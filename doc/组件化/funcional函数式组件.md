# functional函数式组件

> 什么是函数式组件

没有管理或者监听任何传递给他的状态，也没有生命周期方法。它只是一个接收参数的函数（它是无状态 (没有响应式数据)，无实例 (没有 this 上下文)。）。


###

```js
export function createComponent(
    Ctor: Class < Component > | Function | Object | void,
    data: ? VNodeData,
    context : Component,
    children: ? Array < VNode > ,
    tag ? : string
): VNode | Array < VNode > | void {

        const baseCtor = context.$options._base

        if (isObject(Ctor)) {
            // 调用Vue.extend 方法 将依赖的组件对象 转换成构造函数
            Ctor = baseCtor.extend(Ctor)
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


    return vnode
}
```
我们发现 在createComponent() 的时候(即render的时候,表达式字符串 -> vnode)，当_createElement()按照表达式创建节点vnode的时候如果遇到节点的类型为组件，那么就调用createComponent() 去生成组件的 <font color=red> 占位符vnode </font>。 但是对于函数式组件其没有进行

```js
export function createComponent(
    Ctor: Class < Component > | Function | Object | void,
    data: ? VNodeData,
    context : Component,
    children: ? Array < VNode > ,
    tag ? : string
): VNode | Array < VNode > | void {

        // functional component
        // 处理函数式组件
        if (isTrue(Ctor.options.functional)) {
            return createFunctionalComponent(Ctor, propsData, data, context, children)
        }
        const listeners = data.on
        data.on = data.nativeOn

        if (isTrue(Ctor.options.abstract)) {

            const slot = data.slot
            data = {}
            if (slot) {
                data.slot = slot
            }
        }
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
上面的如事件的处理、抽象组件、定义组件的钩子函数、生成占位符vnode而是进行另外一步；所以其vnode.componentOptions.data.hook对象是没有的。

### createFunctionalComponent 函数式组件的创建
下面我们来分析 createFunctionalComponent(Ctor, propsData, data, context, children)

```js

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
```

##### 1. 我们发现第一步其是处理 props  

> 注意：在 2.3.0 之前的版本中，如果一个函数式组件想要接受 props，则 props 选项是必须的。在 2.3.0 或以上的版本中，你可以省略 props 选项，所有组件上的特性都会被自动解析为 props。

Vue官网上说 2.3.0以后我们可以省略 props 所有组件上的特性都自动解析为props。对应源码就是当我们if (isDef(propOptions))为false的时候

```
if (isDef(data.attrs)) mergeProps(props, data.attrs)
if (isDef(data.props)) mergeProps(props, data.props)
```
将data上的 attrs 和 props 属性与 props合并
```
<scope-first id="scopeFirst" dname="name" :name="name" value="name" v-on:click="asdasd" ></scope-first>
```
这个将会在组件的props上自动映射出 id dname name 3个属性 (data.attrs)上，不会再data.props 上

那么此时 porps也就相当于
```
props : {
    dname: "name"
    id: "scopeFirst"
    name: 1
    value: "name"
}
```
