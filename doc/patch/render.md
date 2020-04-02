> 对于Vue的render()过程就是一个将组件render属性从 **AST变成vNode**的过程

首先从返回值就可以看出 render() 返回的是一个VNode对象

对于Vue的组件 来说我们需要主要的一点就是

```
<el-button type='primary' @click="clickFn">
    按钮组件    --- 这就是 组件的默认插槽的数据
</el-button>
```
但是组件的实际内容可能是一个很大的vNode。所以我们就需要注意一个概念
： **占位符vNode 与 组件vNode**
每一个组件实例对象vm其占位符vNode  保存在 _parentVnode属性上
组件vNode其保存在vm._vnode上


1. 我们AST-> VNode 的第一步是从vm.$options 上获取 render属性 与 _parentVnode两个属性，上面说过 _parentVnode是组件的占位符VNode。
2.  vm.$vnode = vm.$options._parentVnode  保存占位符VNode
3.  render.call(vm._renderProxy, vm.$createElement ) 调用render函数 将AST -> vnode
```
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

```

我们在initRender()发现在Vue初始化的时候就 在vm上定义了 vm._createElement()
```js
export function initRender(vm: Component) {

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
}

```

##### createElement(vm , tag , data , children , normalizationType , alwaysNormalize)
```js
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
```
可见其实际上就是调用 _createElement()方法



##### _createElement(vm , tag , data , children , normalizationType , alwaysNormalize)
```js
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
```

可见看出 _createElement的作用就是 判断我们创建的一个元素 其是一个基本的元素节点 还是一个组件组件 如果是元素节点，就很简单了直接调用new VNode() 按照元素节点去创建一个元素节点VNode，但是如果是一个组件节点，那么如何处理？

就像上面所说的我们一个组件分为占位符VNode和 组件VNode 那么此时我们createComponent()处理的应该就是 组件的占位符VNode


```js
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
    // 为什么这边需要判断 isObject(Ctor)
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
        // 调用Vue.extend 方法
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

    data = data || {}

    // resolve constructor options in case global mixins are applied after
    // component constructor creation
    //
    resolveConstructorOptions(Ctor)


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

    return vnode
}
```

总结：

1. 组件render() 将组件从AST-> VNode 的过程，就是从render函数 自上而下 自里而外不断的createElement()的过程。
2. 在createElement中如果是遇到占位符VNode 那么就执行 createComponent()函数。其主要作用根据components或者全局components创建组件的构造函数Ctor，在data.hook上保存4个组件的钩子函数， 最后生成组件VNode (componentOptions)。
3. 在render() 不会关注子组件的AST -> VNode过程




```js

```
```js

```
