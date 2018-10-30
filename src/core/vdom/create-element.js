/* @flow */

import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'

import {
    warn,
    isDef,
    isUndef,
    isTrue,
    isObject,
    isPrimitive,
    resolveAsset
} from '../util/index'

import {
    normalizeChildren,
    simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
// 
// 如在 render(h){
//  return h('div',{
//    class:{'foo': this.isFoo }
//  },[
//     h(App)   // 子元素或者组件
//  ])}
//  如上面我们createElement() 通过函数柯里化  在 render.js initRender() 中  返回
//  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
//  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
export function createElement(
    context: Component,         // 当前vm
    tag: any,                   // 元素标签或者组件
    data: any,                  // 一个包含模板相关属性的数据对象
    children: any,              // 子元素
    normalizationType: any,     // 
    alwaysNormalize: boolean    //
): VNode | Array < VNode > {
    // 处理 render 函数中 data 属性
    if (Array.isArray(data) || isPrimitive(data)) {
        normalizationType = children
        children = data
        data = undefined
    }
    if (isTrue(alwaysNormalize)) {
        normalizationType = ALWAYS_NORMALIZE
    }
    return _createElement(context, tag, data, children, normalizationType)
}

/**
 * 真正将我们 h('div')  转换成vNode
 * @param  {[type]} context:      组件实例对象
 * @param  {[type]} tag           节点类型
 * @param  {[type]} data          data
 * @param  {[type]} children        
 * @param  {[type]} normalizationType ?             :             number    [description]
 * @return {[type]}                   [description]
 */
export function _createElement(
    context: Component,
    tag ? : string | Class < Component > | Function | Object,
    data ? : VNodeData,
    children ? : any,
    normalizationType ? : number
): VNode | Array < VNode > {
    // 判断组件上是否已经绑定响应式对象
    if (isDef(data) && isDef((data: any).__ob__)) {
        process.env.NODE_ENV !== 'production' && warn(
            `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
            'Always create fresh vnode data objects in each render!',
            context
        )
        return createEmptyVNode()
    }
    // object syntax in v-bind
    if (isDef(data) && isDef(data.is)) {
        tag = data.is
    }
    // 如果没有 节点名称 则 为 文本节点  
    if (!tag) {
        // in case of component :is set to falsy value
        return createEmptyVNode()
    }
    // warn against non-primitive key
    if (process.env.NODE_ENV !== 'production' &&
        isDef(data) && isDef(data.key) && !isPrimitive(data.key)
    ) {
        if (!__WEEX__ || !('@binding' in data.key)) {
            warn(
                'Avoid using non-primitive value as key, ' +
                'use string/number value instead.',
                context
            )
        }
    }
    // support single function children as default scoped slot
    if (Array.isArray(children) &&
        typeof children[0] === 'function'
    ) {
        data = data || {}
        data.scopedSlots = { default: children[0] }
        children.length = 0
    }
    if (normalizationType === ALWAYS_NORMALIZE) {
        children = normalizeChildren(children)
    } else if (normalizationType === SIMPLE_NORMALIZE) {
        children = simpleNormalizeChildren(children)
    }
    let vnode, ns
    // 处理 createElment('div') 
    // 对于我们 编译将js函数 转成 vnode 。
    // 我们可以根据  第一个 参数   
    // 如果   tag 是 一个函数  那么 他就是一个子组件类型的节点  调用createComponent()
    // 如果 tag是一个字符串
    //      1. 判断其是否是 系统内置的 元素  是 直接 new VNode() 转成 vnode
    //      2. 如果 判断 字符串 在 components属性上定义过  那么 他也是一个子组件类型的节点  调用createComponent()
    //      3. 如果 都不是  那么直接 作为一个元素节点  直接 new VNode() 转成 vnode
    if (typeof tag === 'string') {
        let Ctor
        ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
        // 如果是 系统内置的元素类型 的节点  那么直接将元素装换成 vnode对象
        if (config.isReservedTag(tag)) {
            // platform built-in elements
            vnode = new VNode(
                config.parsePlatformTagName(tag), data, children,
                undefined, undefined, context
            )
            
            // 如果不是内置元素节点  但是 跟 组件名称匹配 就调用创建组件方法
            //   h('el-button',{},[])
            //   获取 子组件 是否在 components：{} 属性中定义其依赖
        } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
            // component
            vnode = createComponent(Ctor, data, context, children, tag)
        } else {
            // unknown or unlisted namespaced elements
            // check at runtime because it may get assigned a namespace when its
            // parent normalizes children
            // 否则 直接当做 元素节点
            vnode = new VNode(
                tag, data, children,
                undefined, undefined, context
            )
        }
    } else {
        // 处理  h(App) 这种创建为组件的元素
        // direct component options / constructor
        vnode = createComponent(tag, data, context, children)
    }



    if (Array.isArray(vnode)) {
        return vnode
    } else if (isDef(vnode)) {
        if (isDef(ns)) applyNS(vnode, ns)
        if (isDef(data)) registerDeepBindings(data)
        return vnode
    } else {
        return createEmptyVNode()
    }
}

function applyNS(vnode, ns, force) {
    vnode.ns = ns
    if (vnode.tag === 'foreignObject') {
        // use default namespace inside foreignObject
        ns = undefined
        force = true
    }
    if (isDef(vnode.children)) {
        for (let i = 0, l = vnode.children.length; i < l; i++) {
            const child = vnode.children[i]
            if (isDef(child.tag) && (
                    isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
                applyNS(child, ns, force)
            }
        }
    }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings(data) {
    if (isObject(data.style)) {
        traverse(data.style)
    }
    if (isObject(data.class)) {
        traverse(data.class)
    }
}