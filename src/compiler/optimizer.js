/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

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

function genStaticKeys(keys: string): Function {
    return makeMap(
        'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
        (keys ? ',' + keys : '')
    )
}

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