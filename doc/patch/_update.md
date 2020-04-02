此过程主要的作用就是讲 render()生成的vNode转成 真实的DOM

还是以刚才的那个例子讲解

```html
<body>
    <div id="app">
        <button-counter :name-key="childNamekey" name='gzh' >
            <div class="app-scope">app-scope</div>
        </button-counter>
        <span></span>
    </div>
</body>
<script type="text/javascript" src="../vue.js"></script>
<script type="text/javascript">
var buttonCounter = Vue.component('button-counter', {
    props: {
        name: [String],
        nameKey: {
            type: [Boolean,String]
        }
    },
    data: function() {
        return {
            count: 0
        }
    },
    template: `<div class="button-counter">

        <slot></slot>
    </div>`,
    mounted: function() {
        console.log(this);
    }
})
var vue = new Vue({
    el: "#app",
    components: {
        buttonCounter
    },
    data: function() {
        return {
            name: "",
            childNamekey: 'namekey'
        }
    },
    methods:{
        changeNameKey(){
            this.childNamekey = Math.random() + ' name key';
        }
    }
})
</script>
```
上面我们在第一步的时候 将Vue AST -> VNode但是没有进行其子组件的button-counter的AST->VNode的过程。而且我们在render()完成后就进行 _update(vm._render(),) update的过程


下面对于第一步
vm = app的实例vm ;

activeInstance = vm 那么此时相对全局的 activeInstance 就等于APP组件的vm;

因为没有 prevVnode = vm._vnode 此时没有进行生成DOM所以为undefined 所以执行
vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */ )

我们在 platforms/web/runtime/index.js 中发现
```
Vue.prototype.__patch__ = inBrowser ? patch : noop
```

```js

Vue.prototype._update = function(vnode: VNode, hydrating ? : boolean) {
    //
    const vm: Component = this
    // 保存组件 原来的dom
    const prevEl = vm.$el
    // 保存原来的 组件vnode
    const prevVnode = vm._vnode
    // 保存原来处理的组件
    const prevActiveInstance = activeInstance
    // 赋值activeInstance 保存
    activeInstance = vm
    // 是的组件上的_vnode 等于 组件vnode
    // 保存当前js -> vnode后新的vnode
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // 当组件 第一次创建的时候
    if (!prevVnode) {
        // initial render
        vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */ )
    } else {
        // 当组件是触发 更新的时候
        // updates
        vm.$el = vm.__patch__(prevVnode, vnode)
    }
    activeInstance = prevActiveInstance
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
```


发现我们将VNode转换成真实的DOM是通过patch() 进行
第一步其发现oldVnode没有 所以调用 createEle的方法
```js
/**
     * 将组件 vnode 转换成真实的DOM
     * @param  {[type]} oldVnode   [第一步中oldVnode = div#app 元素 vnode = App组件生成的vnode]
     * @param  {[type]} vnode      [description]
     * @param  {[type]} hydrating  [description]
     * @param  {[type]} removeOnly [description]
     * @return {[type]}            [description]
     */
    return function patch(oldVnode, vnode, hydrating, removeOnly) {
        // 如果更新后的vnode是空的  说明此组件卸载了  调用 vnode上定义的 destroy的钩子函数
        if (isUndef(vnode)) {
            if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
            return
        }

        let isInitialPatch = false
        const insertedVnodeQueue = []

        // 如果没有真实的 DOM 那么 就可能是 一开始创建的时候  或者 懒加载的组件类型
        // 那么 直接调用createEle 生成DOM
        if (isUndef(oldVnode)) {
            // empty mount (likely as component), create new root element
            isInitialPatch = true
            createElm(vnode, insertedVnodeQueue)
        } else {
            // 第一步 oldVode = #app  所以 oldVnode.nodeType = 1；
            const isRealElement = isDef(oldVnode.nodeType)
            if (!isRealElement && sameVnode(oldVnode, vnode)) {
                // patch existing root node
                patchVnode(oldVnode, vnode, insertedVnodeQueue, removeOnly)
            } else {
                if (isRealElement) {
                    // mounting to a real element
                    // check if this is server-rendered content and if we can perform
                    // a successful hydration.
                    if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
                        oldVnode.removeAttribute(SSR_ATTR)
                        hydrating = true
                    }
                    if (isTrue(hydrating)) {
                        if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
                            invokeInsertHook(vnode, insertedVnodeQueue, true)
                            return oldVnode
                        } else if (process.env.NODE_ENV !== 'production') {
                            warn(
                                'The client-side rendered virtual DOM tree is not matching ' +
                                'server-rendered content. This is likely caused by incorrect ' +
                                'HTML markup, for example nesting block-level elements inside ' +
                                '<p>, or missing <tbody>. Bailing hydration and performing ' +
                                'full client-side render.'
                            )
                        }
                    }
                    // either not server-rendered, or hydration failed.
                    // create an empty node and replace it
                    oldVnode = emptyNodeAt(oldVnode)
                }

                // replacing existing element
                const oldElm = oldVnode.elm
                const parentElm = nodeOps.parentNode(oldElm)

                // create new node
                createElm(
                    vnode, // 当前的组件vnode
                    insertedVnodeQueue,
                    // extremely rare edge case: do not insert if old element is in a
                    // leaving transition. Only happens when combining transition +
                    // keep-alive + HOCs. (#4590)
                    oldElm._leaveCb ? null : parentElm, // 父元素
                    nodeOps.nextSibling(oldElm)
                )

                // update parent placeholder node element, recursively
                if (isDef(vnode.parent)) {
                    let ancestor = vnode.parent
                    const patchable = isPatchable(vnode)
                    while (ancestor) {
                        for (let i = 0; i < cbs.destroy.length; ++i) {
                            cbs.destroy[i](ancestor)
                        }
                        ancestor.elm = vnode.elm
                        if (patchable) {
                            for (let i = 0; i < cbs.create.length; ++i) {
                                cbs.create[i](emptyNode, ancestor)
                            }
                            // #6513
                            // invoke insert hooks that may have been merged by create hooks.
                            // e.g. for directives that uses the "inserted" hook.
                            const insert = ancestor.data.hook.insert
                            if (insert.merged) {
                                // start at index 1 to avoid re-invoking component mounted hook
                                for (let i = 1; i < insert.fns.length; i++) {
                                    insert.fns[i]()
                                }
                            }
                        } else {
                            registerRef(ancestor)
                        }
                        ancestor = ancestor.parent
                    }
                }

                // destroy old node
                if (isDef(parentElm)) {
                    removeVnodes(parentElm, [oldVnode], 0, 0)
                } else if (isDef(oldVnode.tag)) {
                    invokeDestroyHook(oldVnode)
                }
            }
        }
        // 插入DOM树后 调用钩子函数
        invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
        return vnode.elm
    }
```

发现createEle() 前一步就是调用createComponent() 方法
```js
 /**
     * 将 组件vnode 处理成为 真实的元素
     * @param  {[type]} vnode              [description]
     * @param  {[type]} insertedVnodeQueue [description]
     * @param  {[type]} parentElm          [description]
     * @param  {[type]} refElm             [description]
     * @param  {[type]} nested             [description]
     * @param  {[type]} ownerArray         [description]
     * @param  {[type]} index              [description]
     * @return {[type]}                    [description]
     */
    function createElm(
        vnode,
        insertedVnodeQueue,
        parentElm,
        refElm,
        nested,
        ownerArray,
        index
    ) {
        if (isDef(vnode.elm) && isDef(ownerArray)) {
            // This vnode was used in a previous render!
            // now it's used as a new node, overwriting its elm would cause
            // potential patch errors down the road when it's used as an insertion
            // reference node. Instead, we clone the node on-demand before creating
            // associated DOM element for it.
            vnode = ownerArray[index] = cloneVNode(vnode)
        }
        // 是否是嵌套的内部组件
        vnode.isRootInsert = !nested // for transition enter check
        // 如果为true 说明 此当前处理的vnode是一个组件
        // 如果是undefined 说明当前处理的vnode为元素节点
        if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
            return
        }

    }
```
我们在 render() 中 将AST-> VNode时候对于占位符VNode处理的时候会进行一个installComponentHooks(data)的过程 其就是将VNode为组件VNode的vnode.data上定义了hook钩子函数

```js

/**
 * 创建组件
 * @param  {[type]} vnode              [组件vnode]
 * @param  {[type]} insertedVnodeQueue [description]
 * @param  {[type]} parentElm          [父元素]
 * @param  {[type]} refElm             [兄弟元素]
 * @return {[type]}                    [description]
 */
function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
        const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
        // 在create-component.js 中
        // 那么此时我们去通过判断 vnode.data.hook.init钩子函数是否存在，存在就是组件VNode，不是就是一般的元素vnode
        // 上面第一步 vnode.tag === div(最外层div元素)不是组件vnode 那边conponentInstance也为undefined所以return false;
        if (isDef(i = i.hook) && isDef(i = i.init)) {
            i(vnode, false /* hydrating */ )
        }
        // after calling the init hook, if the vnode is a child component
        // it should've created a child instance and mounted it. the child
        // component also has set the placeholder vnode's elm.
        // in that case we can just return the element and be done.
        // 在调用init钩子之后，如果vnode是一个子组件，它应该已经创建了一个子实例并挂载了它。
        // 子组件还设置了占位符vnode的elm。
        // 在这种情况下，我们只需要返回元素就可以了。
        if (isDef(vnode.componentInstance)) {
            initComponent(vnode, insertedVnodeQueue)
            insert(parentElm, vnode.elm, refElm)
            if (isTrue(isReactivated)) {
                reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
            }
            return true
        }
    }
}

```
```js
function createElm(
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
) {
    // 因为对于第一步 其处理的为最外层的div 所以返回的为undefined不会return
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
        return
    }
    // 元素节点 保存其data数据
    const data = vnode.data
    // 获取其子vnode
    const children = vnode.children
    const tag = vnode.tag
    // 如果是一个元素节点
    // 对于非组件节点
    // 那么节点只能是  三种 ： 元素节点 注释节点 或者 文本节点
    // 元素节点 ： 其可能存在子节点  或元素节点或注释或文本，所以需要createChildren 处理子节点
    // 注释节点 ： 直接调用创建注释节点的方法去生成一个注释节点 然后插入
    // 文本节点 ： 跟注释节点一样
    if (isDef(tag)) {
        if (process.env.NODE_ENV !== 'production') {
            if (data && data.pre) {
                creatingElmInVPre++
            }
            if (isUnknownElement(vnode, creatingElmInVPre)) {
                warn(
                    'Unknown custom element: <' + tag + '> - did you ' +
                    'register the component correctly? For recursive components, ' +
                    'make sure to provide the "name" option.',
                    vnode.context
                )
            }
        }

        vnode.elm = vnode.ns ?
            nodeOps.createElementNS(vnode.ns, tag) :
            nodeOps.createElement(tag, vnode)
        setScope(vnode)

        /* istanbul ignore if */
        if (__WEEX__) {

        } else {
            // 处理子节点
            createChildren(vnode, children, insertedVnodeQueue)
            if (isDef(data)) {
                invokeCreateHooks(vnode, insertedVnodeQueue)
            }
            // 在父节点上 插入处理好的此节点
            insert(parentElm, vnode.elm, refElm)
        }

        if (process.env.NODE_ENV !== 'production' && data && data.pre) {
            creatingElmInVPre--
        }
        // 如果节点是注释节点
    } else if (isTrue(vnode.isComment)) {
        vnode.elm = nodeOps.createComment(vnode.text)
        insert(parentElm, vnode.elm, refElm)
    } else {
        // 其他说明这是一个文本节点
        vnode.elm = nodeOps.createTextNode(vnode.text)
        insert(parentElm, vnode.elm, refElm)
    }
}
```
然后 继续执行 直到createChildren(vnode, children, insertedVnodeQueue)，因为其存在子vnode所以处理子节点
```js
/**
 * 处理节点的子节点
 * @param  {[type]} vnode              [组件vnode]
 * @param  {[type]} children           [其子节点]
 * @param  {[type]} insertedVnodeQueue [description]
 * @return {[type]}                    [description]
 */
function createChildren(vnode, children, insertedVnodeQueue) {
    // 存在子节点
    if (Array.isArray(children)) {
        if (process.env.NODE_ENV !== 'production') {
            checkDuplicateKeys(children)
        }
        for (let i = 0; i < children.length; ++i) {
            // 如果存在子节点 继续调用 vnode 转 元素方法
            createElm(children[i], insertedVnodeQueue, vnode.elm, null, true, children, i)
        }
    } else if (isPrimitive(vnode.text)) {
        // 没有子节点处理
        nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(String(vnode.text)))
    }
}

```
我们发现其也就是 变量每一个子vnode然后继续上面的createElm()的过程，然后再次调用createComponent()方法  因为此次处理的是buttonCounter这个占位符VNode 其是一个组件
```js

/**
 * 创建组件
 * @param  {[type]} vnode              [组件vnode]
 * @param  {[type]} insertedVnodeQueue [description]
 * @param  {[type]} parentElm          [父元素]
 * @param  {[type]} refElm             [兄弟元素]
 * @return {[type]}                    [description]
 */
function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
        const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
        // 因为此时处理的是 buttonCounter这个占位符VNode 然后存在 vnode.data.hook.init方法，所以执行此方法

        if (isDef(i = i.hook) && isDef(i = i.init)) {
            i(vnode, false /* hydrating */ )
        }
        // after calling the init hook, if the vnode is a child component
        // it should've created a child instance and mounted it. the child
        // component also has set the placeholder vnode's elm.
        // in that case we can just return the element and be done.
        // 在调用init钩子之后，如果vnode是一个子组件，它应该已经创建了一个子实例并挂载了它。
        // 子组件还设置了占位符vnode的elm。
        // 在这种情况下，我们只需要返回元素就可以了。
        if (isDef(vnode.componentInstance)) {
            initComponent(vnode, insertedVnodeQueue)
            insert(parentElm, vnode.elm, refElm)
            if (isTrue(isReactivated)) {
                reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
            }
            return true
        }
    }
}

我们发现我们此时执行 createComponentInstanceForVnode(vnode,activeInstance) 然后我们在 _update的 进行了一个activeInstance = vm的过程  所以此时activeInstance === APP这个组件 而对于我们准备处理的buttonCounter组件 activeInstance 应该就是其父组件，vnode 就是其本身占位符vnode

```js
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
        // 上面都不是  所以执行 createComponentInstanceForVnode(vnode,activeInstance)
        const child = vnode.componentInstance = createComponentInstanceForVnode(
            vnode,
            activeInstance // 当前正在处理的组件 对于 组件vnode中的组件 activeInstance 都是其父组件
        )
        // 调用子组件的 $mount()方法
        child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
},

```

```javascript
function createComponentInstanceForVnode(
    vnode: any,  // 在上面我们调用的时候vnode 为其占位符vnode
    parent: any, // activeInstance in lifecycle state 上面所以对于buttonCounter parent === activeInstance 就是其父组件vm
): Component {
    // 第一步 ： vnode === App(vNode)
    // parent = Vue 当前正在处理的是  App组件
    const options: InternalComponentOptions = {
        _isComponent: true, // 表明这是组件VueComponent 不是Vue
        _parentVnode: vnode, // 当前的vnode  === h(<App/>) 所以就是App的_parentVnode
        parent
    }
    // check inline-template render functions
    const inlineTemplate = vnode.data.inlineTemplate
    if (isDef(inlineTemplate)) {
        options.render = inlineTemplate.render
        options.staticRenderFns = inlineTemplate.staticRenderFns
    }
    // 调用组件的 _init方法
    return new vnode.componentOptions.Ctor(options)
}
```
