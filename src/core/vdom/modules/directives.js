/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'

export default {
    create: updateDirectives,
    update: updateDirectives,
    destroy: function unbindDirectives(vnode: VNodeWithData) {
        updateDirectives(vnode, emptyNode)
    }
}

function updateDirectives(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.directives || vnode.data.directives) {
        _update(oldVnode, vnode)
    }
}



/**
 * 指令属性 处理方法
 
    这里面涉及到指令的 bind  inserted update componentUpdated unbind 5个生命周期

    涉及到钩子函数的回调函数的参数
    vnode.elm, 
    dir : {
        name : '' , // 指令的名称
        value : ,   // 指令的值
        oldValue :    , // 指令绑定的前一个值，仅在 update 和 componentUpdated 钩子中可用。无论值是否改变都可用
        expression  :     //
        arg
        modifiers   :
    }, 
    vnode, 
    oldVnode, 
    isDestroy       
    

 * @param {*} oldVnode 
 * @param {*} vnode 
 */
function _update(oldVnode, vnode) {
    const isCreate = oldVnode === emptyNode
    const isDestroy = vnode === emptyNode
    const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
        // 生成当前vnode的指令处理对象
    const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)

    const dirsWithInsert = []
    const dirsWithPostpatch = []

    let key, oldDir, dir
    for (key in newDirs) {
        oldDir = oldDirs[key]
        dir = newDirs[key]
            // 如果旧vnode与新vnode相同的指令属性 不存在，那么说明这是一个新的指令
        if (!oldDir) {
            // new directive, bind
            // 回调指令的 bind 方法
            callHook(dir, 'bind', vnode, oldVnode)
                // 如果定义了inserted 时的回调函数 那么将其存入回调队列
            if (dir.def && dir.def.inserted) {
                dirsWithInsert.push(dir)
            }
        } else {
            // existing directive, update
            // 如果存在相同的回调周期，那么说明需要更新
            dir.oldValue = oldDir.value
                // 回调指令的 update 方法，并在之前修改了保存了oldValue
            callHook(dir, 'update', vnode, oldVnode)
                // 如果定义了componentUpdated 时的回调函数 那么将其存入回调队列
            if (dir.def && dir.def.componentUpdated) {
                dirsWithPostpatch.push(dir)
            }
        }
    }
    // 如果是一个新的指令属性
    if (dirsWithInsert.length) {
        // 创建所有新的指令属性的 inserted周期的回调函数方法
        const callInsert = () => {
                for (let i = 0; i < dirsWithInsert.length; i++) {
                    callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
                }
            }
            // 说明vnode是 刚创建
        if (isCreate) {
            mergeVNodeHook(vnode, 'insert', callInsert)
        } else {
            // 说明是vnode 更新期间添加的新的指令属性
            callInsert()
        }
    }
    // 如果更新vnode期间 原来也存在此指令属性 那么就触发update方法，
    //  然后在vnode转dom完成触发vnode.data.hook.postpatch钩子函数 是回调此指令属性的 componentUpdated生命周期钩子函数
    if (dirsWithPostpatch.length) {
        // 跟bind的时候一样 在vnode.data.hook中添加一个钩子函数 
        mergeVNodeHook(vnode, 'postpatch', () => {
            for (let i = 0; i < dirsWithPostpatch.length; i++) {
                callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
            }
        })
    }

    // 如果存在旧的vnode 说明这是更新阶段
    if (!isCreate) {
        // 遍历旧的指令属性
        for (key in oldDirs) {
            // 如果在新的vnode中不存在说明 需要调用解绑的钩子函数
            if (!newDirs[key]) {
                // no longer present, unbind
                callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
            }
        }
    }
}

const emptyModifiers = Object.create(null)


/**
 * 获取当前指令的处理对象
    
    dirs : {
        expression: "isShow"
        name: "show"
        rawName: "v-show"
        value: true
    }，

    vm: 当前组件的实例对象

   返回 当前vnode 上所有的指令属性所匹配的指令处理对象
    res : {
        'v-show.xxx' : {
             expression: "isShow"
            name: "show"
            rawName: "v-show"
            value: true,
            dep :{
                bind : () => {},
                ...
            }
        }
    }

 * @param {*} dirs 
 * @param {*} vm 
 */
function normalizeDirectives(
    dirs: ? Array < VNodeDirective > ,
    vm : Component
): {
    [key: string]: VNodeDirective
} {
    const res = Object.create(null)
    if (!dirs) {
        // $flow-disable-line
        return res
    }
    let i, dir
    for (i = 0; i < dirs.length; i++) {
        // 获取每一个元素上的指令对象
        dir = dirs[i]
            // 获取指令的描述修饰符
        if (!dir.modifiers) {
            // $flow-disable-line
            dir.modifiers = emptyModifiers
        }
        // 按照指令全称作为key缓存当前vnode上的所有指令属性
        res[getRawDirName(dir)] = dir
            // 从vm.$options.directives中获取 与当前节点的当前指令属性匹配的处理方法对象
        dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
    }
    // $flow-disable-line
    return res
}

/**
 * 获取指令的属性全称
 * 
 * 如 v-directive.mody1
 * @param {*} dir 
 */
function getRawDirName(dir: VNodeDirective): string {
    return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}

/**
 * 指令生命周期的回调函数方法
 * 
 * @param {*} dir   指令的属性即处理对象
 * @param {*} hook  当前回调的生命周期字符串  'bind' 'insert'
 * @param {*} vnode  新的vnode
 * @param {*} oldVnode  原来的vnode
 * @param {*} isDestroy  vnode是否是销毁，还是只是此指令属性销毁了 。 true: vnode销毁 false：指令属性销毁
 */
function callHook(dir, hook, vnode, oldVnode, isDestroy) {
    const fn = dir.def && dir.def[hook]
    if (fn) {
        try {
            fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
        } catch (e) {
            handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
        }
    }
}