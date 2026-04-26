import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '@/modules/auth/pages/LandingPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingPage,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/modules/auth/pages/LoginPage.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/modules/auth/pages/RegisterPage.vue'),
    },
  ],
})

export default router
