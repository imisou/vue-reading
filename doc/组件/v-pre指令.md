# v-pre指令


如文档，其就是对元素文本中的表达式的不进行编译过程

```
<div id="app">
    <div>{{name}}</div>
    <div v-pre :class="{'ui':name === 1}">
        {{name}}
        <scope-first :count="name">xxxx</scope-first>
    </div>
</div>
```
的结果是：
```
1
{{name}}
this is child
xxxundefined
```
其主要在编译的过程，特别是 parse的过程

```js
start(tag, attrs, unary) {

    // 处理 v-pre 指令
    // v-pre： 跳过这个元素和它的子元素的编译过程。可以用来显示原始 Mustache 标签。跳过大量没有指令的节点会加快编译。
    if (!inVPre) {
        processPre(element)
            // 如果element.pre = true; 代表此节点上存在 v-pre 指令 那么
        if (element.pre) {
            inVPre = true
        }
    }
},

```

我们看源码，发现其在处理开始节点的时候如果公共属性 inVPre = false (即节点的祖先节点没有v-pre属性的时候) 都会进行 processPre(element)的过程

```js
/**
 * 处理 v-pre 指令
 *    跳过这个元素和它的子元素的编译过程。可以用来显示原始 Mustache 标签。跳过大量没有指令的节点会加快编译。
 * @param {*} el 
 */
function processPre(el) {
    // 判断该节点上是否存在静态属性 v-pre
    if (getAndRemoveAttr(el, 'v-pre') != null) {
        el.pre = true
    }
}
```
而processPre 就是判断元素的属性上是否存在 v-pre属性。 如果存在那么 el.pre = true;
```js
    // 判断该元素 上存在 v-pre指令  <div v-pre></div>
    if (inVPre) {
        // 如果其存在v-pre 属性或者其父节点存在v-pre属性，那么此处处理其属性。
        processRawAttrs(element)
    } else if (!element.processed) {
        // structural directives
        // 处理directives 中的 v-for
        processFor(element)
            // 处理directives 中的 v-if
        processIf(element)
            // 处理 v-once
        processOnce(element)
            // element-scope stuff
            // 处理一些非特性属性   如 事件 指令 其他属性
        processElement(element, options)
    }
```
然后如果发现 inVPre为 true，那么他所有的属性都通过 processRawAttrs(element)

```js
/**
 * 处理 存在 v-pre 指令的节点及其子节点 的属性。
 *    将所有的属性都作为静态属性 处理
 *    如果是v-pre 的子节点 那么其应该不存在v-pre 属性
 *    
 *  <div class="pre" v-pre>
        <div :class="{'class1':value2 }">this is pre</div>
        <div>{{value1}}</div>
    </div>
 * @param {*} el 
 */
function processRawAttrs(el) {
    // 获取元素的属性长度
    const l = el.attrsList.length
    if (l) {
        //  初始化节点的 el.attrs 属性
        const attrs = el.attrs = new Array(l)

        // 将所有的属性都作为静态属性处理
        for (let i = 0; i < l; i++) {
            attrs[i] = {
                name: el.attrsList[i].name,
                value: JSON.stringify(el.attrsList[i].value)
            }
        }
    } else if (!el.pre) {
        // non root node in pre blocks with no attributes
        //  处理 上面 v-pre 的子节点  他们不存在v-pre 属性。
        // 所以 添加一个el.plain = true;
        el.plain = true
    }
}

```
即所有的属性都是按照静态属性进行处理的。

而对于inVPre = false的元素，Vue才会进行 processFor(element)处理v-for, processIf(element)处理v-if... 处理属性上的表达式。

#### 对于v-pre子节点

其子节点因为没有遇到v-pre节点的closeElement()所以其inVPre仍然为true。

#### 对于文本节点
```js
chars(text: string) {

        // 处理 <pre></pre> 期间的文本内容
    text = inPre || text.trim() ?
        isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag
        :
        preserveWhitespace && children.length ? ' ' : ''
    // 如果 存在文本
    if (text) {
        let res
        // 处理非 v-pre 指令下的文本节点
        // 并通过parseText 解析文本 {{}} 使其转换成可执行的响应式文本
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
            // 将需要进行响应式的文本节点存入children
            children.push({
                type: 2,
                expression: res.expression,
                tokens: res.tokens,
                text
            })
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
            // inVPre = true 那么就解析成 静态的文本节点
            children.push({
                type: 3,
                text
            })
        }
    }
},
```
发现如果 inVPre = true 的时候其children.push({ type : 3 }) 即 type为3的静态文本节点。
所以 上面 {{name}}  =>  '"{{name}}"'。

## optimize 阶段

发现在 isStatic()判断节点是否是静态节点的时候加入了 node.pre。 确实对于v-pre标记的节点其肯定为静态节点，哪怕其后代节点中存在 组件占位符节点 其props也无法通过响应式数据传入给子组件，所以也不需要在更新的时候触发子组件vnode的更新。

```js
/**
 * 判断节点是否是静态节点
 * @param {*} node 
 */
function isStatic(node: ASTNode): boolean {
    // 响应式文本节点 肯定不是静态节点
    if (node.type === 2) { // expression
        return false
    }
    // 静态文本节点肯定是 静态节点
    if (node.type === 3) { // text
        return true
    }

    /*
        1、 v-pre 节点肯定是静态节点
        2、 节点 都不是这些 ：hasBinding : false , 没有 node.if , 且没有node.for , 
            tag不是内置标签 slot、component标签 , 且元素是平台标签(div、span...) , 
            除了 上面的 type,tag,attrsList,attrsMap,plain,parent,children,attrs 没有其他属性
     */
    return !!(node.pre || (!node.hasBindings && // no dynamic bindings
        !node.if && !node.for && // not v-if or v-for or v-else
        !isBuiltInTag(node.tag) && // not a built-in
        isPlatformReservedTag(node.tag) && // not a component
        !isDirectChildOfTemplateFor(node) &&
        Object.keys(node).every(isStaticKey)
    ))
}
```

