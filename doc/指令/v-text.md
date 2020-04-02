# v-text指令

![image](https://note.youdao.com/yws/public/resource/fa4a717e0bafc76404a2b7658a9371c6/xmlnote/E2319904F0DB4E52B78155D17B95E46F/8433)

> v-text指令用于更新元素的textContent属性。

textContent 是元素的一个DOM属性，那么我们就可以想到Vue对于元素DOM属性操作的描述符prop

```html
<div :text-content.prop="text">{{name}}</div>
```
而Vue中对于v-text其实也就是 :text-content.prop的语法糖。其跟v-text的原理相同。

## 编译阶段

### parse阶段

```html
<div v-text="text">{{name}}</div>
```
在parse阶段其生成的AST 主要是

```js
ast = {
    directives : [{
        arg: null
        modifiers: undefined
        name: "text"
        rawName: "v-text"
        value: "text"
    }]
}
```

### generate阶段

在 AST转表达式字符串阶段

```js
/**
 处理AST 对象上的指令属性
 el.directives = [{
    arg: "foo"                       //指令的参数
    modifiers: {a: true, b: true}    //指令的描述属性
    name: "demo"                     // 指令的名称
    rawName: "v-demo:foo.a.b"        // 指令实际属性名称
    value: "fnDirective"             // 指令的值
  }]
 *
 * @param {*} el
 * @param {*} state
 */
function genDirectives(el: ASTElement, state: CodegenState): string | void {
    const dirs = el.directives
    if (!dirs) return
    let res = 'directives:['
    for (i = 0, l = dirs.length; i < l; i++) {
        // 获取每一各指令
        dir = dirs[i]
        needRuntime = true

        const gen: DirectiveFunction = state.directives[dir.name]
        // 如果是内置的指令  如 v-model
        if (gen) {
            // compile-time directive that manipulates AST.
            // returns true if it also needs a runtime counterpart.
            // TODO: 内置指令的处理
            needRuntime = !!gen(el, dir, state.warn)
        }
        if (needRuntime) {
            hasRuntime = true
            // 将 res 转成  "{name:"demo",rawName:"v-demo:foo.a.b",value:(fnDirective),expression:"fnDirective",arg:"foo",modifiers:{"a":true,"b":true}},"
            res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
                dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
                }${
            dir.arg ? `,arg:"${dir.arg}"` : ''
      }${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
        }
    }
}
```
还是通过 state.directives[dir.name] 获取内置指令的钩子函数进行处理，

![image](https://note.youdao.com/yws/public/resource/fa4a717e0bafc76404a2b7658a9371c6/xmlnote/A0E0F444AAAF47EDA9C9D45F68078381/8590)

###### platforms\web\compiler\directives\text.js

```js
/* @flow */

import { addProp } from 'compiler/helpers'



/**
  web 平台处理内置的 v-text指令属性

  如:
    <div v-text="name">{{value}}<p>{{value}}</p></div>

  其处理方法 ：

  _c("div", { domProps: { textContent: _s(name) } }, [
		_v(_s(value)),
		_c("p", [_v(_s(value))])
  ])

  发现其就是当做
    <div v-bind:text-content.prop='name'>{{value}}<p>{{value}}</p></div>

 * @param {*} el
 * @param {*} dir
 */
export default function text (el: ASTElement, dir: ASTDirective) {
  // 如果存在 v-text="value"
  if (dir.value) {
    // 按照 prop进行处理
    addProp(el, 'textContent', `_s(${dir.value})`)
  }
}


```

发现其还是将其转换成textContent这个dom属性进行处理。

对于DOM属性详情请看 prop属性描述符

## 总结 ：

1. v-text="text"  ===  :text-content.prop="text"
