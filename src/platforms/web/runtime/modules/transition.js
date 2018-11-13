/* @flow */

import { inBrowser, isIE9, warn } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { activeInstance } from 'core/instance/lifecycle'

import {
    once,
    isDef,
    isUndef,
    isObject,
    toNumber
} from 'shared/util'

import {
    nextFrame,
    resolveTransition,
    whenTransitionEnds,
    addTransitionClass,
    removeTransitionClass
} from '../transition-util'

export function enter(vnode: VNodeWithData, toggleDisplay: ? () => void) {
    const el: any = vnode.elm

    // call leave callback now
    if (isDef(el._leaveCb)) {
        el._leaveCb.cancelled = true
        el._leaveCb()
    }

    // 处理并获取 transition 上的属性。
    const data = resolveTransition(vnode.data.transition)
    if (isUndef(data)) {
        return
    }

    /* istanbul ignore if */
    if (isDef(el._enterCb) || el.nodeType !== 1) {
        return
    }

    const {
        css,
        type,
        enterClass,
        enterToClass,
        enterActiveClass,
        appearClass,
        appearToClass,
        appearActiveClass,
        beforeEnter,
        enter,
        afterEnter,
        enterCancelled,
        beforeAppear,
        appear,
        afterAppear,
        appearCancelled,
        duration
    } = data

    // activeInstance will always be the <transition> component managing this
    // transition. One edge case to check is when the <transition> is placed
    // as the root node of a child component. In that case we need to check
    // <transition>'s parent for appear check.
    let context = activeInstance
    let transitionNode = activeInstance.$vnode
    while (transitionNode && transitionNode.parent) {
        transitionNode = transitionNode.parent
        context = transitionNode.context
    }

    const isAppear = !context._isMounted || !vnode.isRootInsert

    if (isAppear && !appear && appear !== '') {
        return
    }

    // 如果 appear 属性为true, 那么初始化的时候组件 enter的class 就不是 enter-class 属性 而是 appear-class属性
    const startClass = isAppear && appearClass ?
        appearClass :
        enterClass
    
    // 如上处理 appear-active-class 属性
    const activeClass = isAppear && appearActiveClass ?
        appearActiveClass :
        enterActiveClass
    
    // 如上 处理appear-to-class 属性
    const toClass = isAppear && appearToClass ?
        appearToClass :
        enterToClass

    // 获取 before 时期的钩子函数
    const beforeEnterHook = isAppear ?
        (beforeAppear || beforeEnter) :
        beforeEnter
    const enterHook = isAppear ?
        (typeof appear === 'function' ? appear : enter) :
        enter
    const afterEnterHook = isAppear ?
        (afterAppear || afterEnter) :
        afterEnter
    const enterCancelledHook = isAppear ?
        (appearCancelled || enterCancelled) :
        enterCancelled

    // 处理 duration 属性-- 延迟属性
    const explicitEnterDuration: any = toNumber(
        isObject(duration) ?
        duration.enter :
        duration
    )

    if (process.env.NODE_ENV !== 'production' && explicitEnterDuration != null) {
        checkDuration(explicitEnterDuration, 'enter', vnode)
    }

    // 判断是否使用CSS过渡类
    const expectsCSS = css !== false && !isIE9

    const userWantsControl = getHookArgumentsLength(enterHook)


    /*
        定义了我们 enter 钩子函数中的  done的回调方法。
        enter:function(el,done){ done };
        如果执行了 done 那么下一步将会调用 afterEnter 或者 enterCancelled 钩子函数

    */
    const cb = el._enterCb = once(() => {
        if (expectsCSS) {
            removeTransitionClass(el, toClass)
            removeTransitionClass(el, activeClass)
        }
        if (cb.cancelled) {
            if (expectsCSS) {
                removeTransitionClass(el, startClass)
            }
            enterCancelledHook && enterCancelledHook(el)
        } else {
            afterEnterHook && afterEnterHook(el)
        }
        el._enterCb = null
    })

    /*
        在文档中我们知道只有4种情况，可以为组件添加过渡：
        
        1. 条件渲染 (使用 v-if)
        2. 条件展示 (使用 v-show)
        3. 动态组件
        4. 组件根节点

        对于 v-show | 组件根节点 其在 组件加载的时候触发enter钩子，然后隐藏、再显示的时候就不会触发enter钩子函数了

    
    */
    if (!vnode.data.show) {
        // remove pending leave element on enter by injecting an insert hook
        mergeVNodeHook(vnode, 'insert', () => {
            const parent = el.parentNode
            const pendingNode = parent && parent._pending && parent._pending[vnode.key]
            if (pendingNode &&
                pendingNode.tag === vnode.tag &&
                pendingNode.elm._leaveCb
            ) {
                pendingNode.elm._leaveCb()
            }
            enterHook && enterHook(el, cb)
        })
    }

    // 执行 beforeEnter 时期的钩子函数
    // start enter transition
    beforeEnterHook && beforeEnterHook(el)

    // 如果定义了 expectsCss 那么Vue就需要在 过渡期间 在元素添加各时期的class 属性
    if (expectsCSS) {
        // 添加  fade-in-enter class属性
        addTransitionClass(el, startClass)
        // 添加  fade-in-enter-active class属性
        addTransitionClass(el, activeClass)
        
        nextFrame(() => {
            // 移除元素的显示动画属性
            removeTransitionClass(el, startClass)
            // 如果在 enter() 执行 done() 那么就表示动画完成钩子函数
            if (!cb.cancelled) {
                // 添加动画执行完成CSS过渡属性   fade-in-enter-to
                addTransitionClass(el, toClass)

                if (!userWantsControl) {
                    if (isValidDuration(explicitEnterDuration)) {
                        setTimeout(cb, explicitEnterDuration)
                    } else {
                        whenTransitionEnds(el, type, cb)
                    }
                }
            }
        })
    }

    // 如果默认显示  那么这时候直接调用 enter钩子函数
    if (vnode.data.show) {
        toggleDisplay && toggleDisplay()
        // 调用enter钩子函数，，此时注意  el 只能说明组件的elm 已经存在，但是还没有插入DOM树。
        enterHook && enterHook(el, cb)
    }

    if (!expectsCSS && !userWantsControl) {
        cb()
    }
}

export function leave(vnode: VNodeWithData, rm: Function) {
    const el: any = vnode.elm

    // call enter callback now
    if (isDef(el._enterCb)) {
        el._enterCb.cancelled = true
        el._enterCb()
    }

    const data = resolveTransition(vnode.data.transition)
    if (isUndef(data) || el.nodeType !== 1) {
        return rm()
    }

    /* istanbul ignore if */
    if (isDef(el._leaveCb)) {
        return
    }

    const {
        css,
        type,
        leaveClass,
        leaveToClass,
        leaveActiveClass,
        beforeLeave,
        leave,
        afterLeave,
        leaveCancelled,
        delayLeave,
        duration
    } = data

    const expectsCSS = css !== false && !isIE9
    const userWantsControl = getHookArgumentsLength(leave)

    const explicitLeaveDuration: any = toNumber(
        isObject(duration) ?
        duration.leave :
        duration
    )

    if (process.env.NODE_ENV !== 'production' && isDef(explicitLeaveDuration)) {
        checkDuration(explicitLeaveDuration, 'leave', vnode)
    }

    const cb = el._leaveCb = once(() => {
        if (el.parentNode && el.parentNode._pending) {
            el.parentNode._pending[vnode.key] = null
        }
        if (expectsCSS) {
            removeTransitionClass(el, leaveToClass)
            removeTransitionClass(el, leaveActiveClass)
        }
        if (cb.cancelled) {
            if (expectsCSS) {
                removeTransitionClass(el, leaveClass)
            }
            leaveCancelled && leaveCancelled(el)
        } else {
            rm()
            afterLeave && afterLeave(el)
        }
        el._leaveCb = null
    })

    if (delayLeave) {
        delayLeave(performLeave)
    } else {
        performLeave()
    }

    function performLeave() {
        // the delayed leave may have already been cancelled
        if (cb.cancelled) {
            return
        }
        // record leaving element
        if (!vnode.data.show) {
            (el.parentNode._pending || (el.parentNode._pending = {}))[(vnode.key: any)] = vnode
        }
        beforeLeave && beforeLeave(el)
        if (expectsCSS) {
            addTransitionClass(el, leaveClass)
            addTransitionClass(el, leaveActiveClass)
            nextFrame(() => {
                removeTransitionClass(el, leaveClass)
                if (!cb.cancelled) {
                    addTransitionClass(el, leaveToClass)
                    if (!userWantsControl) {
                        if (isValidDuration(explicitLeaveDuration)) {
                            setTimeout(cb, explicitLeaveDuration)
                        } else {
                            whenTransitionEnds(el, type, cb)
                        }
                    }
                }
            })
        }
        leave && leave(el, cb)
        if (!expectsCSS && !userWantsControl) {
            cb()
        }
    }
}

// only used in dev mode
function checkDuration(val, name, vnode) {
    if (typeof val !== 'number') {
        warn(
            `<transition> explicit ${name} duration is not a valid number - ` +
            `got ${JSON.stringify(val)}.`,
            vnode.context
        )
    } else if (isNaN(val)) {
        warn(
            `<transition> explicit ${name} duration is NaN - ` +
            'the duration expression might be incorrect.',
            vnode.context
        )
    }
}

function isValidDuration(val) {
    return typeof val === 'number' && !isNaN(val)
}

/**
 * Normalize a transition hook's argument length. The hook may be:
 * - a merged hook (invoker) with the original in .fns
 * - a wrapped component method (check ._length)
 * - a plain function (.length)
 */

/**
 * 规范化转换钩子的参数长度
 * @author guzhanghua
 * @param {Function} fn
 * @returns {boolean}
 */
function getHookArgumentsLength(fn: Function): boolean {
    if (isUndef(fn)) {
        return false
    }
    const invokerFns = fn.fns
    if (isDef(invokerFns)) {
        // invoker
        return getHookArgumentsLength(
            Array.isArray(invokerFns) ?
            invokerFns[0] :
            invokerFns
        )
    } else {
        return (fn._length || fn.length) > 1
    }
}

function _enter(_: any, vnode: VNodeWithData) {
    if (vnode.data.show !== true) {
        enter(vnode)
    }
}

export default inBrowser ? {
    create: _enter,
    activate: _enter,
    remove(vnode: VNode, rm: Function) {
        /* istanbul ignore else */
        if (vnode.data.show !== true) {
            leave(vnode, rm)
        } else {
            rm()
        }
    }
} : {}