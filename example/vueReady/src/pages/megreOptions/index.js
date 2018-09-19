import Vue from 'vue'
import App from "./app.vue"
new Vue({
  el: "#app",
  render: (h) => {
    console.log(arguments)
    debugger
    return h(App)
  }
})
