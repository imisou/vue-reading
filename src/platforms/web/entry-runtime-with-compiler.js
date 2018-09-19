/* @flow */

// PC端编译代码的入口

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
    const el = query(id)
    return el && el.innerHTML
})

const mount = Vue.prototype.$mount
Vue.prototype.$mount = function(
    el ? : string | Element,
    hydrating ? : boolean
): Component {
    // querySelector(el)
    el = el && query(el)

    /* istanbul ignore if */
    // el === body | html
    if (el === document.body || el === document.documentElement) {
        process.env.NODE_ENV !== 'production' && warn(
            `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
        )
        return this
    }

    const options = this.$options
    // resolve template/el and convert to render function
    // 解析模板/el并转换为呈现函数
    if (!options.render) {
        // 获取组件上的template属性
        let template = options.template
        // 如果存在template
        if (template) {
            // 判断是否是字符串  即是处 template : '#template1'
            if (typeof template === 'string') {
                // 
                if (template.charAt(0) === '#') {
                    template = idToTemplate(template)
                    /* istanbul ignore if */
                    if (process.env.NODE_ENV !== 'production' && !template) {
                        warn(
                            `Template element not found or is empty: ${options.template}`,
                            this
                        )
                    }
                }
            // template 就是元素 template: `<div class="demo-alert-box"><strong>Error!</strong><slot></slot></div>`
            } else if (template.nodeType) {
                template = template.innerHTML
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    warn('invalid template option:' + template, this)
                }
                return this
            }
            // 如果  vm.$mount(vm.$options.el) 属性中定义了el 那么就是template 被el元素覆盖
        } else if (el) {
            template = getOuterHTML(el)
        }
        // 处理template
        // 编译template
        if (template) {
            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
                mark('compile')
            }
            // 编译dom树 转换成 函数
            const { render, staticRenderFns } = compileToFunctions(template, {
                shouldDecodeNewlines,
                shouldDecodeNewlinesForHref,
                delimiters: options.delimiters,
                comments: options.comments
            }, this)
            options.render = render
            options.staticRenderFns = staticRenderFns

            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
                mark('compile end')
                measure(`vue ${this._name} compile`, 'compile', 'compile end')
            }
        }
    }
    return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
    if (el.outerHTML) {
        return el.outerHTML
    } else {
        const container = document.createElement('div')
        container.appendChild(el.cloneNode(true))
        return container.innerHTML
    }
}

Vue.compile = compileToFunctions

export default Vue