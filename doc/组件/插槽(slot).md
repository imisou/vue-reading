# slot详解

我们使用Slot插槽的方式
```html
<yz-header>
    <template slot="header" slot-scope="scope">
        <h1>Here might be a page title : {{scope.scopeProps.name}}</h1>
    </template>
    <p>A paragraph for the main content.</p>
    <p>And another one.</p>
    <p slot="footer">Here's some contact info</p>
</yz-header>
```

插槽插入的地方 使用的方式是：
```html
<div class="container">
    <header>
        <slot name="header" v-bind:scopeProps="obj">
            <h1>this is default header : {{obj.name}}</h1>
        </slot>
    </header>
    <main>
        <slot></slot>
    </main>
    <slot name="extend">
        <p>this is extend default content</p>
    </slot>    
    <footer>
        <slot name="footer"></slot>
    </footer>
</div>
```
### 第一步：编译过程

#### 1.1 parse() 转AST对象的过程

可见对于占位符slot(<slot name="footer"></slot>) 其处理是在 processSlot()中。
保存原来的slot节点名称 并将插槽名称 保存在el.slotName属性上。

```js
el = {
    tag : 'slot',
    slotName : 'header'
}
```

对于插槽内容我们定义的方式比较多：

1. \<p slot="footer">Here's some contact info\</p>一个元素上添加一个 slot属性
2. 默认的节点
3. <template slot="header" slot-scope="scope"></template>template节点上有slot
4. 作用域插槽

1. 我们先不管作用域插槽 只管其他的发现其重点的属性为 slot="header"， 我们发现其主要是在

```js
const slotTarget = getBindingAttr(el, 'slot')
if (slotTarget) {
    el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
    // preserve slot as an attribute for native shadow DOM compat
    // only for non-scoped slots.
    if (el.tag !== 'template' && !el.slotScope) {
        addAttr(el, 'slot', slotTarget)
    }
}
```
中处理的，先获取响应式属性(可以为静态属性)slot的值，如果没有定义那么默认为default,这样
\<span slot>xxx\</span>  === \<span>xxx\</span> === \<span slot='default'>xxx\</span>

```js
el = {
    tag : 'span',
    attrs : [{
        'slot' : 'header'
    }],
    slot : 'header'
}
```
下面是对于作用域插槽的处理：

```js
let slotScope
if (el.tag === 'template') {
    // <template slot="scope"></template>
    slotScope = getAndRemoveAttr(el, 'scope')
        /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && slotScope) {
        warn(
            `the "scope" attribute for scoped slots have been deprecated and ` +
            `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
            `can also be used on plain elements in addition to <template> to ` +
            `denote scoped slots.`,
            true
        )
    }
    //  也支持 <template slot-scope="scope"></template>
    el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
} else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
        warn(
            `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
            `(v-for takes higher priority). Use a wrapper <template> for the ` +
            `scoped slot to make it clearer.`,
            true
        )
    }
    el.slotScope = slotScope
}
```
对于作用域插槽，一方面其将属性名为 scope | slot-scope 的值存放在节点的 slotScope属性上。
另外
```js
start(tag, attrs, unary) {
    //...
    if (currentParent && !element.forbidden) {
        if (element.slotScope) { // scoped slot
            // 处理对于插槽的实例节点 其如果在其中定义了slot-scope || scope = 'header' 的这种节点的处理
            /*
                <template slot="header" slot-scope="slotProps">
                    <h1>Here might be a page title : {{slotProps.name}}</h1>
                </template>
             */
            // 同样对于 <slot></slot>这种节点元素其也只是一个插槽，不需要生成实际的节点
            currentParent.plain = false
            // 插槽的默认名称 为default 
            const name = element.slotTarget || '"default"';
            // 插槽的节点 存放在 parent.scopedSlots 属性上，而不是像其他的节点 放在 children属性 上
            // TODO: 插槽 slot
            (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        } else {
            // 如上面 currentParent = div 那么此时就构成了 div>span 的树
            currentParent.children.push(element)
            // span 的父节点  也就指向 div
            element.parent = currentParent
        }
    }
  
},

```
如果此节点存在作用域插槽，那么节点就不插入到父节点的children属性中，而是存放在 currentParent.scopedSlots属性中

对于父节点：
```js
parentEl = {
   scopedSlots : {
       'header' : el(节点AST)
   } 
}
```
对于scope节点
```js
el = {
   slotScope : 'scope'
}
```


###### processSlot()代码
```js
/**
 * 处理 slot 插槽相关的属性
 *   <slot name="header"></slot> 
 * 
 *   <template slot="scope"></template>
 *   <template slot-scope="scope"></template>
 * 
 * @param {*} el 
 */
function processSlot(el) {
    if (el.tag === 'slot') {
        // 支持 <slot name="header"></slot> <slot :name="header"></slot> <slot v-bind:name="header"></slot>
        el.slotName = getBindingAttr(el, 'name')
        if (process.env.NODE_ENV !== 'production' && el.key) {
            warn(
                `\`key\` does not work on <slot> because slots are abstract outlets ` +
                `and can possibly expand into multiple elements. ` +
                `Use the key on a wrapping element instead.`
            )
        }
    } else {
        let slotScope
        if (el.tag === 'template') {
            // <template slot="scope"></template>
            slotScope = getAndRemoveAttr(el, 'scope')
            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && slotScope) {
                warn(
                    `the "scope" attribute for scoped slots have been deprecated and ` +
                    `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
                    `can also be used on plain elements in addition to <template> to ` +
                    `denote scoped slots.`,
                    true
                )
            }
            //  也支持 <template slot-scope="scope"></template>
            el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
        } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
                warn(
                    `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
                    `(v-for takes higher priority). Use a wrapper <template> for the ` +
                    `scoped slot to make it clearer.`,
                    true
                )
            }
            el.slotScope = slotScope
        }
        // 处理 含有slot属性 
        // <div slot="header"></div>
        const slotTarget = getBindingAttr(el, 'slot')
        if (slotTarget) {
            el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
            // preserve slot as an attribute for native shadow DOM compat
            // only for non-scoped slots.
            if (el.tag !== 'template' && !el.slotScope) {
                addAttr(el, 'slot', slotTarget)
            }
        }
    }
}
```

### 第二步: generate() AST -> 表达式字符串

#### 1. 处理占位符插槽 

对于占位符插槽其先判断 el.tag === 'slot' 然后通过 genSlot()进行处理。

1.1. 获取其占位符slot的name属性 没有就初始化为'"default"'

1.2. 编译其children子节点作为其默认节点

1.3. 处理attrs (占位符插槽上的静态属性 如 id="xxx")

1.4. 生成scope的bind对象，如 \<slot name="header" v-bind:scopeProps="obj" :address="address"> => bind = {scopeProps : obj , address:'address' }

1.5. 生成表达式字符串

 _t("header", [_c('h1',[_v("this is default header : "+_s(obj.name))])] ,{ scopeProps:obj })

发现其主要的为 _t() 方法

```js
/**
 * 处理 
  <slot name="header" v-bind:scopeProps="obj">
    <span>slot header</span>
  </slot>

  el : 
  {
      tag : 'slot',
      slotName : 'header',
      attrsList : [{
          name : 'v-bind:scopeProps',
          value : 'obj'
      }]
  }
  generate : 
  _t("header", [_c('h1',[_v("this is default header : "+_s(obj.name))])] ,{ scopeProps:obj })
 * @param {*} el 
 * @param {*} state 
 */
function genSlot(el: ASTElement, state: CodegenState): string {
    // 获取slot的name属性
    const slotName = el.slotName || '"default"'
    // slot 的子节点 "[_c('span',[_v("slot header")])]" 
    const children = genChildren(el, state)
    // res = _t('header' , children | '')
    let res = `_t(${slotName}${children ? `,${children}` : ''}`
    // 获取slot上绑定的一个 响应式属性  如 :id = "count"
    const attrs = el.attrs && `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
    // slot 上绑定的 v-bind="{xxx:xx}"
    const bind = el.attrsMap['v-bind']
    if ((attrs || bind) && !children) {
        res += `,null`
    }
    if (attrs) {
        res += `,${attrs}`
    }
    if (bind) {
        res += `${attrs ? '' : ',null'},${bind}`
    }
    // 生成的结果就是  _t('header' , children | '' , attrs , bind )四个参数
    // _t("default",[_c('span',[_v("slot name")])],{id:count},count)
    return res + ')'
}
```

#### 2. 处理插槽内容节点

在parse() 的时候对于插槽内容节点其主要放在属性上 如 el.slotTarget、 el.scopedSlot，在generate()中大部分的属性是在genData()时候处理

2.1 对于slot属性的处理，其在el.slotTarget上 生成表达式字符串的时候直接在data属性对象上添加一个data += 'slot:${el.slotTarget}',
```js
/**
 * 处理 el.data属性 生成我们创建节点的 data属性的值
 * @param {*} el 
 * @param {*} state 
 */
export function genData(el: ASTElement, state: CodegenState): string {
    
    // slot target
    // only for non-scoped slots
    // 处理 <template slot="header" ></template>  <p slot="footer"></p>
    //  结果为 template : { attrs: { slot: "footer" }, slot: "footer" }
    if (el.slotTarget && !el.slotScope) {
        data += `slot:${el.slotTarget},`
    }
    // scoped slots  
    // 如果插槽上还定义了 作用域 scope slot-scope
    // 处理插槽占位符节点 的 父节点上currentParent.scopedSlots[name]属性
    //  如 <template slot-scope="scope"></template> 这种
    if (el.scopedSlots) {
        data += `${genScopedSlots(el.scopedSlots, state)},`
    }
    return data
}
```

##### 2.2 对于scope、slot-scope属性 其也存放在data属性上但是 genScopedSlots()方法处理。

处理方法： 按照el.scopedSlots属性的值生成一个 _u()方法的表达式字符串，每一个scopedSlot属性变成一个{key : name ,fn : 处理函数}的对象
其中fn的入参为 el.slotScope(slot-scope="scope"的scope)返回值为vnode的创建函数 [_c()]。

```js
/**
 * 处理占位符插槽节点 的父节点
    <template slot="header" slot-scope="slotProps">
        <h1>Here might be a page title : {{slotProps.name}}</h1>
    /template>

    header.scopedSlots.header = el(slot);

    {
      scopedSlots : _u([
        {
            key : 'header',
            fn : function (slotProps){
                return [ _c('h1' ,_v('Here might be a page title :' + _s(slotProps.name)) )]
            }
        }
      ])
    }
 * @param {*} slots 保存着占位符插槽的节点
 * @param {*} state 
 */
function genScopedSlots(
    slots: {
        [key: string]: ASTElement },
    state: CodegenState
) : string {
    return `scopedSlots:_u([${
    Object.keys(slots).map(key => {
      return genScopedSlot(key, slots[key], state)
    }).join(',')
  }])`
}
```
对于每一种 slot="header"的处理方式是通过genScopedSlot()进行。其分为3种情况：

1. \<div slot-scope="scope">\</div>

处理方式为：genElement(el, state)
```js
{
    key : 'header',
    fn : function (slotProps){
        return genElement(el, state)
    }
}
```
2. <template slot-scope="scope"></template>

处理方式为：genChildren(el, state) || 'undefined'
```js
{
    key : 'header',
    fn : function (slotProps){
        return genChildren(el, state) || 'undefined'
    }
}
```
所以其支持多个子节点。根节点为template节点。

3. <template slot-scope="scope" v-if="xxx"></template>

处理方式为：`${el.if}?${genChildren(el, state) || 'undefined'}:undefined`
```js
{
    key : 'header',
    fn : function (slotProps){
        return `${el.if}?${genChildren(el, state) || 'undefined'}:undefined`
    }
}
```
生成一个if判断的三目运算字符串。

```js
/**
 * 处理插槽的 slot-scope scope属性 节点
 
 <template slot="header" slot-scope="slotProps">
    <h1>Here might be a page title : {{slotProps.name}}</h1>
 </template>

 el:
    parentEl.scopedSlots.header = {
        tag : 'template',
        slotScope : 'slotProps',
        slotTarget : 'header',
        children : [ ... ]
    }

 generate : 
    {
        key : 'header',
        fn : function (slotProps){
            return [ _c('h1' ,_v('Here might be a page title :' + _s(slotProps.name)) )]
        }
    }

 * @param {*} key 
 * @param {*} el 
 * @param {*} state 
 */
function genScopedSlot(
    key: string,
    el: ASTElement,
    state: CodegenState
): string {
    // 判断作用域插槽上是否存在 v-for 
    if (el.for && !el.forProcessed) {
        return genForScopedSlot(key, el, state)
    }
     /*
    一般的作用域插槽
    返回一个函数入参为作用的名称，返回为插槽的子节点
    
    1. <template slot-scope="scope"></template>
     => genChildren(el, state) || 'undefined'
    2. <div slot-scope="scope"></div>
     => genElement(el, state)
    3. <template slot-scope="scope" v-if="xxx"></template>
     => `${el.if}?${genChildren(el, state) || 'undefined'}:undefined`
     */
    const fn = `function(${String(el.slotScope)}){` +
        `return ${el.tag === 'template'
      ? el.if
        ? `${el.if}?${genChildren(el, state) || 'undefined'}:undefined`   // <template slot-scope="scope" v-if="xxx"></template>
        : genChildren(el, state) || 'undefined'    // <template slot-scope="scope"></template>
      : genElement(el, state)    // <div slot-scope="scope"></div>
    }}`
    // {key:"header",fn:function(slotProps){return [_c('h1',[_v("Here might be a page title : "+_s(slotProps.name))])]}}
    return `{key:${key},fn:${fn}}`
}
```








### 第三步： render的时候

> 在第二步generate的时候主要借助于除_c() 以外的 _u() _t()两个方法。

我们对于slot还是两个地方： 一个是占位符节点中定义的插槽内容 slotTarget、scopedSlots；一个是组件节点中 占位符插槽 _t()。

#### 3.1 插槽内容

> 在第二步中我们对于 占位符组件下的子节点中存在 slot="header"属性的节点的处理方式是将其放在节点的attrs属性上

如：
```
el: {
    tag : "div",
    attrs: { slot: "footer" }, 
    slot: "footer" 
}
```
那么Vue在哪里去处理这个

###### code/instance/render.js
```js
export function initRender(vm: Component) {
    ...
    // 处理占位符节点下的插槽
    vm.$slots = resolveSlots(options._renderChildren, renderContext)
    // 初始化 作用域插槽 vm.$slot = {}
    vm.$scopedSlots = emptyObject
    
    ...
}
```
我们发现对于占位符节点的slot，其是一个深度遍历的过程。不断遍历el.children属性，如果发现节点data.attrs.slot存在，那么这就是一个slot的节点。其存放在 vm.$slots属性上。
如:
```js
vm.$slots = {
    'default' :[
        VNode1,
        VNode2
    ],
    'header' : [
        VNode1,
        VNode2
    ]
}
```
```js
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
 */
export function resolveSlots(
    children: ? Array < VNode > ,
    context : ? Component
): {
    [key: string]: Array < VNode >
} {
    // 定义一个空的对象用于保存 所有的不是作用域插槽的 插槽，其是一个深度遍历的过程
    const slots = {}
    if (!children) {
        return slots
    }
    // 遍历子组件
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
```
##### 对于 作用域插槽 el.scopedSlot

> 在第二步中 其生成的表达式字符串为 

```
scopedSlots : _u([
    {
        key : 'header',
        fn : function (slotProps){
                return [ _c('h1' ,_v('Here might be a page title :' + _s(slotProps.name)) )]
        }
    }
])
```
> 借助了_u() 即vm._u()方法。那么在render的时候调用_u()方法

我们知道 在initRender的时候 一方面处理了通过 vm.$slots = resolveSlots(options._renderChildren, renderContext)处理了slot属性；例外也初始化了 vm.$scopedSlots = emptyObject。

###### 总结：
vm._u()的作用就是 将 vnode.scopedSlots变成一个 slotTarget : fn 的键值对。

###### core/instance/render-helpers/index.js 
###### vm._u()
```js
/**
 * 处理 在编译的时候 作用域插槽节点  其
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
```


#### 3.2 占位符插槽

> 在第二步中我们对于 <slot name="xxx"></slot>生成的表达式字符串 是一个 _t()方法   

###### vm._t()
```js
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
  
  其获取插槽内容规则是：
  slot-scope属性 > slot="xxx"属性

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
    // 组件实例中已定义此插槽
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
        nodes = scopedSlotFn(props) || fallback
    } else {
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

    const target = props && props.slot
    if (target) {
        return this.$createElement('template', { slot: target }, nodes)
    } else {
        return nodes
    }
}
```
###### this.$scopedSlots是在什么时候定义的？

在子组件 _render的时候其vm.$scopeSlots = _parentVnode.data.scopedSlots 即占位符VNode的data.scopedSlots属性。所以对于占位符节点的孙节点slot-scope将是无效的。

如 : \<yz-header> \<div>\<p slot-scope="scope">And another one. {{scope}}\</p>\</div> \</yz-header>
```js
Vue.prototype._render = function(): VNode {
    if (_parentVnode) {
        vm.$scopedSlots = _parentVnode.data.scopedSlots || emptyObject
    }
}
```
##### 注意：

1. slot属性不是占位符Vnode 的子节点而是孙节点的时候将无效。
```html
<yz-header>
    <div>
        <template slot="header" slot-scope="scope">
            <h1>Here might be a page title : {{scope.scopeProps.name}}</h1>
        </template>
    </div>
    <p>A paragraph for the main content.</p>
    <p slot-scope="scope">And another one. {{scope}}</p>
   
</yz-header>
```

2. 如果占位符Vnode中定义的具名插槽不是组件占位符节点的子节点而是孙节点将无效

```html
<yz-header>
    <div>
        <template slot="header" slot-scope="scope">
            <h1>Here might be a page title : {{scope.scopeProps.name}}</h1>
        </template>
    </div>
</yz-header>
```
```js
<div class="container">
    <header>
        <slot name="header" v-bind:scopeProps="obj">
            <h1>this is default header : {{obj.name}}</h1>
        </slot>
    </header>
</div>
```

结果为 : \<h1>this is default header : {{obj.name}}\</h1>。  而不是 \<h1>Here might be a page title : {{scope.scopeProps.name}}\</h1>

###### 原因：

请看上面对于组件占位符Vnode中获取slot插槽内容的方法为 resolve() 其只遍历了子节点 并存放在组件占位符Vnode的实例vm.$slots属性上。然后看在组件vnode中遇到slot的时候其调用的是 vm._u()方法 只获取了this.$scopedSlots 和 this.$slot中此name的插槽内容。而孙节点的只有scopeSlots属性 并且其存放在其父节点所以
vm.$scopedSlots = _parentVnode.data.scopedSlots || emptyObject 时获取不到此scopedSlots


3. 如果在默认插槽节点上定义了slot-scope属性，就会使得其变成 slot="default"节点，而其他的没有定义slot="default"的将会被覆盖。

```js
<div class="container">
   <slot></slot> 
</div>
```
如果是
```js
<yz-header>
    <p>A paragraph for the main content.</p>
    <p>And another one. {{scope}}</p>
</yz-header>
```
输出的结果为 :
A paragraph for the main content.

And another one. {{scope}}

而如果是：
```js
<yz-header>
    <p>A paragraph for the main content.</p>
    <p slot-scope="scope">And another one. {{scope}}</p>
</yz-header>
```
则变成 And another one. {{scope}} 第一个p节点被覆盖。

###### 原因：

对于resolveSlots()的时候其 vm.$slots.default = [VNode,VNode] 还是有两个默认插槽内容，
但是当renderSlot() 的时候因为其先获取 const scopedSlotFn = this.$scopedSlots[name]，

而对于 \<p slot-scope="scope">And another one. {{scope}}\</p> 其定义的时候在组件占位符Vnode的 vm.$scopedSlots已经定义了 default的fn为 p 而不会去遍历 vm.$slots里面所有的default节点。


### 作用域问题

> 为什么普通的插槽内容其响应式数据是父组件的，而作用域插槽其作用域是子组件vm的?

插槽作用域主要是有其_render()的时候觉得的(表达式字符串转VNode的时候)。

而插槽主要在 renderSlot()时候去插入组件VNode

```js
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
       
        nodes = scopedSlotFn(props) || fallback
    } else {
        // 如果没有在 this.$scopedSlots 中定义 才会从 this.$slots中去寻找。
        const slotNodes = this.$slots[name]
       
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
```
1. 对于普通的插槽内容其render的时候是父组件render的时候，然后在子组件上通过this.$slot[name]找到的时候是直接  return nodes ; 是一个地址的引用其作用域还是父组件的。

当父组件触发更新的时候会触发父组件的渲染Watcher重新渲染VNode，而此时子组件插槽内容只是父组件的一个对象引用所以就直接更新了。

2. 对于 slot-scope 定义的作用域插槽 其返回的是 this.$createElement('template', { slot: target }, nodes) 去重新创建属于子组件作用的VNode，所以其作用域是子组件的

对于作用域插槽来说，其重新 this.$createElement() 所以其VNode绑定的子组件渲染Watcher，当子组件更新才会触发更新。
