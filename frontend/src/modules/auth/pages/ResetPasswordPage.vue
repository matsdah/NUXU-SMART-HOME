<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { api, ApiError, TOKEN_KEY } from '@/services/api/client'
import { sendVerificationEmail } from '@/services/email'
import { handleApiError } from '@/shared/utils/api-error-handler'
import AuthLayout from '../components/AuthLayout.vue'
import { useToast } from '@/shared/composables/useToast'

import '@/shared/styles/auth-form.css'

const route = useRoute()
const router = useRouter()

const initialEmail = typeof route.query.email === 'string' ? route.query.email : ''

const email = ref(initialEmail)
const code = ref('')
const currentPassword = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)

const { showToast } = useToast()
const showCurrentPass = ref(false)
const showPass = ref(false)
const showConfirm = ref(false)

// Si no hay sesión activa de recuperación, significa que el código ya fue usado o nunca se pidió uno
const hasActiveSession = !!sessionStorage.getItem('recovery_session')
const fromSettings = route.name === 'change-password'
const step = ref<'email' | 'code' | 'password'>(
  fromSettings ? 'password' : initialEmail && hasActiveSession ? 'code' : 'email'
)

async function handleEmailStep() {
  const normalizedEmail = email.value.trim()
  if (!normalizedEmail) {
    showToast('Ingresá tu email para continuar.', 'error')
    return
  }

  if (fromSettings) {
    step.value = 'password'
    return
  }

  loading.value = true
  try {
    const { code: recoveryCode } = await api.post<{ code: string }>('/users/forgot-password', {
      email: normalizedEmail,
    })

    sessionStorage.setItem('recovery_code', recoveryCode)
    sessionStorage.setItem('recovery_session', crypto.randomUUID())
    await sendVerificationEmail(normalizedEmail, recoveryCode)
    step.value = 'code'
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      showToast('No existe una cuenta con ese email.', 'error')
    } else {
      const { message } = handleApiError(e)
      showToast(message, 'error')
    }
  } finally {
    loading.value = false
  }
}

function handleCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  code.value = target.value.replace(/\D/g, '').slice(0, 6)
}

function handleCodeStep() {
  if (code.value.length !== 6) {
    showToast('Ingresá un código de 6 dígitos.', 'error')
    return
  }

  const savedCode = sessionStorage.getItem('recovery_code')
  if (code.value !== savedCode) {
    showToast('Código incorrecto. Revisá tu mail e intentá de nuevo.', 'error')
    return
  }

  step.value = 'password'
}

async function handlePasswordStep() {
  if (password.value !== confirm.value) {
    showToast('Las contraseñas no coinciden.', 'error')
    return
  }

  loading.value = true
  try {
    if (fromSettings) {
      // 1. Iniciamos sesión con la contraseña actual para obtener el token
      const { token } = await api.post<{ token: string }>('/users/login', {
        email: email.value.trim(),
        password: currentPassword.value,
      })

      // 2. Guardamos el token temporalmente para que el cliente lo use en la siguiente llamada
      localStorage.setItem(TOKEN_KEY, token)

      // 3. Cambiamos la contraseña
      await api.post('/users/change-password', {
        oldPassword: currentPassword.value,
        newPassword: password.value,
      })

      // 4. Borramos el token (el usuario deberá iniciar sesión con la nueva contraseña)
      localStorage.removeItem(TOKEN_KEY)
    } else {
      const recoveryCode = sessionStorage.getItem('recovery_code')
      if (!recoveryCode) {
        showToast('No encontramos un código de recuperación válido. Pedí uno nuevo.', 'error')
        return
      }

      await api.post('/users/reset-password', {
        email: email.value.trim(),
        code: recoveryCode,
        newPassword: password.value,
      })
    }

    sessionStorage.removeItem('recovery_code')
    sessionStorage.removeItem('recovery_session')

    router.push(fromSettings ? { name: 'settings', query: { passwordChanged: '1' } } : { name: 'login' })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      showToast('Contraseña actual incorrecta.', 'error')
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
      <h1 class="auth-title">
        {{ step === 'email' ? 'Cambiar contraseña' : step === 'code' ? 'Verificar identidad' : fromSettings ? 'Nueva contraseña' : 'Restablecer contraseña' }}
      </h1>
      <p class="auth-subtitle">
        {{ step === 'email' ? 'Ingresá tu email para continuar' : step === 'code' ? `Ingresá el código enviado a ${email}` : fromSettings ? 'Ingresá tu contraseña actual y la nueva' : 'Elegí una nueva contraseña' }}
      </p>
    </div>

    <form v-if="step === 'email'" class="auth-form" @submit.prevent="handleEmailStep" novalidate>

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
          id="reset-email"
          placeholder=" "
          autocomplete="email"
          required
          class="field__input field__input--with-icon"
        />
        <label for="reset-email" class="field__label field__label--with-icon">Email</label>
      </div>

      <button type="submit" class="auth-submit">
        <span>Continuar</span>
      </button>

    </form>

    <form v-else-if="step === 'code'" class="auth-form" @submit.prevent="handleCodeStep" novalidate>

      <div class="field">
        <input
          :value="code"
          type="text"
          id="recovery-code"
          placeholder=" "
          inputmode="numeric"
          maxlength="6"
          autocomplete="one-time-code"
          required
          class="field__input field__input--code"
          @input="handleCodeInput"
        />
        <label for="recovery-code" class="field__label">Código de verificación</label>
      </div>

      <button type="submit" class="auth-submit">
        <span>Verificar código</span>
      </button>

    </form>

    <form v-else class="auth-form" @submit.prevent="handlePasswordStep" novalidate>

      <div v-if="fromSettings" class="field">
        <span class="field__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </span>
        <input v-model="currentPassword" :type="showCurrentPass ? 'text' : 'password'"
          id="reset-current" placeholder=" " autocomplete="current-password"
          required class="field__input field__input--with-icon field__input--pass" />
        <label for="reset-current" class="field__label field__label--with-icon">Contraseña actual</label>
        <button type="button" class="field__eye"
          :aria-label="showCurrentPass ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showCurrentPass = !showCurrentPass">
          <svg v-if="!showCurrentPass" width="16" height="16" viewBox="0 0 24 24" fill="none"
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

      <div class="field">
        <span class="field__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </span>
        <input v-model="password" :type="showPass ? 'text' : 'password'"
          id="reset-password" placeholder=" " autocomplete="new-password"
          required class="field__input field__input--with-icon field__input--pass" />
        <label for="reset-password" class="field__label field__label--with-icon">Nueva contraseña</label>
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

      <div class="field">
        <span class="field__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </span>
        <input v-model="confirm" :type="showConfirm ? 'text' : 'password'"
          id="reset-confirm" placeholder=" " autocomplete="new-password"
          required class="field__input field__input--with-icon field__input--pass" />
        <label for="reset-confirm" class="field__label field__label--with-icon">Confirmar contraseña</label>
        <button type="button" class="field__eye"
          :aria-label="showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showConfirm = !showConfirm">
          <svg v-if="!showConfirm" width="16" height="16" viewBox="0 0 24 24" fill="none"
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

      <button type="submit" class="auth-submit" :disabled="loading">
        <svg v-if="loading" width="20" height="20" viewBox="0 0 24 24" fill="none"
          aria-hidden="true" class="spinner">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"
            stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        <span v-else>Confirmar cambios</span>
      </button>

    </form>

    <p class="auth-footer">
      <RouterLink v-if="fromSettings" to="/settings">Volver a Configuración</RouterLink>
      <RouterLink v-else to="/login">Volver al inicio de sesión</RouterLink>
    </p>

  </AuthLayout>
</template>

<style scoped>
/* Todos los estilos compartidos están en shared/styles/auth-form.css */
</style>
