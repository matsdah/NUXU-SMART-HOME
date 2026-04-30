import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '@/modules/auth/pages/LandingPage.vue'
import AppLayout from '@/shared/layout/AppLayout.vue'
import DevicesPage from '@/modules/devices/pages/DevicesPage.vue'
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
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/modules/auth/pages/RegisterPage.vue'), // Importo a demanda o lazy-load
    },
    {
      path: '/homes',
      component: AppLayout,
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
      children: [
        {
          path: '',
          name: 'devices',
          component: DevicesPage,
        },
      ],
    },
    {
      path: '/routines',
      component: AppLayout,
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

export default router
