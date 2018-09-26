/* @flow */

import { genHandlers } from './events'
import baseDirectives from '../directives/index'
import { camelize, no, extend } from 'shared/util'
import { baseWarn, pluckModuleFunction } from '../helpers'

type TransformFunction = (el: ASTElement, code: string) => string;
type DataGenFunction = (el: ASTElement) => string;
type DirectiveFunction = (el: ASTElement, dir: ASTDirective, warn: Function) => boolean;

export class CodegenState {
    options: CompilerOptions;
    warn: Function;
    transforms: Array < TransformFunction > ;
    dataGenFns: Array < DataGenFunction > ;
    directives: {
        [key: string]: DirectiveFunction
    };
    maybeComponent: (el: ASTElement) => boolean;
    onceId: number;
    staticRenderFns: Array < string > ;

    constructor(options: CompilerOptions) {
        this.options = options
        this.warn = options.warn || baseWarn
        this.transforms = pluckModuleFunction(options.modules, 'transformCode')
        // 在 platsform/web/compiler/modules/class.js style.js 定义了genData处理方法
        this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
        this.directives = extend(extend({}, baseDirectives), options.directives)
        const isReservedTag = options.isReservedTag || no
        this.maybeComponent = (el: ASTElement) => !isReservedTag(el.tag)
        this.onceId = 0
        this.staticRenderFns = []
    }
}

export type CodegenResult = {
    render: string,
    staticRenderFns: Array < string >
};



/**
 * codegen的 入口函数
 * @param {(ASTElement | void)} ast
 * @param {CompilerOptions} options
 * @returns {CodegenResult}
 */
export function generate(
    ast: ASTElement | void,
    options: CompilerOptions
): CodegenResult {
    const state = new CodegenState(options)
    const code = ast ? genElement(ast, state) : '_c("div")'
    return {
        render: `with(this){return ${code}}`,
        staticRenderFns: state.staticRenderFns
    }
}

export function genElement(el: ASTElement, state: CodegenState): string {
    // !el.staticProcessed 作用 是 防止无限循环处理当前节点
    if (el.staticRoot && !el.staticProcessed) {
        // 处理静态根节点
        return genStatic(el, state)
    } else if (el.once && !el.onceProcessed) {
        return genOnce(el, state)
    } else if (el.for && !el.forProcessed) {
        // TODO: slot 整体分析
        return genFor(el, state)
    } else if (el.if && !el.ifProcessed) {
        return genIf(el, state)
    } else if (el.tag === 'template' && !el.slotTarget) {
        return genChildren(el, state) || 'void 0'
    } else if (el.tag === 'slot') {
        // TODO: slot 整体分析
        return genSlot(el, state)
    } else {
        // component or element
        let code
        if (el.component) {
            // 处理 <el-button></el-button>
            code = genComponent(el.component, el, state)
        } else {
            const data = el.plain ? undefined : genData(el, state)

            const children = el.inlineTemplate ? null : genChildren(el, state, true)
            code = `_c('${el.tag}'${
                data ? `,${data}` : '' // data
                }${
                children ? `,${children}` : '' // children
                })`
        }
        // module transforms
        for (let i = 0; i < state.transforms.length; i++) {
            code = state.transforms[i](el, code)
        }
        return code
    }
}

// hoist static sub-trees out
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




/**
 * 处理 el.data属性 生成我们创建节点的 data属性的值
 * @param {*} el 
 * @param {*} state 
 */
export function genData(el: ASTElement, state: CodegenState): string {
    let data = '{'

    // directives first.
    // directives may mutate the el's other properties before they are generated.
    // 指令属性可能在其他属性修改之前发生改变
    const dirs = genDirectives(el, state)
    
    if (dirs) data += dirs + ','

    // key
    if (el.key) {
        data += `key:${el.key},`
    }
    // ref
    if (el.ref) {
        data += `ref:${el.ref},`
    }
    if (el.refInFor) {
        data += `refInFor:true,`
    }
    // pre
    if (el.pre) {
        data += `pre:true,`
    }
    // record original tag name for components using "is" attribute
    if (el.component) {
        data += `tag:"${el.tag}",`
    }
    // module data generation functions
    // 处理 在module中定义了genData钩子函数的属性   
    // 此处主要处理 class style 这两个拥有静态属性和响应式属性两种定义方式的属性
    for (let i = 0; i < state.dataGenFns.length; i++) {
        data += state.dataGenFns[i](el)
    }
    // attributes
    // 处理其他静态属性  如 { name :'id' , value : '"app"'}
    if (el.attrs) {
        data += `attrs:{${genProps(el.attrs)}},`
    }
    // DOM props
    // 处理 <component :>
    if (el.props) {
        data += `domProps:{${genProps(el.props)}},`
    }
    // event handlers
    if (el.events) {
        data += `${genHandlers(el.events, false, state.warn)},`
    }
    if (el.nativeEvents) {
        data += `${genHandlers(el.nativeEvents, true, state.warn)},`
    }
    // slot target
    // only for non-scoped slots
    // 处理 <template slot="header" ></template>  <p slot="footer"></p>
    //  结果为 template : { attrs: { slot: "footer" }, slot: "footer" }
    if (el.slotTarget && !el.slotScope) {
        data += `slot:${el.slotTarget},`
    }
    // scoped slots  
    // 如果插槽上还定义了 作用域 scope slot-scope
    // 处理插槽占位符节点 的 父节点上currentParent.scopedSlots[name]属性
    //  如 <template slot-scope="scope"></template> 这种
    if (el.scopedSlots) {
        data += `${genScopedSlots(el.scopedSlots, state)},`
    }
    // component v-model
    if (el.model) {
        data += `model:{value:${el.model.value},callback:${el.model.callback},expression:${el.model.expression}},`
    }
    // inline-template
    if (el.inlineTemplate) {
        const inlineTemplate = genInlineTemplate(el, state)
        if (inlineTemplate) {
            data += `${inlineTemplate},`
        }
    }
    data = data.replace(/,$/, '') + '}'
    // v-bind data wrap
    if (el.wrapData) {
        data = el.wrapData(data)
    }
    // v-on data wrap
    if (el.wrapListeners) {
        data = el.wrapListeners(data)
    }
    return data
}


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
    let hasRuntime = false
    let i, l, dir, needRuntime
    for (i = 0, l = dirs.length; i < l; i++) {
        // 获取每一各指令
        dir = dirs[i]
        needRuntime = true
        /*
            state.directives 保存了Vue内置的一些指令的处理方法 
            state.directives = {
                bind : function(){},
                clock : function(){},
                html : function(){},
                model : function(){},
                once : function(){},
                text : function(){},
            }
         */
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
    if (hasRuntime) {
        // 将指令字符串闭合 变成
        //  res = "directives:[{name:"demo",rawName:"v-demo:foo.a.b",value:(fnDirective),expression:"fnDirective",arg:"foo",modifiers:{"a":true,"b":true}},]"
        return res.slice(0, -1) + ']'
    }
}

function genInlineTemplate(el: ASTElement, state: CodegenState): ? string {
    const ast = el.children[0]
    if (process.env.NODE_ENV !== 'production' && (
            el.children.length !== 1 || ast.type !== 1
        )) {
        state.warn('Inline-template components must have exactly one child element.')
    }
    if (ast.type === 1) {
        const inlineRenderFns = generate(ast, state.options)
        return `inlineTemplate:{render:function(){${
      inlineRenderFns.render
    }},staticRenderFns:[${
      inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')
    }]}`
    }
}

/**
 * 处理占位符插槽节点 的父节点
    <template slot="header" slot-scope="slotProps">
        <h1>Here might be a page title : {{slotProps.name}}</h1>
    /template>

    header.scopedSlots.header = el(slot);

    {
      scopedSlots : _u([
        {
            key : 'header',
            fn : function (slotProps){
                return [ _c('h1' ,_v('Here might be a page title :' + _s(slotProps.name)) )]
            }
        }
      ])
    }

 * @param {*} slots 保存着占位符插槽的节点
 * @param {*} state 
 */
function genScopedSlots(
    slots: {
        [key: string]: ASTElement },
    state: CodegenState
) : string {
    return `scopedSlots:_u([${
    Object.keys(slots).map(key => {
      return genScopedSlot(key, slots[key], state)
    }).join(',')
  }])`
}

/**
 * 处理插槽的 slot-scope scope属性 节点
 
 <template slot="header" slot-scope="slotProps">
    <h1>Here might be a page title : {{slotProps.name}}</h1>
 </template>

 el:
    parentEl.scopedSlots.header = {
        tag : 'template',
        slotScope : 'slotProps',
        slotTarget : 'header',
        children : [ ... ]
    }

 generate : 
    {
        key : 'header',
        fn : function (slotProps){
            return [ _c('h1' ,_v('Here might be a page title :' + _s(slotProps.name)) )]
        }
    }

 * @param {*} key 
 * @param {*} el 
 * @param {*} state 
 */
function genScopedSlot(
    key: string,
    el: ASTElement,
    state: CodegenState
): string {
    // 判断作用域插槽上是否存在 v-for 
    if (el.for && !el.forProcessed) {
        return genForScopedSlot(key, el, state)
    }
    /*
    一般的作用域插槽
    返回一个函数入参为作用的名称，返回为插槽的子节点
    
    1. <template slot-scope="scope"></template>
     => genChildren(el, state) || 'undefined'
    2. <div slot-scope="scope"></div>
     => genElement(el, state)
    3. <template slot-scope="scope" v-if="xxx"></template>
     => `${el.if}?${genChildren(el, state) || 'undefined'}:undefined`
     */
    const fn = `function(${String(el.slotScope)}){` +
        `return ${el.tag === 'template'
      ? el.if
        ? `${el.if}?${genChildren(el, state) || 'undefined'}:undefined`   // <template slot-scope="scope" v-if="xxx"></template>
        : genChildren(el, state) || 'undefined'    // <template slot-scope="scope"></template>
      : genElement(el, state)    // <div slot-scope="scope"></div>
    }}`
    // {key:"header",fn:function(slotProps){return [_c('h1',[_v("Here might be a page title : "+_s(slotProps.name))])]}}
    return `{key:${key},fn:${fn}}`
}

function genForScopedSlot(
    key: string,
    el: any,
    state: CodegenState
): string {
    const exp = el.for
    const alias = el.alias
    const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
    const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''
    el.forProcessed = true // avoid recursion
    return `_l((${exp}),` +
        `function(${alias}${iterator1}${iterator2}){` +
        `return ${genScopedSlot(key, el, state)}` +
        '})'
}

export function genChildren(
    el: ASTElement,
    state: CodegenState,
    checkSkip ? : boolean,
    altGenElement ? : Function,
    altGenNode ? : Function
): string | void {
    const children = el.children
    if (children.length) {
        const el: any = children[0]
        // optimize single v-for
        if (children.length === 1 &&
            el.for &&
            el.tag !== 'template' &&
            el.tag !== 'slot'
        ) {
            return (altGenElement || genElement)(el, state)
        }
        const normalizationType = checkSkip ?
            getNormalizationType(children, state.maybeComponent) :
            0
        const gen = altGenNode || genNode
        return `[${children.map(c => gen(c, state)).join(',')}]${
            normalizationType ? `,${normalizationType}` : ''
        }`
    }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
function getNormalizationType(
    children: Array < ASTNode > ,
    maybeComponent: (el: ASTElement) => boolean
): number {
    let res = 0
    for (let i = 0; i < children.length; i++) {
        const el: ASTNode = children[i]
        if (el.type !== 1) {
            continue
        }
        if (needsNormalization(el) ||
            (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
            res = 2
            break
        }
        if (maybeComponent(el) ||
            (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
            res = 1
        }
    }
    return res
}

function needsNormalization(el: ASTElement): boolean {
    return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

function genNode(node: ASTNode, state: CodegenState): string {
    if (node.type === 1) {
        return genElement(node, state)
    }
    if (node.type === 3 && node.isComment) {
        return genComment(node)
    } else {
        return genText(node)
    }
}

export function genText(text: ASTText | ASTExpression): string {
    return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

export function genComment(comment: ASTText): string {
    return `_e(${JSON.stringify(comment.text)})`
}


/**
 * 处理 
  <slot name="header" v-bind:scopeProps="obj">
    <span>slot header</span>
  </slot>

  el : 
  {
      tag : 'slot',
      slotName : 'header',
      attrsList : [{
          name : 'v-bind:scopeProps',
          value : 'obj'
      }]
  }
  generate : 
  _t("header", [_c('h1',[_v("this is default header : "+_s(obj.name))])] ,{ scopeProps:obj })
 * @param {*} el 
 * @param {*} state 
 */
function genSlot(el: ASTElement, state: CodegenState): string {
    // 获取slot的name属性
    const slotName = el.slotName || '"default"'
    // slot 的子节点 "[_c('span',[_v("slot header")])]" 
    const children = genChildren(el, state)
    // res = _t('header' , children | '')
    let res = `_t(${slotName}${children ? `,${children}` : ''}`
    // 获取slot上绑定的一个 响应式属性  如 :id = "count"
    const attrs = el.attrs && `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
    // slot 上绑定的 v-bind="{xxx:xx}"
    const bind = el.attrsMap['v-bind']
    if ((attrs || bind) && !children) {
        res += `,null`
    }
    if (attrs) {
        res += `,${attrs}`
    }
    if (bind) {
        res += `${attrs ? '' : ',null'},${bind}`
    }
    // 生成的结果就是  _t('header' , children | '' , attrs , bind )四个参数
    // _t("default",[_c('span',[_v("slot name")])],{id:count},count)
    return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
/**
 *   处理 <el-button ></el-button>
 * 
 *   el.component
 * 
 *   return _c('el-button', { ...data } , [ ...children])
 * @param {*} componentName 
 * @param {*} el 
 * @param {*} state 
 */
function genComponent(
    componentName: string,
    el: ASTElement,
    state: CodegenState
): string {
    const children = el.inlineTemplate ? null : genChildren(el, state, true)
    return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}

/**
 * 处理 其他的基本属性  如 id="app"
 * 其保存在 el.attrs = [{
 *      name : 'id',
 *      value: '"app"'
 * }]
 * @param {*} props 
 */
function genProps(props: Array < { name: string, value: any } > ): string {
    let res = ''
    for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        /* istanbul ignore if */
        if (__WEEX__) {
            res += `"${prop.name}":${generateValue(prop.value)},`
        } else {
            // 在WEB平台中转成 "id":'"app"' 并处理其中特殊的行分隔符 段落分隔符
            res += `"${prop.name}":${transformSpecialNewlines(prop.value)},`
        }
    }
    return res.slice(0, -1)
}

/* istanbul ignore next */
function generateValue(value) {
    if (typeof value === 'string') {
        return transformSpecialNewlines(value)
    }
    return JSON.stringify(value)
}

// #3895, #4268
function transformSpecialNewlines(text: string): string {
    return text
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}