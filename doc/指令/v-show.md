# v-show

![image](https://note.youdao.com/yws/public/resource/fa4a717e0bafc76404a2b7658a9371c6/xmlnote/CA512402653C45D7814F072487200515/8617)

> v-show 操作元素的 display 属性


## 编译阶段

### parse阶段

```html
<div v-show="isShow">isShow</div>
```
在parse阶段其生成的AST 主要是

```js
ast = {
    directives : [{
        arg: null
        modifiers: undefined
        name: "show"
        rawName: "v-show"
        value: "isShow"
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

发现其不想 v-text、 v-html等作为一个内置的指令进行处理，而是在编译阶段作为自定义指令进行处理，所以其最后生成的表达式字符串为

```js
_c(
	"div",
	{
		directives: [
			{
				name: "show",
				rawName: "v-show",
				value: isShow,
				expression: "isShow"
			}
		]
	},
	[_v("isShow")]
)
```

##

## 总结 ：

1. v-text="text"  ===  :text-content.prop="text"
