import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './shared/styles/variables.css'
import './assets/base.css'
import App from './App.vue'
import router from './app/router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
