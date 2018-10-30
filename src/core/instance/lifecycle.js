/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
    warn,
    noop,
    remove,
    handleError,
    emptyObject,
    validateProp
} from '../util/index'

//  保存了当前处理的组件的实例对象，当 组件在patch的时候 如果createComponent判断是组件vnode
//  那么执行 vnode.data.hook.init 的时候 activeInstance 作为parent传给子组件的options
export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false


export function initLifecycle(vm: Component) {
    const options = vm.$options

    // locate first non-abstract parent
    // 保存的父组件的 实例对象
    let parent = options.parent
    if (parent && !options.abstract) {
        while (parent.$options.abstract && parent.$parent) {
            parent = parent.$parent
        }
        // 第一步 Vue.$children add App
        // 将 此组件存入父vm的 $children中
        parent.$children.push(vm)
    }
    // 定义实例属性$parent
    vm.$parent = parent
        // 定义实例属性 $root 根组件
    vm.$root = parent ? parent.$root : vm
        // 初始化 其子组件
    vm.$children = []
        // 初始化组件的索引对象
    vm.$refs = {}

    // 组件状态初始化
    vm._watcher = null
    vm._inactive = null
    vm._directInactive = false
    vm._isMounted = false
    vm._isDestroyed = false
    vm._isBeingDestroyed = false
}

export function lifecycleMixin(Vue: Class < Component > ) {
    /*
        可见 _update()方法触发的时机有两种。
        1、 当组件初始化渲染的时候 此时组件从AST -> VNode 但是没有生成DOM元素 此时触发_update 进行 VNode -> DOM的过程
        2、 当组件发生更新的时候  此时响应式数据触发 set方法 然后 dep.notify() 去通知渲染Watcher进行重新getter方法
        此时也会触发 _update() 方法
     */
    Vue.prototype._update = function(vnode: VNode, hydrating ? : boolean) {
        const vm: Component = this;
        // 保存组件 原来的dom
        const prevEl = vm.$el;
        // 保存原来的 组件vnode
        // 对于更新的情况  因为组件已经生成过 所以触发了 vm._vnode = vnode 所以此时prevVnode 不会空
        const prevVnode = vm._vnode;
        // activeInstance是相当于全局属性，用来保存当前正在处理的组件vm，而此时进行 _update() 所以需要保存原来正在处理的vm，
        // 保存原来处理的组件
        const prevActiveInstance = activeInstance;
        // 赋值activeInstance 保存当前正在处理的组件vm
        activeInstance = vm;
        // 是的组件上的_vnode 等于 组件vnode
        // 保存当前js -> vnode后新的vnode
        vm._vnode = vnode;
        // Vue.prototype.__patch__ is injected in entry points
        // based on the rendering backend used.
        // 当组件 第一次创建的时候
        if (!prevVnode) {
            // initial render
            vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */ );
        } else {
            // 当组件更新的时候触发 preVnode 为旧的组件VNode vnode为新render生成的VNode
            // updates
            vm.$el = vm.__patch__(prevVnode, vnode)
        }
        activeInstance = prevActiveInstance;
        // update __vue__ reference
        if (prevEl) {
            prevEl.__vue__ = null
        }
        if (vm.$el) {
            vm.$el.__vue__ = vm
        }
        // if parent is an HOC, update its $el as well
        if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
            vm.$parent.$el = vm.$el
        }
        // updated hook is called by the scheduler to ensure that children are
        // updated in a parent's updated hook.
    }

    Vue.prototype.$forceUpdate = function() {
        const vm: Component = this
        if (vm._watcher) {
            vm._watcher.update()
        }
    }

    /*
        组件卸载实例方法。在组件卸载钩子函数 data.hook.destory中也是调用此 方法去卸载组件
    */
    Vue.prototype.$destroy = function() {
        const vm: Component = this

        // 如果组件在卸载那么此时就return
        if (vm._isBeingDestroyed) {
            return
        }
        // 调用组件 beforeDestory 的生命周期函数
        callHook(vm, 'beforeDestroy')
        vm._isBeingDestroyed = true;

        // remove self from parent
        const parent = vm.$parent
        if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
            remove(parent.$children, vm)
        }
        // teardown watchers
        if (vm._watcher) {
            vm._watcher.teardown()
        }
        let i = vm._watchers.length
        while (i--) {
            vm._watchers[i].teardown()
        }
        // remove reference from data ob
        // frozen object may not have observer.
        if (vm._data.__ob__) {
            vm._data.__ob__.vmCount--
        }
        // call the last hook...
        vm._isDestroyed = true
            // invoke destroy hooks on current rendered tree
        vm.__patch__(vm._vnode, null)
            // fire destroyed hook
        callHook(vm, 'destroyed')
            // turn off all instance listeners.
        vm.$off()
            // remove __vue__ reference
        if (vm.$el) {
            vm.$el.__vue__ = null
        }
        // release circular reference (#6759)
        if (vm.$vnode) {
            vm.$vnode.parent = null
        }
    }
}


/**
 * 编译运行
 * 每一个组件 调用$mount后具体执行编译组件方法
 *
 * 触发 beforeMount钩子
 * 声明 new Watcher()
 * 定义updateComponent方法
 */
export function mountComponent(
    vm: Component,
    el: ? Element,
    hydrating ? : boolean
): Component {
    vm.$el = el

    // 判断此时是否存在render 函数，
    // Vue中不管是通过el,template,render() 3种方式中的一种去获取模板的 都在最后将其转换成render函数，
    if (!vm.$options.render) {
        vm.$options.render = createEmptyVNode
        if (process.env.NODE_ENV !== 'production') {
            /* istanbul ignore if */
            // 如果 使用的是runtime-only版本vue的时候 
            if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
                vm.$options.el || el) {
                warn(
                    'You are using the runtime-only build of Vue where the template ' +
                    'compiler is not available. Either pre-compile the templates into ' +
                    'render functions, or use the compiler-included build.',
                    vm
                )
            } else {
                warn(
                    'Failed to mount component: template or render function not defined.',
                    vm
                )
            }
        }
    }
    // 触发钩子函数 看生命周期  之前 Compile template into render function or Compile el's outerHTML as template
    callHook(vm, 'beforeMount')

    let updateComponent
        /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        updateComponent = () => {
            const name = vm._name
            const id = vm._uid
            const startTag = `vue-perf-start:${id}`
            const endTag = `vue-perf-end:${id}`

            mark(startTag)
            const vnode = vm._render()
            mark(endTag)
            measure(`vue ${name} render`, startTag, endTag)

            mark(startTag)
            vm._update(vnode, hydrating)
            mark(endTag)
            measure(`vue ${name} patch`, startTag, endTag)
        }
    } else {
        // 创建一个更新组件方法
        updateComponent = () => {
            vm._update(vm._render(), hydrating)
        }
    }

    // we set this to vm._watcher inside the watcher's constructor
    // since the watcher's initial patch may call $forceUpdate (e.g. inside child
    // component's mounted hook), which relies on vm._watcher being already defined
    // 渲染Wathcer 观察者模式
    new Watcher(vm, updateComponent, noop, {
        // 在我们的更新队列中 其更新方法 是sort排列 使得 子组件在父组件之后更新
        // 先调用before 然后调用 watcher.run()方法 
        before() {
            if (vm._isMounted) {
                callHook(vm, 'beforeUpdate')
            }
        }
    }, true /* isRenderWatcher */ )
    hydrating = false

    // manually mounted instance, call mounted on self
    // mounted is called for render-created child components in its inserted hook
    if (vm.$vnode == null) {
        vm._isMounted = true
        callHook(vm, 'mounted')
    }
    return vm
}


/**
 * 当我们调用父组件数据更新，而子组件通过porpsData订阅了父组件的数据的时候 就是通过此方法去更新子组件
 * @param vm
 * @param propsData
 * @param listeners
 * @param parentVnode
 * @param renderChildren
 */
export function updateChildComponent(
    vm: Component, // 子组件的vm实例
    propsData: ? Object,
    listeners : ? Object,
    parentVnode : MountedComponentVNode,
    renderChildren: ? Array < VNode >
) {
    if (process.env.NODE_ENV !== 'production') {
        isUpdatingChildComponent = true
    }

    // determine whether component has slot children
    // we need to do this before overwriting $options._renderChildren
    const hasChildren = !!(
        renderChildren || // has new static slots
        vm.$options._renderChildren || // has old static slots
        parentVnode.data.scopedSlots || // has new scoped slots
        vm.$scopedSlots !== emptyObject // has old scoped slots
    )

    vm.$options._parentVnode = parentVnode
    vm.$vnode = parentVnode // update vm's placeholder node without re-render

    if (vm._vnode) { // update child tree's parent
        vm._vnode.parent = parentVnode
    }
    vm.$options._renderChildren = renderChildren

    // update $attrs and $listeners hash
    // these are also reactive so they may trigger child update if the child
    // used them during render
    vm.$attrs = parentVnode.data.attrs || emptyObject
    vm.$listeners = listeners || emptyObject

    // update props
    if (propsData && vm.$options.props) {
        toggleObserving(false)
        const props = vm._props
        const propKeys = vm.$options._propKeys || []
        for (let i = 0; i < propKeys.length; i++) {
            const key = propKeys[i]
            const propOptions: any = vm.$options.props // wtf flow?
                // 重新赋值 props 这个就会触发响应式数据的 set方法 从而通知订阅的Watcher进行更新
            props[key] = validateProp(key, propOptions, propsData, vm)
        }
        toggleObserving(true)
            // keep a copy of raw propsData
        vm.$options.propsData = propsData
    }

    // update listeners
    listeners = listeners || emptyObject
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)

    // resolve slots + force update if has children
    if (hasChildren) {
        vm.$slots = resolveSlots(renderChildren, parentVnode.context)
        vm.$forceUpdate()
    }

    if (process.env.NODE_ENV !== 'production') {
        isUpdatingChildComponent = false
    }
}

function isInInactiveTree(vm) {
    while (vm && (vm = vm.$parent)) {
        if (vm._inactive) return true
    }
    return false
}

export function activateChildComponent(vm: Component, direct ? : boolean) {
    if (direct) {
        vm._directInactive = false
        if (isInInactiveTree(vm)) {
            return
        }
    } else if (vm._directInactive) {
        return
    }
    if (vm._inactive || vm._inactive === null) {
        vm._inactive = false
        for (let i = 0; i < vm.$children.length; i++) {
            activateChildComponent(vm.$children[i])
        }
        callHook(vm, 'activated')
    }
}

export function deactivateChildComponent(vm: Component, direct ? : boolean) {
    if (direct) {
        vm._directInactive = true
        if (isInInactiveTree(vm)) {
            return
        }
    }
    if (!vm._inactive) {
        vm._inactive = true
        for (let i = 0; i < vm.$children.length; i++) {
            deactivateChildComponent(vm.$children[i])
        }
        callHook(vm, 'deactivated')
    }
}

// 回调钩子函数
export function callHook(vm: Component, hook: string) {
    // #7573 disable dep collection when invoking lifecycle hooks
    pushTarget()
        // 获取入参中是否定义了钩子回调函数
    const handlers = vm.$options[hook]
        // 定义了钩子
    if (handlers) {
        for (let i = 0, j = handlers.length; i < j; i++) {
            try {
                handlers[i].call(vm)
            } catch (e) {
                handleError(e, vm, `${hook} hook`)
            }
        }
    }
    if (vm._hasHookEvent) {
        vm.$emit('hook:' + hook)
    }
    popTarget()
}