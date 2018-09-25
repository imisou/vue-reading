/* @flow */

import type VNode from 'core/vdom/vnode'

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 */
/*
    对于组件的实例vnode 在编译的时候 其作为节点的一个属性 slot存在
    如
      <p slot="footer">Here's some contact info</p>
    => 
    _c("p", { attrs: { slot: "footer" }, slot: "footer" }, [
		_v("Here's some contact info")
    ])
    
    但是如果插槽上还存在作用域：
    如 
    <template slot="header" slot-scope="slotProps">
      <h1>Here might be a page title : {{slotProps.name}}</h1>
    </template>
    其就不是一个组件的一个子节点 在children 上存在了
    其存在于父节点的scopedSlots属性上 
     _c("p", { 
       scopedSlots : _u([ { key : 'header' ,fn : function(scopeProps){} }]) 
    },[...])


    注意：
        对于占位符节点的插槽内容，如果是具名插槽 其必须是占位符节点的子节点，而不能是孙节点。

 */
export function resolveSlots(
    children: ? Array < VNode > ,
    context : ? Component
): {
    [key: string]: Array < VNode >
} {
    // 定义一个空的对象用于保存 所有的不是作用域插槽的 插槽
    const slots = {}
    if (!children) {
        return slots
    }
    /*
        只遍历的占位符节点的子节点 而没有进行深度遍历
        <yz-header>
            <div>
                <template slot="header" slot-scope="scope">
                    <h1>Here might be a page title : {{scope.scopeProps.name}}</h1>
                </template>
            </div>
        </yz-header>
        这种 slot="header"是无效的
     */
    for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i]
        const data = child.data
        // remove slot attribute if the node is resolved as a Vue slot node
        // 先将插槽节点 保存在属性上的插槽的名称属性删除  attrs: { slot: "footer" }
        if (data && data.attrs && data.attrs.slot) {
            delete data.attrs.slot
        }
        // named slots should only be respected if the vnode was rendered in the
        // same context.
        if ((child.context === context || child.fnContext === context) &&
            data && data.slot != null
        ) {
            // 获取插槽的名称 header
            const name = data.slot
            // 初始化此插槽 slots['header'] = [];
            const slot = (slots[name] || (slots[name] = []))
            // 如果是 <template slot="header"></template>插入的是此节点的子节点
            if (child.tag === 'template') {
                slot.push.apply(slot, child.children || [])
            } else {
                // 否则直接插入子节点
                slot.push(child)
            }
        } else {
            // 如果不在具名插槽下  那么全部移入 slots.default 属性下
            (slots.default || (slots.default = [])).push(child)
        }
    }
    // ignore slots that contains only whitespace
    // 忽略只包含空格的插槽  如 <template slot="footer"></template>没哟子节点 。。。
    for (const name in slots) {
        if (slots[name].every(isWhitespace)) {
            delete slots[name]
        }
    }
    return slots
}

// 判断插槽的节点是否是空的节点
// 如 <div slot="header"></div>
function isWhitespace(node: VNode): boolean {
    return (node.isComment && !node.asyncFactory) || node.text === ' '
}


/**
 * 处理 在编译的时候 作用域插槽节点  其父节点肯定为组件的占位符节点，
 * 所以其所有的作用域都定义在 占位符节点的 el.scopedSlots属性上
  <template slot="header" slot-scope="slotProps">
      <h1>Here might be a page title : {{slotProps.name}}</h1>
  </template>

 在generate : 
   _u([
      {
        key : 'header',
        fn : function (slotProps){
            return [ _c('h1' ,_v('Here might be a page title :' + _s(slotProps.name)) )]
        }
      }
  ])

  scopedSlots : {
     'header' : fn
  }
 * @param {*} fns 
 * @param {*} res 
 */
export function resolveScopedSlots(
    fns: ScopedSlotsData, // see flow/vnode
    res ? : Object
): {
    [key: string]: Function
} {
    res = res || {}
    for (let i = 0; i < fns.length; i++) {
        if (Array.isArray(fns[i])) {
            resolveScopedSlots(fns[i], res)
        } else {
            res[fns[i].key] = fns[i].fn
        }
    }
    return res
}