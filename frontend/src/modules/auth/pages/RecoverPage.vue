<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError } from '@/services/api/client'
import { generateVerificationCode, sendVerificationEmail } from '@/services/email'
import { handleApiError } from '@/shared/utils/api-error-handler'
import { translateAuthError } from '@/shared/utils/auth-error-translator'
import AuthLayout from '../components/AuthLayout.vue'
import { useToast } from '@/shared/composables/useToast'

import '@/shared/styles/auth-form.css'

const email = ref('')
const loading = ref(false)
const router = useRouter()
const { showToast } = useToast()

async function handleSubmit() {
  const normalizedEmail = email.value.trim()
  if (!normalizedEmail) {
    showToast('Ingresá tu email para continuar.', 'error')
    return
  }

  loading.value = true
  try {
    const recoveryResponse = await api.post<{ code?: string; verification_code?: string }>(
      '/users/forgot-password',
      { email: normalizedEmail },
    )
    const recoveryCode = recoveryResponse.code ?? recoveryResponse.verification_code ?? generateVerificationCode()

    sessionStorage.setItem('recovery_code', recoveryCode)
    sessionStorage.setItem('recovery_session', crypto.randomUUID())
    await sendVerificationEmail(normalizedEmail, recoveryCode)

    router.push({ name: 'reset-password', query: { email: normalizedEmail } })
  } catch (e) {
    sessionStorage.removeItem('recovery_code')
    sessionStorage.removeItem('recovery_session')
    if (e instanceof ApiError && e.status === 404) {
      showToast('No existe una cuenta con ese email.', 'error')
    } else {
      const { message } = handleApiError(e)
      showToast(translateAuthError(message), 'error')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>

    <div class="auth-header">
      <h1 class="auth-title">Cambiar contraseña</h1>
      <p class="auth-subtitle">Ingresá tu email para continuar</p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit" novalidate>

      <div class="field">
        <input v-model="email" type="email" id="rec-email" placeholder=" "
          autocomplete="email" required class="field__input" />
        <label for="rec-email" class="field__label">Email</label>
      </div>

      <button type="submit" class="auth-submit" :disabled="loading">
        <svg v-if="loading" width="20" height="20" viewBox="0 0 24 24" fill="none"
          aria-hidden="true" class="spinner">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"
            stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        <span v-else>Continuar</span>
      </button>

    </form>

    <p class="auth-footer">
      <RouterLink to="/login">Volver al inicio de sesión</RouterLink>
    </p>

  </AuthLayout>
</template>

<style scoped>
/* Todos los estilos compartidos están en shared/styles/auth-form.css */
</style>
