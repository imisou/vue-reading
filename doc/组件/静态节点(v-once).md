# 静态节点

> Vue中对于那么只需要渲染一次 不会因为属性或者子节点变化而改变的节点称为静态节点

静态节点有哪些：

1. 哪些在编译的时候 optimize() 标记的静态根节点和静态节点

```html
<div class="staticroot">
    <p>xxxxxxxxx</p>
</div>
```

2. 通过 v-once 属性标记的元素或者组件

```
<!-- 单个元素 -->
<span v-once>This will never change: {{msg}}</span>
<!-- 有子元素 -->
<div v-once>
  <h1>comment</h1>
  <p>{{msg}}</p>
</div>
<!-- 组件 -->
<my-component v-once :comment="msg"></my-component>
<!-- `v-for` 指令-->
<ul>
  <li v-for="i in list" v-once>{{i}}</li>
</ul>
```

## 编译阶段

### 标记静态节点和静态根节点

> 我们在编译的时候分为3步：第一步： HTML转AST； 第二步：优化AST(标记静态节点和静态根节点) ； 第三步：AST转表达式字符串。 第二步就是标记静态节点和静态根节点

```js
/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
/*
    optimize的作用主要是给AST树，进行静态根的标记，从而优化渲染过程中对静态节点的处理
    其是一个深度遍历的过程，先标记静态节点，再标记静态根节点
 */
export function optimize(root: ? ASTElement, options : CompilerOptions) {
    if (!root) return
    isStaticKey = genStaticKeysCached(options.staticKeys || '')
    isPlatformReservedTag = options.isReservedTag || no
    // first pass: mark all non-static nodes.
    // 标记节点是否是静态节点
    markStatic(root)
    // second pass: mark static roots.
    // 标记节点是否是静态根节点
    markStaticRoots(root, false)
}
```

主要分为三步：

1. 提供根据节点的属性判断是否是静态节点的方法 isStaticKey
2. 深度编译节点，判断是否是 静态节点。
3. 深度遍历节点，判断是都是静态根节点


#### 1. isStaticKey

生成一个 isStaticKey(key) 返回 true/false 的方法，然后去遍历节点el的每一个属性，如果其存在下面的这些响应式属性那么此节点肯定不是静态节点。 
```js
//
const genStaticKeysCached = cached(genStaticKeys)

isStaticKey = genStaticKeysCached(options.staticKeys || '')

function genStaticKeys(keys: string): Function {
    return makeMap(
        'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
        (keys ? ',' + keys : '')
    )
}
```

#### 2. 标记静态节点 markStatic(node)

先通过 isStatic(node)去判断节点是否是静态节点 

1. 响应式文本节点 node.type === 2 肯定不是静态节点
2. 静态文本节点 node.type === 1 肯定是静态节点
3. 最复杂的元素节点
   1. v-pre 属性节点 肯定是
   2. hasBinding : false 且 没有node.for 且 没有node.if  且 不是内置元素标签(slot...)..
   3. 元素节点的子节点只有有一个不是静态节点 那么此节点就不是静态节点
   4. 处理 v-if 因为正常子节点都是放在el.children属性上，但是 v-if else.. 是存放在node.ifConditions属性上 所以也需要对此进行标记

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

```js
/**
 * 标记节点 static 的过程
 *    深度遍历的过程，只要节点的子节点中包含一个非静态子节点 那么此节点就不是静态节点
 * 
 * 
 * @param {*} node 
 */
function markStatic(node: ASTNode) {
    // 直接根据 node.type node.pre  判断是否是静态节点
    // 判断节点是否是静态节点
    node.static = isStatic(node)

    // 如果是元素节点
    if (node.type === 1) {
        // do not make component slot content static. this avoids
        // 1. components not able to mutate slot nodes
        // 2. static slot content fails for hot-reloading
        //  <slot></slot>节点元素及其子节点都不是静态节点
        // 原因： 1、当前组件不能改变插槽内的内容
        // 2、静态插槽内容 不能用于热重载
        if (!isPlatformReservedTag(node.tag) &&
            node.tag !== 'slot' &&
            node.attrsMap['inline-template'] == null
        ) {
            return
        }
        for (let i = 0, l = node.children.length; i < l; i++) {
            const child = node.children[i]
            // 循环处理子节点 如果发现一个子节点不是静态子节点 那么此节点就不是静态节点
            markStatic(child)
            // 如果发现一个子节点不是静态节点 那么此节点就不是静态节点
            if (!child.static) {
                node.static = false
            }
        }
        // 处理节点为 v-if v-else-if v-else的兄弟节点
        // 因为此节点 其几个节点都存放在 node(v-if).ifConditions属性上，
        // 所以此处遍历 如果子节点有一个不是静态节点，那么父节点就不是静态节点 
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                const block = node.ifConditions[i].block
                markStatic(block)
                if (!block.static) {
                    node.static = false
                }
            }
        }
    }
}





function isDirectChildOfTemplateFor(node: ASTElement): boolean {
    while (node.parent) {
        node = node.parent
        if (node.tag !== 'template') {
            return false
        }
        if (node.for) {
            return true
        }
    }
    return false
}
```

#### 3. 标记静态根节点

这个涉及到节点el.staticRoot 与 el.staticInFor 两个属性

##### 3.1 对于el.staticRoot 判断很简单。
1. 如果子节点中全是静态节点那么此节点就是静态根节点
2. 一个特殊的情况。 就是我们常用的     
```
<p>xxxxx</p>
```
这种编译后变成一个父子节点（一个元素节点、一个静态文本节点）。
所以Vue认为将此元素节点标记为静态根节点进行处理 性能更不好。

##### 3.2 对于for循环节点下的静态节点处理 用el.staticInFor进行另外的标记。

```js
/**
 * 标记节点是否是静态根节点
 *   哪些是静态根节点？
 *   1、存在子节点(子节点不是单个文本节点)的静态节点就是 静态根节点。
 *   2、v-if.v-else-if v-else 三种节点是 存放在v-if节点的 node.ifConditions属性下，而不是我们正常的node.children属性。
 *      所以我们也需要根据 条件1 去判断其 其他节点是否是静态根节点
 * @param {*} node 
 * @param {*} isInFor    节点或者父节点存在 v-for 属性那么 isInFor = true;
 */
function markStaticRoots(node: ASTNode, isInFor: boolean) {
    // 只有元素节点 才可能是静态根节点
    if (node.type === 1) {
        // 如果父节点 存在 node.for (是循环节点)
        // 那么如果子节点存在 static 或者 once 那么此子节点 staticInFor = true
        if (node.static || node.once) {
            node.staticInFor = isInFor
        }
        // For a node to qualify as a static root, it should have children that
        // are not just static text. Otherwise the cost of hoisting out will
        // outweigh the benefits and it's better off to just always render it fresh.
        /*
            存在子节点(子节点不是单个文本节点)的静态节点就是 静态根节点。
            node.static && node.children.length 判断需要存在子节点。
            node.children.length === 1 && node.children[0].type === 3 解决的是这种 
            元素节点下只包含一个文本节点(<div>xxxxx</div>) 的元素节点 不值得去 标记其为静态根节点
         */
        if (node.static && node.children.length && !(
                node.children.length === 1 &&
                node.children[0].type === 3
            )) {
            node.staticRoot = true
            return
        } else {
            node.staticRoot = false
        }
        if (node.children) {
            for (let i = 0, l = node.children.length; i < l; i++) {
                // 节点或者父节点存在 v-for 属性那么 isInFor = true;
                markStaticRoots(node.children[i], isInFor || !!node.for)
            }
        }
        // 同样处理 v-if v-else-if
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                markStaticRoots(node.ifConditions[i].block, isInFor)
            }
        }
    }
}
```

### 1.2 v-once标记静态节点

#### 1. HTML转AST

发现如果存在静态属性 v-once 那么 el.once = true;
```
/**
 * 处理节点属性中的 v-once 属性
 * <div class="vOnce" v-once>{{testIf}}</div>
 *  
 *  => el.once = true
 * @param {*} el 
 */
function processOnce(el) {
    // 获取v-once属性的值
    const once = getAndRemoveAttr(el, 'v-once')
        // 如果存在就保存在 el.once 属性上
    if (once != null) {
        el.once = true
    }
}
```

#### 2. AST 转 表达式字符串

```js
// v-once
/**
    处理 v-once 节点
 * @param {*} el 
 * @param {*} state 
 */
function genOnce(el: ASTElement, state: CodegenState): string {
    // 防止无限处理当前节点
    el.onceProcessed = true
    if (el.if && !el.ifProcessed) {
        return genIf(el, state)
    } else if (el.staticInFor) {
        // 处理 v-for 节点下的 v-once 节点
        let key = ''
        let parent = el.parent
        while (parent) {
            if (parent.for) {
                key = parent.key
                break
            }
            parent = parent.parent
        }
        if (!key) {
            process.env.NODE_ENV !== 'production' && state.warn(
                `v-once can only be used inside v-for that is keyed. `
            )
            return genElement(el, state)
        }
        return `_o(${genElement(el, state)},${state.onceId++},${key})`
    } else {
        return genStatic(el, state)
    }
}

```


1. 对于 节点中包含 v-if 判断条件和 v-once 的处理

```html
<div v-if="name ===1" v-once>{{name}}</div>
<div v-else v-once>{{name}}</div>
```
发现其 对el.ifConditions中的每一个判断进行 genOnce()处理
```js
function genTernaryExp(el) {return altGen ? altGen(el, state) : el.once ?
    genOnce(el, state) :
    genElement(el, state)
}
```
###### 如：
```js
(name ===1)?_m(1):_m(2),_v(" ")

code.staticRenderFns = [
    1: "with(this){return _c('div',[_v(_s(name))])}",
    2: "with(this){return _c('div',[_v(_s(name))])}",
]
```


2. 对于祖先节点是v-for节点的v-once的处理

```html
<div v-for="item in arr" :key="item.id">
    <div v-once>
        <p>xxxxx:</p>
    </div>
</div>
```
对于 v-once节点上存在v-for属性的时候 其返回的是一个 _o() 函数表达式字符串

###### 如：
```js
_o(_c("div", [_c("p", [_v("xxxxx:")])]), 0, item.id)
```

3. 正常的v-once节点
```html
<div v-once>
    <p>xxxxx:</p>
</div>
```
其处理方法跟一般的el.staticRoot === true 的节点一样 其返回的是一个
###### 如：
```js
_m(3)

code.staticRenderFns = [
    3: "with(this){return _c('div',[_v("xxxxx")])}"
]
```

```js
/**
    处理静态根节点 和静态节点
    <div class="static-root">
        <div>xasxasxasx</div>
    </div>
    其将所有的静态节点都存放在  state.staticRenderFns数组中，
    然后返回 "_m(下标，是否是for)" 这个render的时候执行 _m方法节点

 * @param {*} el 
 * @param {*} state 
 */
function genStatic(el: ASTElement, state: CodegenState): string {
    // 为什么将el.staticProcessed = true;???
    // 因为下面 ${genElement(el, state)} 会重新genElement()当前el,
    // 如果el.staticProcessed不为true,那么 if (el.staticRoot && !el.staticProcessed) {} 又将继续执行，这将无限循环
    // 其他的如onceProcessed、forProcessed ... 都是这个道理
    el.staticProcessed = true
    // 并将静态节点保存到 code.staticRenderFns中
    
    state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)
    // state.staticRenderFns[0] = "with(this){return _c('div',{staticClass:"static-root"},[_c('div',[_v("xasxasxasx")])])}"

    // 然后返回 '_m(0)' 或者 '_m(1,true)' 
    // 第一个是当前节点在 state.staticRenderFns中的下标
    // 第二个表示是否是 for 遍历静态根节点
    return `_m(${state.staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}
```

#### 总结：

1. 对于静态节点 和 静态根节点 是在编译的第二步是通过深度遍历判断节点而形成的。
2. 对于一般的静态根节点他不像一般的节点直接在父节点的children中通过 _c()去创建 而是通过 _m(下标,isInFor)去寻找我们编译后返回的code.staticRenderFns数组中。
3. 对于v-once一般分为3种情况 存在 v-if属性，是v-for的一个后代节点，平常的v-once属性节点。其处理方式不同。








## render阶段(表达式字符串 -> vnode)

我们发现上面装换的时候主要涉及到 _m() _o() 两个实例方法。

###### core/instance/render-helpers/index.js

target._m = renderStatic

```js
/* @flow */

/**
 * Runtime helper for rendering static trees.
 */
export function renderStatic(
    index: number,
    isInFor: boolean
): VNode | Array < VNode > {
    const cached = this._staticTrees || (this._staticTrees = [])
    let tree = cached[index]
        // if has already-rendered static tree and not inside v-for,
        // we can reuse the same tree.
    if (tree && !isInFor) {
        return tree
    }
    // otherwise, render a fresh tree.
    tree = cached[index] = this.$options.staticRenderFns[index].call(
        this._renderProxy,
        null,
        this // for render fns generated for functional component templates
    )
    markStatic(tree, `__static__${index}`, false)
    return tree
}

```
在上面编译的时候我们发现对于静态节点 其编译成表达式字符串的时候为
_m(0,false)。

这就涉及到我们编译的generate()阶段返回的是一个对象

```
code = {
    render: "with(this){return _c('div',{attrs:{"id":"app"}},[_c('div',[_v("this is app")]),_v(" "),_m(0),_v(" "),_l((arr),function(item){return _c('div',{key:item.id},[_m(1,true)])}),_v(" "),_l((arr),function(item){return _c('div',{key:item.id},[_o(_c('div',[_c('p',[_v("xxxxx:")])]),0,item.id)])}),_v(" "),_m(3),_v(" "),(name ===1)?_m(4):_m(5),_v(" "),_m(6)],2)}"
    
    staticRenderFns: [
        0: "with(this){return _c('div',{staticClass:"staticroot"},[_c('p',[_v("xxxxxxxxx")])])}",
        1: "with(this){return _c('div',[_c('p',[_v("xxxxx:")])])}"
        2: "with(this){return _c('div',[_c('p',[_v("xxxxx:")])])}"
        3: "with(this){return _l((arr),function(item){return _c('div',{key:item.id},[_m(2,true)])})}"
        4: "with(this){return _c('div',[_v(_s(name))])}"
        5: "with(this){return _c('div',[_v(_s(name))])}"
        6: "with(this){return _c('div',[_v("xxxxx")])}"
    ]
}
```
而 _m(0,false)就是调用 this.$options.staticRenderFns[index].call(this._renderProxy,null,this)。 并将其缓存到组件实例属性 this._staticTrees[staticRenderFns数组下标]中，再下次遇到就直接调用缓存的tree。

### _o()的处理

target._o = markOnce

```js
/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 * 实际上，这意味着用唯一的键将节点标记为静态。
 */

/**
 * 处理 v-for 节点下的 v-once 节点
    <div v-for="item in arr" :key="item.id">
      <div v-once>
        <p>xxxxx:</p>
      </div>   
    </div>

    generate 转换 
    _l(arr, function(item) {
            return _c("div", { key: item.id }, [
                _o(_c("div", [_c("p", [_v("xxxxx:")])]), 0, item.id)
            ])
        })
    结果 就是把v-once 的vnode对象上
    {
        isStatic : true,
        key : __once__${state.onceId}_${key},
        isOnce : true,
    }

 * @param {*} tree   vnode 节点
 * @param {*} index  当前 state.onceId++
 * @param {*} key    v-for循环的 key 的值
 */
export function markOnce(
    tree: VNode | Array < VNode > ,
    index: number,
    key: string
) {

    // 调用标记为静态节点方法     __once__0_${item_id}
    markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)

    return tree
}

function markStatic (
  tree: VNode | Array<VNode>,
  key: string,
  isOnce: boolean
) {
  if (Array.isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    //   对于 markOnce 肯定不是数组类型 
    markStaticNode(tree, key, isOnce)
  }
}

/**
 * 修改vnode 节点的 isStatic key isOnce 3个属性
 * @param {*} node 
 * @param {*} key 
 * @param {*} isOnce 
 */
function markStaticNode (node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}
```
我们发现对于 v-for节点的后代节点中存在 v-once的节点处理与其他的静态根节点的处理方式不同（_m()），其没有存放在 code.staticRenderFns数组中，而是仍然存放在 render表达式字符串中。但是用 _o()实例方法去标记创建好的vnode。

```
<div v-for="item in arr" :key="item.id">
    <div v-once>
        <p>xxxxx:</p>
    </div>
</div>
        
_l(arr, function(item) {
    return _c("div", { key: item.id }, [
        _o(_c("div", [_c("p", [_v("xxxxx:")])]), 0, item.id)
    ])
}),
```
可见其节点的创建仍然是通过 _c(...)去生成vnode 然后再以vnode,state.onceId,item.id作为入参进行静态节点的标记。

所以其vnode特别的地方是： vnode的key 和 isOnce 属性

```js
vnode = {
    isStatic : true,
    key : __once__${state.onceId}_${key},
    isOnce : true,
}
```



## 组件更新阶段

> 当组件进行渲染Watcher的更新的时候 其重新进行 render()。 表达式转vnode。

#### 一般静态根节点

在 renderStatic() 的时候通过 this._staticTrees 找到缓存的tree直接返回。就不需要更新

#### 对于v-for下的v-once节点 
 其不想其它的静态根节点缓存在 this._staticTrees数组下。而是通过markOnce()进行了vnode.isOnce的标记，所以在 patchVnode()的时候发现其是v-for下的v-once节点，直接return。

```js
// reuse element for static trees.
// note we only do this if the vnode is cloned -
// if the new node is not cloned it means the render functions have been
// reset by the hot-reload-api and we need to do a proper re-render.
// 为静态树重用元素。注意，我们只在克隆vnode时才这样做——如果没有克隆新的节点，这意味着呈现函数已经被热重加载api重置，我们需要做一个适当的重新呈现。
// 对于v-for下的v-once节点 其不想其他的静态根节点缓存在 this._staticTrees数组下。
if (isTrue(vnode.isStatic) &&
    isTrue(oldVnode.isStatic) &&
    vnode.key === oldVnode.key &&
    (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
) {
    // TODO: 为什么需要将旧的componentInstance 赋给新的 vnode
    vnode.componentInstance = oldVnode.componentInstance
    return
}
```




