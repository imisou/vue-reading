/* @flow */

import {
    warn,
    nextTick,
    emptyObject,
    handleError,
    defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

export function initRender(vm: Component) {
    vm._vnode = null // the root of the child tree
    vm._staticTrees = null // v-once cached trees
    const options = vm.$options
    const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree
    const renderContext = parentVnode && parentVnode.context

    // 处理占位符节点下的插槽
    vm.$slots = resolveSlots(options._renderChildren, renderContext)
    // 初始化 作用域插槽 vm.$slot = {}
    vm.$scopedSlots = emptyObject
    // bind the createElement fn to this instance
    // so that we get proper render context inside it.
    // args order: tag, data, children, normalizationType, alwaysNormalize
    // internal version is used by render functions compiled from templates
    // 模板编译后render函数调用的
    vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
    // normalization is always applied for the public version, used in
    // user-written render functions.
    // 用户自定义的render函数调用的createElement
    vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

    // $attrs & $listeners are exposed for easier HOC creation.
    // they need to be reactive so that HOCs using them are always updated
    const parentData = parentVnode && parentVnode.data

    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
        }, true)
        defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
            !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
        }, true)
    } else {
        defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
        defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
    }
}

export function renderMixin(Vue: Class < Component > ) {
    // install runtime convenience helpers
    // 主要用安装运行时，编译后组件 依赖的一些方法 
    /*
        with(this){_c('div',{},[_e()])}
     */
    installRenderHelpers(Vue.prototype)

    Vue.prototype.$nextTick = function(fn: Function) {
        return nextTick(fn, this)
    }

/**
 * 作用  就是 执行组件上定义的 render函数  生成 一个vnode
 * @return {vnode} [组件vnode]
 */
Vue.prototype._render = function(): VNode {
    // 第一次 vm = new Vue()
    const vm: Component = this
    
    // render 用户自定义 或者webpack编译 options生成的render函数
    // _parentVnode ？？？？？
    const { render, _parentVnode } = vm.$options
    // reset _rendered flag on slots for duplicate slot check
    if (process.env.NODE_ENV !== 'production') {
        for (const key in vm.$slots) {
            // $flow-disable-line
            vm.$slots[key]._rendered = false
        }
    }
    
    if (_parentVnode) {
        vm.$scopedSlots = _parentVnode.data.scopedSlots || emptyObject
    }
    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode
    // render self
    let vnode
    try {
        // 调用 组件定义的render函数
        vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
        handleError(e, vm, `render`)
        // return error render result,
        // or previous vnode to prevent render error causing blank component
        /* istanbul ignore else */
        if (process.env.NODE_ENV !== 'production') {
            if (vm.$options.renderError) {
                try {
                    vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
                } catch (e) {
                    handleError(e, vm, `renderError`)
                    vnode = vm._vnode
                }
            } else {
                vnode = vm._vnode
            }
        } else {
            vnode = vm._vnode
        }
    }
    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
        if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
            warn(
                'Multiple root nodes returned from render function. Render function ' +
                'should return a single root node.',
                vm
            )
        }
        vnode = createEmptyVNode()
    }
    // set parent
    vnode.parent = _parentVnode
 
    return vnode
}
}