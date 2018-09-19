'use strict'
const path = require('path')
const glob = require("glob")
const utils = require('./utils')
const config = require('../config')
const vueLoaderConfig = require('./vue-loader.conf')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const merge = require('webpack-merge')

function resolve(dir) {
    return path.join(__dirname, '..', dir)
}

const webpackBaseConfig = {
    context: path.resolve(__dirname, '../'),
    output: {
        path: config.build.assetsRoot,
        filename: '[name].js',
        publicPath: process.env.NODE_ENV === 'production' ?
            config.build.assetsPublicPath : config.dev.assetsPublicPath
    },
    resolve: {
        extensions: ['.js', '.vue', '.json'],
        alias: {
            'vue$': resolve('static/vue.js'),
            '@': resolve('src'),
        }
    },
    module: {
        rules: [{
                test: /\.vue$/,
                loader: 'vue-loader',
                options: vueLoaderConfig
            },
            {
                test: /\.js$/,
                loader: 'babel-loader',
                include: [resolve('src'), resolve('test'), resolve('node_modules/webpack-dev-server/client')]
            },
            {
                test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    name: utils.assetsPath('img/[name].[hash:7].[ext]')
                }
            },
            {
                test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    name: utils.assetsPath('media/[name].[hash:7].[ext]')
                }
            },
            {
                test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    name: utils.assetsPath('fonts/[name].[hash:7].[ext]')
                }
            }
        ]
    },
    node: {
        // prevent webpack from injecting useless setImmediate polyfill because Vue
        // source contains it (although only uses it if it's native).
        setImmediate: false,
        // prevent webpack from injecting mocks to Node native modules
        // that does not make sense for the client
        dgram: 'empty',
        fs: 'empty',
        net: 'empty',
        tls: 'empty',
        child_process: 'empty'
    },
    plugins: []
}


const PAGE_PATH = path.resolve(__dirname, '../src/pages');

const entries = () => {
    const entryFiles = glob.sync(PAGE_PATH + "/*/*.js");
    let map = {};

    entryFiles.forEach(filePath => {
        //获取入口文件的名称
        let fileName = filePath.substring(filePath.lastIndexOf("\/") + 1, filePath.indexOf("."));
        map[fileName] = filePath;

    })
    console.log(map)
    return map;
}

const HTMLPlugins = _ => {
    const isProduction = process.env.NODE_ENV === 'production';
    let entryHTML = glob.sync(PAGE_PATH + '/*/*.html');

    let arr = [];

    entryHTML.forEach(htmlPath => {
        let fileName = htmlPath.substring(htmlPath.lastIndexOf("\/") + 1, htmlPath.indexOf("."));
        let options = {
            template: htmlPath,
            // 模板名称
            filename: `${fileName}.html`,
            inject: true,
            chunks: [fileName, 'vendor', 'manifest'],
        }
        options = isProduction ? Object.assign(options, {
            // minify: {
            //   removeComments: true,
            //   collapseWhitespace: true,
            //   removeAttributeQuotes: true
            //   // more options:
            //   // https://github.com/kangax/html-minifier#options-quick-reference
            // },

            chunksSortMode: 'dependency'
        }) : options
        arr.push(new HtmlWebpackPlugin(options));
    })
    return arr
}

let weconfig = merge(webpackBaseConfig, {
    entry: entries(),
    plugins: HTMLPlugins()
});

module.exports = weconfig;