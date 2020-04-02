# prop属性描述符

- [ ] 详解prop描述符的 textContent 与 value在dom-props.js中的处理方式

> v-bind指令添加.prop修饰符的作用：用于绑定 DOM 属性 (property)

[差别](https://stackoverflow.com/questions/6003819/what-is-the-difference-between-properties-and-attributes-in-html#answer-6004028)

```
<!-- 通过 prop 修饰符绑定 DOM 属性 -->
<div v-bind:text-content.prop="text"></div>
```

## 编译期间

通过阅读HTML转AST过程对开始节点的处理阶段，发现Vue通过 processAttr() 处理一些非特殊的响应式属性(v-text, v-bind: , @ ,v-xxx) ，并通过 parseModifiers(name)获取属性上的修饰符。

当存在属性修饰符的时候 if (modifiers.prop) 去判断是否存在 prop属性，然后再进行<font color=red>驼峰名称转换</font>, 所以我们写节点的DOM属性的时候使用 - 方式。

再处理特殊的属性 innerHTML

```html
<div v-bind:inner-html.prop="xxx"></div>
```

将其先转换成 innerHtml 然后再转换成 innerHTML。
然后调用了

```js
addProp(el, name, value)

// 将属性按照 { name : name , value : value }的对象形式保存在AST.props数组中
export function addProp(el: ASTElement, name: string, value: string) {
    (el.props || (el.props = [])).push({ name, value })
    el.plain = false
}
```
将DOM属性 保存到AST.props数组中

```js
ast = {
    props : [
        {
            name : 'textContent',
            value : "value"
        }
    ]
}
```


```js
function processAttr(){
    ...

    modifiers = parseModifiers(name)
    // 如果存在属性描述符  那么其name 就需要去除属性描述符
    if (modifiers) {
        //  v-zdy.name  => v-zdy
        name = name.replace(modifierRE, '')
    }
    // 处理 :id v-bind:id
    if (bindRE.test(name)) { // v-bind
        // 获取属性的名称  移除 : | v-bind:
        name = name.replace(bindRE, '')
            //  处理value 解析成正确的value
        value = parseFilters(value)
        isProp = false
        if (modifiers) {
            // 处理 .prop - 被用于绑定 DOM 属性 (property)
            // <div v-bind:text-content.prop="text"></div>
            if (modifiers.prop) {
                isProp = true
                    // text-content -> textContent
                name = camelize(name)
                    // 如果是 <div v-bind:inner-html.prop="text"></div>  转成 innerHTML
                if (name === 'innerHtml') name = 'innerHTML'
            }
            // <svg :view-box.camel="viewBox"></svg>
            // 自动将属性的名称驼峰化  
            if (modifiers.camel) {
                name = camelize(name)
            }
            // .sync (2.3.0+) 语法糖，会扩展成一个更新父组件绑定值的 v-on 侦听器
            // v-on:update:title="doc.title = $event"
            if (modifiers.sync) {
                addHandler(
                    el,
                    `update:${camelize(name)}`,
                    genAssignmentCode(value, `$event`)
                )
            }
        }
        if (isProp || (!el.component && platformMustUseProp(el.tag, el.attrsMap.type, name))) {
            // 添加 到 el.props 属性数组中 [{ innerHTML : value }]
            // 或者如 input 元素上的value checked option上的selected 详情请看platforms/utils/attrs.js mustUseProp
            addProp(el, name, value)
        } else {
            // 添加 到 el.attrs 属性数组中 [{ title : value }]
            addAttr(el, name, value)
        }
    }
}
```

### generate期间

> generate 期间主要作用就是 将AST.props属性转换成 data上的一个domProps属性对象

处理AST中的属性，如果遇到 el.props 将其转换成 domProps 属性对象

```js

/**
 * 处理 el.data属性 生成我们创建节点的 data属性的值
 * @param {*} el
 * @param {*} state
 */
export function genData(el: ASTElement, state: CodegenState): string {
    let data = '{'

    // DOM props
    // 处理 <component :>
    if (el.props) {
        data += `domProps:{${genProps(el.props)}},`
    }

    return data
}

```
```js
/**
 * 处理 其他的基本属性  如 id="app"
 * 其保存在 el.attrs = [{
 *      name : 'id',
 *      value: '"app"'
 * }]
 * @param {*} props
 */
function genProps(props: Array < { name: string, value: any } > ): string {
    let res = ''
    for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        /* istanbul ignore if */
        if (__WEEX__) {
            res += `"${prop.name}":${generateValue(prop.value)},`
        } else {
            // 在WEB平台中转成 "id":'"app"' 并处理其中特殊的行分隔符 段落分隔符
            res += `"${prop.name}":${transformSpecialNewlines(prop.value)},`
        }
    }
    return res.slice(0, -1)
}

```
所以在WEN 平台上面的
```js
ast = {
    props : [
        {
            name : 'textContent',
            value : "value"
        }
    ]
}
```
将变成
```js
_c('div',
    {
        domProps : {
            'textContent' : value
        }
    },
    [xxx])
```


## patch阶段

我们知道在组件 vnode 转 dom 阶段对于元素节点他会执行 节点的create期间的钩子函数
```
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
```
我们在WEB平台通过函数柯里化的方式生成各平台的配置对象和patch方法，在option中就存在modules数组对象
![image](https://note.youdao.com/yws/public/resource/fa4a717e0bafc76404a2b7658a9371c6/xmlnote/3523BCC2C4244ED3A7223D372D700F06/8531)

其中就存在updateDOMProps钩子函数

###### platforms/web/runtime/modules/dom-props.js

```js
/* @flow */

/**
  当节点vnode 存在 domProps属性的时候 处理DOM属性

  创建阶段
      oldVnode : emptyVnode
      vnode    : vnode

 * @param {*} oldVnode
 * @param {*} vnode
 */
function updateDOMProps(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (isUndef(oldVnode.data.domProps) && isUndef(vnode.data.domProps)) {
        return
    }
    let key, cur
    const elm: any = vnode.elm
    const oldProps = oldVnode.data.domProps || {}
    let props = vnode.data.domProps || {}
        // clone observed objects, as the user probably wants to mutate it
    if (isDef(props.__ob__)) {
        props = vnode.data.domProps = extend({}, props)
    }

    for (key in oldProps) {
        if (isUndef(props[key])) {
            elm[key] = ''
        }
    }
    for (key in props) {
        cur = props[key]
            // ignore children if the node has textContent or innerHTML,
            // as these will throw away existing DOM nodes and cause removal errors
            // on subsequent patches (#3360)
        if (key === 'textContent' || key === 'innerHTML') {
            if (vnode.children) vnode.children.length = 0
            if (cur === oldProps[key]) continue
                // #6601 work around Chrome version <= 55 bug where single textNode
                // replaced by innerHTML/textContent retains its parentNode property
            if (elm.childNodes.length === 1) {
                elm.removeChild(elm.childNodes[0])
            }
        }

        if (key === 'value') {
            // store value as _value as well since
            // non-string values will be stringified
            // 因为非字符串的值 如 1 会转换成 '1' 所以 elm._value 存储原来的值
            elm._value = cur
            // avoid resetting cursor position when value is the same
            const strCur = isUndef(cur) ? '' : String(cur)
            if (shouldUpdateValue(elm, strCur)) {
                elm.value = strCur
            }
        } else {
            elm[key] = cur
        }
    }
}

// check platforms/web/util/attrs.js acceptValue
type acceptValueElm = HTMLInputElement | HTMLSelectElement | HTMLOptionElement;

function shouldUpdateValue(elm: acceptValueElm, checkVal: string): boolean {
    return (!elm.composing && (
        elm.tagName === 'OPTION' ||
        isNotInFocusAndDirty(elm, checkVal) ||
        isDirtyWithModifiers(elm, checkVal)
    ))
}

function isNotInFocusAndDirty(elm: acceptValueElm, checkVal: string): boolean {
    // return true when textbox (.number and .trim) loses focus and its value is
    // not equal to the updated value
    let notInFocus = true
        // #6157
        // work around IE bug when accessing document.activeElement in an iframe
    try { notInFocus = document.activeElement !== elm } catch (e) {}
    return notInFocus && elm.value !== checkVal
}

function isDirtyWithModifiers(elm: any, newVal: string): boolean {
    const value = elm.value
    const modifiers = elm._vModifiers // injected by v-model runtime
    if (isDef(modifiers)) {
        if (modifiers.lazy) {
            // inputs with lazy should only be updated when not in focus
            return false
        }
        if (modifiers.number) {
            return toNumber(value) !== toNumber(newVal)
        }
        if (modifiers.trim) {
            return value.trim() !== newVal.trim()
        }
    }
    return value !== newVal
}

export default {
    create: updateDOMProps,
    update: updateDOMProps
}
```

发现其节点更新和创建的过程是差不多的，先判断是否存在domProps属性，然后再分别处理 textContent、innerHTML、value 3个比较特殊的DOM属性。
