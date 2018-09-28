# v-if、v-else-if、v-else

![image](https://note.youdao.com/yws/public/resource/fa4a717e0bafc76404a2b7658a9371c6/xmlnote/7C97FD4A8D914D3FBCAD1C5A21A6CB24/9101)

```html
<div v-if="testIf === 1">if</div>
<div v-else-if="testIf === 2">elseif</div>
<div v-else>else</div>

<template v-if="loginType === 'username'">
  <label>Username</label>
  <input placeholder="Enter your username" key="username-input">
</template>
<template v-else>
  <label>Email</label>
  <input placeholder="Enter your email address" key="email-input">
</template>
```

## 编译阶段

Vue在编译阶段的parse处理开始节点的时候 通过 processIf()
```js
// 处理directives 中的 v-if
processIf(element)

/**
 * 处理 AST 上的 v-if , v-else , v-else-if 三个属性
 * 
    <div v-if="testIf === '1'">if</div>
    <div v-else-if="testIf === '2'">v-else-if</div>
    <div v-else>else</div>
 * @param {c} el 
 */
function processIf(el) {
    // 获取 ast.attrsMap['v-if']的值 并从ast.attrsList 中移除v-if属性
    const exp = getAndRemoveAttr(el, 'v-if')
    if (exp) {
        // 保存if的条件到 AST对象上   el-if = "testIf === '1'"
        el.if = exp;
        // 保存if的条件对象到AST.ifConditions数组中  ast.ifConditions = [{exp = "testIf === '1'" , block : AST}]
        addIfCondition(el, {
            exp: exp,
            block: el
        })
    } else {
        //  获取 ast.attrsMap['v-else']的值 并从ast.attrsList 中移除v-else属性
        //  如果存在 v-else 属性  那么 ast.else = true;
        if (getAndRemoveAttr(el, 'v-else') != null) {
            el.else = true
        }

        //  获取 ast.attrsMap['v-else-if']的值 并从ast.attrsList 中移除v-else-if属性
        const elseif = getAndRemoveAttr(el, 'v-else-if')
        if (elseif) {
            el.elseif = elseif
        }
    }
}
```

判断节点上是否存在静态属性  v-if 

- 不存在v-if 判断是否存在 v-else | v-else-if 
- 如果存在v-if 属性  

设置el.if 保存属性条件
```js
el = {
    if : exp ,       // v-if的值 就是我们上面的 "testIf === '1'"
}

```
调用 addIfCondition()
```js
export function addIfCondition(el: ASTElement, condition: ASTIfCondition) {
    if (!el.ifConditions) {
        el.ifConditions = []
    }
    el.ifConditions.push(condition)
}
```

发现addIfCondition() 很简单，就是初始化 el.ifConditions 并保存当前节点的if对象

```js
el = {
    if : exp ,       // v-if的值 就是我们上面的 "testIf === '1'"
    ifConditions : [{
        exp : exp ,      // "testIf === '1'"
        blocl : el       // v-if 节点的AST对象
    }]
}
```

第二步 ：

```js
if (element.elseif || element.else) {
    // 为什么 el.elseif 与 el.else 没有 最后的else 。就是在currentParent下 其浓缩在一个节点el上 (v-if),所以不需要插入
    processIfConditions(element, currentParent)
}
```
发现下面还有一步判断if (element.elseif || element.else) 当前节点是否存在 elseif || else , 因为第一步处理的是 v-if 所以不是，然后继续向下处理直到 v-else-if 节点，然后又进行第一步;发现其只是标记 el.elseif = "testIf === '2'" 然后又是第二步； 此时条件成功

```js
/**
 * 处理遇到 v-else-if  v-else 的节点  其parent要么就是 共同上级 ；要么就是undefined
    <div id="app">
        <div v-if='testIf === 0'>if</div>
        <div v-else-if='testIf === 1'>v-else-if</div>
        <div v-else>else</div>
    </div>

    #### 当我们遇到 <div v-else>else</div>  为什么 findPrevElement(parent.children) 查找的父节点最后一个元素节点仍然是 <div v-if='testIf === 0'>if</div> 而不是<div v-else-if='testIf === 1'>v-else-if</div>

    在我们start() 的时候
    if (element.elseif || element.else) {          
        processIfConditions(element, currentParent)
        ...
    } else {
        // 如上面 currentParent = div 那么此时就构成了 div>span 的树
        currentParent.children.push(element)
        // span 的父节点  也就指向 div
        element.parent = currentParent
    }
    我们发现element.elseif || element.else 没有进行 currentParent.children.push(element) 
    那就是说对于 v-if..else 3个节点来说其在AST上只是一个节点(v-if) 其其他节点 都存放在 el.ifConditions = [数组中]

    el(v-if).ifConditions = [
        { exp : 'testIf === 0' , block : el(v-if) } , 
        { exp : 'testIf === 1' , block : el(v-else-if) } , 
        { exp : undefined , block : el(v-else) }
    ]
 * @author guzhanghua
 * @param {*} el
 * @param {*} parent
 */
function processIfConditions(el, parent) {
    // 找到当前节点的上一个兄弟节点，其肯定为此时他们父节点的最后一个元素子节点
    // 当我们
    const prev = findPrevElement(parent.children)
        // 判断元素子节点中是否存在 v-if
    if (prev && prev.if) {
        // 如果存在 就在上一个兄弟节点的 el.ifConditions = []添加此条件
        addIfCondition(prev, {
            exp: el.elseif,
            block: el
        })
    } else if (process.env.NODE_ENV !== 'production') {
        warn(
            `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
            `used on element <${el.tag}> without corresponding v-if.`
        )
    }
}
```
processIfConditions 也就是先判断上一个兄弟节点是否存在 v-if， 不存在就报错，存在就调用addIfCondition() 其第一个参数为prev就上一个兄弟节点

```js
el = {
    if : exp ,       // v-if的值 就是我们上面的 "testIf === '1'"
    ifConditions : [{    // <div v-if="testIf === 1">if</div>
        exp : exp ,      // "testIf === '1'"
        blocl : el       // v-if 节点的AST对象
    },{                  //  <div v-else-if="testIf === 2">elseif</div>
        exp : exp ,      // "testIf === '2'"
        block : el       // 当前 v-else-if 节点 AST对象 <div v-else-if="testIf === 2">elseif</div>
    }]
}
```
然后处理第三个v-else 继续按照上面的流程 使得 el变成：
```js
el = {
    if : exp ,       // v-if的值 就是我们上面的 "testIf === '1'"
    ifConditions : [{    // <div v-if="testIf === 1">if</div>
        exp : exp ,      // "testIf === '1'"
        blocl : el       // v-if 节点的AST对象
    },{                  //  <div v-else-if="testIf === 2">elseif</div>
        exp : exp ,      // "testIf === '2'"
        block : el       // 当前 v-else-if 节点 AST对象 <div v-else-if="testIf === 2">elseif</div>
    },{                  //   <div v-else>else</div>
        exp : exp ,      //  true
        block : el       // 当前 v-else 节点AST对象  <div v-else>else</div>
    }]
}
```

### 重点:

###### 1. 我们发现对于v-else-if v-else 节点其节点都没有保存在父节点的children属性中 而是保存在 他们兄弟节点的 v-if节点的 el.ifConditions 属性上。

```js
if (currentParent && !element.forbidden) {
    // 如果遇到 elseif 或者 else 那么此时 currentParent 要么就是 跟v-if的共同parent 要么就是undefined
    if (element.elseif || element.else) {
        // 为什么 el.elseif 与 el.else 没有 最后的else 。就是在currentParent下 其浓缩在一个节点el上 (v-if),所以不需要插入
        processIfConditions(element, currentParent)
    } else if (element.slotScope) { // scoped slot
        ...           
    } else {
        // 如上面 currentParent = div 那么此时就构成了 div>span 的树
        currentParent.children.push(element)
            // span 的父节点  也就指向 div
        element.parent = currentParent
    }
}
```
上面 currentParent存在的时候 如果不是v-else-if v-else slot属性节点 那么会执行else条件

```js
currentParent.children.push(element)
// span 的父节点  也就指向 div
element.parent = currentParent
```
而 对于v-else-if v-else 节点起没有执行 currentParent.children.push(element) 所以节点对象咩有保存在父节点的children属性中

![image](https://note.youdao.com/yws/public/resource/fa4a717e0bafc76404a2b7658a9371c6/xmlnote/DEF8F4DDBA4B4256AAFC5A3A9D1E3635/9186)

### 优化AST树对象，标记静态节点阶段

```js

function markStatic(node: ASTNode) {

    // 如果是元素节点
    if (node.type === 1) {

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

function markStaticRoots(node: ASTNode, isInFor: boolean) {
    // 只有元素节点 才可能是静态根节点
    if (node.type === 1) {

        // 同样处理 v-if v-else-if
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                markStaticRoots(node.ifConditions[i].block, isInFor)
            }
        }
    }
}
```
发现对于静态节点树的标记 其都处理了node.ifConditions 这也印证了上面 v-if、v-else-if、v-else的节点没有存放在父节点的children属性下，而是存放在 v-if节点的node.ifConfitions属性下

### AST转表达式字符串

在AST转表达式字符串阶段

```js

export function genIf(
    el: any,
    state: CodegenState,
    altGen ? : Function,
    altEmpty ? : string
): string {
    el.ifProcessed = true // avoid recursion
    return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}


/**
 * 处理 v-if 节点 的if属性
 conditions = [{               // <div v-if="testIf === 1"></div>   
     exp : 'testIf === 1',
     block : 节点1
 },{                     //  <div v-else></div>   
     exp : undefined,            
     block : 节点2
 }]
   然后通过三目运算符   ( exp1 ) ? 节点1 : 待确定 去不断的遍历 el.ifConditions数组
 * @param {*} conditions 
 * @param {*} state 
 * @param {*} altGen 
 * @param {*} altEmpty 
 */
function genIfConditions(
    conditions: ASTIfConditions,
    state: CodegenState,
    altGen ? : Function,
    altEmpty ? : string
): string {
    if (!conditions.length) {
        return altEmpty || '_e()'
    }

    const condition = conditions.shift()
    if (condition.exp) {
        // "(testIf === 1)?_c('div',{staticClass:"v-if"},[_v("if")]):_e()"
        // 通过三目运算符
        // 第一个 ( exp ) ? 节点1 : 
        // 判断第二个是否存在  
        //   如果不存在 return '_e()'  => ( exp ) ? 节点1 : '_e()'
        //   如果第二个存在 且仍有 exp 说明是 v-else-if ： return ( exp2 ) ? 节点2 : 待确定  
        //       =>  ( exp ) ? 节点1 : ( exp2 ) ? 节点2 : 待确定;
        // 判断第三个是否存在  如果存在 且 exp = undefined  那么 return `${genTernaryExp(condition.block)}` 即 节点3
        //    => ( exp ) ? 节点1 : ( exp2 ) ? 节点2 : 节点3;
        return `(${condition.exp})?${
                genTernaryExp(condition.block)
            }:${
                genIfConditions(conditions, state, altGen, altEmpty)
            }`
    } else {
        // 处理 v-else 的情况  其存在判断条件  但是exp = undefined
        // 所以直接返回 节点
        return `${genTernaryExp(condition.block)}`
    }

    // v-if with v-once should generate code like (a)?_m(0):_m(1)
    function genTernaryExp(el) {
        return altGen ?
            altGen(el, state) :
            el.once ?
            genOnce(el, state) :
            genElement(el, state)
    }
}
```

其作用就是将el.ifConditions里的值转换成 三目运算表达式字符串

```js
(testIf === 1) ? _c('div',[_v("if")]):
    (testIf === 2)?_c('div',[_v("elseif")]):_c('div',[_v("else")])
```


### 重点: 

#### 1. v-if 与 v-show的区别




