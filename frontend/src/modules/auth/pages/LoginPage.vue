<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'
import { ApiError } from '@/services/api/client'
import { handleApiError } from '@/shared/utils/api-error-handler'

import AuthLayout from '../components/AuthLayout.vue'
import { useToast } from '@/shared/composables/useToast'

import '@/shared/styles/auth-form.css'

const email = ref('')
const password = ref('')
const showVerifyAction = ref(false)
const loading = ref(false)
const showPass = ref(false)

const { showToast } = useToast()

const auth = useAuthStore()
const router = useRouter()

function isUnverifiedAccountError(status: number, description: string): boolean {
  const normalizedDescription = description.toLowerCase()
  return status === 403
    || normalizedDescription.includes('verif')
    || normalizedDescription.includes('not verified')
}

async function handleSubmit() {
  showVerifyAction.value = false
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push({ name: 'homes' })
  } catch (e) {
    if (e instanceof ApiError) {
      const message = (e.body as { error?: { description?: string } })?.error?.description ?? ''
      const shouldOfferVerification = Boolean(email.value.trim()) && [400, 401, 403].includes(e.status)
      if (isUnverifiedAccountError(e.status, message)) {
        showToast('Tu cuenta existe, pero todavía no está verificada.', 'error')
        showVerifyAction.value = shouldOfferVerification
      } else {
        showToast(
          e.status === 401 || e.status === 400
            ? 'Usuario o contraseña incorrectos.'
            : `Error ${e.status}. Intentá de nuevo.`,
          'error'
        )
        showVerifyAction.value = shouldOfferVerification
      }
    } else {
      const { message } = handleApiError(e)
      showToast(message, 'error')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>

    <div class="auth-header">
      <h1 class="auth-title">¡Hola!</h1>
      <p class="auth-subtitle">Iniciá sesión para continuar</p>
    </div>

    <div v-if="showVerifyAction" class="login__verify-help">
      <RouterLink :to="{ name: 'verify', query: { email: email.trim() } }">Reenviar código de verificación</RouterLink>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit" novalidate>

        <!-- Email / Usuario -->
        <div class="field">
          <span class="field__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </span>
          <input
            v-model="email"
            type="email"
            id="login-email"
            placeholder=" "
            autocomplete="email"
            required
            class="field__input field__input--with-icon"
          />
          <label for="login-email" class="field__label field__label--with-icon">Usuario</label>
        </div>

      <div class="field">
        <span class="field__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </span>
        <input v-model="password" :type="showPass ? 'text' : 'password'"
          id="login-password" placeholder=" " autocomplete="current-password"
          required class="field__input field__input--with-icon field__input--pass" />
        <label for="login-password" class="field__label field__label--with-icon">Contraseña</label>
        <button type="button" class="field__eye"
          :aria-label="showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showPass = !showPass">
          <svg v-if="!showPass" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </button>
      </div>

      <div class="login__options">
        <RouterLink to="/recover" class="login__recover">¿Olvidaste tu contraseña?</RouterLink>
      </div>

      <button type="submit" class="auth-submit" :disabled="loading">
        <svg v-if="loading" width="20" height="20" viewBox="0 0 24 24" fill="none"
          aria-hidden="true" class="spinner">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"
            stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        <span v-else>Iniciar sesión</span>
      </button>

    </form>

    <div class="auth-separator"></div>
    <p class="auth-footer">¿No tenés cuenta? <RouterLink to="/register">Crear cuenta</RouterLink></p>

  </AuthLayout>
</template>

<style scoped>

.login__verify-help {
  width: 100%;
  text-align: center;
  margin-top: -0.35rem;
}

.login__verify-help a {
  font-size: 0.84rem;
  color: var(--color-brown);
  text-decoration: none;
  font-weight: 400;
}
.login__verify-help a:hover { text-decoration: underline; }

.login__options {
  display: flex;
  justify-content: center;
  margin-top: -0.25rem;
}

.login__recover {
  font-size: 0.82rem;
  color: var(--color-brown);
  text-decoration: none;
  font-weight: 300;
  transition: opacity 0.15s;
}
.login__recover:hover { opacity: 0.75; }
</style>
