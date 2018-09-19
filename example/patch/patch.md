当我们createComponent() 好了以后

那我们就会调用
\_update(vnode: VNode, hydrating ? : boolean)

// 判断vm._vnode 是否存在
// 不存在执行这个  即 new Vue()
if (!prevVnode) {
    // initial render
    vm.$el = vm.**patch**(vm.$el, vnode, hydrating, false /_ removeOnly _/ )
} else {
    // updates
    vm.$el = vm.**patch**(prevVnode, vnode)
}


=>

在 patch中我们定义了
oldVnode => #app元素
vnode => vNode
function patch(oldVnode, vnode, hydrating, removeOnly) {}

=>

createElm(vnode,insertedVnodeQueue,oldElm._leaveCb ? null : parentElm,nodeOps.nextSibling(oldElm))


if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
    return
}

=>
//此时我们判断在前面createComponent的时候 installComponentHooks(data)
if (isDef(i = i.hook) && isDef(i = i.init)) {
    i(vnode, false /* hydrating */ )
}
