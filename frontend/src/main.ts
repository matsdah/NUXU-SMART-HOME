import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from '@/app/stores/auth'

import './shared/styles/variables.css'
import './assets/base.css'
import App from './App.vue'
import router from './app/router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

async function bootstrap() {
  await router.isReady()

  const auth = useAuthStore(pinia)
  if (auth.token && !auth.user) {
    try {
      await auth.fetchProfile()
    } catch {
      auth.clearSession()
      const publicRoutes = new Set([
        'landing',
        'login',
        'register',
        'recover',
        'verify',
        'reset-password',
      ])
      const currentRouteName = String(router.currentRoute.value.name ?? '')
      if (!publicRoutes.has(currentRouteName)) {
        await router.push({ name: 'login' })
      }
    }
  }

  app.mount('#app')
}

void bootstrap()
