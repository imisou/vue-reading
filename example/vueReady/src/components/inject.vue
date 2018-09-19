<template>
    <div class="hello">
        <h1>inject</h1>
        <h2>{{getProvide}}</h2>
        <h2>{{getDefault}}</h2>

    </div>
</template>

<script>
export default {
    name: 'HelloWorld',
    inject: {
        parent : 'parent',
        getProvide: {
            from: 'parent',
            default() {
                return 'ceshi'
            }
        },
        getDefault: {
            default() {
                return '这是默认的值'
            }
        }
},
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',

        }
    }
}
</script>
