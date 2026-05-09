<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'
import { ApiError } from '@/services/api/client'

import AuthLayout from '../components/AuthLayout.vue'
import { useToast } from '@/shared/composables/useToast'

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
      showToast('Error inesperado. Intentá de nuevo.', 'error')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>

    <div class="login__header">
      <h1 class="login__title">¡Hola!</h1>
      <p class="login__subtitle">Iniciá sesión para continuar</p>
    </div>

    <div v-if="showVerifyAction" class="login__verify-help">
      <RouterLink :to="{ name: 'verify', query: { email: email.trim() } }">Reenviar código de verificación</RouterLink>
    </div>

    <form class="login__form" @submit.prevent="handleSubmit" novalidate>

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

.login__header {
  width: 100%;
  text-align: center;
}

.login__title {
  font-size: clamp(1.75rem, 6vw, 2.25rem);
  font-weight: 300;
  color: var(--color-text);
  margin-bottom: 0.15rem;
}

.login__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-weight: 300;
}

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

.login__form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  position: relative;
  width: 100%;
}

.field__input {
  width: 100%;
  height: 54px;
  padding: 18px 1rem 4px;
  background: rgba(255, 255, 255, 0.6);
  border: 1.5px solid var(--color-sage);
  border-radius: 12px;
  font-size: 0.95rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s;
}

.field__input--with-icon { padding-left: 2.5rem; }
.field__input--pass { padding-right: 2.75rem; }
.field__input:focus { border-color: var(--color-brown); }

.field__icon {
  position: absolute;
  left: 0.9rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
  pointer-events: none;
}

.field__icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.field__label {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.95rem;
  font-weight: 300;
  color: var(--color-text-muted);
  pointer-events: none;
  transition: top 0.18s ease, font-size 0.18s ease, color 0.18s ease;
}

.field__label--with-icon { left: 2.5rem; }

.field__input:focus ~ .field__label,
.field__input:not(:placeholder-shown) ~ .field__label {
  top: 10px;
  font-size: 0.72rem;
  color: var(--color-brown);
}

.field__eye {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
  transition: color 0.15s;
}
.field__eye:hover { color: var(--color-text); }

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

.auth-submit {
  width: 100%;
  height: 50px;
  border-radius: 12px;
  background-color: var(--color-brown);
  border: none;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 400;
  font-family: var(--font-sans);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}
.auth-submit:hover:not(:disabled) { background-color: #7a5240; }
.auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
.spinner { animation: spin 0.9s linear infinite; }

.auth-separator {
  width: 100%;
  display: flex;
  align-items: center;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-weight: 300;
}
.auth-separator::before,
.auth-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-sage);
}

.auth-social {
  display: flex;
  gap: 0.75rem;
}

.social-btn {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1.5px solid var(--color-sage);
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.social-btn:hover {
  background: rgba(255, 255, 255, 0.85);
  border-color: var(--color-sage-dark);
}

.auth-footer {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-weight: 300;
  text-align: center;
}
.auth-footer a {
  color: var(--color-brown);
  font-weight: 400;
  text-decoration: none;
}
.auth-footer a:hover { text-decoration: underline; }
</style>
