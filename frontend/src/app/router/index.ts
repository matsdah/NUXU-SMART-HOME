import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'

import LoginPage from '@/modules/auth/pages/LoginPage.vue'
import RegisterPage from '@/modules/auth/pages/RegisterPage.vue'
import VerifyPage from '@/modules/auth/pages/VerifyPage.vue'
import RecoverPage from '@/modules/auth/pages/RecoverPage.vue'
import AppLayout from '@/shared/layout/AppLayout.vue'
import HomesPage from '@/modules/homes/pages/HomesPage.vue'
import RoomsPage from '@/modules/rooms/pages/RoomsPage.vue'
import DevicesPage from '@/modules/devices/pages/DevicesPage.vue'
import RoutinesPage from '@/modules/routines/pages/RoutinesPage.vue'
import LogsPage from '@/modules/logs/pages/LogsPage.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginPage, meta: { guestOnly: true } },
    { path: '/register', name: 'register', component: RegisterPage, meta: { guestOnly: true } },
    { path: '/verify', name: 'verify', component: VerifyPage, meta: { guestOnly: true } },
    { path: '/recover', name: 'recover', component: RecoverPage, meta: { guestOnly: true } },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/homes' },
        { path: 'homes', name: 'homes', component: HomesPage },
        { path: 'rooms', name: 'rooms', component: RoomsPage },
        { path: 'devices', name: 'devices', component: DevicesPage },
        { path: 'routines', name: 'routines', component: RoutinesPage },
        { path: 'logs', name: 'logs', component: LogsPage },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'homes' }
  }
})

export default router
