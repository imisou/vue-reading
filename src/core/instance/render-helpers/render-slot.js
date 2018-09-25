/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 * 处理运行期间的 <slot ></slot>
 * 
  如： 
  <slot name="header" v-bind:scopeProps="obj">
    <span>slot header</span>
  </slot>
  generate期间：

  _t("header", [_c('h1',[_v("this is default header : "+_s(obj.name))])] ,{ scopeProps:obj })
    

  注意：
  1. 先处理 this.$scopedSlots 再去寻找 this.$slots 导致
    <yz-header>
        <div slot="header">
            <p>this is header1</p>
        </div>
        <div slot="header">
            <p>this is header2</p>
        </div>
    </yz-header>
    返回的结果为 
    this is header1
    this is header2

    <yz-header>
        <div slot="header">
            <p>this is header1</p>
        </div>
        <div slot="header" slot-scope="scope">
            <p>this is header2</p>
        </div>
        <div slot="header" slot-scope="scope">
            <p>this is header3</p>
        </div>
    </yz-header>
    返回的结果为 
    this is header3


    2. 同理 对于
    <yz-header>
        <p>xxxxxxxxxx</p>
        <p>lllllllll</p>
        <p>aaaaaaaaaaaaa</p>
    </yz-header>
    结果为: 
    xxxxxxxxxx
    lllllllll
    aaaaaaaaaaaaa

    而
    <yz-header>
        <p>xxxxxxxxxx</p>
        <p slot-scope="scope">lllllllll</p>
        <p>aaaaaaaaaaaaa</p>
    </yz-header>
    结果就变成了
    lllllllll
 */
export function renderSlot(
    name: string, // 插槽的名称   default
    fallback: ? Array < VNode > , // 插槽的子节点 render函数  [_c('span',[_v("slot name")])]
    props : ? Object, // slot节点上的响应式属性
    bindObject : ? Object // slot节点上 v-bind 指令绑定的属性
): ? Array < VNode > {
    // 获取当前组件实例中 此插槽是否定义
    const scopedSlotFn = this.$scopedSlots[name]
    let nodes
    // 先获取组件VNode中 slot-scope属性上定义的所有的 插槽内容
    if (scopedSlotFn) { // scoped slot
        props = props || {}
        if (bindObject) {
            if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
                warn(
                    'slot v-bind without argument expects an Object',
                    this
                )
            }
            props = extend(extend({}, bindObject), props)
        }
        // 执行slot-scoped属性定义的节点的 fn方法(function(scopeProps){ return [_c(...)]})
        nodes = scopedSlotFn(props) || fallback
    } else {
        // 如果没有在 this.$scopedSlots 中定义 才会从 this.$slots中去寻找。
        const slotNodes = this.$slots[name]
            // warn duplicate slot usage
        if (slotNodes) {
            if (process.env.NODE_ENV !== 'production' && slotNodes._rendered) {
                warn(
                    `Duplicate presence of slot "${name}" found in the same render tree ` +
                    `- this will likely cause render errors.`,
                    this
                )
            }
            slotNodes._rendered = true
        }
        nodes = slotNodes || fallback
    }

    // 如果存在 props && props.slot 即 div.slot-scope="scope"
    const target = props && props.slot
    if (target) {
        return this.$createElement('template', { slot: target }, nodes)
        
    } else {
        return nodes
    }
}