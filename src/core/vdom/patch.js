/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 */

import VNode, { cloneVNode } from './vnode'
import config from '../config'
import { SSR_ATTR } from 'shared/constants'
import { registerRef } from './modules/ref'
import { traverse } from '../observer/traverse'
import { activeInstance } from '../instance/lifecycle'
import { isTextInputType } from 'web/util/element'

import {
    warn,
    isDef,
    isUndef,
    isTrue,
    makeMap,
    isRegExp,
    isPrimitive
} from '../util/index'

export const emptyNode = new VNode('', {}, [])


// vnode 的 5个生命周期 在vnode 创建 -> ... 时 调用各自的钩子函数
const hooks = ['create', 'activate', 'update', 'remove', 'destroy']


/**
 * 判断两个节点是否相同
 *  必须的： 两个节点的 key相同 (如果都没有定义key 那么也相同) 如 text节点
 *  1、  两个节点的tag 节点类型相同  div === div
 *       两个都是注释节点  那么也相同
 *       两个是否都定义了 data属性 或者都没有   所以 li.class1    ===  li.class1.class2 因为其都定义了data属性
 *       如果都是input节点  那么要type 大类型相同
 *
 *
 *
 *   <li class="class1" :class="{'class2' : isShowClass}">22222</li>
 *   <li class="class1">11111</li>  相同
 *
 *
 * @param a
 * @param b
 * @returns {boolean|*}
 */
function sameVnode(a, b) {

    return (
        a.key === b.key && (
            (
                a.tag === b.tag &&
                a.isComment === b.isComment &&
                isDef(a.data) === isDef(b.data) &&
                sameInputType(a, b)
            ) || (
                isTrue(a.isAsyncPlaceholder) &&
                a.asyncFactory === b.asyncFactory &&
                isUndef(b.asyncFactory.error)
            )
        )
    )
}

/**
 * 处理VNode类型 tag 为 input的；
 * 判断两个VNode 相等
 *      需要 要么都没有定义 type  那么 typeA = undefined  ===   typeB = undefined
 * @param a
 * @param b
 * @returns {*}
 */
function sameInputType(a, b) {
    if (a.tag !== 'input') return true
    let i
    // 获取 vnode A和 vnode B 的 type 的值  为 text | textarea ...
    const typeA = isDef(i = a.data) && isDef(i = i.attrs) && i.type
    const typeB = isDef(i = b.data) && isDef(i = i.attrs) && i.type
    // 两个input类型相等  要么两个input 的类型相等，   text === text   textarea === textarea
    // 要么 type 都是web/utils/element中定义的 text的类型 text,number,password,search,email,tel,url
    // 所以 type:  text === number === password === search ... 因为其实际上都是 text类型
    return typeA === typeB || isTextInputType(typeA) && isTextInputType(typeB)
}

/**
 * 将子VNode数组 按照key 生成一个 key -> index 的键值对对象
 * [ li , li(key=8) , li , li(key=1)]      => { 8 : 1, 1: 4 }
 * @param children
 * @param beginIdx
 * @param endIdx
 */
function createKeyToOldIdx(children, beginIdx, endIdx) {
    let i, key
    const map = {}
    for (i = beginIdx; i <= endIdx; ++i) {
        key = children[i].key
        if (isDef(key)) map[key] = i
    }
    return map
}

export function createPatchFunction(backend) {
    let i, j
    // 记录了元素从 create -> activate -> 'update' -> 'remove' -> 'destroy' 过程中
    // 对元素上的attrs class domProps event style transition的处理方法
    const cbs = {}

    const { modules, nodeOps } = backend

    //  生成在各个环境中 create -> activate -> 'update' -> 'remove' -> 'destroy' 过程中 元素属性处理回调函数
    /*
        cbs = {
            create : [
                updateClass(),
                updateAttrs(),
                updateDOMListeners(),
                updateDOMProps(),
                updateStyle(),
                _enter()
                create()
                updateDirectives()
            ],
            activate : [
                _enter()
            ],
            update:[
                updateClass(),
                updateAttrs(),
                updateDOMListeners(),
                updateDOMProps(),
                updateStyle(),
                update(),
                updateDirectives()
            ],
            remove : [
                remove()
            ],
            destroy:[
                destroy(),
                unbindDirectives()
            ]   
        }
     */
    for (i = 0; i < hooks.length; ++i) {
        cbs[hooks[i]] = []
        for (j = 0; j < modules.length; ++j) {
            if (isDef(modules[j][hooks[i]])) {
                cbs[hooks[i]].push(modules[j][hooks[i]])
            }
        }
    }

    function emptyNodeAt(elm) {
        return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
    }

    function createRmCb(childElm, listeners) {
        function remove() {
            if (--remove.listeners === 0) {
                removeNode(childElm)
            }
        }
        remove.listeners = listeners
        return remove
    }

    function removeNode(el) {
        const parent = nodeOps.parentNode(el)
        // element may have already been removed due to v-html / v-text
        if (isDef(parent)) {
            nodeOps.removeChild(parent, el)
        }
    }

    function isUnknownElement(vnode, inVPre) {
        return (!inVPre &&
            !vnode.ns &&
            !(
                config.ignoredElements.length &&
                config.ignoredElements.some(ignore => {
                    return isRegExp(ignore) ?
                        ignore.test(vnode.tag) :
                        ignore === vnode.tag
                })
            ) &&
            config.isUnknownElement(vnode.tag)
        )
    }

    let creatingElmInVPre = 0

/**
 * 将 组件vnode 处理成为 真实的元素
 * 如<div id="app">
        <button-counter :name-key="childNamekey" name='gzh' >
            <div class="app-scope">app-scope</div>
        </button-counter>
        <span></span>
     </div>
 * 这种很简单的 组件render vnode 当我们在patch的时候调用createElm的时候
 *  其  vnode 为组件整个vnode
 *     insertedVnodeQueue 为一个空的数组队列
 *
 *
 *  但是当我们处理完第一层vnode然后createChildren()的时候 发现再次调用此方法
 *  createElm(children[i], insertedVnodeQueue, vnode.elm, null, true, children, i)
 *      vnode 当前处理的vnode
 *      insertedVnodeQueue  : 整个组件共享的[]
 *      parentElm    : vnode.elm     外层执行完成生产的真实DOM
 *      refElm       : null
 *      nested       : true  不是组件的根元素
 *      children     : children   其当前处于父vnode的children(其中包含了此vnode)
 *      index        :  i    上面 children 的下标
 *
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
            // in Weex, the default insertion order is parent-first.
            // List items can be optimized to use children-first insertion
            // with append="tree".
            const appendAsTree = isDef(data) && isTrue(data.appendAsTree)
            if (!appendAsTree) {
                // data中保存了元素的属性，所以如果 data不为空就需要处理元素上的属性
                if (isDef(data)) {
                    // 在 createPatchFunction() 的时候 cbs保存了元素在各个阶段属性的处理方法
                    invokeCreateHooks(vnode, insertedVnodeQueue)
                }
                insert(parentElm, vnode.elm, refElm)
            }
            createChildren(vnode, children, insertedVnodeQueue)
            if (appendAsTree) {
                if (isDef(data)) {
                    invokeCreateHooks(vnode, insertedVnodeQueue)
                }
                insert(parentElm, vnode.elm, refElm)
            }
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

    function initComponent(vnode, insertedVnodeQueue) {
        if (isDef(vnode.data.pendingInsert)) {
            insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert)
            vnode.data.pendingInsert = null
        }
        vnode.elm = vnode.componentInstance.$el
        if (isPatchable(vnode)) {
            invokeCreateHooks(vnode, insertedVnodeQueue)
            setScope(vnode)
        } else {
            // empty component root.
            // skip all element-related modules except for ref (#3455)
            registerRef(vnode)
            // make sure to invoke the insert hook
            insertedVnodeQueue.push(vnode)
        }
    }

    function reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
        let i
        // hack for #4339: a reactivated component with inner transition
        // does not trigger because the inner node's created hooks are not called
        // again. It's not ideal to involve module-specific logic in here but
        // there doesn't seem to be a better way to do it.
        let innerNode = vnode
        while (innerNode.componentInstance) {
            innerNode = innerNode.componentInstance._vnode
            if (isDef(i = innerNode.data) && isDef(i = i.transition)) {
                for (i = 0; i < cbs.activate.length; ++i) {
                    cbs.activate[i](emptyNode, innerNode)
                }
                insertedVnodeQueue.push(innerNode)
                break
            }
        }
        // unlike a newly created component,
        // a reactivated keep-alive component doesn't insert itself
        insert(parentElm, vnode.elm, refElm)
    }

    /**
     * 在 指定父节点parent和兄弟节点ref之前插入ele节点
     * @param  {[type]} parent [description]
     * @param  {[type]} elm    [description]
     * @param  {[type]} ref    [description]
     * @return {[type]}        [description]
     */
    function insert(parent, elm, ref) {
        // 首先判断是否有父节点
        if (isDef(parent)) {
            // 是否有兄弟节点
            if (isDef(ref)) {
                // 兄弟节点的父节点跟其父节点相同
                if (ref.parentNode === parent) {
                    // 那么就调用module中定义的在指定元素之前插入子节点
                    nodeOps.insertBefore(parent, elm, ref)
                }
            } else {
                // 没有兄弟节点直接在父节点最后插入一个子节点
                nodeOps.appendChild(parent, elm)
            }
        }
    }

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

	/**
     * 获取 占位符vnode 所代表的 组件的组件vnode 的真实元素类型(div、span...)如果不是 继续向下寻找直到找到真实代表的元素类型
	 * @param vnode
	 * @returns {*}
	 */
	function isPatchable(vnode) {
		// 获取占位符vnode 代表的组件的实例vm
        while (vnode.componentInstance) {
            // vnode = 组件的组件vnode   如果 组件vnode的第一个vnode还是 占位符vnode继续向子组件寻找
            vnode = vnode.componentInstance._vnode
        }
        return isDef(vnode.tag)
    }

    /**
     * 调用vnode 在create阶段 的 对元素属性处理的回调方法
     * @param  {[type]} vnode              [vnode]
     * @param  {[type]} insertedVnodeQueue [description]
     * @return {[type]}                    [description]
     */
    function invokeCreateHooks(vnode, insertedVnodeQueue) {
        // 分别回调 create的时候处理属性的方法
        for (let i = 0; i < cbs.create.length; ++i) {
            cbs.create[i](emptyNode, vnode)
        }
        // 如果处理的vnode节点是 组件节点
        i = vnode.data.hook // Reuse variable
        // 且定义了钩子函数
        if (isDef(i)) {
            // 回调 钩子create钩子函数  详见 create-component.js  componentVNodeHooks 
            if (isDef(i.create)) i.create(emptyNode, vnode)
            if (isDef(i.insert)) insertedVnodeQueue.push(vnode)
        }
    }

    // set scope id attribute for scoped CSS.
    // this is implemented as a special case to avoid the overhead
    // of going through the normal attribute patching process.
    function setScope(vnode) {
        let i
        if (isDef(i = vnode.fnScopeId)) {
            nodeOps.setStyleScope(vnode.elm, i)
        } else {
            let ancestor = vnode
            while (ancestor) {
                if (isDef(i = ancestor.context) && isDef(i = i.$options._scopeId)) {
                    nodeOps.setStyleScope(vnode.elm, i)
                }
                ancestor = ancestor.parent
            }
        }
        // for slot content they should also get the scopeId from the host instance.
        if (isDef(i = activeInstance) &&
            i !== vnode.context &&
            i !== vnode.fnContext &&
            isDef(i = i.$options._scopeId)
        ) {
            nodeOps.setStyleScope(vnode.elm, i)
        }
    }

    function addVnodes(parentElm, refElm, vnodes, startIdx, endIdx, insertedVnodeQueue) {
        for (; startIdx <= endIdx; ++startIdx) {
            createElm(vnodes[startIdx], insertedVnodeQueue, parentElm, refElm, false, vnodes, startIdx)
        }
    }

    function invokeDestroyHook(vnode) {
        let i, j
        const data = vnode.data
        if (isDef(data)) {
            if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode)
            for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
        }
        if (isDef(i = vnode.children)) {
            for (j = 0; j < vnode.children.length; ++j) {
                invokeDestroyHook(vnode.children[j])
            }
        }
    }

    function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
        for (; startIdx <= endIdx; ++startIdx) {
            const ch = vnodes[startIdx]
            if (isDef(ch)) {
                if (isDef(ch.tag)) {
                    removeAndInvokeRemoveHook(ch)
                    invokeDestroyHook(ch)
                } else { // Text node
                    removeNode(ch.elm)
                }
            }
        }
    }

    function removeAndInvokeRemoveHook(vnode, rm) {
        if (isDef(rm) || isDef(vnode.data)) {
            let i
            const listeners = cbs.remove.length + 1
            if (isDef(rm)) {
                // we have a recursively passed down rm callback
                // increase the listeners count
                rm.listeners += listeners
            } else {
                // directly removing
                rm = createRmCb(vnode.elm, listeners)
            }
            // recursively invoke hooks on child component root node
            if (isDef(i = vnode.componentInstance) && isDef(i = i._vnode) && isDef(i.data)) {
                removeAndInvokeRemoveHook(i, rm)
            }
            for (i = 0; i < cbs.remove.length; ++i) {
                cbs.remove[i](vnode, rm)
            }
            if (isDef(i = vnode.data.hook) && isDef(i = i.remove)) {
                i(vnode, rm)
            } else {
                rm()
            }
        } else {
            removeNode(vnode.elm)
        }
    }


	/**
     * Vue Component Diff算法的核心
	 * @param parentElm
	 * @param oldCh
	 * @param newCh
	 * @param insertedVnodeQueue
	 * @param removeOnly
	 */
    function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {
        let oldStartIdx = 0
        let newStartIdx = 0
        let oldEndIdx = oldCh.length - 1
        let oldStartVnode = oldCh[0]
        let oldEndVnode = oldCh[oldEndIdx]
        let newEndIdx = newCh.length - 1
        let newStartVnode = newCh[0]
        let newEndVnode = newCh[newEndIdx]
        let oldKeyToIdx, idxInOld, vnodeToMove, refElm

        // removeOnly is a special flag used only by <transition-group>
        // to ensure removed elements stay in correct relative positions
        // during leaving transitions
        const canMove = !removeOnly

        if (process.env.NODE_ENV !== 'production') {
            // 判断数组中是否存在相同的key
            checkDuplicateKeys(newCh)
        }


        /*

            updateChildren 就是一个 通过新旧Vnode的比较来尽可能通过 DOM的移动 保留 而减少DOM元素的新建、删除的操作

            因为我们 一组元素当 改变的时候 一般情况都是 修改了其中一个 或者 元素的位置发生了改变 获取全部发生改变。
            而Vue 的比较方法 是优先考虑这种 情况的

            所以比较规则是 在一次循环下 依次比较一个  新旧vnodes 第一个，最后一个，第一最后，最后第一 这四种情况是否相同
            （可以减少循环次数 而不是新vnodes数组的n次 而是最少的n/2次），
            然后 通过 <el key=12> key来查找旧vnode数组中是否存在  然后依次操作新vnode数组，
            按照新vnodes数组  在 parentEl的 子元素上进行元素 的平移，插入。
            最后添加或者删除 剩余的元素

            所以关键就有下面的 旧vnode数组、新vnodes数组、 DOM树 、 新旧起始下标。

            我们已一个就    0 - 1 - 2 - 3 - 4
                    新    1 - 0 - 5 - 2
                 DOM树    0 - 1 - 2 - 3 - 4
           oldStartIdx   : 0
           oldEndIdx     : 4
           newStartIdx   : 0
           newEndIdx     : 3

           下一步：
            我们已一个就    0 - u - 2 - 3 - 4
                    新    1 - 0 - 5 - 2
                 DOM树    1 - 0 - 2 - 3 - 4
           oldStartIdx   : 0
           oldEndIdx     : 4
           newStartIdx   : 1
           newEndIdx     : 3

            下一步：
            我们已一个就    0 - u - 2 - 3 - 4
                    新    1 - 0 - 5 - 2
                 DOM树    1 - 0 - 2 - 3 - 4
           oldStartIdx   : 1
           oldEndIdx     : 4
           newStartIdx   : 2
           newEndIdx     : 3

           下一步：
            我们已一个就    0 - u - 2 - 3 - 4
                    新    1 - 0 - 5 - 2
                 DOM树    1 - 0 - 2 - 3 - 4
           oldStartIdx   : 2
           oldEndIdx     : 4
           newStartIdx   : 2
           newEndIdx     : 3

           下一步：
            我们已一个就    0 - u - 2 - 3 - 4
                    新    1 - 0 - 5 - 2
                 DOM树    1 - 0 - 3 - 4 - 2
           oldStartIdx   : 3
           oldEndIdx     : 4
           newStartIdx   : 2
           newEndIdx     : 2

           下一步：
            我们已一个就    0 - u - 2 - 3 - 4
                    新    1 - 0 - 5 - 2
                 DOM树    1 - 0 - 5 - 3 - 4 - 2
           oldStartIdx   : 3
           oldEndIdx     : 4
           newStartIdx   : 3
           newEndIdx     : 2

           执行 newStartIdx > newEndIdx
           删除 DOM 树  3 - 4 的节点

           最后生成 ：
                 DOM树    1 - 0 - 5 - 2

         */
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (isUndef(oldStartVnode)) {
                oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
            } else if (isUndef(oldEndVnode)) {
                oldEndVnode = oldCh[--oldEndIdx]
            } else if (sameVnode(oldStartVnode, newStartVnode)) {
                patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue)
                oldStartVnode = oldCh[++oldStartIdx]
                newStartVnode = newCh[++newStartIdx]
            } else if (sameVnode(oldEndVnode, newEndVnode)) {
                patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue)
                oldEndVnode = oldCh[--oldEndIdx]
                newEndVnode = newCh[--newEndIdx]
            } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
                patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue)
                canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm))
                oldStartVnode = oldCh[++oldStartIdx]
                newEndVnode = newCh[--newEndIdx]
            } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
                patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue)
                canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
                oldEndVnode = oldCh[--oldEndIdx]
                newStartVnode = newCh[++newStartIdx]
            } else {
                // 将原来的vNode 数组 按照 key -> index (key , 数组下标) 的方式生成一个 key下标对象
                if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)

                // 如果当前处理的新vnode key 在旧的数组中 找到  那么就返回该vnode在旧数组中的下标
                // 如果没有找到
                idxInOld = isDef(newStartVnode.key) ?
                    oldKeyToIdx[newStartVnode.key] :
                    findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx)

                if (isUndef(idxInOld)) { // New element
                    createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm, false, newCh, newStartIdx)
                } else {
                    vnodeToMove = oldCh[idxInOld]
                    if (sameVnode(vnodeToMove, newStartVnode)) {
                        patchVnode(vnodeToMove, newStartVnode, insertedVnodeQueue)
                        oldCh[idxInOld] = undefined
                        canMove && nodeOps.insertBefore(parentElm, vnodeToMove.elm, oldStartVnode.elm)
                    } else {
                        // same key but different element. treat as new element
                        createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm, false, newCh, newStartIdx)
                    }
                }
                newStartVnode = newCh[++newStartIdx]
            }
        }
        if (oldStartIdx > oldEndIdx) {
            refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
            addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
        } else if (newStartIdx > newEndIdx) {
            removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
        }
    }

	/**
     * 判断数组vNode中是否存在重复的key
	 * @param children
	 */
	function checkDuplicateKeys(children) {
        const seenKeys = {}
        for (let i = 0; i < children.length; i++) {
            const vnode = children[i]
            const key = vnode.key
            if (isDef(key)) {
                if (seenKeys[key]) {
                    warn(
                        `Duplicate keys detected: '${key}'. This may cause an update error.`,
                        vnode.context
                    )
                } else {
                    seenKeys[key] = true
                }
            }
        }
    }

	/**
     * 在 旧的vnode数组数组中 通过 samveVnode的方式去寻找 与新vnode(node)相同的 vnode的下标
	 * @param node
	 * @param oldCh
	 * @param start
	 * @param end
	 * @returns {*}
	 */
    function findIdxInOld(node, oldCh, start, end) {
        for (let i = start; i < end; i++) {
            const c = oldCh[i]
            if (isDef(c) && sameVnode(node, c)) return i
        }
    }


/**
    *
 * @param oldVnode    旧vnode对象
 * @param vnode       更新后的新vnode对象
 * @param insertedVnodeQueue     插入队列
 * @param removeOnly
 */
function patchVnode(oldVnode, vnode, insertedVnodeQueue, removeOnly) {
	if (oldVnode === vnode) {
		return
	}

	const elm = vnode.elm = oldVnode.elm

	if (isTrue(oldVnode.isAsyncPlaceholder)) {
		if (isDef(vnode.asyncFactory.resolved)) {
			hydrate(oldVnode.elm, vnode, insertedVnodeQueue)
		} else {
			vnode.isAsyncPlaceholder = true
		}
		return
	}

	// reuse element for static trees.
	// note we only do this if the vnode is cloned -
	// if the new node is not cloned it means the render functions have been
	// reset by the hot-reload-api and we need to do a proper re-render.
	if (isTrue(vnode.isStatic) &&
		isTrue(oldVnode.isStatic) &&
		vnode.key === oldVnode.key &&
		(isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
	) {
		vnode.componentInstance = oldVnode.componentInstance
		return
	}

	let i
	const data = vnode.data
	// 在 createComponent的时候我们调用 vnode.data.hook.init ；
	// 如果新的vnode上存在vnode.data.hook 这就说明这是一个占位符vnode，也就是一个组件
	// 当我们更新组件的时候我们调用 prepatch
	// 此处就是  我们 父组件 通过props 去通知子组件更新的开始
	if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
		i(oldVnode, vnode)
	}

	const oldCh = oldVnode.children
	const ch = vnode.children

	// 如果定义了 data属性 且不是一个文本节点类型的元素 那么就执行元素上的更新钩子函数
	//  （文本节点不需要执行update 因为没有属性这个概念，而占位符vnode的组件vnode如果就是文本节点 那么也应该不需要执行update）
	//
	// 如果定义了 data 说明元素 属性可能修改过。
	// 为什么判断isPatchable(vnode) ???
	//    说明：
	//    isPatchable 判断的就是其真实的节点是不是元素节点
	//  因为Vue中vnode 可能为两种 元素vnode 和 占位符vnode
	//      对于元素vnode 返回的就是 元素的类型(对于文本节点  tag === undefined 所以为false)
	//      对于占位符节点 其真实节点也有可能不是一个元素节点
	if (isDef(data) && isPatchable(vnode)) {
		// 调用 各平台中vnode 在update的时候 钩子函数，如 updateClass updateStyle ...
		for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
		// 如果定义了hook 那么说明是 占位符vnode，调用其update的生命周期钩子函数
		if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
	}



	if (isUndef(vnode.text)) {
		//如果新vnode 不是文本节点

		// 如果都存在 子节点
		if (isDef(oldCh) && isDef(ch)) {
			// 最复杂的就是都存在子节点  此时更新子节点
			// *****
			if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)

			//如果 新vnode存在子节点 而旧vnode不存在
		} else if (isDef(ch)) {
			// 判断一下如果旧的vnode 为文本节点 那么其text就存在值  所以 将清空
			if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
			addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)

			// 如果是旧的vnode 存在子节点  而新的vnode 不存在 那么应该是 删除子节点
		} else if (isDef(oldCh)) {
			removeVnodes(elm, oldCh, 0, oldCh.length - 1)
			//如果都没有子节点 上面判断新的vnode 不是 文本节点，那么就是旧的是文本节点 那就直接设置text = '';
		} else if (isDef(oldVnode.text)) {
			nodeOps.setTextContent(elm, '')
		}

		// 新的vnode是文本节点，如果新的vnode 的text 跟就的不同  那么就 直接按照新的vnode文本节点 插入
	} else if (oldVnode.text !== vnode.text) {
		nodeOps.setTextContent(elm, vnode.text)
	}
	if (isDef(data)) {
		if (isDef(i = data.hook) && isDef(i = i.postpatch)) i(oldVnode, vnode)
	}
}

    function invokeInsertHook(vnode, queue, initial) {
        // delay insert hooks for component root nodes, invoke them after the
        // element is really inserted
        if (isTrue(initial) && isDef(vnode.parent)) {
            vnode.parent.data.pendingInsert = queue
        } else {
            for (let i = 0; i < queue.length; ++i) {
                queue[i].data.hook.insert(queue[i])
            }
        }
    }

    let hydrationBailed = false
    // list of modules that can skip create hook during hydration because they
    // are already rendered on the client or has no need for initialization
    // Note: style is excluded because it relies on initial clone for future
    // deep updates (#7063).
    const isRenderedModule = makeMap('attrs,class,staticClass,staticStyle,key')

    // Note: this is a browser-only function so we can assume elms are DOM nodes.
    function hydrate(elm, vnode, insertedVnodeQueue, inVPre) {
        let i
        const { tag, data, children } = vnode
        inVPre = inVPre || (data && data.pre)
        vnode.elm = elm

        if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
            vnode.isAsyncPlaceholder = true
            return true
        }
        // assert node match
        if (process.env.NODE_ENV !== 'production') {
            if (!assertNodeMatch(elm, vnode, inVPre)) {
                return false
            }
        }
        if (isDef(data)) {
            if (isDef(i = data.hook) && isDef(i = i.init)) i(vnode, true /* hydrating */ )
            if (isDef(i = vnode.componentInstance)) {
                // child component. it should have hydrated its own tree.
                initComponent(vnode, insertedVnodeQueue)
                return true
            }
        }
        if (isDef(tag)) {
            if (isDef(children)) {
                // empty element, allow client to pick up and populate children
                if (!elm.hasChildNodes()) {
                    createChildren(vnode, children, insertedVnodeQueue)
                } else {
                    // v-html and domProps: innerHTML
                    if (isDef(i = data) && isDef(i = i.domProps) && isDef(i = i.innerHTML)) {
                        if (i !== elm.innerHTML) {
                            /* istanbul ignore if */
                            if (process.env.NODE_ENV !== 'production' &&
                                typeof console !== 'undefined' &&
                                !hydrationBailed
                            ) {
                                hydrationBailed = true
                                console.warn('Parent: ', elm)
                                console.warn('server innerHTML: ', i)
                                console.warn('client innerHTML: ', elm.innerHTML)
                            }
                            return false
                        }
                    } else {
                        // iterate and compare children lists
                        let childrenMatch = true
                        let childNode = elm.firstChild
                        for (let i = 0; i < children.length; i++) {
                            if (!childNode || !hydrate(childNode, children[i], insertedVnodeQueue, inVPre)) {
                                childrenMatch = false
                                break
                            }
                            childNode = childNode.nextSibling
                        }
                        // if childNode is not null, it means the actual childNodes list is
                        // longer than the virtual children list.
                        if (!childrenMatch || childNode) {
                            /* istanbul ignore if */
                            if (process.env.NODE_ENV !== 'production' &&
                                typeof console !== 'undefined' &&
                                !hydrationBailed
                            ) {
                                hydrationBailed = true
                                console.warn('Parent: ', elm)
                                console.warn('Mismatching childNodes vs. VNodes: ', elm.childNodes, children)
                            }
                            return false
                        }
                    }
                }
            }
            if (isDef(data)) {
                let fullInvoke = false
                for (const key in data) {
                    if (!isRenderedModule(key)) {
                        fullInvoke = true
                        invokeCreateHooks(vnode, insertedVnodeQueue)
                        break
                    }
                }
                if (!fullInvoke && data['class']) {
                    // ensure collecting deps for deep class bindings for future updates
                    traverse(data['class'])
                }
            }
        } else if (elm.data !== vnode.text) {
            elm.data = vnode.text
        }
        return true
    }

    function assertNodeMatch(node, vnode, inVPre) {
        if (isDef(vnode.tag)) {
            return vnode.tag.indexOf('vue-component') === 0 || (!isUnknownElement(vnode, inVPre) &&
                vnode.tag.toLowerCase() === (node.tagName && node.tagName.toLowerCase())
            )
        } else {
            return node.nodeType === (vnode.isComment ? 8 : 3)
        }
    }

    /**
     * 将组件 vnode 转换成真实的DOM
     *
     * 在 code/instance/lifecycle.js 我们_update()的时候
     * prevVnode = vm._vnode
     * 当组件初次加载的时候 preVnode 肯定为 undefined
     *
     * if (!prevVnode) {
     *      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false )
     *
     * // 当组件更新的时候 因为我们 已经执行了 vm._vnode = vnode 所以存在
     * } else {
     *      vm.$el = vm.__patch__(prevVnode, vnode)
     * }
     *
     *
     * 可以 patch分为两种情况
     *  1、 组件初次加载的时候
     *      oldVnode  === vm.$el  对于根组件 其一般使用$el 去绑定一个元素 所以这个 === DOM(div#app),而对于子组件 undefined
     *      vnode                 组件的组件vnode
     *      hydrating           :
     *      removeOnly          : false
     *
     *  2、 更新的时候  vm.__patch__(prevVnode, vnode)
     *      oldVnode    :   prevVnode   旧的vNode
     *      vnode       :   vnode       新render生成的VNode
     *
     *    对于组件的更新 其情况分为
     *    2.1、 sameVnode(oldVnode, vnode) 当前组件节点相同
     *
     *
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
}