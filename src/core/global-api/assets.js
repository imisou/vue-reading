/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters(Vue: GlobalAPI) {
    /**
     * Create asset registration methods.
     * 定义了 Vue.component() , Vue.directive() , Vue.filter() 3个静态方法
     *
     *
     */
    ASSET_TYPES.forEach(type => {
        Vue[type] = function(
            id: string,
            definition: Function | Object
        ): Function | Object | void {
            if (!definition) {
                return this.options[type + 's'][id]
            } else {
                /* istanbul ignore if */
                // 如果是component  校验 组件的名称
                if (process.env.NODE_ENV !== 'production' && type === 'component') {
                    validateComponentName(id)
                }
                // component静态方法的处理方式
                if (type === 'component' && isPlainObject(definition)) {
                    // 如果 {} 中没有设置name则用id作为组件名称
                    definition.name = definition.name || id
                    // 调用Vue.extend()去处理
                    definition = this.options._base.extend(definition)
                }
                if (type === 'directive' && typeof definition === 'function') {
                    definition = { bind: definition, update: definition }
                }
                this.options[type + 's'][id] = definition
                return definition
            }
        }
    })
}