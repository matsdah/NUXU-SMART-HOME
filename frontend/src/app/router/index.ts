import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'
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
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (_to.hash) return { el: _to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
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
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/modules/auth/pages/ResetPasswordPage.vue'),
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

const ROUTE_TITLES: Record<string, string> = {
  landing: 'NUXU — Gestión de Hogares Inteligentes',
  login: 'Iniciar sesión — NUXU',
  register: 'Crear cuenta — NUXU',
  recover: 'Recuperar contraseña — NUXU',
  verify: 'Verificar cuenta — NUXU',
  'reset-password': 'Restablecer contraseña — NUXU',
  homes: 'Mi Hogar — NUXU',
  devices: 'Dispositivos — NUXU',
  'device-ac-controls': 'Aire acondicionado — NUXU',
  routines: 'Rutinas — NUXU',
  logs: 'Historial — NUXU',
  rooms: 'Habitaciones — NUXU',
  settings: 'Configuración — NUXU',
}

router.afterEach((to) => {
  document.title = ROUTE_TITLES[String(to.name)] ?? 'NUXU — Gestión de Hogares Inteligentes'
})

export default router
