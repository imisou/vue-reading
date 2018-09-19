/* @flow */

import VNode, { cloneVNode } from './vnode'
import { createElement } from './create-element'
import { resolveInject } from '../instance/inject'
import { normalizeChildren } from '../vdom/helpers/normalize-children'
import { resolveSlots } from '../instance/render-helpers/resolve-slots'
import { installRenderHelpers } from '../instance/render-helpers/index'

import {
    isDef,
    isTrue,
    hasOwn,
    camelize,
    emptyObject,
    validateProp
} from '../util/index'



/*
  在Vue 我们一方面可以创建 组件，此时 组件拥有生命周期、实例对象vm(this)。
  那么我们也可以创建一个函数式组件 funtional组件，其跟react的无状态组件相同。

  Vue.component('function-component',{
      name : 'function-component',
      functional : true ,
      props:{},
      data(){return {}},
      render(h,context){
        return h()
      },
      inject:[]
  })
  因为函数式组件是一个无状态的组件，所以其没有 vm(this)实例，所以 methods属性、生命周期属性都没有用。

  重点 ：
    1、  没有vm(即this)实例。
    2、  所有数据的修改都是通过parent的 props 或者inject 传递。
    3、  render 函数与组件render不同
      组件 render(h){ } 可以通过this.xx  去访问响应式数据、methods等
      函数式组件没有this  所以其 render(h,context) 中的 context 去传递 props、data数据

  源码上的重点：
    对于一般的组件  我们的流程是什么？
    先初始化根组件，然后执行render 将 AST -> VNode 
      如果遇到占位符VNode，调用createComponent() 并执行 installComponentHooks(data) 
      在vnode.data.hook上保存占位符VNode的一些 `占位符vnode生命周期` 的钩子函数 ，
      然后在 update() 的时候将 vnode -> dom 
      此时所有的元素都转换成vnode 那么如何区分元素vnode 和组件vnode
      一方面通过 tag 如果 tag是基本的元素类型 还有就是 data.hook对象
      
      而此时我们的函数式组件 其也是一个组件，也调用了createComponent()创建组件的方法。
      但是其没有走完 没有执行 installComponentHooks(data) 所以其没有 data.hook的钩子函数 所以其不是正在的组件的占位符vnode。

    2. render.call()方法的调用时间。
      基本组件： 其是父组件 初始化 ... ，然后执行 vm.$mount() 方法， 然后在 new Watcher()的getter方法 vm._update(vm._render(), hydrating)执行组件的render回调方法。
      然后 生成vnode 的时候，当遇到组件vnode 的时候只是编译成占位符vnode 然后定义 初始化构造函数 不会指向子组件的render方法。
      而是在 vnode -> DOM 的时候遇到其是占位符vnode 且有hook 那么new Ctor实例 然后子组件的 $mount..然后循环上面的过程。

      对于函数式组件
      当父组件 vm._update(vm._render(), hydrating) 生成vnode 的时候 ，遇到函数式组件  其也指向createComponent方法，但是 其执行执行createFunctionalComponent() 在期间调用render()方法,
      直接将函数组件转换成vnode 然后 替换占位符vnode, 不是 在父组件vnode -> dom的时候遇到在转成vnode。

    3. 那么对于函数式组件vnode 其render完成后 没有占位符vnode的概念。 在父组件 vnode -> DOM 的时候 其也就是一个不同的元素vnode 
       那如何在更新的时候区分这是一个函数式组件vnode?
       cloneAndMarkFunctionalResult() 就是解决这个的。


 */

/**
 *  创建函数式组件的 render方法的 context 与 createElement方法。
 *  如上面第3点，函数式组件没有this 那么访问props、data...等的数据如何获取 就是通过第二个参数context，其就像vm
 * @param {*} data 
 * @param {*} props 
 * @param {*} children 
 * @param {*} parent 
 * @param {*} Ctor 
 */
export function FunctionalRenderContext(
    data: VNodeData,
    props: Object,
    children: ? Array < VNode > ,
    parent : Component,
    Ctor: Class < Component >
) {
    const options = Ctor.options
    // ensure the createElement function in functional components
    // gets a unique context - this is necessary for correct named slot check
    // 确保函数式组件中 createElement 方法 拥有一个唯一的上下文，这对于命名插槽是必须的
    //  render(createElement,conetxt) 先申明一个context
    let contextVm
    // 判断此组件的父组件  是不是一个实例组件(不是函数式组件)
    if (hasOwn(parent, '_uid')) {
        contextVm = Object.create(parent)
        // $flow-disable-line
        contextVm._original = parent
    } else {
        // the context vm passed in is a functional context as well.
        // in this case we want to make sure we are able to get a hold to the
        // real context instance.
        contextVm = parent
            // $flow-disable-line
        parent = parent._original
    }
    const isCompiled = isTrue(options._compiled)
    const needNormalization = !isCompiled

    this.data = data
    this.props = props
    this.children = children
    this.parent = parent
    this.listeners = data.on || emptyObject
    this.injections = resolveInject(options.inject, parent)
    this.slots = () => resolveSlots(children, parent)

    // support for compiled functional template
    if (isCompiled) {
        // exposing $options for renderStatic()
        this.$options = options
            // pre-resolve slots for renderSlot()
        this.$slots = this.slots()
        this.$scopedSlots = data.scopedSlots || emptyObject
    }

    if (options._scopeId) {
        this._c = (a, b, c, d) => {
            const vnode = createElement(contextVm, a, b, c, d, needNormalization)
            if (vnode && !Array.isArray(vnode)) {
                vnode.fnScopeId = options._scopeId
                vnode.fnContext = parent
            }
            return vnode
        }
    } else {
        this._c = (a, b, c, d) => createElement(contextVm, a, b, c, d, needNormalization)
    }
}

installRenderHelpers(FunctionalRenderContext.prototype)


/**
 * 函数式组件的创建方式
 * @param {*} Ctor            组件的构造函数
 * @param {*} propsData       父组件与子组件props 解析后 子组件 获取的props数据
 * @param {*} data            vnode.componentOptions.data数据
 * @param {*} contextVm       当前组件的vm  对于Ctor的实例组件  此为parentVM
 * @param {*} children        组件的 插槽内容children
 */
export function createFunctionalComponent(
    Ctor: Class < Component > ,
    propsData: ? Object,
    data : VNodeData,
    contextVm: Component,
    children: ? Array < VNode >
): VNode | Array < VNode > | void {
    const options = Ctor.options

    // 处理props
    const props = {}
    const propOptions = options.props
    if (isDef(propOptions)) {
        for (const key in propOptions) {
            props[key] = validateProp(key, propOptions, propsData || emptyObject)
        }
    } else {
        if (isDef(data.attrs)) mergeProps(props, data.attrs)
        if (isDef(data.props)) mergeProps(props, data.props)
    }

    // 生成 render 的 renderContext 即 context
    const renderContext = new FunctionalRenderContext(
        data,
        props,
        children,
        contextVm,
        Ctor
    )
    // 在父组件 render的时候  就直接执行 函数式组件的render()   
    const vnode = options.render.call(null, renderContext._c, renderContext)

    if (vnode instanceof VNode) {
        return cloneAndMarkFunctionalResult(vnode, data, renderContext.parent, options)
    } else if (Array.isArray(vnode)) {
        const vnodes = normalizeChildren(vnode) || []
        const res = new Array(vnodes.length)
        for (let i = 0; i < vnodes.length; i++) {
            res[i] = cloneAndMarkFunctionalResult(vnodes[i], data, renderContext.parent, options)
        }
        return res
    }
}

function cloneAndMarkFunctionalResult(vnode, data, contextVm, options) {
    // #7817 clone node before setting fnContext, otherwise if the node is reused
    // (e.g. it was from a cached normal slot) the fnContext causes named slots
    // that should not be matched to match.
    const clone = cloneVNode(vnode)
    clone.fnContext = contextVm
    clone.fnOptions = options
    if (data.slot) {
        (clone.data || (clone.data = {})).slot = data.slot
    }
    return clone
}

function mergeProps(to, from) {
    for (const key in from) {
        to[camelize(key)] = from[key]
    }
}