/* @flow */

// 事件回调函数  为  function(){} 或者 () => { xxxx }
const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/


// 匹配 a a.b  a['b']  a["b"] a[0] a[b]
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/

// KeyboardEvent.keyCode aliases
const keyCodes: {
    [key: string]: number | Array < number >
} = {
    esc: 27,
    tab: 9,
    enter: 13,
    space: 32,
    up: 38,
    left: 37,
    right: 39,
    down: 40,
    'delete': [8, 46]
}

// KeyboardEvent.key aliases
const keyNames: {
    [key: string]: string | Array < string >
} = {
    // #7880: IE11 and Edge use `Esc` for Escape key name.
    esc: ['Esc', 'Escape'],
    tab: 'Tab',
    enter: 'Enter',
    space: ' ',
    // #7806: IE11 uses key names without `Arrow` prefix for arrow keys.
    up: ['Up', 'ArrowUp'],
    left: ['Left', 'ArrowLeft'],
    right: ['Right', 'ArrowRight'],
    down: ['Down', 'ArrowDown'],
    'delete': ['Backspace', 'Delete']
}

// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
const genGuard = condition => `if(${condition})return null;`

const modifierCode: {
    [key: string]: string
} = {
    stop: '$event.stopPropagation();',
    prevent: '$event.preventDefault();',
    self: genGuard(`$event.target !== $event.currentTarget`),
    ctrl: genGuard(`!$event.ctrlKey`),
    shift: genGuard(`!$event.shiftKey`),
    alt: genGuard(`!$event.altKey`),
    meta: genGuard(`!$event.metaKey`),
    left: genGuard(`'button' in $event && $event.button !== 0`),
    middle: genGuard(`'button' in $event && $event.button !== 1`),
    right: genGuard(`'button' in $event && $event.button !== 2`)
}

/*
    处理节点上的 events 和 nativeEvents 属性
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


*/
export function genHandlers(
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

// Generate handler code with binding params on Weex
/* istanbul ignore next */
function genWeexHandler(params: Array < any > , handlerCode: string) {
    let innerHandlerCode = handlerCode
    const exps = params.filter(exp => simplePathRE.test(exp) && exp !== '$event')
    const bindings = exps.map(exp => ({ '@binding': exp }))
    const args = exps.map((exp, i) => {
        const key = `$_${i + 1}`
        innerHandlerCode = innerHandlerCode.replace(exp, key)
        return key
    })
    args.push('$event')
    return '{\n' +
        `handler:function(${args.join(',')}){${innerHandlerCode}},\n` +
        `params:${JSON.stringify(bindings)}\n` +
        '}'
}

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

    // 最重要的是事件的修饰符
    
    事件修饰符:
        .stop   .prevent  .capture  .self  .once  .passive

    按键修饰符:
        数字类型  :  37 , 64
        按键的别名 : .enter 、 .tab 、.delete (捕获“删除”和“退格”键) 、 .esc 、 .space 、.up 、.down 、 .left 、 .right
    
    系统修饰键 :
        .ctrl  、 .alt 、 .shift 、 .meta 、 .exact
    
    鼠标按钮修饰符 :
        .left 、 .right 、 .middle

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



    /*
        处理 按键别名修饰符

        如 'esc'
        => _k( $event.keyCode , 'esc' , 27 , $event.key , ['Esc', 'Escape'])

        如果是自定义的按键别名
        如  'f1'
        => _k( $event.keyCode , 'f1' , '' , $event.key , '' )
     */
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