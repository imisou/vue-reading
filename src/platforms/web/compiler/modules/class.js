/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import {
    getAndRemoveAttr,
    getBindingAttr,
    baseWarn
} from 'compiler/helpers'

/**
 * 处理 元素上的 静态class属性、 响应式class属性
 * <div class="class1" :class="{'class2': true}"></div>
 * @param {*} el 
 * @param {*} options 
 */
function transformNode(el: ASTElement, options: CompilerOptions) {
    const warn = options.warn || baseWarn
    // 获取静态的class属性
    const staticClass = getAndRemoveAttr(el, 'class')
    if (process.env.NODE_ENV !== 'production' && staticClass) {
        const res = parseText(staticClass, options.delimiters)
        if (res) {
            warn(
                `class="${staticClass}": ` +
                'Interpolation inside attributes has been removed. ' +
                'Use v-bind or the colon shorthand instead. For example, ' +
                'instead of <div class="{{ val }}">, use <div :class="val">.'
            )
        }
    }
    if (staticClass) {
        el.staticClass = JSON.stringify(staticClass)
    }
    // 获取响应式属性 class
    const classBinding = getBindingAttr(el, 'class', false /* getStatic */ )
    if (classBinding) {
        el.classBinding = classBinding
    }
}

/**
 * 用于 codegen 的时候将 AST 的class相关属性转换成表达式
 <li class="liclass" :class="{'liclass': item.id === 1}">
    {{item.name}} is ad
 </li>
 其
 el = {
    staticClass : '"liclass"'
    class : "{'liclass': item.id === 1}"
 }

 转成 "staticClass:"liclass",class:{'liclass': item.id === 1},"

 * @param {*} el 
 */
function genData(el: ASTElement): string {
    let data = ''
    if (el.staticClass) {
        data += `staticClass:${el.staticClass},`
    }
    if (el.classBinding) {
        data += `class:${el.classBinding},`
    }
    return data
}

export default {
    staticKeys: ['staticClass'],
    transformNode,
    genData
}