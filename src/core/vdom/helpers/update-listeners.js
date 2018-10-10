/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef, isPlainObject } from 'shared/util'



/**
    处理事件的名称，如 "!click"  "~&click" ，将其转换成修饰符对象
    {
        name : "click",
        once: true,
        capture : false,
        passive : true
    }
 */
const normalizeEvent = cached((name: string): {
    name: string,
    once: boolean,
    capture: boolean,
    passive: boolean,
    handler ? : Function,
    params ? : Array < any >
} => {
    // 是否存在 & ，如果存在那么就是存在passive修饰符
    const passive = name.charAt(0) === '&'
    name = passive ? name.slice(1) : name
    // 是否存在 ~ ，如果存在那么就是存在once修饰符
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = once ? name.slice(1) : name
    // 是否存在 ! ，如果存在那么就是存在capture修饰符
    const capture = name.charAt(0) === '!'
    name = capture ? name.slice(1) : name
    return {
        name,
        once,
        capture,
        passive
    }
})


/**
 * 创建一个回调者
 * 
 *  function invoker
 *  有一个静态属性 fns 保存了回调时所有的回调方法数组。
 *  返回回调者构造函数 其执行时的入参为每一个fns中回调的入参。 
 *  
 *  使用方法 
 *    invoker = createFnInvoker([cb1,cb2]);
 *    invoker.fns = [ cb,... ] 存放所有的回调方法
 *    invoker(arg1,arg2,arg3...)
 *    
 * @param {*} fns  
 */
export function createFnInvoker(fns: Function | Array < Function > ): Function {
    function invoker() {
        const fns = invoker.fns
        if (Array.isArray(fns)) {
            const cloned = fns.slice()
            for (let i = 0; i < cloned.length; i++) {
                cloned[i].apply(null, arguments)
            }
        } else {
            // return handler return value for single handlers
            return fns.apply(null, arguments)
        }
    }

    // 将回调的 方法存放在 Invoker 构造函数的静态属性fns上
    invoker.fns = fns
    return invoker
}


/**
 * 处理 vnode上事件 在create 和 update期间处理方法
 * @author guzhanghua
 * @export
 * @param {Object} on
 * @param {Object} oldOn
 * @param {Function} add
 * @param {Function} remove
 * @param {Component} vm
 */
export function updateListeners(
    on: Object,
    oldOn: Object,
    add: Function,
    remove: Function,
    vm: Component
) {
    let name, def, cur, old, event
    for (name in on) {
        // 获取 新的vnode 上的事件属性
        def = cur = on[name]
        // 更新，或者卸载的时候旧的的事件
        old = oldOn[name]
        // 处理事件的名称，我们在 编译阶段 ，对事件的修饰符如capture:在事件名称前加! 变成 '!click',还有 once 、 passive
        event = normalizeEvent(name)
            /* istanbul ignore if */
        if (__WEEX__ && isPlainObject(def)) {
            cur = def.handler
            event.params = def.params
        }
        // 新的vnode上不存在事件的名称，错误情况
        if (isUndef(cur)) {
            process.env.NODE_ENV !== 'production' && warn(
                `Invalid handler for event "${event.name}": got ` + String(cur),
                vm
            )
        // 如果没有旧的 相同的事件，那么就是create 或者 更新的时候 新添加了此事件
        } else if (isUndef(old)) {
            // Vue中对事件的处理绑定的是一个Invoker回调函数，其静态属性fns中保存了所有的回调方法
            if (isUndef(cur.fns)) {
                cur = on[name] = createFnInvoker(cur)
            }
            // 添加 一个事件方法
            add(event.name, cur, event.once, event.capture, event.passive, event.params)
        } else if (cur !== old) {
            //  在 update 的时候，如果内容更新了，那么就直接将回调函数 赋给就的回调invoker的fns 
            old.fns = cur
            on[name] = old
        }
    }
    // 处理 旧vnode 的事件
    for (name in oldOn) {
        // 旧vnode中存在 而新vnode不存在 那就是remove 移除事件
        if (isUndef(on[name])) {
            event = normalizeEvent(name)
            // 移除事件
            remove(event.name, oldOn[name], event.capture)
        }
    }
}