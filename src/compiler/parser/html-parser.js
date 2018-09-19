/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// Regular Expressions for parsing tags and attributes
// 处理元素的 属性正则 <div class='class1' style="color:red;" checked>
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
// 识别元素名  只能是  以a-zA-Z_ 开头 字母、数字、 _ 、- 组成。
// 但是对于xml 其可能为   <元素名:元素名 的情况
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
// <\/>
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// 判断 <!DOCTYPE 节点>
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
// 判断注释节点 <!-- 注释  -->
const comment = /^<!\--/
// 判断 条件节点<![if !IE]>
const conditionalComment = /^<!\[/

let IS_REGEX_CAPTURING_BROKEN = false 'x'.replace(/x(.)?/g, function(m, g) {
    IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
    '&lt;': '<',
    '&lt;': '>',
    '&quot;': '"',
    '&amp;': '&',
    '&#10;': '\n',
    '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

/*
    将 字符串中的 '&lt;','&lt;','&quot;','&amp;','&#10;'  转换成 <>"&...
    在 HTML 中不能使用小于号（<）和大于号（>），这是因为浏览器会误认为它们是标签。
    如果希望正确地显示预留字符，我们必须在 HTML 源代码中使用字符实体
    如需显示小于号，我们必须这样写：&lt; 或 &#60; 
 */
function decodeAttr(value, shouldDecodeNewlines) {
    const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
    return value.replace(re, match => decodingMap[match])
}

/**
 * 将html字符串转换成AST
    <div id="app">
        xxxx
        <span class="span1">value : {{value2}} - {{value1}}。</span>
        <img src="xxxx">
        <div class="no-span-div">
            <span>    
        </div>
    </div>






 * @param  {[type]} html    [字符串]"<div id="app"><button-counter></button-counter></div>"
 * @param  {[type]} options [配置对象]
 * @return {[type]}         [description]
 */
export function parseHTML(html, options) {
    const stack = []
    const expectHTML = options.expectHTML
    const isUnaryTag = options.isUnaryTag || no
    const canBeLeftOpenTag = options.canBeLeftOpenTag || no
    // 当前处理html的下标 
    let index = 0
    let last, lastTag
    while (html) {
        last = html
        // Make sure we're not in a plaintext content element like script/style
        if (!lastTag || !isPlainTextElement(lastTag)) {
            let textEnd = html.indexOf('<')
            if (textEnd === 0) {
                // Comment: 注释类型节点
                // 先判断元素中是否存在 <!-- 如果存在说明存在可能存在注释节点
                if (comment.test(html)) {
                    // 获取 -->的下标 
                    const commentEnd = html.indexOf('-->')
                    // 存在 -->  那么说明存在注释节点
                    if (commentEnd >= 0) {
                        // 配置文件中是否保存注释节点
                        if (options.shouldKeepComment) {
                            options.comment(html.substring(4, commentEnd))
                        }
                        // 下标修改成 index = comment + 3;
                        advance(commentEnd + 3)
                        continue
                    }
                }

                // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
                /*
                  条件注释
                  <![if !IE]>
                    <link href="non-ie.css" rel="stylesheet">
                  <![endif]>
                 */
                // 匹配是否以<![ 开始
                if (conditionalComment.test(html)) {
                    // 以 ]> 结尾 
                    const conditionalEnd = html.indexOf(']>')
                    // 如果存在  
                    if (conditionalEnd >= 0) {
                        // 将下标 后移
                        advance(conditionalEnd + 2)
                        continue
                    }
                }

                // Doctype:
                // Doctype 判断
                const doctypeMatch = html.match(doctype)
                if (doctypeMatch) {
                    // 下标后移
                    advance(doctypeMatch[0].length)
                    continue
                }

                // End tag:
                // 处理结束标签   </div> </div:xx>
                const endTagMatch = html.match(endTag)
                if (endTagMatch) {
                    // 移动当前的下标到  </div>的前面
                    const curIndex = index
                    // 移动下标到 </div>结尾
                    advance(endTagMatch[0].length)
                    parseEndTag(endTagMatch[1], curIndex, index)
                    continue
                }

                // Start tag:
                // 记录了一个元素开始标签的位置 属性 是否自闭和
                const startTagMatch = parseStartTag()
                if (startTagMatch) {
                    handleStartTag(startTagMatch)
                    if (shouldIgnoreFirstNewline(lastTag, html)) {
                        advance(1)
                    }
                    continue
                }
            }

            let text, rest, next
            // 如果 textEnd 大于0 那么说明 <div> .... 开始或者闭合标签跟上一个标签之间存在文本
            // 此处为 xxxx
            if (textEnd >= 0) {
                // 取出文本的内容
                rest = html.slice(textEnd)

                while (!endTag.test(rest) &&
                    !startTagOpen.test(rest) &&
                    !comment.test(rest) &&
                    !conditionalComment.test(rest)
                ) {
                    // < in plain text, be forgiving and treat it as text
                    next = rest.indexOf('<', 1)
                    if (next < 0) break
                    textEnd += next
                    rest = html.slice(textEnd)
                }
                text = html.substring(0, textEnd)
                advance(textEnd)
            }
            // 如果没有 < 那么后面的就全都是文本类型的
            if (textEnd < 0) {
                text = html
                html = ''
            }

            // 在 上面的 如果遇到文本内容 那么就保存在text中 
            if (options.chars && text) {
                options.chars(text)
            }
        } else {
            let endTagLength = 0
            const stackedTag = lastTag.toLowerCase()
            const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
            const rest = html.replace(reStackedTag, function(all, text, endTag) {
                endTagLength = endTag.length
                if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
                    text = text
                        .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
                        .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
                }
                if (shouldIgnoreFirstNewline(stackedTag, text)) {
                    text = text.slice(1)
                }
                if (options.chars) {
                    options.chars(text)
                }
                return ''
            })
            index += html.length - rest.length
            html = rest
            parseEndTag(stackedTag, index - endTagLength, index)
        }

        if (html === last) {
            options.chars && options.chars(html)
            if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
                options.warn(`Mal-formatted tag at end of template: "${html}"`)
            }
            break
        }
    }

    // Clean up any remaining tags
    parseEndTag()

    function advance(n) {
        index += n
        html = html.substring(n)
    }

    /*
        处理元素的开始， 获取元素的名称、属性组、开始下标地址、结束下标地址 
        返回一个match 即元素的AST对象
        match = {
            tagName : 'div' , // 元素的标签名
            attrs : [ [' class="app"', 'class' , '=' ,'app' ] ,  ] ,      // 元素的属性数组
            start : 10 ,      // 元素的开始下标
            unarySlash : '/', // 元素是否是自闭和标签  <img/>
            end   : 15        // 元素的结束下标  不是<div></div> 这个的下标 而是 <div>的结束下标
        }
     */
    function parseStartTag() {
        // 如 <div class="app" checked>xxxxxxxxxx</div>
        // ['<div',div,index:0,input:'<div>xxxxxxxxxx</div>',length:2]
        const start = html.match(startTagOpen);

        if (start) {
            const match = {
                tagName: start[1],  // 元素的标签名 div
                attrs: [],
                start: index        // 此时起始下标
            }
            // 将下标移动到 <div 此处  使得 html = ' class="app" checked>xxxxxxxxxx</div>'
            advance(start[0].length)

            let end, attr
            // 获取元素上的属性，并将其存储在attrs上
            while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
                // 如上面 attr = [' class="app"', 'class' , '=' ,'app' ]
                // 修改index的下标 并修改html
                advance(attr[0].length)
                // 并将其存储在attrs上
                match.attrs.push(attr)
            }
            //  end [" />", "/", index: 0, input: " />"]
            //  可见第二个 '/' 决定了元素是否是自闭和元素
            if (end) {
                // 保存了 元素是否是自闭和元素
                match.unarySlash = end[1]
                // 移动到下一个下标进行处理
                advance(end[0].length)
                // 记录了闭合的下标
                match.end = index
                return match
            }
        }
    }

    /**
     * 处理 parseStartTag() 返回的节点对象
     *   1、 
     *   2、 判断是否是自闭和元素(不是元素直接开始节点上有 /> 就是自闭和元素，也需要判断 其是否是浏览器支持的自闭和元素。如div 就不应该是自闭和元素)
     *   3、 处理节点的属性  上面获取节点的基本信息的时候属性是一个二维数组，此时需要对其进行转换成一个 [{name : xx , value : xx }, ...]的属性数组。
     *   4、 仍然是非自闭和元素（即正常节点元素的处理），
     * @param {*} match 
     */
    function handleStartTag(match) {
        // 元素的标签名
        const tagName = match.tagName
        // 元素是否为自闭和标签
        const unarySlash = match.unarySlash


        if (expectHTML) {
            // FIXME: 处理特殊的情况  <p>元素中包含一些非法元素 <div></div> <h1></h1>.... </p>
            /*
                <p> 这是1 <div>this is div</div>xxxx</p>
                在浏览器中渲染的结果为:
                <p> 这是1 </p><div>this is div</div><p>xxxx</p>
             */
            // 如果我们上一个未闭合标签为p 且此标签是那些不能包含的非法标签如：<div></div>
            if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
                // 强制执行 闭合上一个未闭合标签 p元素
                // <p> 这是1 </p><div>this is div</div>xxxx</p>
                // 那么后面的那个 </p> 怎么处理 ？请看parseEndTag() pos < 0的情况
                parseEndTag(lastTag)
            }

            /*
                <p>
                    ppp
                    <p>111111</p>
                    pppp
                </p>
                浏览器渲染的结果一样为: 
                <p>ppp</p>
                <p>111111</p>
                <p>pppp</p>
             */
            if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
                // 强制前面没有闭合标签的元素闭合
                parseEndTag(tagName)
            }
        }
        // 在parseStartTag() 的时候 match.unarySlash : "\" 代表元素是否是自闭和元素，
        // 此处判断 tag 是否应该是自闭和标签 如 <div /> 这就是不对的
        const unary = isUnaryTag(tagName) || !!unarySlash

        // 下面处理元素的属性
        // match.attrs =  [ [' class="app"', 'class' , '=' ,'app' ] , [ ... ]]
        const l = match.attrs.length
        const attrs = new Array(l)
        for (let i = 0; i < l; i++) {
            const args = match.attrs[i]
            // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
            if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
                if (args[3] === '') { delete args[3] }
                if (args[4] === '') { delete args[4] }
                if (args[5] === '') { delete args[5] }
            }
            const value = args[3] || args[4] || args[5] || ''
            const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href' ?
                options.shouldDecodeNewlinesForHref :
                options.shouldDecodeNewlines
            attrs[i] = {
                name: args[1],
                // 处理属性中的字符实例转换  &lt; -> <
                value: decodeAttr(value, shouldDecodeNewlines)
            }
        }

        //  处理 非自闭和标签
        if (!unary) {
            stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
            lastTag = tagName
        }

        if (options.start) {
            options.start(tagName, attrs, unary, match.start, match.end)
        }
    }

    /*
        解析结束标签
        <div> <span>xxxx </span></div> 
        当我们遇到 </span>这个结束标签的时候，此时 tagName = span ; start = 16; end = 22

        Vue 解析html的过程是这样的
        <div> <span>xxxx </span> <img/> <input></div> 

        如上面  先匹配遇到开始标签 <div> 其也不是自闭和标签 所以在栈中存一下 
        stack = ['div'];
        然后向下解析  需要 又遇到开始标签且不闭合 <span> ，那么
        stack = [ div' , 'span' ];
        然后继续 ，遇到闭合标签</span> 就运行到 parseEndTag() , 
        然后从后向前 遍历 stack，发现 span === span 那么 pos = 1;
        stack = ['div']  span处理了
        继续：  遇到 img 发现其是自闭和标签 那么
        继续：  需要input 发现其不是自闭和开始标签
        stack = ['div' , 'input']
        继续：  遇到闭合标签 </div>就运行到 parseEndTag() 然后 遍历 pos = 0 且发现
    
     */
    function parseEndTag(tagName, start, end) {
        let pos, lowerCasedTagName
        if (start == null) start = index
        if (end == null) end = index

        // 将标签转小写
        if (tagName) {
            lowerCasedTagName = tagName.toLowerCase()
        }

        // Find the closest opened tag of the same type
        if (tagName) {
            // 从后向前 遍历 stack，发现 span === span 那么 pos = 1;
            for (pos = stack.length - 1; pos >= 0; pos--) {
                if (stack[pos].lowerCasedTag === lowerCasedTagName) {
                    break
                }
            }
        } else {
            // If no tag name is provided, clean shop
            pos = 0
        }
        //  发现 pos 大于0 说明在栈中找到了其开始标签
        if (pos >= 0) {
            // Close all the open elements, up the stack
            //  如上面的 当 <div> <span>xxxx </span> <img/> <input></div>  解析到 </div>的时候 stack =  ['div' , 'input']
            // 但是遍历 发现 pos = 0 那么 0到最后的都是没有闭合的标签，提示
            for (let i = stack.length - 1; i >= pos; i--) {
                if (process.env.NODE_ENV !== 'production' &&
                    (i > pos || !tagName) &&
                    options.warn
                ) {
                    options.warn(
                        `tag <${stack[i].tag}> has no matching end tag.`
                    )
                }
                if (options.end) {
                    // 调用 parse中的 end 方法
                    options.end(stack[i].tag, start, end)
                }
            }

            // Remove the open elements from the stack
            // 移除栈中 此时处理好的非闭合标签 如上面 
            stack.length = pos
            lastTag = pos && stack[pos - 1].tag
        
            // 下面是 在 stack = [ div' , 'span' ];中没有找到 跟此 结束标签相对应的开始标签
            // 这个是处理 我们一个特殊的元素  </br> 这个元素可以直接结束而没有<br>这样的
            // 所以我们找不到 <br>
        } else if (lowerCasedTagName === 'br') {
            // 那么我们直接调用 start 去创建一个 开始标签
            if (options.start) {
                options.start(tagName, [], true, start, end)
            }

        /*
            跟上面 </br>一样，此处是处理 没有开始标签的 </p>的情况
            如上面我们在handleStartTag()  处理了一个特殊的情况 <p>x<div>x</div></p> p元素中包含非法的元素。
            那么在handleStartTag()的处理 是在 <div>前 强制闭合 <p>x</p>元素，
            那么就会造成 最后遗留一个 </p> 没有开始标签的p结束标签。
         */
        } else if (lowerCasedTagName === 'p') {
            // 发现 没有开始标签的结束标签名称为p
            // 那么强制调用 start去创建一个开始标签
            if (options.start) {
                // tagName === p
                options.start(tagName, [], false, start, end)
            }
            // 再执行 结束标签的 闭合过程
            if (options.end) {
                options.end(tagName, start, end)
            }
        }
    }
}