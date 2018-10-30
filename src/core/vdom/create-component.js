/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
    warn,
    isDef,
    isUndef,
    isTrue,
    isObject
} from '../util/index'

import {
    resolveAsyncComponent,
    createAsyncPlaceholder,
    extractPropsFromVNodeData
} from './helpers/index'

import {
    callHook,
    activeInstance,
    updateChildComponent,
    activateChildComponent,
    deactivateChildComponent
} from '../instance/lifecycle'

import {
    isRecyclableComponent,
    renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'


// inline hooks to be invoked on component VNodes during patch
// 在组件patch期间 调用的钩子函数
const componentVNodeHooks = {
    init(vnode: VNodeWithData, hydrating: boolean): ? boolean {
        if (
            vnode.componentInstance &&
            !vnode.componentInstance._isDestroyed &&
            vnode.data.keepAlive
        ) {
            // kept-alive components, treat as a patch
            const mountedNode: any = vnode // work around flow
            componentVNodeHooks.prepatch(mountedNode, mountedNode)
        } else {
            // 执行子组件的初始化 _init 过程，但是这时候 $mount 没有执行
            const child = vnode.componentInstance = createComponentInstanceForVnode(
                vnode,
                activeInstance // 当前正在处理的组件 对于 组件vnode中的组件 activeInstance 都是其父组件
            )

            // 调用子组件的 $mount()方法
            child.$mount(hydrating ? vnode.elm : undefined, hydrating)
        }
    },
    // TODO: 待了解
    prepatch(oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
        const options = vnode.componentOptions
        const child = vnode.componentInstance = oldVnode.componentInstance
        updateChildComponent(
            child, // 旧的组件的实例对象vm
            options.propsData, // updated props     // 新的vnode 的 propsData数据
            options.listeners, // updated listeners
            vnode, // new parent vnode              // 新的vnode
            options.children // new children
        )
    },

    /**
     * 当组件 从vnode -> 真实的DOM 并且插入到 DOM上的时候  
     * 回调 mounted()  钩子函数
     */
    insert(vnode: MountedComponentVNode) {
        const { context, componentInstance } = vnode
        if (!componentInstance._isMounted) {
            componentInstance._isMounted = true
            callHook(componentInstance, 'mounted')
        }
        if (vnode.data.keepAlive) {
            if (context._isMounted) {
                // vue-router#1212
                // During updates, a kept-alive component's child components may
                // change, so directly walking the tree here may call activated hooks
                // on incorrect children. Instead we push them into a queue which will
                // be processed after the whole patch process ended.
                queueActivatedComponent(componentInstance)
            } else {
                activateChildComponent(componentInstance, true /* direct */ )
            }
        }
    },

    /**
     * 组件卸载时调用的钩子函数
     * @param {MountedComponentVNode} vnode
     */
    destroy(vnode: MountedComponentVNode) {
        const { componentInstance } = vnode
        if (!componentInstance._isDestroyed) {
            if (!vnode.data.keepAlive) {
                componentInstance.$destroy()
            } else {
                deactivateChildComponent(componentInstance, true /* direct */ )
            }
        }
    }
}

// 返回了一个定义的hook数组
const hooksToMerge = Object.keys(componentVNodeHooks)



/**
 * 处理 创建的子元素为组件的情况
 *    如 h(App)
 *    h('el-button',{
 *        'class': {
            foo: true,
            bar: false
          },
          // 和`v-bind:style`一样的 API
          // 接收一个字符串、对象或对象组成的数组
          style: {
            color: 'red',
            fontSize: '14px'
          },
          // 正常的 HTML 特性
          attrs: {
            id: 'foo'
          },
          // 组件 props
          props: {
            myProp: 'bar'
          },
          // DOM 属性
          domProps: {
            innerHTML: 'baz'
          },
          // 事件监听器基于 `on`
          // 所以不再支持如 `v-on:keyup.enter` 修饰器
          // 需要手动匹配 keyCode。
          on: {
            click: this.clickHandler
          },
          // 仅对于组件，用于监听原生事件，而不是组件内部使用
          // `vm.$emit` 触发的事件。
          nativeOn: {
            click: this.nativeClickHandler
          },
          // 自定义指令。注意，你无法对 `binding` 中的 `oldValue`
          // 赋值，因为 Vue 已经自动为你进行了同步。
          directives: [
            {
              name: 'my-custom-directive',
              value: '2',
              expression: '1 + 1',
              arg: 'foo',
              modifiers: {
                bar: true
              }
            }
          ],
          // 作用域插槽格式
          // { name: props => VNode | Array<VNode> }
          scopedSlots: {
            default: props => createElement('span', props.text)
          },
          // 如果组件是其他组件的子组件，需为插槽指定名称
          slot: 'name-of-slot',
          // 其他特殊顶层属性
          key: 'myKey',
          ref: 'myRef'
 *    },[])
 * 
 * @param  {[type]} Ctor:     子组件对象
 * @param  {[type]} data:     ?  VNodeData [description]
 * @param  {[type]} context   :  Component [description]
 * @param  {[type]} children: ?  子vNode
 * @param  {[type]} tag       ?  元素名称
 */
export function createComponent(
    Ctor: Class < Component > | Function | Object | void,
    data: ? VNodeData,
    context : Component,
    children: ? Array < VNode > ,
    tag ? : string
): VNode | Array < VNode > | void {
        if (isUndef(Ctor)) {
            return
        }
        // 在 core/global-api/initGlobalAPI()   Vue.options._base = Vue
        // // 所以baseCtor  === Vue| VueComponent 构造器
        /*
            我们从core/global-api/index.js中initGlobalAPI() 发现一行
            Vue.options._base = Vue ;
            我们Vue所有的组件都是先从 new Vue()开始  而在_init()的方法
            vm.$options = mergeOptions(
                resolveConstructorOptions(vm.constructor),  // Vue.options
                options || {},
                vm
            )
            可见我们第一个Vue创建的实例vm的$options._base === Vue
            那么对于Vue下面的第一层子组件其 context.$options._base === Vue
            然后调用Vue.extend() 生成VNode组件的构造函数


            然后在installComponentHooks(data)在 data上生成组件的一些钩子函数

        */
        const baseCtor = context.$options._base

        // plain options object: turn it into a constructor
        //  为什么这边需要判断 isObject(Ctor)
        /*
            因为我们在配置的时候
            {
                components : { App, elButton }   //这些在引用之前就通过Vue.component() 返回的是一个VueComponent构造函数
                // 但是我们有时候可能为这样做
                components : {
                    el-button : {   // 那么此时依赖的组件 就是一个对象  我们需要将他转换成VueComponent构造函数
                        name : 'elButton',
                        data(){ return {} }
                    }
                }
            }
         */
        if (isObject(Ctor)) {
            // 调用Vue.extend 方法 将依赖的组件对象 转换成构造函数
            Ctor = baseCtor.extend(Ctor)
        }

        // if at this stage it's not a constructor or an async component factory,
        // reject.
        if (typeof Ctor !== 'function') {
            if (process.env.NODE_ENV !== 'production') {
                warn(`Invalid Component definition: ${String(Ctor)}`, context)
            }
            return
        }

        // async component
        let asyncFactory
            // 异步组件的处理
        if (isUndef(Ctor.cid)) {
            asyncFactory = Ctor
            Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
            if (Ctor === undefined) {
                // return a placeholder node for async component, which is rendered
                // as a comment node but preserves all the raw information for the node.
                // the information will be used for async server-rendering and hydration.
                return createAsyncPlaceholder(
                    asyncFactory,
                    data,
                    context,
                    children,
                    tag
                )
            }
        }

        data = data || {}

        // resolve constructor options in case global mixins are applied after
        // component constructor creation
        // 解析构造函数选项，以防在组件构造函数创建后应用全局mixin
        // 
        resolveConstructorOptions(Ctor)

        // transform component v-model data into props & events
        // 处理v-model
        if (isDef(data.model)) {
            transformModel(Ctor.options, data)
        }

        // extract props
        // 处理props
        const propsData = extractPropsFromVNodeData(data, Ctor, tag)

        // functional component
        // 处理函数式组件
        if (isTrue(Ctor.options.functional)) {
            return createFunctionalComponent(Ctor, propsData, data, context, children)
        }

        // extract listeners, since these needs to be treated as
        // child component listeners instead of DOM listeners
        const listeners = data.on

        // replace with listeners with .native modifier
        // so it gets processed during parent component patch.
        data.on = data.nativeOn

        if (isTrue(Ctor.options.abstract)) {
            // abstract components do not keep anything
            // other than props & listeners & slot

            // work around flow
            const slot = data.slot
            data = {}
            if (slot) {
                data.slot = slot
            }
        }

        // install component management hooks onto the placeholder node
        // 安装一些组件的钩子函数 ***
        // 主要用于我们patch的时候 createComponent()  => i(vnode, false /* hydrating */ )
        installComponentHooks(data)

        // return a placeholder vnode
        const name = Ctor.options.name || tag
        const vnode = new VNode(
                `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
        data, undefined, undefined, undefined, context, { Ctor, propsData, listeners, tag, children },
        asyncFactory
    )

    // Weex specific: invoke recycle-list optimized @render function for
    // extracting cell-slot template.
    // https://github.com/Hanks10100/weex-native-directive/tree/master/component
    /* istanbul ignore if */
    if (__WEEX__ && isRecyclableComponent(vnode)) {
        return renderRecyclableComponentTemplate(vnode)
    }

    return vnode
}

export function createComponentInstanceForVnode(
    vnode: any, // we know it's MountedComponentVNode but flow doesn't
    parent: any, // activeInstance in lifecycle state
): Component {
    // 第一步 ： vnode === App(vNode)
    // parent = Vue 当前正在处理的是  App组件
    const options: InternalComponentOptions = {
        _isComponent: true, // 表明这是组件VueComponent 不是Vue
        _parentVnode: vnode, // 表明 子组件的 _parentVnode 指向 子组件的占位符Vnode
        parent               // 子组件的parent 指向 父组件vm
    }
    // check inline-template render functions
    // 当 inline-template 这个特殊的特性出现在一个子组件上时，这个组件将会使用其里面的内容作为模板，
    // 而不是将其作为被分发的内容。这使得模板的撰写工作更加灵活。
    const inlineTemplate = vnode.data.inlineTemplate
    if (isDef(inlineTemplate)) {
        options.render = inlineTemplate.render
        options.staticRenderFns = inlineTemplate.staticRenderFns
    }

    // 调用组件的 _init方法
    return new vnode.componentOptions.Ctor(options)
}

function installComponentHooks(data: VNodeData) {
    const hooks = data.hook || (data.hook = {})
    // vue中定义的4个patch 钩子函数 init prepatch insert destory
    for (let i = 0; i < hooksToMerge.length; i++) {
        // 钩子函数名称key
        const key = hooksToMerge[i]
        // 用户自定义的钩子函数方法
        const existing = hooks[key]
        // 获取Vue定义的钩子函数方法
        const toMerge = componentVNodeHooks[key]
        // 如果 用户自定以了
        if (existing !== toMerge && !(existing && existing._merged)) {
            hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
        }
    }
}

/**
 * 处理用户自定义了钩子函数时 处理方式
 *    先执行 Vue定义的钩子函数
 *    然后执行用户定义的钩子函数
 * @param  {[type]} f1: any           [description]
 * @param  {[type]} f2: any           [description]
 * @return {[type]}     [description]
 */
function mergeHook(f1: any, f2: any): Function {
    const merged = (a, b) => {
        // flow complains about extra args which is why we use any
        f1(a, b)
        f2(a, b)
    }
    merged._merged = true
    return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel(options, data: any) {
    const prop = (options.model && options.model.prop) || 'value'
    const event = (options.model && options.model.event) || 'input';
    (data.props || (data.props = {}))[prop] = data.model.value
    const on = data.on || (data.on = {})
    if (isDef(on[event])) {
        on[event] = [data.model.callback].concat(on[event])
    } else {
        on[event] = data.model.callback
    }
}