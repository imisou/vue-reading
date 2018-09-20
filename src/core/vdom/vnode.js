/* @flow */


import config from "../config";

/**
 * 分为 占位符vNode(占位符vNode 说明这个vnode 就是一个组件) 元素vNode
 *
 *  占位符vNode
 *
 *  我们一般的组件vNode 可能为
 *      <el-button type='primary' @click="clickFn">
 *          按钮组件    --- 这就是 组件的默认插槽的数据
 *      </el-button>
 *
 *  const vnode = new VNode(
        `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
        data,
        undefined,
        undefined,
        undefined,
        context,
        { Ctor, propsData, listeners, tag, children },
        asyncFactory
    )
    可见对于组件vNode来说
    tag      : vue-component-${cid}
    data     : {
        hook : {     // 在组件creatComponent(AST-> DOM)的时候 installComponentHooks(data)生成的
            init(){},
            prepatch(){},
            insert(){},
            destory(){}
        }
    },
    children : undefined  ** 子组件为空 
    text     : undefined
    elm      : undefined
    context  : context      // 组件vNode所在组件的 vm
    componentOptions : {
        Ctor,               // 每一个组件都是一个VueComponent Ctor = 其构造函数
        propsData,          // 组件vNode 上定义的propsData
        listeners, 
        tag,                // 保存了组件vNode定义的 时候元素名称 如el-button
        children            // 定义了组件vNode的插槽内容 他不像一般的元素其子vNode保存在vNode.children上
    }



 * 对于普通的元素vNode
 * new VNode(
        config.parsePlatformTagName(tag),
        data,
        children,
        undefined,
        undefined,
        context
    )
 *  可见 元素vNode
 *  tag              :  元素的类型 div、span...
 *  data             :  元素data数据
 *  children         :  保存了其所有的子元素
 *  text             :  undefined  对于文本节点 text为文本的内容
 *  elm              :  保存了其元素DOM节点
 *  context          :  context
 *  componentOptions :  undefined
 *
 *
 *
 *  总结 普通元素vNode 与 组件占位符vNode的区别
 *
 *  1、 tag 元素的名称不同
 *      对于普通元素tag就是元素的类型
 *      占位符组件vNode的tag为`vue-component-${Ctor.cid}${name ? `-${name}` : ''}`
 *  2、 children 属性
 *      普通元素vNode存在子节点 其所有的子vNode都存放在children 上，
 *      而对于占位符组件vNode children为undefined，其子节点就是其 插槽内容， 其保存在 componentOptions.children上
 *  3、 componentOptions
 *      对于普通元素vNode  其componentOptions = undefined
 *      组件占位符vNode    componentOptions是一个很重要的属性
 *          其保存了组件VueComponent的构造函数Ctor
 *          propsData : 父组件通过占位符vNode传给组件的 数据
 *          listeners : 保存了子组件通过事件像父组件发送数据的事件
 *          tag       : 保存了占位符vNode的用户定义的节点名称  el-button
 *          children  : 其保存了占位符节点的子节点，也就是其插槽内容
 *
 *
 *
 *
 *  对于VNode其最重要的一个属性是data
 *  {
        key?: string | number;
        slot?: string;
        ref?: string;
        is?: string;
        pre?: boolean;
        tag?: string;
        staticClass?: string;
        class?: any;
        staticStyle?: { [key: string]: any };
        style?: Array<Object> | Object;
        normalizedStyle?: Object;
        props?: { [key: string]: any };
        attrs?: { [key: string]: string };
        domProps?: { [key: string]: any };
        hook?: {    // 定义了VNode 生命周期的一些钩子函数
            init : () => {}       // 当组件vnode -> dom的时候 调用init 去
            prepatch : () => {}   // 当组件更新的时候
        };
        on?: ?{ [key: string]: Function | Array<Function> };
        nativeOn?: { [key: string]: Function | Array<Function> };
        transition?: Object;
        show?: boolean; // marker for v-show
        inlineTemplate?: {
          render: Function;
          staticRenderFns: Array<Function>;
        };
        directives?: Array<VNodeDirective>;
        keepAlive?: boolean;
        scopedSlots?: { [key: string]: Function };
        model?: {
          value: any;
          callback: Function;
        };
    };
 *
 *
 */
export default class VNode {
    tag: string | void;
    data: VNodeData | void;
    children: ? Array < VNode > ;
    text: string | void;
    elm: Node | void;
    ns: string | void;
    context: Component | void; // rendered in this component's scope
    key: string | number | void;
    componentOptions: VNodeComponentOptions | void;
    componentInstance: Component | void; // component instance
    parent: VNode | void; // component placeholder node

    // strictly internal
    raw: boolean; // contains raw HTML? (server only)
    isStatic: boolean; // hoisted static node
    isRootInsert: boolean; // necessary for enter transition check
    isComment: boolean; // empty comment placeholder?
    isCloned: boolean; // is a cloned node?
    isOnce: boolean; // is a v-once node?
    asyncFactory: Function | void; // async component factory function
    asyncMeta: Object | void;
    isAsyncPlaceholder: boolean;
    ssrContext: Object | void;
    fnContext: Component | void; // real context vm for functional nodes
    fnOptions: ? ComponentOptions; // for SSR caching
    fnScopeId: ? string; // functional scope id support

    constructor(
        tag ? : string,
        data ? : VNodeData,
        children ? : ? Array < VNode > ,
        text ? : string,
        elm ? : Node,
        context ? : Component,
        componentOptions ? : VNodeComponentOptions,
        asyncFactory ? : Function
    ) {
        this.tag = tag
        this.data = data
        this.children = children
        this.text = text
        this.elm = elm
        this.ns = undefined
        this.context = context
        this.fnContext = undefined
        this.fnOptions = undefined
        this.fnScopeId = undefined
        this.key = data && data.key
        this.componentOptions = componentOptions
        this.componentInstance = undefined
        this.parent = undefined
        this.raw = false
        this.isStatic = false
        this.isRootInsert = true
        this.isComment = false
        this.isCloned = false
        this.isOnce = false
        this.asyncFactory = asyncFactory
        this.asyncMeta = undefined
        this.isAsyncPlaceholder = false
    }

    // DEPRECATED: alias for componentInstance for backwards compat.
    /* istanbul ignore next */
    get child(): Component | void {
        return this.componentInstance
    }
}

/**
 * 创建一个 空的 vnode 的方法
 *  如我们 编译后 render()  中 _v('')就是调用此方法 去创建一个空的VNode
 * @param {*} text 
 */
export const createEmptyVNode = (text: string = '') => {
    const node = new VNode()
    node.text = text
    node.isComment = true
    return node
}

/**
 * 创建一个文本VNode
 * @param {*} val 
 */
export function createTextVNode(val: string | number) {
    return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
export function cloneVNode(vnode: VNode): VNode {
    const cloned = new VNode(
        vnode.tag,
        vnode.data,
        vnode.children,
        vnode.text,
        vnode.elm,
        vnode.context,
        vnode.componentOptions,
        vnode.asyncFactory
    )
    cloned.ns = vnode.ns
    cloned.isStatic = vnode.isStatic
    cloned.key = vnode.key
    cloned.isComment = vnode.isComment
    cloned.fnContext = vnode.fnContext
    cloned.fnOptions = vnode.fnOptions
    cloned.fnScopeId = vnode.fnScopeId
    cloned.asyncMeta = vnode.asyncMeta
    cloned.isCloned = true
    return cloned
}