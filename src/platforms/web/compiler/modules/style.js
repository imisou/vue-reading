/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import { parseStyleText } from 'web/util/style'
import {
    getAndRemoveAttr,
    getBindingAttr,
    baseWarn
} from 'compiler/helpers'

/**
 * 处理 元素上的 静态style属性、 响应式style属性
 * <div style="style1" :style="{'style2': true}"></div>
 * @param {*} el 
 * @param {*} options 
 */
function transformNode(el: ASTElement, options: CompilerOptions) {
    const warn = options.warn || baseWarn
        // 静态属性 style    => style1
    const staticStyle = getAndRemoveAttr(el, 'style')
    if (staticStyle) {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production') {
            const res = parseText(staticStyle, options.delimiters)
            if (res) {
                warn(
                    `style="${staticStyle}": ` +
                    'Interpolation inside attributes has been removed. ' +
                    'Use v-bind or the colon shorthand instead. For example, ' +
                    'instead of <div style="{{ val }}">, use <div :style="val">.'
                )
            }
        }
        el.staticStyle = JSON.stringify(parseStyleText(staticStyle))
    }
    //  响应式属性 :style、 v-bind:style    => {'style2': true}
    const styleBinding = getBindingAttr(el, 'style', false /* getStatic */ )
    if (styleBinding) {
        el.styleBinding = styleBinding
    }
}

function genData(el: ASTElement): string {
    let data = ''
    if (el.staticStyle) {
        data += `staticStyle:${el.staticStyle},`
    }
    if (el.styleBinding) {
        data += `style:(${el.styleBinding}),`
    }
    return data
}

export default {
    staticKeys: ['staticStyle'],
    transformNode,
    genData
}