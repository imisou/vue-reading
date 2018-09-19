/* @flow */

import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { genAssignmentCode } from '../directives/model'
import { extend, cached, no, camelize } from 'shared/util'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
    addProp,
    addAttr,
    baseWarn,
    addHandler,
    addDirective,
    getBindingAttr,
    getAndRemoveAttr,
    pluckModuleFunction
} from '../helpers'

export const onRE = /^@|^v-on:/
export const dirRE = /^v-|^@|^:/
export const forAliasRE = /([^]*?)\s+(?:in|of)\s+([^]*)/
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g

const argRE = /:(.*)$/
export const bindRE = /^:|^v-bind:/
const modifierRE = /\.[^.]+/g

const decodeHTMLCached = cached(he.decode)

// configurable state
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace

type Attr = { name: string;value: string };

export function createASTElement(
    tag: string,
    attrs: Array < Attr > ,
    parent: ASTElement | void
): ASTElement {
    return {
        type: 1,
        tag,
        attrsList: attrs,
        attrsMap: makeAttrsMap(attrs),
        parent,
        children: []
    }
}

/**
 * Convert HTML string to AST.
 */
export function parse(
    template: string,
    options: CompilerOptions
): ASTElement | void {
    warn = options.warn || baseWarn

    platformIsPreTag = options.isPreTag || no
    platformMustUseProp = options.mustUseProp || no
    platformGetTagNamespace = options.getTagNamespace || no

    transforms = pluckModuleFunction(options.modules, 'transformNode')
    preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
    postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

    delimiters = options.delimiters

    const stack = []
    const preserveWhitespace = options.preserveWhitespace !== false
    let root
    let currentParent
    let inVPre = false
    let inPre = false
    let warned = false

    function warnOnce(msg) {
        if (!warned) {
            warned = true
            warn(msg)
        }
    }

    function closeElement(element) {
        // check pre state
        if (element.pre) {
            inVPre = false
        }
        if (platformIsPreTag(element.tag)) {
            inPre = false
        }
        // apply post-transforms
        for (let i = 0; i < postTransforms.length; i++) {
            postTransforms[i](element, options)
        }
    }

    parseHTML(template, {
        warn,
        expectHTML: options.expectHTML,
        isUnaryTag: options.isUnaryTag,
        canBeLeftOpenTag: options.canBeLeftOpenTag,
        shouldDecodeNewlines: options.shouldDecodeNewlines,
        shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
        shouldKeepComment: options.comments,
        start(tag, attrs, unary) {
            // check namespace.
            // inherit parent ns if there is one
            const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

            // handle IE svg bug
            /* istanbul ignore if */
            if (isIE && ns === 'svg') {
                attrs = guardIESVGBug(attrs)
            }
            // 生成一个基础的AST对象。
            // currentParent的作用？  这是一个闭包属性，当此时为根节点的时候creentParent = undefined。astEl.parent = currentParent === undefined;
            // 然后在下面把 
            let element: ASTElement = createASTElement(tag, attrs, currentParent)
            if (ns) {
                element.ns = ns
            }

            // 如果元素 是 style | script 且 type="text/javascript"
            if (isForbiddenTag(element) && !isServerRendering()) {
                element.forbidden = true
                process.env.NODE_ENV !== 'production' && warn(
                    'Templates should only be responsible for mapping the state to the ' +
                    'UI. Avoid placing tags with side-effects in your templates, such as ' +
                    `<${tag}>` + ', as they will not be parsed.'
                )
            }

            // apply pre-transforms
            for (let i = 0; i < preTransforms.length; i++) {
                // 调用定义modules 中 所有的 preTransforms 钩子函数。 如 platforms/web/compiler/moudles/model.js preTransforms方法
                element = preTransforms[i](element, options) || element
            }

            if (!inVPre) {
                processPre(element)
                if (element.pre) {
                    inVPre = true
                }
            }
            if (platformIsPreTag(element.tag)) {
                inPre = true
            }
            if (inVPre) {
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

            // 根节点 不能为 <slot></slot> <template></template> 或者包含 v-for属性
            function checkRootConstraints(el) {
                if (process.env.NODE_ENV !== 'production') {
                    if (el.tag === 'slot' || el.tag === 'template') {
                        warnOnce(
                            `Cannot use <${el.tag}> as component root element because it may ` +
                            'contain multiple nodes.'
                        )
                    }
                    if (el.attrsMap.hasOwnProperty('v-for')) {
                        warnOnce(
                            'Cannot use v-for on stateful component root element because ' +
                            'it renders multiple elements.'
                        )
                    }
                }
            }

            // tree management
            if (!root) {
                root = element
                // 根节点 不能为 <slot></slot> <template></template> 或者包含 v-for属性
                checkRootConstraints(root)
            } else if (!stack.length) {
                // allow root elements with v-if, v-else-if and v-else
                // Vue中根节点只能存在一个 
                // 但是如果我们几个根节点 是v-if v-else-if v-else 那么就支持
                if (root.if && (element.elseif || element.else)) {
                    checkRootConstraints(element)
                    addIfCondition(root, {
                        exp: element.elseif,
                        block: element
                    })
                } else if (process.env.NODE_ENV !== 'production') {
                    warnOnce(
                        `Component template should contain exactly one root element. ` +
                        `If you are using v-if on multiple elements, ` +
                        `use v-else-if to chain them instead.`
                    )
                }
            }
            if (currentParent && !element.forbidden) {
                if (element.elseif || element.else) {
                    processIfConditions(element, currentParent)
                } else if (element.slotScope) { // scoped slot
                    currentParent.plain = false
                    const name = element.slotTarget || '"default"';
                    (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
                } else {
                    currentParent.children.push(element)
                    element.parent = currentParent
                }
            }
            if (!unary) {
                currentParent = element
                stack.push(element)
            } else {
                closeElement(element)
            }
        },

        end() {
            // remove trailing whitespace
            const element = stack[stack.length - 1]
            const lastNode = element.children[element.children.length - 1]
            if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
                element.children.pop()
            }
            // pop stack
            stack.length -= 1
            currentParent = stack[stack.length - 1]
            closeElement(element)
        },

        chars(text: string) {
            if (!currentParent) {
                if (process.env.NODE_ENV !== 'production') {
                    if (text === template) {
                        warnOnce(
                            'Component template requires a root element, rather than just text.'
                        )
                    } else if ((text = text.trim())) {
                        warnOnce(
                            `text "${text}" outside root element will be ignored.`
                        )
                    }
                }
                return
            }
            // IE textarea placeholder bug
            /* istanbul ignore if */
            if (isIE &&
                currentParent.tag === 'textarea' &&
                currentParent.attrsMap.placeholder === text
            ) {
                return
            }
            const children = currentParent.children
            text = inPre || text.trim() ?
                isTextTag(currentParent) ? text : decodeHTMLCached(text)
                // only preserve whitespace if its not right after a starting tag
                :
                preserveWhitespace && children.length ? ' ' : ''
            if (text) {
                let res
                if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
                    children.push({
                        type: 2,
                        expression: res.expression,
                        tokens: res.tokens,
                        text
                    })
                } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
                    children.push({
                        type: 3,
                        text
                    })
                }
            }
        },
        comment(text: string) {
            currentParent.children.push({
                type: 3,
                text,
                isComment: true
            })
        }
    })
    return root
}

function processPre(el) {
    if (getAndRemoveAttr(el, 'v-pre') != null) {
        el.pre = true
    }
}

function processRawAttrs(el) {
    const l = el.attrsList.length
    if (l) {
        const attrs = el.attrs = new Array(l)
        for (let i = 0; i < l; i++) {
            attrs[i] = {
                name: el.attrsList[i].name,
                value: JSON.stringify(el.attrsList[i].value)
            }
        }
    } else if (!el.pre) {
        // non root node in pre blocks with no attributes
        el.plain = true
    }
}
/**
 * 处理元素类型节点的一些 特殊属性
 * @param {*} element 
 * @param {*} options 
 */
export function processElement(element: ASTElement, options: CompilerOptions) {
    processKey(element)

    // determine whether this is a plain element after
    // removing structural attributes
    // 在删除结构属性后确定这是否是一个普通元素
    element.plain = !element.key && !element.attrsList.length

    processRef(element)
    processSlot(element)
    processComponent(element)
    for (let i = 0; i < transforms.length; i++) {
        element = transforms[i](element, options) || element
    }
    processAttrs(element)
}


/**
 * 处理节点中响应式属性 ‘key’ 
 *  <div></div>
 * 
 * @param {*} el 
 */
function processKey(el) {
    // 获取 :key = '' 或者 v-bind:key = '' 两个绑定属性方式的值
    const exp = getBindingAttr(el, 'key')
    if (exp) {
        // template 节点 不支持key 属性
        if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
            warn(`<template> cannot be keyed. Place the key on real elements instead.`)
        }
        el.key = exp
    }
}

/**
 * 处理节点中静态属性 ‘ref’ 
 *  <div ref="ref1"></div>
 * 
 * @param {*} el 
 */
function processRef(el) {
    // 获取节点中ref属性的值  ref="ref1" => 'ref1'
    const ref = getBindingAttr(el, 'ref')
    if (ref) {
        // 保存属性到AST.ref上
        el.ref = ref
        // 判断 ref 是否在 v-for节点或者 父节点中存在 v-for 属性
        // 即 判断是否在v-for 节点中
        el.refInFor = checkInFor(el)
    }
}

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

type ForParseResult = {
    for: string;
    alias: string;
    iterator1 ? : string;
    iterator2 ? : string;
};

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

function processIfConditions(el, parent) {
    const prev = findPrevElement(parent.children)
    if (prev && prev.if) {
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

function findPrevElement(children: Array < any > ) : ASTElement | void {
    let i = children.length
    while (i--) {
        if (children[i].type === 1) {
            return children[i]
        } else {
            if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
                warn(
                    `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
                    `will be ignored.`
                )
            }
            children.pop()
        }
    }
}

export function addIfCondition(el: ASTElement, condition: ASTIfCondition) {
    if (!el.ifConditions) {
        el.ifConditions = []
    }
    el.ifConditions.push(condition)
}


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


/**
 * 处理 slot 插槽相关的属性
 *   <slot name="header"></slot> 
 * 
 *   <template slot="scope"></template>
 *   <template slot-scope="scope"></template>
 * 
 * @param {*} el 
 */
function processSlot(el) {
    if (el.tag === 'slot') {
        // 支持 <slot name="header"></slot> <slot :name="header"></slot> <slot v-bind:name="header"></slot>
        el.slotName = getBindingAttr(el, 'name')
        if (process.env.NODE_ENV !== 'production' && el.key) {
            warn(
                `\`key\` does not work on <slot> because slots are abstract outlets ` +
                `and can possibly expand into multiple elements. ` +
                `Use the key on a wrapping element instead.`
            )
        }
    } else {
        let slotScope
        if (el.tag === 'template') {
            // <template slot="scope"></template>
            slotScope = getAndRemoveAttr(el, 'scope')
            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && slotScope) {
                warn(
                    `the "scope" attribute for scoped slots have been deprecated and ` +
                    `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
                    `can also be used on plain elements in addition to <template> to ` +
                    `denote scoped slots.`,
                    true
                )
            }
            //  也支持 <template slot-scope="scope"></template>
            el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
        } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
                warn(
                    `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
                    `(v-for takes higher priority). Use a wrapper <template> for the ` +
                    `scoped slot to make it clearer.`,
                    true
                )
            }
            el.slotScope = slotScope
        }
        // 处理 含有slot属性 
        // <div slot="header"></div>
        const slotTarget = getBindingAttr(el, 'slot')
        if (slotTarget) {
            el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
            // preserve slot as an attribute for native shadow DOM compat
            // only for non-scoped slots.
            if (el.tag !== 'template' && !el.slotScope) {
                addAttr(el, 'slot', slotTarget)
            }
        }
    }
}

/**
 *  处理动态组件 的 响应式属性 is
 *   <component v-bind:is="currentTabComponent"></component>
 *  处理内联模板 inline-template 静态属性
 *  <my-component inline-template>
        <div>
            <p>These are compiled as the component's own template.</p>
            <p>Not parent's transclusion content.</p>
        </div>
    </my-component>
 * @param {*} el 
 */
function processComponent(el) {
    let binding
    // 获取节点的响应式属性 is 
    if ((binding = getBindingAttr(el, 'is'))) {
        el.component = binding
    }
    // 处理内联模板 inline-template 静态属性
    if (getAndRemoveAttr(el, 'inline-template') != null) {
        el.inlineTemplate = true
    }
}


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
        if (dirRE.test(name)) {
            // mark element as dynamic
            el.hasBindings = true
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
                    addProp(el, name, value)
                } else {
                     // 添加 到 el.attrs 属性数组中 [{ title : value }]
                    addAttr(el, name, value)
                }
            } else if (onRE.test(name)) { // v-on
                // 处理 v-on 或者 @ 属性  如 <div v-on:click="xxx" @change="xxx">
                // v-on:click => click
                name = name.replace(onRE, '')
                // 添加事件属性
                addHandler(el, name, value, modifiers, false, warn)
            } else { // normal directives
                // 处理自定义指令  <div id="hook-arguments-example" v-demo:foo.a.b="message"></div>

                // v-demo:foo.a.b -> demo:foo  名称和参数
                name = name.replace(dirRE, '')
                // parse arg
                // 获取自定义指令的参数 
                // [ 0 : ':foo' ,1 : 'foo' , input : 'demo:foo']
                const argMatch = name.match(argRE)
                // 如果存在参数
                const arg = argMatch && argMatch[1]
                if (arg) {
                    // 如果指令的名称  demo:foo -> demo
                    name = name.slice(0, -(arg.length + 1))
                }
                // 添加一个指令属性对象
                addDirective(el, name, rawName, value, arg, modifiers)

                if (process.env.NODE_ENV !== 'production' && name === 'model') {
                    checkForAliasModel(el, value)
                }
            }
        } else {
            // literal attribute
            // 处理遗留的 静态属性 如 src="x.img"
            if (process.env.NODE_ENV !== 'production') {
                // 如果 在静态属性中 使用 {{}}访问响应式数据，那么就报错。 
                //    <div id="{{val}}"> 就建议使用响应式属性的方式
                const res = parseText(value, delimiters)
                if (res) {
                    warn(
                        `${name}="${value}": ` +
                        'Interpolation inside attributes has been removed. ' +
                        'Use v-bind or the colon shorthand instead. For example, ' +
                        'instead of <div id="{{ val }}">, use <div :id="val">.'
                    )
                }
            }
            // 如 <div id="xx"> id这种没有特殊处理的静态属性， 那么此时直接添加到el 上
            addAttr(el, name, JSON.stringify(value))
            // #6887 firefox doesn't update muted state if set via attribute
            // even immediately after element creation
            if (!el.component &&
                name === 'muted' &&
                platformMustUseProp(el.tag, el.attrsMap.type, name)) {
                addProp(el, name, 'true')
            }
        }
    }
}

/**
 * 判断 组件中节点 及其父节点中是否存在 v-for属性
 * 
 * @param {*} el  
 */
function checkInFor(el: ASTElement): boolean {
    let parent = el
    while (parent) {
        if (parent.for !== undefined) {
            return true
        }
        parent = parent.parent
    }
    return false
}

function parseModifiers(name: string): Object | void {
    const match = name.match(modifierRE)
    if (match) {
        const ret = {}
        match.forEach(m => { ret[m.slice(1)] = true })
        return ret
    }
}

function makeAttrsMap(attrs: Array < Object > ): Object {
    const map = {}
    for (let i = 0, l = attrs.length; i < l; i++) {
        if (
            process.env.NODE_ENV !== 'production' &&
            map[attrs[i].name] && !isIE && !isEdge
        ) {
            warn('duplicate attribute: ' + attrs[i].name)
        }
        map[attrs[i].name] = attrs[i].value
    }
    return map
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag(el): boolean {
    return el.tag === 'script' || el.tag === 'style'
}

function isForbiddenTag(el): boolean {
    return (
        el.tag === 'style' ||
        (el.tag === 'script' && (!el.attrsMap.type ||
            el.attrsMap.type === 'text/javascript'
        ))
    )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
function guardIESVGBug(attrs) {
    const res = []
    for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i]
        if (!ieNSBug.test(attr.name)) {
            attr.name = attr.name.replace(ieNSPrefix, '')
            res.push(attr)
        }
    }
    return res
}

function checkForAliasModel(el, value) {
    let _el = el
    while (_el) {
        if (_el.for && _el.alias === value) {
            warn(
                `<${el.tag} v-model="${value}">: ` +
                `You are binding v-model directly to a v-for iteration alias. ` +
                `This will not be able to modify the v-for source array because ` +
                `writing to the alias is like modifying a function local variable. ` +
                `Consider using an array of objects and use v-model on an object property instead.`
            )
        }
        _el = _el.parent
    }
}