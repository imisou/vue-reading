/* @flow */

import { emptyObject } from 'shared/util'
import { parseFilters } from './parser/filter-parser'

export function baseWarn(msg: string) {
    console.error(`[Vue compiler]: ${msg}`)
}


/**
 *  
 *  transforms = pluckModuleFunction(options.modules, 'transformNode')
    preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
    postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

    在配置options.modules数组中保存了baseOption和 platforms/web/compiler/moudles/index.js 定义的 class model style 等属性钩子函数
    在数组中 [ {transformNode(){} } , { preTransformNode() ,  transformNode(){} }] 每一个对象按照相同的方法名称定义，
    那么 在pluckModuleFunction(options.modules , transformNode) 就会获取数组对象中 钩子函数名为 transformNode 的回调函数 并存放在一个新的数组中，
    然后在调用时按照下标一个一个调用

 * @param {*} modules 
 * @param {*} key 
 */
export function pluckModuleFunction < F: Function > (
    modules: ? Array < Object > ,
    key : string
): Array < F > {
    return modules ?
        modules.map(m => m[key]).filter(_ => _) :
        []
}

export function addProp(el: ASTElement, name: string, value: string) {
    (el.props || (el.props = [])).push({ name, value })
    el.plain = false
}

export function addAttr(el: ASTElement, name: string, value: any) {
    (el.attrs || (el.attrs = [])).push({ name, value })
    el.plain = false
}

// add a raw attr (use this in preTransforms)
export function addRawAttr(el: ASTElement, name: string, value: any) {
    el.attrsMap[name] = value
    el.attrsList.push({ name, value })
}


/**
 * 在AST上添加 处理后的指令属性
 *    <div id="hook-arguments-example" v-demo:foo.a.b="message"></div>
 *      涉及到的AST属性为 directives
 * @param {*} el        
 * @param {*} name                   // demo      
 * @param {*} rawName                // 全名称   v-demo:foo.a.b
 * @param {*} value                  //  message
 * @param {*} arg                    // 参数  foo
 * @param {*} modifiers              // 属性描述  { a: true , b: true}
 */
export function addDirective(
    el: ASTElement,
    name: string,
    rawName: string,
    value: string,
    arg: ? string,
    modifiers : ? ASTModifiers
) {
    // 
    (el.directives || (el.directives = [])).push({ name, rawName, value, arg, modifiers })
    el.plain = false
}


/**
 *   向el中添加 事件属性 AST的值
 * 
 *   涉及到的属性有   el.nativeEvents el.events
 * 
 *   events对象 = {
 *      'click' : {
 *           value  : value,         //函数处理方法
 *           modifiers : modifiers    //属性描述对象
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
    // 处理事件的caption 描述符  
    if (modifiers.capture) {
        delete modifiers.capture
        name = '!' + name // mark the event as captured
    }
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
    let events
    if (modifiers.native) {
        delete modifiers.native
        // 初始化 事件保存的 地方
        events = el.nativeEvents || (el.nativeEvents = {})
    } else {
        events = el.events || (el.events = {})
    }

    const newHandler: any = {
        value: value.trim()
    }
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

/**
 * 获取 bind属性的值
 *     <div   :class="{'isShow':true }" v-bind:props-key="propKey" ></div>
 *     我们定义响应式属性的时候有两种方式  :属性名 或者 v-bind:属性名
 * 
 *     对于 getStatic 参数 ，我们发现只有 class 和 style 使用了 getBindingAttr(el,'class',false)
 *      其他的都是 getBindingAttr(el,'name') 
 *      如果传入 false，那么只支持 :class v-bind:class 响应式值获取
 *      如果没有  getStatic = undefined 那么 即支持:name v-bind:name 响应式值获取， 也支持 name="" 静态属性方式
 * @param {*} el 
 * @param {*} name 
 * @param {*} getStatic   是否支持静态属性  
 */
export function getBindingAttr(
    el: ASTElement,
    name: string,    
    getStatic ? : boolean
): ? string {
    // 获取 :属性名 或者 v-bind:属性名 bing的属性的值
    const dynamicValue =
        getAndRemoveAttr(el, ':' + name) ||
        getAndRemoveAttr(el, 'v-bind:' + name)
    
    if (dynamicValue != null) {
        return parseFilters(dynamicValue)
    } else if (getStatic !== false) {
        // 支持 静态属性获取值的方式  
        const staticValue = getAndRemoveAttr(el, name)
        if (staticValue != null) {
            return JSON.stringify(staticValue)
        }
    }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// 这只是从ast.attrsList 数组中删除此属性，所以不会破坏 processAttrs的处理
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
// 默认情况，它不会从映射(attrsMap)中删除它，因为在codegen中需要映射。
export function getAndRemoveAttr(
    el: ASTElement,
    name: string,
    removeFromMap ? : boolean
) : ? string {
    let val
    // 从 el.attrsMap中获取指定属性name 的值，并在el.attrsList中删除此属性
    if ((val = el.attrsMap[name]) != null) {
        const list = el.attrsList
        for (let i = 0, l = list.length; i < l; i++) {
            if (list[i].name === name) {
                list.splice(i, 1)
                break
            }
        }
    }
    // 如果removeFromMap:true 那么 el.attrsMap 中也删除此属性
    if (removeFromMap) {
        delete el.attrsMap[name]
    }
    return val
}