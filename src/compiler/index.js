/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// 提供一个方法，此方法根据传入的baseOptions来创建相应的编译器


/*
    <div id="app">
        <ul @click="handleClickOptions" id="ul">
            <li  v-for="item in arr" :key="item.id">{{item.id}} : {{item.name}}</li>
        </ul>
    </div>


    ast = {
        type : 1,
        tag : 'div',
        parent : undefined,
        plain : false,
        attrs : [{
            name : 'id',
            value : '"app"'
        }],
        attrsList:[{
            name : 'id',
            value : '"app"'
        }],
        attrsMap:{
            id: 'app'
        },
        children : [{
           {
                type : 1,
                tag : 'ul',
                parent : parent, //父
                plain : false,
                attrs : [{
                    name : 'id',
                    value : '"ul"'
                }],
                attrsList:[{
                    name : 'id',
                    value : '"ul"'
                },{
                    name: "@click", 
                    value: "handleClickOptions"
                }],
                attrsMap:{
                    @click: "handleClickOptions",
                    id: 'ul'
                },
                events: {
                    click: {
                        value: "handleClickOptions"
                    }
                },
                hasBindings: true,
                children : [{
                    
                }]
            } 
        }]
    }


 */
export const createCompiler = createCompilerCreator(function baseCompile(
    template: string,
    options: CompilerOptions
): CompiledResult {

    // 将HTML 转换成 AST 对象
    const ast = parse(template.trim(), options)

    // 标记静态节点、静态根节点
    if (options.optimize !== false) {
        optimize(ast, options)
    }

    // codegen 把AST树转换成 代码执行字符串
    const code = generate(ast, options)


    return {
        ast,
        render: code.render,
        staticRenderFns: code.staticRenderFns
    }
})