/* @flow */

const validDivisionCharRE = /[\w).+\-_$\]]/



/**
 * 表达式中的过滤器解析 方法
 * @param {*} exp 
 */
export function parseFilters(exp: string): string {
    let inSingle = false
    let inDouble = false
    let inTemplateString = false
    let inRegex = false
    let curly = 0
    let square = 0
    let paren = 0
    let lastFilterIndex = 0
    let c, prev, i, expression, filters

    for (i = 0; i < exp.length; i++) {
        prev = c
        c = exp.charCodeAt(i)
        if (inSingle) {
            //  '  \
            if (c === 0x27 && prev !== 0x5C) inSingle = false
        } else if (inDouble) {
            // " \
            if (c === 0x22 && prev !== 0x5C) inDouble = false
        } else if (inTemplateString) {
            //  `
            if (c === 0x60 && prev !== 0x5C) inTemplateString = false
        } else if (inRegex) {
            // 当前在正则表达式中  /开始
            //  / \
            if (c === 0x2f && prev !== 0x5C) inRegex = false
        } else if (
            // 如果在 之前不在 ' " ` / 即字符串 或者正则中
            // 那么就判断 当前字符是否是 |
            //  如果当前 字符为 | 
            // 且下一个（上一个）字符不是 | 
            // 且 不在 { } 对象中
            // 且 不在 [] 数组中
            // 且不在  () 中
            // 那么说明此时是过滤器的一个 分界点
            c === 0x7C && // pipe
            exp.charCodeAt(i + 1) !== 0x7C &&
            exp.charCodeAt(i - 1) !== 0x7C &&
            !curly && !square && !paren
        ) {
            /*
                如果前面没有表达式那么说明这是第一个 管道符号 "|"


                再次遇到 | 因为前面 expression = 'message '
                执行  pushFilter()
             */
           
            if (expression === undefined) {
                // first filter, end of expression
                // 过滤器表达式 就是管道符号之后开始
                lastFilterIndex = i + 1
                // 存储过滤器的 表达式
                expression = exp.slice(0, i).trim()
            } else {
                pushFilter()
            }
        } else {
            switch (c) {
                case 0x22:    
                    inDouble = true;
                    break // "
                case 0x27:
                    inSingle = true;
                    break // '
                case 0x60:
                    inTemplateString = true;
                    break // `
                case 0x28:
                    paren++;
                    break // (
                case 0x29:
                    paren--;
                    break // )
                case 0x5B:
                    square++;
                    break // [
                case 0x5D:
                    square--;
                    break // ]
                case 0x7B:
                    curly++;
                    break // {
                case 0x7D:
                    curly--;
                    break // }
            }
            if (c === 0x2f) { // /
                let j = i - 1
                let p
                    // find first non-whitespace prev char
                for (; j >= 0; j--) {
                    p = exp.charAt(j)
                    if (p !== ' ') break
                }
                if (!p || !validDivisionCharRE.test(p)) {
                    inRegex = true
                }
            }
        }
    }

    if (expression === undefined) {
        expression = exp.slice(0, i).trim()
    } else if (lastFilterIndex !== 0) {
        pushFilter()
    }

    // 获取当前过滤器的 并将其存储在filters 数组中
    //  filters = [ 'filterA' , 'filterB']
    function pushFilter() {
        (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
        lastFilterIndex = i + 1
    }

    if (filters) {
        for (i = 0; i < filters.length; i++) {
            expression = wrapFilter(expression, filters[i])
        }
    }

    return expression
}

/**
    生成过滤器的 表达式字符串

    如上面的 
    exp = message
    filters = ['filterA','filterB(arg1,arg2)'] 

    第一步  以exp 为入参 生成 filterA 的过滤器表达式字符串  _f("filterA")(message)

    第二步 以第一步字符串作为入参 生成第二个过滤器的表达式字符串 _f("filterB")(_f("filterA")(message),arg1,arg2)

    => _f("filterB")(_f("filterA")(message),arg1,arg2)

 * @param {string} exp   上一个过滤器的值 没有就是 表达式的值
 * @param {string} filter
 * @returns {string}
 */
function wrapFilter(exp: string, filter: string): string {
    // 判断是否存在入参， 即 'filterB(arg1,arg2)'
    const i = filter.indexOf('(')
    if (i < 0) {
        // 如果不是  直接生成  "_f("filterA")(message)"
        // _f: resolveFilter
        return `_f("${filter}")(${exp})`
    } else {
        // 过滤器名称
        const name = filter.slice(0, i)
        // 过滤器自定义入参
        const args = filter.slice(i + 1)
        // 生成 "_f("filterB")(message,arg1,arg2)"
        return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
    }
}