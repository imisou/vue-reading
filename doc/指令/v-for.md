# v-for

![image](https://note.youdao.com/yws/public/resource/fa4a717e0bafc76404a2b7658a9371c6/xmlnote/D7C58C2BAA2643A68CB38A5094CE40FB/9227)

```html
<div id="app">
    <div v-for="(item, index) in items" :key="item.id">
        <p>{{item.value + '---' + index}}</p>
    </div>
    <div v-for="(val, key) in object" :key="key">
        <p>{{val + '---' + key }}</p>
    </div>
    <div v-for="(val, key, index) in object1" :key="key">
        <p>{{val + '---' + key + ' --- ' + index}}</p>
    </div>
</div>
```

## 编译阶段

```js
/**
 * 处理节点上的 v-for 属性
 * @param {*} el 
 */
export function processFor(el: ASTElement) {
    let exp
    if ((exp = getAndRemoveAttr(el, 'v-for'))) {
        //  解析 v-for 属性的值  转换成一个 解析后的对象
        const res = parseFor(exp)
        if (res) {
            // 将v-for生成的对象 合并到el上
            extend(el, res)
        } else if (process.env.NODE_ENV !== 'production') {
            warn(
                `Invalid v-for expression: ${exp}`
            )
        }
    }
}
```

最重要的还是 parseFor(exp) 去解析v-for属性的值

```js
/**
 *  解析 v-for 属性
 *    exp = '(item,index) in arr'
 *      返回一个v-for 解析后的对象
 *    res = {
 *        for       : 'arr'    ,      // 指向v-for 绑定的对象 
 *        alias     : 'item'   ,      // 遍历的第一个参数   item
 *        iterator1 : 'index'   ,     // 如果存在第二个参数就获取第二个参数   index
 *        iterator2 : 'key'   ,       // 如果存在第三个参数就获取第三个参数   key
 *    }
 * @param {*} exp 
 */
export function parseFor(exp: string): ? ForParseResult {
    // '(item,index) in arr'
    //   [ '(item,index) in arr'  , '(item,index)' , 'arr', index: 0,input : '(item,index) in arr' ]
    const inMatch = exp.match(forAliasRE)
    if (!inMatch) return
    const res = {}
        // res.for 指向 响应式数据
    res.for = inMatch[2].trim()
        //  去除参数两边的空格和()   '(item,index)' -> item,index
    const alias = inMatch[1].trim().replace(stripParensRE, '')

    // 处理参数   获取参数的值，Vue中对于for 最多支持3个参数  (item,index,key)
    // item,index,key =>     [ ',index,key' , 'index' , 'key' , index: 4, input: 'item,index,key']
    const iteratorMatch = alias.match(forIteratorRE)
    if (iteratorMatch) {
        //  上面 alias.match(forIteratorRE) 是匹配回去 , 后面的参数；那么此时直接 替换,后面的参数
        //  res.alias 就是获取第一个参数   === item
        res.alias = alias.replace(forIteratorRE, '')
            // 获取第二个参数  res.iterator1 = index
        res.iterator1 = iteratorMatch[1].trim()
            // 如果存在第三个参数， 获取第三个参数  res.iterator1 = key
        if (iteratorMatch[2]) {
            res.iterator2 = iteratorMatch[2].trim()
        }
    } else {
        res.alias = alias
    }
    return res
}

```

1. 先通过 in of 去分割v-for属性的值，
2. inMatch[1] 保存的就是 v-for 的前一部分，如 (val, key) 、 (val, key, index) 、item,通过inMatch[1].trim().replace(stripParensRE, '')去除两边的()。
3. 处理alias的值 通过，分割参数。

```js
el = {
    for : items ,      // 依赖的响应式数据
    alias :  val  ,    // 当前循环的值
    iterator1 : key    // 入参的第二个参数
    iterator2 ：index  // 入参的第三个参数
}
```

### generate阶段

```js
genFor(el, state)


/**
    处理 v-for 节点
 * @param {*} el 
 * @param {*} state 
 */
export function genFor(
    el: any,
    state: CodegenState,
    altGen ? : Function,
    altHelper ? : string
): string {
    const exp = el.for
    const alias = el.alias
    const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
    const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

    if (process.env.NODE_ENV !== 'production' &&
        state.maybeComponent(el) &&
        el.tag !== 'slot' &&
        el.tag !== 'template' &&
        !el.key
    ) {
        state.warn(
            `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
            `v-for should have explicit keys. ` +
            `See https://vuejs.org/guide/list.html#key for more info.`,
            true /* tip */
        )
    }
    // 防止循环处理此节点
    el.forProcessed = true // avoid recursion

    // return "_l((arr),function(item){return _l((arr),function(item){return _c('li',{key:item.id,staticClass:"liclass",class:{'liclass': item.id === 1},on:{"click":function($event){$event.stopPropagation();handleClick(item,$event)}}},[_v("\n"+_s(item.name)+" is ad\n")])})})"
    // _l 函数   return _l( arr , function(alias ,iterator1 , iterator2 ){ return _c('li' , { ...})})
    return `${altHelper || '_l'}((${exp}),` +
        `function(${alias}${iterator1}${iterator2}){` +
        `return ${(altGen || genElement)(el, state)}` +
        '})'
}

```
发现 v-for 编译成表达式字符串 是通过 _l()

```js
_l(object1, function(val, key, index) {
    return _c("div", { key: key }, [
        _c("p", [_v(_s(val + "---" + key + " --- " + index))])
    ])
})

_l(遍历的参数 ,回调函数function(alias , iterator1 , iterator2 ){})
```

#### 注意:

###### 1. 对于 非组件占位符节点、slot节点、template节点 需要添加 :key 

## render编译阶段

```js
/**
 * Runtime helper for rendering v-for lists.
 * 用于呈现v-for列表的运行时助手。
 */
/**

_l(object1, function(val, key, index) {
    return _c("div", { key: key }, [
        _c("p", [_v(_s(val + "---" + key + " --- " + index))])
    ])
})

在 v-for 中 参数可以为 Array | Object | number | string


 * @param {*} val  我们定义的  v-for="item in arr" 中的 arr
 * @param {*} render 
 */
export function renderList(
    val: any,
    render: (
        val: any,
        keyOrIndex: string | number,
        index ? : number
    ) => VNode
): ? Array < VNode > {
    let ret: ? Array < VNode > , i, l, keys, key

    // 处理参数为 Array类型
    if (Array.isArray(val) || typeof val === 'string') {
        ret = new Array(val.length)
        for (i = 0, l = val.length; i < l; i++) {
            // 回调 render()  参数为 val 和 index ，所以数组类型没有第三个参数
            ret[i] = render(val[i], i)
        }
    } else if (typeof val === 'number') {
        // 处理参数类型为 数字
        ret = new Array(val)
        for (i = 0; i < val; i++) {
            // 回调 render()  参数为 val 和 index ，所以数字类型没有第三个参数
            ret[i] = render(i + 1, i)
        }
    } else if (isObject(val)) {
        // 处理 对象类型参数
        keys = Object.keys(val)
        ret = new Array(keys.length)
        for (i = 0, l = keys.length; i < l; i++) {
            key = keys[i]
            // 回调 render()  参数为 val 、 key 和 index ，对象类型有3个参数
            ret[i] = render(val[key], key, i)
        }
    }
    if (isDef(ret)) {
        (ret: any)._isVList = true
    }
    return ret
}
```














