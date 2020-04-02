# 事件

> 可以用 v-on 指令监听 DOM 事件, 也可以通过组件中 @event 去定义自定义事件，然后通过 $emit $on $once $off去处理自定义事件


## 编译期间

### parse(html转AST期间)

```js
/**
 *  处理那些没有经过特殊处理的属性
 *   1、 一方面支持 静态与动态 属性 两种方式； 如 id="xx" :id="name"
 *   2、 处理 事件属性   @click v-on:click 和 事件属性描述符  @click.caption
 *   3、 处理 v-bind:text-content.prop = 'title' 的 prop , sync , camel 3个描述属性
 *   4、 处理 v-directive 自定义指令 属性
 * @param {*} el
 */
function processAttrs(el) {
    // 为什么使用el.attrList 而不使用 el.attrsMap
    // 因为对于那些Vue 特殊处理的属性 如class ref style name slot... 这些在调用getAndRemoveAttr(el, 'inline-template')的时候会将el.attrsList移除，
    // 那么这时候 el.attrsList 遗留的就是哪些 不需要特殊处理的 静态|响应式属性 如 id="xx" src="xxx"
    const list = el.attrsList
    let i, l, name, rawName, value, modifiers, isProp
    for (i = 0, l = list.length; i < l; i++) {
        name = rawName = list[i].name
        value = list[i].value
            // 处理遗留的 响应式属性， 如 :id="idName", 自已的的指令 v-directive ,v-bind , @
            /*
                处理剩余的响应式属性
                v- 开头的 ：  v-text 、 v-bind: 、 v-on:click 、  v-directive 自定义的
                : 开头的      :id="xxx"
                @ 开头的       @click
             */
        if (dirRE.test(name)) {
            // mark element as dynamic
            // 标记AST节点有响应式属性
            el.hasBindings = true
                // 第二步 ： 获取属性的 属性描述符
                // modifiers  处理 <div v-zdy.name="xxx">xxx</div> v-zdy后面的属性描述符
                // 将其转换成对象的形式  { name : true }
            modifiers = parseModifiers(name)
                // 如果存在属性描述符  那么其name 就需要去除属性描述符
            if (modifiers) {
                //  v-zdy.name  => v-zdy
                name = name.replace(modifierRE, '')
            }
            // 处理 :id v-bind:id
            if (bindRE.test(name)) { // v-bind

            } else if (onRE.test(name)) { // v-on
                // 处理 v-on 或者 @ 属性  如 <div v-on:click="xxx" @change="xxx">
                // v-on:click => click
                name = name.replace(onRE, '')
                    // 添加事件属性
                addHandler(el, name, value, modifiers, false, warn)
            }
        }
    }
}

```
可以看到在processAttrs() 的时候会处理 @ 或 v-on：定义的事件属性，并通过parseModifiers()将事件属性上的修饰符转换成修饰符对象。

如:

```
<button @click.capture.stop.once="handleClickSub($event)">handleClickSub</button>
```

转换成
```js
modifiers : {
    capture : true ,
    stop : true ,
    once : true ,
}

name : click

```
然后通过addHandler(el, name, value, modifiers, false, warn) 去处理节点的事件属性

```js

/**
 *   向el中添加 事件属性 AST的值, 将事件属性转换成 el.events 或 el.nativaEvent属性
 *
 *   涉及到的属性有   el.nativeEvents  el.events

 <button @click.capture="handleClickSub" @click.capture="handleClickCaptions" @click.stop.once="handleClickSub($event)">handleClickSub</button>

    中的 @click.capture.stop.once="handleClickSub($event)"为例

 *   events对象 | nativeEvents = {
 *      '~!click' : {
 *           value  : handleClickSub($event),         //函数处理方法
 *           modifiers : { capture : true stop : true , once : true }    //属性描述对象
 *      },
 *      '!click': [{} ,{} {} ]   先后顺序 和 important决定触发顺序
 *   }
 *   
 *
 * @param {*} el              AST对象
 * @param {*} name            // 事件的名称  click
 * @param {*} value           // 事件的值   handleClickChange()
 * @param {*} modifiers       // 事件的描述属性   { stop : true , prevent:true }
 * @param {*} important       
 * @param {*} warn
 */
export function addHandler(
    el: ASTElement,
    name: string,
    value: string,
    modifiers: ? ASTModifiers,
    important ? : boolean,
    warn ? : Function
) {
    // 事件的描述对象
    // @click.capture.stop.once="handleClickSub($event)" 存在两个描述对象 {capture : true stop : true , once : true }
    modifiers = modifiers || emptyObject
        // warn prevent and passive modifier
        /* istanbul ignore if */
    if (
        process.env.NODE_ENV !== 'production' && warn &&
        modifiers.prevent && modifiers.passive
    ) {
        warn(
            'passive and prevent can\'t be used together. ' +
            'Passive handler can\'t prevent default event.'
        )
    }

    // check capture modifier
    // 处理事件的caption 描述符  存在capture 修饰符  name = "!click"
    if (modifiers.capture) {
        delete modifiers.capture
        name = '!' + name // mark the event as captured
    }
    // 上面存在 once 描述符  name = '~!click'
    if (modifiers.once) {
        delete modifiers.once
        name = '~' + name // mark the event as once
    }
    /* istanbul ignore if */
    if (modifiers.passive) {
        delete modifiers.passive
        name = '&' + name // mark the event as passive
    }

    // normalize click.right and click.middle since they don't actually fire
    // this is technically browser-specific, but at least for now browsers are
    // the only target envs that have right/middle clicks.
    // 如果是点击事件  且绑定了鼠标右键别名 那么事件的名称就应该是 contextmenu事件
    if (name === 'click') {
        if (modifiers.right) {
            name = 'contextmenu'
            delete modifiers.right
            // 如果是点击事件  且绑定了鼠标滚轮按钮 那么事件的名称就应该是 mouseup事件
        } else if (modifiers.middle) {
            name = 'mouseup'
        }
    }

    // 处理 @click.native  native描述符
    // 对于组件上面定义的事件有两种  自定义事件 : @event1="" , 原生事件  @click.native="xxx"
    // 对于普通元素 其只有原生的DOM事件  其定义方法 @click="cccc"
    let events
    // 所以对于组件上的自定义事件  其保存在AST对象的 nativeEvents属性上
    if (modifiers.native) {
        delete modifiers.native
        // 初始化 事件保存的 地方
        events = el.nativeEvents || (el.nativeEvents = {})
    } else {
        events = el.events || (el.events = {})
    }

    // 定义AST对象上 events 或者 nativeEvents属性 上的值
    const newHandler: any = {
        value: value.trim()
    }
    // 如果此事件存在修饰符  那么保存的对象为  { value : "handleClickSub($event)" , modifiers : { capture : true stop : true , once : true }}
    if (modifiers !== emptyObject) {
        newHandler.modifiers = modifiers
    }

    // 获取节点上保存的事件对象  events['click'] = [];
    const handlers = events[name]
    /* istanbul ignore if */
    // 当单个节点上添加多个相同的事件的时候 events.click 一开始为handler对象，
    // 如果再次定义了 event.click handler 那么就 else if (handlers) { } 判断第二个是否有important 来决定事件触发的顺序
    // 如果还有 那么继续
    if (Array.isArray(handlers)) {
        // 如果传入 important 那么在 handlers的最前面添加  否则在后面添加
        important ? handlers.unshift(newHandler) : handlers.push(newHandler)
    } else if (handlers) {
        events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
    } else {
        events[name] = newHandler
    }

    el.plain = false
}

```
可以看到对于节点事件相关的属性有两个 ast.events 和 ast.nativeEvents , 其保存了当前节点上所有事件有关属性的处理对象。

```html
<button @click.capture="handleClickSub" @click.capture="handleClickCaptions" @click.capture.stop.once="handleClickSub($event)">handleClickSub</button>
<scope-first @select="callbackHandler" @click.native="handleClickScopeFirst"></scope-first>
```
1. 先处理修饰符 生成事件的名称，如上面的@click.capture的事件名称会变成 '!click' ,@click.capture.stop.once 变成 '~!click'

2. 通过native修饰符区分自定义事件和DOM事件，所以

```html
<scope-first @select="callbackHandler" @click.native="handleClickScopeFirst"></scope-first>
```
- click事件存放在 ast.nativeEvents属性上
- select事件存放在 ast.events属性上

3. 生成事件对象

```js
handler = {
    value : "handleClickSub($event)" ,
    modifiers : {
        stop : true
    }
}
```
4. 存储到AST对象的 ast.events 和 ast.nativeEvents中，其中如果同名的 就变成数组。

如button的

```js
button ast : {
    events : {
        "!click": {
            value: "handleClickSub",
            modifiers: {}
        },
        "~click": {
            value: "handleClickSub($event)",
            modifiers: {
                stop : true
            }
        }
    }
}

scopeFirst ast : {
    events : {
        "select": {
            value: "callbackHandler"
        }
    },
    nativeEvents : {
        "click": {
            value: "handleClickScopeFirst",
            modifiers: {
            }
        }
    }
}
```

### generate阶段 (ast转换成可执行的代码即表达式字符串)

#### 事件修饰符种类

##### 1.  事件修饰符:

1. .stop   
2. .prevent  
3. .capture  
4. .self  
5. .once  
6. .passive

##### 2. 按键修饰符:

###### 2.1 数字类型  :  37 , 64

###### 2.2  按键的别名

1. .enter
2. .tab
3. .delete (捕获“删除”和“退格”键)
4. .esc
5. .space
6. .up
7. .down  
8. .left  
9. .right

##### 3.系统修饰键 :

1. .ctrl   
2. .alt
3. .shift
4. .meta
5. .exact

##### 4.鼠标按钮修饰符 :

1. .left
2. .right
3. .middle

在parse() 的时候处理了事件修饰符  
1. .native 将事件分成原生DOM事件和自定义事件
2. .capture 在事件名称上添加 ! ("!click")
3. .once 在事件名称上添加 ! ("~click")
4. .passive 在事件名称上添加 ! ("&click")

在AST转可执行代码阶段，Vue将节点属性上的 events 和 nativeEvents 属性处理成data属性上的 on和nativeOn属性

```js
_c(
	"button",
	{
		on: {
			click: handleClickSub,
			"~!click": function($event) {
				$event.stopPropagation()
				handleClickSub($event)
			}
		}
	},
	[_v("handleClickSub")]
)
```
在处理节点属性的时候，如果遇到 el.events || el.nativeEvents 就调用genHandlers()处理事件属性
```js
function genData(el: ASTElement, state: CodegenState): string {
    if (el.events) {
        data += `${genHandlers(el.events, false, state.warn)},`
    }
    if (el.nativeEvents) {
        data += `${genHandlers(el.nativeEvents, true, state.warn)},`
    }
}
```

###### src\compiler\codegen\events.js

```js
function genHandlers(
    events: ASTElementHandlers,
    isNative: boolean, // 是否是元素DOM事件 即 true : nativeEvents ,false : events
    warn: Function
): string {
    let res = isNative ? 'nativeOn:{' : 'on:{'
    for (const name in events) {
        res += `"${name}":${genHandler(name, events[name])},`
    }
    return res.slice(0, -1) + '}'
}
```
```html
<scope-first @select="callbackHandler" @click.native="handleClickScopeFirst"></scope-first>

_c('button',{
    on:{},
    nativeOn : {}
})
```

然后通过genHandler()去处理一个个属性

```js
/*

    处理事件对象
    "!click": {
        value: "handleClickSub",
        modifiers: {}
    },
    "~click": {
        value: "handleClickSub($event)",
        modifiers: {
            stop : true
        }
    }
*/
function genHandler(
    name: string, // name ： "!click"
    handler: ASTElementHandler | Array < ASTElementHandler > // handler { value: "handleClickSub", modifiers: {} }
): string {
    if (!handler) {
        return 'function(){}'
    }
    // 如果事件处理函数为数组类型  说明定义了相同的事件
    if (Array.isArray(handler)) {
        return `[${handler.map(handler => genHandler(name, handler)).join(',')}]`
    }

    // 解析事件的处理回调函数
    // 判断其是否是 handleClickSub 或者  a.b  a['b']  a["b"] a[0] a[b]
    const isMethodPath = simplePathRE.test(handler.value)
    // 事件回调函数  为  function(){} 或者 () => { xxxx }
    const isFunctionExpression = fnExpRE.test(handler.value)

    // 没有修饰符
    if (!handler.modifiers) {
        // 且为简单的回调函数类型就行  因为上面两种  直接可以 handler.value() 回调执行
        if (isMethodPath || isFunctionExpression) {
            return handler.value
        }
        /* istanbul ignore if */
        if (__WEEX__ && handler.params) {
            return genWeexHandler(handler.params, handler.value)
        }
        // 不然对于  如 handleClickSub($event)  "target = $event" 这种就需要用一层函数去包裹
        //  function($event){ handleClickSub($event) }
        //  function($event){ target = $event }
        return `function($event){${handler.value}}` // inline statement
    } else {
        // 如果存在修饰符  在parse的时候我们处理了如 capture , once , native , right , passive; 但是还有其他的修饰符 如 stop , self

        let code = ''
        let genModifierCode = ''
        const keys = []
        // 处理上面的遗留的修饰符
        for (const key in handler.modifiers) {
            // 如 stop , 在Vue中定义了各修饰符 的处理方法
            // 如 stop :  '$event.stopPropagation();'
            // 处理 stop prevent self ctrl shift alt meta left middle right
            if (modifierCode[key]) {
                genModifierCode += modifierCode[key]

                // 处理 left 、 right
                // left/right
                if (keyCodes[key]) {
                    keys.push(key)
                }
            // 处理 exact
            } else if (key === 'exact') {
                // exact 修饰符允许你控制由精确的系统修饰符组合触发的事件。
                const modifiers: ASTModifiers = (handler.modifiers: any)

                genModifierCode += genGuard(
                    ['ctrl', 'shift', 'alt', 'meta']
                    .filter(keyModifier => !modifiers[keyModifier])
                    .map(keyModifier => `$event.${keyModifier}Key`)
                    .join('||')
                )
            } else {
                // 处理 按键修饰符 (数字类型、别名)
                keys.push(key)
            }
        }
        if (keys.length) {
            code += genKeyFilter(keys)
        }
        // Make sure modifiers like prevent and stop get executed after key filtering
        if (genModifierCode) {
            code += genModifierCode
        }
        const handlerCode = isMethodPath ?
            `return ${handler.value}($event)` :
            isFunctionExpression ?
            `return (${handler.value})($event)` :
            handler.value
            /* istanbul ignore if */
        if (__WEEX__ && handler.params) {
            return genWeexHandler(handler.params, code + handlerCode)
        }
        return `function($event){${code}${handlerCode}}`
    }
}
```

genHander()处理过程分为:

##### 1. 处理事件的值

```js
// 事件回调函数  为  function(){} 或者 () => { xxxx }
const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/

// 匹配 a.b  a['b']  a["b"] a[0] a[b]
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/
```
```js
// 解析事件的处理回调函数
// 判断其是否是 handleClickSub 或者 a a.b  a['b']  a["b"] a[0] a[b]
const isMethodPath = simplePathRE.test(handler.value)
// 事件回调函数  为  function(){} 或者 () => { xxxx }
const isFunctionExpression = fnExpRE.test(handler.value)
/////
const handlerCode = isMethodPath ? `return ${handler.value}($event)` : ( isFunctionExpression ? `return (${handler.value})($event)` : handler.value)

```
对于事件的值 我们可以这样定义:

```js
// methods中的一个参数的引用           // 匹配 isMethodPath : true
@click="handleClickSub"                 => return handleClickSub($event)

// methods中的一个参数的执行回调       // 匹配 isFunctionExpression : true
@click.capture.stop.once="handleClickSub($event)"       => return handleClickSub($event)

// 一个可执行的代码
@click="name = $event;"                                 => name = $event;

```

##### 2. 处理修饰符

- 没有修饰符

```js
// 没有修饰符 并不代表真正的没有修饰符，而是不需要再 generate期间 处理的修饰符，如 .native .capture .once .passive .right .middle
if (!handler.modifiers) {
    // 且为简单的回调函数类型就行  因为上面两种  直接可以 handler.value() 回调执行
    if (isMethodPath || isFunctionExpression) {
        return handler.value
    }
    /* istanbul ignore if */
    if (__WEEX__ && handler.params) {
        return genWeexHandler(handler.params, handler.value)
    }
    // 不然对于  如 handleClickSub($event)  "target = $event" 这种就需要用一层函数去包裹
    //  function($event){ handleClickSub($event) }
    //  function($event){ target = $event }
    return `function($event){${handler.value}}` // inline statement
}

如 @click.native="handleClickSub"            =>  data : { nativeOn : { 'click' :  handleClickSub }}
如 @click.native="handleClickSub($event)"    =>  data : { nativeOn : { 'click' :  handleClickSub($event) }}
如 @click.native="name = $event;"            =>  data : { nativeOn : { 'click' :  function($event){ name = $event; } }}
```

- 有修饰符

其实对这些修饰符的处理方式也很简单， 其实就是在将事件的值变成一个函数  function($event){ .... } ,所以我们可以在我们事件处理方法的时候可以访问到$event属性，
然后在函数中对修饰符就行处理。

如 stop 转换成 $event.stopPropagation(); 所以 function($event){ $event.stopPropagation(); .... }

self 转换成 genGuard(`$event.target !== $event.currentTarget`), 所以 function($event){ if($event.target !== $event.currentTarget) return null;  .... }

```js
else {
    // 如果存在修饰符  在parse的时候我们处理了如 capture , once , native , right , passive; 但是还有其他的修饰符 如 stop , self
    let code = ''
    let genModifierCode = ''
    const keys = []
    // 处理上面的遗留的修饰符
    for (const key in handler.modifiers) {
        // 如 stop , 在Vue中定义了各修饰符 的处理方法
        // 如 stop :  '$event.stopPropagation();'
        // 处理 stop prevent self ctrl shift alt meta left middle right
        if (modifierCode[key]) {
            genModifierCode += modifierCode[key]
            // 处理 left 、 right
            // left/right
            if (keyCodes[key]) {
                keys.push(key)
            }
        // 处理 exact
        } else if (key === 'exact') {
            // exact 修饰符允许你控制由精确的系统修饰符组合触发的事件。
            const modifiers: ASTModifiers = (handler.modifiers: any)
            genModifierCode += genGuard(
                ['ctrl', 'shift', 'alt', 'meta']
                .filter(keyModifier => !modifiers[keyModifier])
                .map(keyModifier => `$event.${keyModifier}Key`)
                .join('||')
            )
        } else {
            // 处理 按键修饰符 (数字类型、别名)
            keys.push(key)
        }
    }
    if (keys.length) {
        code += genKeyFilter(keys)
    }
    // Make sure modifiers like prevent and stop get executed after key filtering
    if (genModifierCode) {
        code += genModifierCode
    }
    const handlerCode = isMethodPath ?
        `return ${handler.value}($event)` :
        isFunctionExpression ?
        `return (${handler.value})($event)` :
        handler.value
        /* istanbul ignore if */
    if (__WEEX__ && handler.params) {
        return genWeexHandler(handler.params, code + handlerCode)
    }
    return `function($event){${code}${handlerCode}}`
}

```

###### 按键的处理

在处理修饰符的时候 对于按键类型的 如数字、 按键别名全部按照 keys 进行处理，并保存在keys数组中, 然后通过genKeyFilter(keys)去处理

```js

/**
 * 处理 @keyup.alt.67 这种 67 按键
 *
 *
 * @param {*} keys
 */
function genKeyFilter(keys: Array < string > ): string {
    //  if (!("button" in $event) && $event.keyCode !== 67)
    return `if(!('button' in $event)&&${keys.map(genFilterCode).join('&&')})return null;`
}

/**
 * 按键类型
 * @param {*} key
 */
function genFilterCode(key: string): string {
    //
    const keyVal = parseInt(key, 10)
    // 如果是数字类型   $event.keyCode !== 67
    if (keyVal) {
        return `$event.keyCode!==${keyVal}`
    }
    // 如果不是数字类型，如设置的按键别名
    // 'esc'   =>  27
    const keyCode = keyCodes[key]
    // ['Esc', 'Escape']
    const keyName = keyNames[key]
    // 调用系统内置 _f()方法
    // _k($event.keyCode,'esc' , 27 , $event.key , ['Esc', 'Escape'])
    return (
        `_k($event.keyCode,` +
        `${JSON.stringify(key)},` +
        `${JSON.stringify(keyCode)},` +
        `$event.key,` +
        `${JSON.stringify(keyName)}` +
        `)`
    )
}
```
发现按照按键的类型也分为了2种：  

1. 数字类型   return `$event.keyCode!==${keyVal}` ; 所以结果是：  

```js
if(!('button' in $event) && $event.keyCode!==67 &&  $event.keyCode!==68 )return null;`
```

2. 别名按键类型通过 _k()进行处理

```js

if(!('button' in $event) && $event.keyCode!==67 &&  $event.keyCode!==68 )return null;`

if(!('button' in $event) && $event.keyCode!==67 && _k( $event.keyCode , 'esc' ,   ) )return null;`
```

##### 按键别名 _k()

```js
/**
 * 事件 别名按键修饰符处理
 *
    如 'esc'
    => _k( $event.keyCode , 'esc' , 27 , $event.key , ['Esc', 'Escape'])

    如果是自定义的按键别名
    如  'f1'
    => _k( $event.keyCode , 'f1' , '' , $event.key , '' )


    我们需要注意的是:
        按键的别名分为:
            1、 Vue内置的别名如 esc : ['Esc', 'Escape']
            2、 用户自定义的别名   Vue.config.keyCodes = { 'f1' : 112 }
        按键别名涉及的event属性  event.key

 * @param {*} eventKeyCode        // DOM事件回调传入的 event.keyCode
 * @param {*} key                 // 事件按键别名 名称 'esc'
 * @param {*} builtInKeyCode      // Vue内置的事件按键别名对应的 键值。如 esc : 27
 * @param {*} eventKeyName        // DOM事件回调传入的 event.key
 * @param {*} builtInKeyName      // Vue内置的事件按键别名对应的按键名数据 builtInKeyName = ['Esc', 'Escape']
 */
export function checkKeyCodes(
    eventKeyCode: number,
    key: string,
    builtInKeyCode ? : number | Array < number > ,
    eventKeyName ? : string,
    builtInKeyName ? : string | Array < string >
): ? boolean {
    // 通过别名获取按键的 键值
    // 如果内置的按键别名如 'esc', 那么builtInKeyCode就是generate时传入的键值 27;
    // 如果是通过 config.keyCodes = { f1 : 112 } 设置的键值别名 那么就通过config.keyCodes[key]获取
    const mappedKeyCode = config.keyCodes[key] || builtInKeyCode

    // 处理 generate
    /*
        如果获取到 builtInKeyName 那么就说明其是Vue内置的别名，如esc,
        eventKeyName 是 event.key 获取当前事件的按键名，各浏览器按键名可能不同

        情况分为：
        1、  Vue内置的且用户没有通过Vue.config.keyCodes去覆盖
        2、  Vue.config.keyCodes去覆盖
        3、  都没有设置  就通过 event.key 去比较
     */
    if (builtInKeyName && eventKeyName && !config.keyCodes[key]) {
        // 处理第一种情况: Vue内置的且用户没有通过Vue.config.keyCodes去覆盖
        return isKeyNotMatch(builtInKeyName, eventKeyName)
    } else if (mappedKeyCode) {
        // 处理第二种： Vue.config.keyCodes去覆盖
        return isKeyNotMatch(mappedKeyCode, eventKeyCode)
    } else if (eventKeyName) {
        // 处理第三种：都没有设置  就通过 event.key 去比较
        return hyphenate(eventKeyName) !== key
    }
}
```

可见对于按键别名的处理其分为3种情况：
1. Vue内置的且用户没有通过Vue.config.keyCodes去覆盖
2. Vue.config.keyCodes去覆盖
3. 都没有设置  就通过 event.key 去比较

###### Vue内置的且用户没有通过Vue.config.keyCodes去覆盖

```html
<button @click.esc="handleClickCaptions">A</button>
```
```js
_k($event.keyCode, "esc", 27, $event.key, ["Esc","Escape"])
```
所以其处理过程是

```js
if (builtInKeyName && eventKeyName && !config.keyCodes[key]) {
    // 处理第一种情况: Vue内置的且用户没有通过Vue.config.keyCodes去覆盖
    return isKeyNotMatch(builtInKeyName, eventKeyName)
}
```
builtInKeyName为 ["Esc","Escape"]

eventKeyName为 当前按键event.key

即用当前事件的按键名 event.key 与Vue内置的按键别名进行比较 esc: ['Esc', 'Escape']


######  Vue.config.keyCodes去覆盖

如果用户通过Vue.config.keyCodes设置了按键的别名

```js
Vue.config.keyCodes = {
    "tab" : 113,
    "f12":112
}
```

包含覆盖Vue内置的按键别名如esc、tab，那么这时候上面的!config.keyCodes[key]为false 也会进行

```js
if (mappedKeyCode) {
    // 处理第二种： Vue.config.keyCodes去覆盖
    return isKeyNotMatch(mappedKeyCode, eventKeyCode)
}
```
那么这时候比较的就是 mappedKeyCode, eventKeyCode,即用用户定义的别名对应的按键键值与event.keyCode进行比较。

mappedKeyCode 为 Vue.config.keyCodes.tab 的值 '113'

eventKeyCode 为 当前按键event.keyCode

######  啥都没设置就用别名
这时候按键别名在Vue内置与用户设置的都没有匹配的那么这时候就直接用按键的别名与event.key进行比较。(不推荐)

```html
<button @click.f11="handleClickCaptions">A</button>

Vue.config.keyCodes = {
    "tab" : 113,
    "f12":112
}

```
处理代码:
```js
if (eventKeyName) {
    // 处理第三种：都没有设置  就通过 event.key 去比较
    return hyphenate(eventKeyName) !== key
}
```

### 事件编译流程总结

对于事件类型编译流程其遇到 v-on或者 @ 前缀的属性就调用addHandler()将属性解析成
```js
events对象 | nativeEvents = {
  '~!click' : {
       value  : handleClickSub($event),         //函数处理方法
       modifiers : { capture : true stop : true , once : true }    //属性描述对象
  },
  '!click': [{} ,{} {} ]   先后顺序 和 important决定触发顺序
}
```
然后在 generate过程将其编译成可执行的代码字符串。其编译规则是： 如果遇到事件属性  el.events|nativeEvents 那么就通过 genHandlers() 进行处理。

其处理规则有两个<font color=red>重点</font>：

1. 处理事件的处理方法。 如变量引用(handleClickSub)、变量的回调(handleClickSub(item,$event))、可执行代码(ev = $event;)
2. 处理事件的 一般修饰符如 stop、prevent等 和 按键、别名修饰符。

##### 对于第一个，其通过simplePathRE、fnExpRE去匹配事件处理方法
- 如果是simplePathRE类型，那么返回的就是一个  function($event){ return handleClickSub($event) },所以我们methods中 可以 handleClickSub(e)去访问事件event对象。
- 如果是fnExpRE类型，那么就返回一个闭包 function($event){ return ( handleClickSub(item,$event) )($event) }
- 如果都不是，那么就直接作为函数的内容 function($event){ ev = $event; }

所以我们发现为什么可以使用 $event去访问时间event对象，<font color=red>因为我们定义的处理方法被一个入参为$event的函数包含了，所以我们可以方法上一级作用域链上的属性 $event,而不是 event、e 等属性</font>。

##### 对于第二个问题 修饰符处理

通过函数中 添加特定的代码如 不正确return等方式去处理的，如 stop修饰符，就是通过在  function($event){ }的第一步添加 $event.stopPropagation()，shift修饰符 是 if (!$event.shiftKey ) return null。 那么上面还是分了2中 一般修饰符和 按键修饰符。

- 一般修饰符如 stop等就是按照上面的通用流程 处理。
- 按键修饰符：其分为 <font color=red>数字类型按键修饰符 和 别名类型按键修饰符</font>。
  - 数字类型按键修饰符
```js
function($event) {
	if (
		!("button" in $event) && $event.keyCode!== 按键数字
	)
	return null
	return handleClickCaptions($event)
}
```
  - 别名类型按键修饰符
区分 <font color=red>Vue内置按键别名、Vue.config.keyCodes用户定义按键别名 和 其他按键别名</font>
其也是按照上面的 去获取 keyCodes, Vue.config.keyCodes去判断是哪一种 按键别名，然后通过 <font color=red>_k()</font> 去进行处理

```js
click: function($event) {
	if (
		!("button" in $event) &&
		_k($event.keyCode, "tab", 9, $event.key, "Tab")
	)
		return null
	return handleClickCaptions($event)
}
```



## parse过程

1. 原生DOM事件和自定义事件
2. 事件的处理时期(patch)

##### Vue是如何去处理事件编译后的可执行代码表达式的？

> Vue是在vnode -> dom 的时候通过节点的各生命周期的钩子函数去处理的。

首先我们需要了解一个概念。 对于vnode, Vue中主要分为 元素Vnode(正常的元素节点)、和 占位符Vnode(组件的占位符节点)。那么在这两个vnode上定义的事件就有区分， 在元素vnode上只能存在 元素的DOM事件，而在组件占位符vnode上可以存在元素DOM事件 和 自定义事件两种。


### 元素vnode中DOM事件

> 对于元素vnode，只有DOM事件而没有自定义事件，其编译期间DOM事件也存放在 on 属性中。

上面说到事件处理时期是在 patch的时候。那么我们看patch期间的代码

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
    if (isDef(tag)) {
        /* istanbul ignore if */
        if (__WEEX__) {
           ...
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
    }
}
```
最重要的是 createChildren(vnode, children, insertedVnodeQueue) if (isDef(data)) { invokeCreateHooks(vnode, insertedVnodeQueue) } 通过invokeCreateHooks()调用vnode create期间的钩子函数，而在

####### platforms\web\runtime\modules\events.js
```
export default {
    create: updateDOMListeners,
    update: updateDOMListeners
}
```
我们看updateDOMListeners方法

```js
function updateDOMListeners(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
        return
    }
    const on = vnode.data.on || {}
    const oldOn = oldVnode.data.on || {}
    target = vnode.elm
    normalizeEvents(on)
    updateListeners(on, oldOn, add, remove, vnode.context)
    target = undefined
}
```
其主要是通过 updateListeners()去处理事件，同时这里面传入了一个add、remove两个事件的绑定解绑方法(这个在后面讲解)。

上面我们知道元素vnode只支持DOM事件，而组件占位符Vnode支持DOM事件和自定义事件，那么对于DOM事件与自定义事件的处理方法应该不同，而这不同一部分就体现在add和remove两个方法上。

下面我们还是继续看上面的 updateListeners()方法

```js

export function updateListeners(
    on: Object,
    oldOn: Object,
    add: Function,
    remove: Function,
    vm: Component
) {
    let name, def, cur, old, event
    for (name in on) {
        // 获取 新的vnode 上的事件属性
        def = cur = on[name]
        // 更新，或者卸载的时候旧的的事件
        old = oldOn[name]
        // 处理事件的名称，我们在 编译阶段 ，对事件的修饰符如capture:在事件名称前加! 变成 '!click',还有 once 、 passive
        event = normalizeEvent(name)
        /* istanbul ignore if */
        if (__WEEX__ && isPlainObject(def)) {
            cur = def.handler
            event.params = def.params
        }
        // 新的vnode上不存在事件的名称，错误情况
        if (isUndef(cur)) {
            process.env.NODE_ENV !== 'production' && warn(
                `Invalid handler for event "${event.name}": got ` + String(cur),
                vm
            )
        // 如果没有旧的 相同的事件，那么就是create 或者 更新的时候 新添加了此事件
        } else if (isUndef(old)) {
            // Vue中对事件的处理绑定的是一个Invoker回调函数，其静态属性fns中保存了所有的回调方法
            if (isUndef(cur.fns)) {
                cur = on[name] = createFnInvoker(cur)
            }
            // 添加 一个事件方法
            add(event.name, cur, event.once, event.capture, event.passive, event.params)
        } else if (cur !== old) {
            old.fns = cur
            on[name] = old
        }
    }
    for (name in oldOn) {
        if (isUndef(on[name])) {
            event = normalizeEvent(name)
            remove(event.name, oldOn[name], event.capture)
        }
    }
}
```
因为create和update期间都是调用的updateListeners去处理事件，那么其处理方式就是先遍历新的vnode中所有的事件，且判断oldVnode中是否存在相同的事件，如果没有就去新建一个新的事件处理方法 add() , 如果存在那就更新，然后再编译oldVnode，判断新的中如果不存在 ，那就应该remove()移除此事件的绑定函数。

其重点有一个:

- #### 事件回调函数的处理

```js
if (isUndef(cur.fns)) {
    cur = on[name] = createFnInvoker(cur)
}

//--------------------
/**
 * 创建一个回调者
 *
 *  function invoker
 *  有一个静态属性 fns 保存了回调时所有的回调方法数组。
 *  返回回调者构造函数 其执行时的入参为每一个fns中回调的入参。
 *  
 *  使用方法
 *    invoker = createFnInvoker([cb1,cb2]);
 *    invoker.fns = [ cb,... ] 存放所有的回调方法
 *    invoker(arg1,arg2,arg3...)
 *    
 * @param {*} fns  
 */
export function createFnInvoker(fns: Function | Array < Function > ): Function {
    function invoker() {
        const fns = invoker.fns
        if (Array.isArray(fns)) {
            const cloned = fns.slice()
            for (let i = 0; i < cloned.length; i++) {
                cloned[i].apply(null, arguments)
            }
        } else {
            // return handler return value for single handlers
            return fns.apply(null, arguments)
        }
    }

    // 将回调的 方法存放在 Invoker 构造函数的静态属性fns上
    invoker.fns = fns
    return invoker
}
```

如我们 编译后的事件属性on是
```js
on: {
	click: function($event) {
		if (
			!("button" in $event) &&
			_k($event.keyCode, "tab", 9, $event.key, "Tab")
		)
			return null
		return handleClickCaptions($event)
	}
}
```
然后经过 createFnInvoker(fns)， function($event) {} 赋给了 invoker.fns

然后在经过 add()

```js
function add(
    event: string,
    handler: Function,
    once: boolean,
    capture: boolean,
    passive: boolean
) {
    handler = withMacroTask(handler)
}
//-------------------
export function withMacroTask(fn: Function): Function {
    return fn._withTask || (fn._withTask = function() {
        useMacroTask = true
        const res = fn.apply(null, arguments)
        useMacroTask = false
        return res
    })
}
```
invoker 变成了 handler._withTask 函数的一个属性fn

所以当我们触发事件的时候，
1. 先调用hander， 即withMacroTask()，然后执行 fn.apply(...);
2. fn为上面的invoker函数，那么就执行invoker()，然后对invoker.fns 进行 fns.apply(null, arguments)
3. 此时的fns就是我们编译期间的 function ，即 function($event) {}
4. 最后回调我们定义的事件处理方法

<font color=red>这期间我们遇到了几个问题</font>：
1. 我们的 function($event) {} 为什么要去创建invoker并保存在 invoker.fns属性上。
2. 为什么我们执行事件的时候 需要 withMacroTask()。

#### 第一个问题： 为什么创建invoker。

> 在vnode创建的时候，去创建一个invoker函数，其回调方法存放在静态属性invoker.fns上，那么以后更新vnode的时候如果处理方法修改了直接 修改静态属性invoker.fns就可以了，而不需要重新创建一个新的invoker。

#### 第一个问题： 为什么withMacroTask()。

> 我们看withMacroTask() 其主要作用是  useMacroTask = true；

### 2. 组件vnode中DOM事件和自定义事件

1. 在render的时候
```
/**
 * 真正将我们 h('div')  转换成vNode
 * @param  {[type]} context:      组件实例对象
 * @param  {[type]} tag           节点类型
 * @param  {[type]} data          data
 * @param  {[type]} children        
 * @param  {[type]} normalizationType ?             :             number    [description]
 * @return {[type]}                   [description]
 */
export function _createElement(
    context: Component,
    tag ? : string | Class < Component > | Function | Object,
    data ? : VNodeData,
    children ? : any,
    normalizationType ? : number
): VNode | Array < VNode > {
    ...
    if (typeof tag === 'string') {
        if (config.isReservedTag(tag)) {
           ...
        } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
            // component
            vnode = createComponent(Ctor, data, context, children, tag)
        } else {
            ...
        }
    } else {
        // 处理  h(App) 这种创建为组件的元素
        // direct component options / constructor
        vnode = createComponent(tag, data, context, children)
    }
}
```
调用createComponent()

```
export function createComponent(
    Ctor: Class < Component > | Function | Object | void,
    data: ? VNodeData,
    context : Component,
    children: ? Array < VNode > ,
    tag ? : string
): VNode | Array < VNode > | void {

        // extract listeners, since these needs to be treated as
        // child component listeners instead of DOM listeners
        const listeners = data.on
            // replace with listeners with .native modifier
            // so it gets processed during parent component patch.
        data.on = data.nativeOn


        const vnode = new VNode(
                `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
        data, undefined, undefined, undefined, context, { Ctor, propsData, listeners, tag, children },
        asyncFactory
    )
    return vnode
}
```
我们发现其将 nativeOn即组件DOM事件存放在data.on属性上而原来的自定义事件存在在 vnode.componentOptions.listeners属性上。

然后在patch的时候
```
function createElm(
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
) {
//    ...
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
        return
    }
//    ...
}
```
其调用了createComponent() 判断到其是组件的占位符vnode 然后

```
function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
        if (isDef(i = i.hook) && isDef(i = i.init)) {
            i(vnode, false /* hydrating */ )
        }
    }
}
```
调用组件占位符vnode 的init钩子函数，在 init() 的时候 createComponentInstanceForVnode()去生成组件的构造函数，然后new vnode.componentOptions.Ctor(options)的时候调用组件VueComponent的 _init()方法

```
Vue.prototype._init = function(options ? : Object) {
    if (options && options._isComponent) {
        initInternalComponent(vm, options)
    } else {
        ...
    }

}

//-----------------------
export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
    opts._parentListeners = vnodeComponentOptions.listeners
}
```
并将组件占位符vnode上的 vnode.componentOptions.listeners存放在 opts._parentListeners上
然后_init() 中调用initEvents()去处理自定义事件

```
/**
 *  初始化组件的时候 处理父子组件的 自定义事件
 * @author guzhanghua
 * @export
 * @param {Component} vm
 */
export function initEvents(vm: Component) {
    // 定义所有的
    vm._events = Object.create(null)
    vm._hasHookEvent = false
        // init parent attached events
    const listeners = vm.$options._parentListeners
    if (listeners) {
        updateComponentListeners(vm, listeners)
    }
}

export function updateComponentListeners(
    vm: Component,
    listeners: Object,
    oldListeners: ? Object
) {
    target = vm
    updateListeners(listeners, oldListeners || {}, add, remove, vm)
    target = undefined
}
```
我们发现其也是调用updateListeners(listeners, oldListeners || {}, add, remove, vm)去处理自定义事件，只是这时候 add与remove方法为组件vnode对于自定义事件定义的add和remove方法
```
function add(event, fn, once) {
    if (once) {
        target.$once(event, fn)
    } else {
        target.$on(event, fn)
    }
}

function remove(event, fn) {
    target.$off(event, fn)
}
```

所以我们明白了上面所说的为什么在调用updateListeners()需要传入add和remove方法，因为其是统一处理DOM事件和自定义事件的，那么对于两种事件的add、remove方法就需要各自定义。

我们看到对于自定义事件 其也是调用target.$once $on $off 那么我们就看一下这几个方法

```
const hookRE = /^hook:/
// 监听当前实例上的自定义事件。事件可以由vm.$emit触发。回调函数会接收所有传入事件触发函数的额外参数。
Vue.prototype.$on = function(event: string | Array < string > , fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
        for (let i = 0, l = event.length; i < l; i++) {
            this.$on(event[i], fn)
        }
    } else {
        // 将事件按照事件名称存放在vm._events属性上
        (vm._events[event] || (vm._events[event] = [])).push(fn)
        // optimize hook:event cost by using a boolean flag marked at registration
        // instead of a hash lookup
        // TODO: hook:event 有哪些？
        if (hookRE.test(event)) {
            vm._hasHookEvent = true
        }
    }
    return vm
}
// 监听一个自定义事件，但是只触发一次，在第一次触发之后移除监听器。
Vue.prototype.$once = function(event: string, fn: Function): Component {
    const vm: Component = this

    function on() {
        vm.$off(event, on)
        fn.apply(vm, arguments)
    }
    // 用于 vm.$emit('event1',cb);这种移除指定回调的事件的时候，需要使用 cb.fn === fn,所以在on.fn中保存事件的回调对象
    on.fn = fn
    vm.$on(event, on)
    return vm
}
```

我们发现其 定义一个事件的接受方法(once,on)都是将事件定义的时候 ，以事件名为id在 vm._events上定义一个以此事件名为key的属性，将回调方法作为此属性中的一个值。

###### 事件触发

```
// 触发当前实例上的事件。附加参数都会传给监听器回调。
Vue.prototype.$emit = function(event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      //  自定义事件的名称只能使用 小写字母
        const lowerCaseEvent = event.toLowerCase()
        if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
            tip(
                `Event "${lowerCaseEvent}" is emitted in component ` +
                `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
                `Note that HTML attributes are case-insensitive and you cannot use ` +
                `v-on to listen to camelCase events when using in-DOM templates. ` +
                `You should probably use "${hyphenate(event)}" instead of "${event}".`
            )
        }
    }
    // 自定义事件的回调
    let cbs = vm._events[event]
    if (cbs) {
        //
        cbs = cbs.length > 1 ? toArray(cbs) : cbs
        // 获取 emit的 入参， 我们vm.$emit('event-name', arg1,arg2);那么这边就获取后面的 [arg1,arg2]
        const args = toArray(arguments, 1)
        for (let i = 0, l = cbs.length; i < l; i++) {
            try {
                // 执行回调
                cbs[i].apply(vm, args)
            } catch (e) {
                handleError(e, vm, `event handler for "${event}"`)
            }
        }
    }
    return vm
}
```
我们发现事件触发 就是获取vm._event上相同事件名称的值，然后一个一个进行回调。并将第二个参数后的入参作为回调的入参。

###### 事件移除

```
//  移除自定义事件监听器。
Vue.prototype.$off = function(event ? : string | Array < string > , fn ? : Function): Component {
    const vm: Component = this
    // all
    // 处理没有入参  vm.$off();  如果没有提供参数，则移除所有的事件监听器；
    if (!arguments.length) {
        vm._events = Object.create(null)
        return vm
    }
    // array of events
    // 处理 同时移除多个事件的方法 即 vm.$off(['event1','event2'])
    if (Array.isArray(event)) {
        for (let i = 0, l = event.length; i < l; i++) {
            this.$off(event[i], fn)
        }
        return vm
    }
    // specific event
    // 获取需要移除事件的回调函数
    const cbs = vm._events[event]
    // 如果不存在此事件 接受方，直接返回vm
    if (!cbs) {
        return vm
    }
    // 如果只提供了事件，则移除该事件所有的监听器；
    if (!fn) {
        vm._events[event] = null
        return vm
    }
    // 如果同时提供了事件与回调，则只移除这个回调的监听器。
    if (fn) {
        // specific handler
        let cb
        let i = cbs.length
        while (i--) {
            cb = cbs[i]
            //  on : cb=== fn ; once : cb.fn === fn
            if (cb === fn || cb.fn === fn) {
                cbs.splice(i, 1)
                break
            }
        }
    }
    return vm
}
```
对于事件的移除 主要分为三种：

1. 如果没有提供参数，则移除所有的事件监听器；

2. 如果只提供了事件，则移除该事件所有的监听器；

3. 如果同时提供了事件与回调，则只移除这个回调的监听器。

源码中也是分别按照3中进行处理，只是需要注意的时候定义事件回调的时候 对于on once两种事件接受其回调一个值 cb === fn 而once则是 cb.fn === fn;

所以我们对于自定义事件 add remove的时候就是调用 vm.$once,$on,$off进行处理

### 组件vnode中的DOM事件

我们看到对于组件上的原生DOM事件其在 createComponent的时候 data.on = data.nativeOn 存放在data.on属性上，而原来的data.on 保存到 vnode.componentOptions.listeners上，所以此时原生DOM事件，也就存放在 data.on 而不是data.nativeOn中。然后在

```js
function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
        ...
        if (isDef(i = i.hook) && isDef(i = i.init)) {
            i(vnode, false /* hydrating */ )
        }

        if (isDef(vnode.componentInstance)) {
            initComponent(vnode, insertedVnodeQueue)
            ...
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
```
也会调用 invokeCreateHooks() 即vnode的create期间的hooks钩子函数，然后按照 updateListener去处理。


## 总结

1. 对于事件运行期间的处理，其主要分为两种 DOM事件、自定义事件。然后又分为元素vnode的DOM事件、组件占位符vnode的DOM事件、组件占位符vnode的自定义事件这三种。

2. 而对于DOM事件，其在patch的时候通过调用vnode在create、update期间的钩子函数 updateDOMListeners()去处理， 对于组件占位符vnode的自定义事件 其是在render的时候将data.on 存放在vnode.componentOptions.listeners属性上，然后在 组件patch的时候调用VueComponent的_init()初始化方法，在initEvents()方法中 将自定义事件通过 vm.$on 、vm.$once 、vm.$off去进行处理。

3. 在所有的事件处理中都调用了 updateListeners() 方法，然后按照传入的 add,remove方法去区分处理 DOM事件和自定义事件。
