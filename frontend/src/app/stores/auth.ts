import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api, TOKEN_KEY } from '@/services/api/client'
import type { User, LoginResponse } from '@/modules/auth/types'
import { useDashboardStore } from '@/app/stores/dashboard'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))

  const isAuthenticated = computed(() => token.value !== null)

  async function login(email: string, password: string): Promise<void> {
    const res = await api.post<LoginResponse>('/users/login', { email, password })
    token.value = res.token
    user.value = res.user
    localStorage.setItem(TOKEN_KEY, res.token)
  }


  async function logout(): Promise<void> {
    try {
      await api.post('/users/logout')
    } finally {
      useDashboardStore().reset()  // ← limpiar estado del dashboard
      clearSession()               // ← limpiar token y user
    }
  }

  async function fetchProfile(): Promise<void> {
    user.value = await api.get<User>('/users/profile')
  }

  async function updateProfile(data: {
    name: string
    email: string
    currentPassword: string
    newPassword?: string
  }): Promise<void> {
    await api.put('/users/profile', { name: data.name, email: data.email })
    if (data.newPassword) {
      await api.post('/users/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
    }
    await fetchProfile()
  }

  function clearSession(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { user, token, isAuthenticated, login, logout, fetchProfile, updateProfile, clearSession }
})
