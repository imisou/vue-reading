# v-bind指令

![image](https://note.youdao.com/yws/public/resource/fa4a717e0bafc76404a2b7658a9371c6/xmlnote/BAAF03C914884C7AB84BF8BC9D0CF09C/8937)

> 用法：动态地绑定一个或多个特性，或一个组件 prop 到表达式。在绑定 class 或 style 特性时，支持其它类型的值，如数组或对象。可以通过下面的教程链接查看详情。在绑定 prop 时，prop 必须在子组件中声明。可以用修饰符指定不同的绑定类型。没有参数时，可以绑定到一个包含键值对的对象。注意此时 class 和 style 绑定不支持数组和对象。

根据说明其实最重要的是属性上响应式数据的处理。

###### compiler\parser\index.js
```js
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
```

### 重点：

#### 1. value = parseFilters(value) 如何解析value



#### 2. 3种属性修饰符的处理 .prop .camel .sync
