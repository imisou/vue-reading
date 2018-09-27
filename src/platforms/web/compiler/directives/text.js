/* @flow */

import { addProp } from 'compiler/helpers'



/**
  web 平台处理内置的 v-text指令属性

  如:
    <div v-text="name">{{value}}<p>{{value}}</p></div>

  其处理方法 ：

  _c("div", { domProps: { textContent: _s(name) } }, [
		_v(_s(value)),
		_c("p", [_v(_s(value))])
  ])
  
  发现其就是当做 
    <div v-bind:text-content.prop='name'>{{value}}<p>{{value}}</p></div>

 * @param {*} el 
 * @param {*} dir 
 */
export default function text (el: ASTElement, dir: ASTDirective) {
  // 如果存在 v-text="value"
  if (dir.value) {
    // 按照 prop进行处理 
    addProp(el, 'textContent', `_s(${dir.value})`)
  }
}
