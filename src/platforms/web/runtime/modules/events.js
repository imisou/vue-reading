/* @flow */

import { isDef, isUndef } from 'shared/util'
import { updateListeners } from 'core/vdom/helpers/index'
import { withMacroTask, isIE, supportsPassive } from 'core/util/index'
import { RANGE_TOKEN, CHECKBOX_RADIO_TOKEN } from 'web/compiler/directives/model'

// normalize v-model event tokens that can only be determined at runtime.
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
function normalizeEvents(on) {
    /* istanbul ignore if */
    if (isDef(on[RANGE_TOKEN])) {
        // IE input[type=range] only supports `change` event
        const event = isIE ? 'change' : 'input'
        on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
        delete on[RANGE_TOKEN]
    }
    // This was originally intended to fix #4521 but no longer necessary
    // after 2.5. Keeping it for backwards compat with generated code from < 2.4
    /* istanbul ignore if */
    if (isDef(on[CHECKBOX_RADIO_TOKEN])) {
        on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
        delete on[CHECKBOX_RADIO_TOKEN]
    }
}

let target: any

function createOnceHandler(handler, event, capture) {
    const _target = target // save current target element in closure
    return function onceHandler() {
        const res = handler.apply(null, arguments)
        if (res !== null) {
            remove(event, onceHandler, capture, _target)
        }
    }
}


/**
 * @description 添加一个事件回调函数
 * @author guzhanghua
 * @param {string} event      事件的名称
 * @param {Function} handler  事件的处理方法
 * @param {boolean} once      修饰符once   
 * @param {boolean} capture   修饰符capture
 * @param {boolean} passive   修饰符passive
 */
function add(
    event: string,
    handler: Function,
    once: boolean,
    capture: boolean,
    passive: boolean
) {
    handler = withMacroTask(handler)
    if (once) handler = createOnceHandler(handler, event, capture)
    target.addEventListener(
        event,
        handler,
        supportsPassive ?
        { capture, passive } :
        capture
    )
}

function remove(
    event: string,
    handler: Function,
    capture: boolean,
    _target ? : HTMLElement
) {
    (_target || target).removeEventListener(
        event,
        handler._withTask || handler,
        capture
    )
}


/**
    对于事件的运行期间的处理是通过 vnode -> dom的时候，在各个生命周期期间调用各生命周期间定义的钩子函数

    对于vnode 其

    此处处理的是节点上的真实DOM事件，如果是组件占位符节点上定义的

    {
		on: {
			click: handleClickSub,
			"~!click": function($event) {
				$event.stopPropagation()
				handleClickSub($event)
            },
            keyup: function($event) {
				if (!("button" in $event) && $event.keyCode !== 67)
					return null
				if (!$event.altKey) return null
				return handleClickCaptions($event)
			}
		}
	},


 * @param {*} oldVnode 
 * @param {*} vnode 
 */
function updateDOMListeners(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
        return
    }
    const on = vnode.data.on || {}
    const oldOn = oldVnode.data.on || {}
    target = vnode.elm
    normalizeEvents(on)
    updateListeners(on, oldOn, add, remove, vnode.context)
    target = undefined
}

export default {
    create: updateDOMListeners,
    update: updateDOMListeners
}