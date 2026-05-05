import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'
import LandingPage from '@/modules/auth/pages/LandingPage.vue'
import AppLayout from '@/shared/layout/AppLayout.vue'
import DevicesPage from '@/modules/devices/pages/DevicesPage.vue'
import AcControlsPage from '@/modules/devices/pages/AcControlsPage.vue'
import HomesPage from '@/modules/homes/pages/HomesPage.vue'
import LogsPage from '@/modules/logs/pages/LogsPage.vue'
import RoomsPage from '@/modules/rooms/pages/RoomsPage.vue'
import RoutinesPage from '@/modules/routines/pages/RoutinesPage.vue'
import SettingsPage from '@/modules/settings/pages/SettingsPage.vue'

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
      component: () => import('@/modules/auth/pages/LoginPage.vue'),  // Importo a demanda o lazy-load
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/modules/auth/pages/RegisterPage.vue'), // Importo a demanda o lazy-load
      meta: { guestOnly: true },
    },
    {
      path: '/recover',
      name: 'recover',
      component: () => import('@/modules/auth/pages/RecoverPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/verify',
      name: 'verify',
      component: () => import('@/modules/auth/pages/VerifyPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/modules/auth/pages/ResetPasswordPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/homes',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'homes',
          component: HomesPage,
        },
      ],
    },
    {
      path: '/devices',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'devices',
          component: DevicesPage,
        },
        {
          path: ':deviceId/ac-controls',
          name: 'device-ac-controls',
          component: AcControlsPage,
        },
      ],
    },
    {
      path: '/routines',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'routines',
          component: RoutinesPage,
        },
      ],
    },
    {
      path: '/logs',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'logs',
          component: LogsPage,
        },
      ],
    },
    {
      path: '/rooms',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'rooms',
          component: RoomsPage,
        },
      ],
    },
    {
      path: '/settings',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'settings',
          component: SettingsPage,
        },
      ],
    },
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
