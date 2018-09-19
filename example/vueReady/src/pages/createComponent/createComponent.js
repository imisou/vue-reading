import Vue from 'vue'
import App from "./app.vue"
new Vue({
  name: "RootApp",
  el: "#app",

  render: (h) => {
    return h(App, {}, [
      h('div'),
      h('div', {
        class: 'is class1'
      }, 'div1')
    ])
  }
})
