/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

// 判断是否是响应式的 值  <div> {{obj.xx}}</div>
const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
    const open = delimiters[0].replace(regexEscapeRE, '\\$&')
    const close = delimiters[1].replace(regexEscapeRE, '\\$&')
    return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
    expression: string,
    tokens: Array < string | { '@binding': string } >
};


/**
 * 将字符串 中包含{{}} 解析成能够执行的 字符串数组，并返回两个数组
 *   'this is {{obj.name}}。{{obj.address}} is good address。'
 *      
 *   tokens = [
 *      0 : 'this is ',
 *      1 : '_s(obj.name)',
 *      2 : '。',
 *      3 : '_s(obj.address)',
 *      4 : ' is good address。',
 *   ]
 *   rawTokens = [
 *      0 : 'this is ',
 *      1 : { '@binding': 'obj.name' },
 *      2 : '。',
 *      3 : { '@binding': 'obj.address' }',
 *      4 : ' is good address。',
 *   ]
 *   return {
 *      expression : 'this is ' + '_s(obj.name)' + '。' + '_s(obj.address)' + ' is good address。',
 *      rawTokens : rawTokens
 *   }
 * 
 * @param {*} text 
 * @param {*} delimiters 
 */
export function parseText(
    text: string,
    delimiters ? : [string, string]
): TextParseResult | void {
    const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
    // 如果就是静态的文本内容
    if (!tagRE.test(text)) {
        return
    }
    // 此处最重要的两个数组对象
    // tokens 保存了 render() 的时候能够直接执行的 字符串数组  。
    // 
    const tokens = []
    const rawTokens = []
    // 整个文本的长度
    let lastIndex = tagRE.lastIndex = 0
    let match, index, tokenValue

    // 处理 文本内容  如：
    //  {{obj.name}} is {{obj.job}}
    while ((match = tagRE.exec(text))) {
        // ' {{obj.name}} is {{obj.job}} '  => [ 0: '{{obj.name}}' , 1: 'obj.name' ,index : 1, input: ' {{obj.name}} is {{obj.job}} ']
        // match.index 获取当前匹配的 开始下标
        index = match.index
        // push text token
        // 如果 {{ }}的前面存在 静态的文本   如   (空格..{{xx}} xxx {{}})那么需要将这些静态文本保存
        if (index > lastIndex) {
            
            rawTokens.push(tokenValue = text.slice(lastIndex, index))
            // 将静态文本保存在 tokens 
            tokens.push(JSON.stringify(tokenValue))
        }
        // tag token
        const exp = parseFilters(match[1].trim())
        //生成当前参数在Vue render中获取响应式数据的方法  _s('obj.name')  => this['obj.name']
        tokens.push(`_s(${exp})`)
        // 提供绑定的依赖 { '@binding': 'obj.job' }
        rawTokens.push({ '@binding': exp })
        // 移动下标至处理当前{{}}的结束下标
        lastIndex = index + match[0].length
    }
    // 处理 结尾包含静态文本的情况 '{{xxx}}111'后面的111
    if (lastIndex < text.length) {
        rawTokens.push(tokenValue = text.slice(lastIndex))
        tokens.push(JSON.stringify(tokenValue))
    }
    return {
        // 'this is ' + '_s(obj.name)' + '。' + '_s(obj.address)' + ' is good address。'
        expression: tokens.join('+'),
        tokens: rawTokens
    }
}