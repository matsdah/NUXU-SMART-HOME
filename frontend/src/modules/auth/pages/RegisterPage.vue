<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError } from '@/services/api/client'
import { sendVerificationEmail } from '@/services/email'
import { handleApiError } from '@/shared/utils/api-error-handler'
import { translateAuthError } from '@/shared/utils/auth-error-translator'
import AuthLayout from '../components/AuthLayout.vue'
import { useToast } from '@/shared/composables/useToast'

import '@/shared/styles/auth-form.css'

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)

const { showToast } = useToast()
const showPass = ref(false)
const showConfirmPass = ref(false)

const router = useRouter()

async function handleSubmit() {
  const normalizedEmail = email.value.trim()
  if (!normalizedEmail) {
    showToast('Ingresá un email válido.', 'error')
    return
  }
  if (password.value !== confirmPassword.value) {
    showToast('Las contraseñas no coinciden.', 'error')
    return
  }

  loading.value = true
  let accountCreated = false
  try {
    // 1. Crear la cuenta en el backend
    await api.post('/users/register', { name: name.value.trim(), email: normalizedEmail, password: password.value })
    accountCreated = true

    // 2. Pedir al backend el código de verificación
    const { code } = await api.post<{ code: string }>('/users/send-verification', { email: normalizedEmail })

    // 3. Enviar ese código al mail del usuario via EmailJS
    await sendVerificationEmail(normalizedEmail, code)

    await router.push({ name: 'verify', query: { email: normalizedEmail } })
  } catch (e) {
    if (accountCreated) {
      await router.push({
        name: 'verify',
        query: { email: normalizedEmail, notice: 'needs-resend' },
      })
      return
    }

    if (e instanceof ApiError && e.status === 409) {
      showToast('Este mail ya tiene una cuenta. Podés iniciar sesión directamente.', 'error')
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
      <h1 class="auth-title">Crear cuenta</h1>
      <p class="auth-subtitle">Registrate para continuar</p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit" novalidate>

      <div class="field">
        <input v-model="name" type="text" id="reg-name" placeholder=" "
          autocomplete="name" required class="field__input" />
        <label for="reg-name" class="field__label">Nombre</label>
      </div>

      <div class="field">
        <input v-model="email" type="email" id="reg-email" placeholder=" "
          autocomplete="email" required class="field__input" />
        <label for="reg-email" class="field__label">Email</label>
      </div>

      <div class="field">
        <input v-model="password" :type="showPass ? 'text' : 'password'"
          id="reg-password" placeholder=" " autocomplete="new-password"
          required class="field__input field__input--pass" />
        <label for="reg-password" class="field__label">Contraseña</label>
        <button type="button" class="field__eye"
          :aria-label="showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showPass = !showPass">
          <svg v-if="!showPass" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </button>
      </div>

      <div class="field">
        <input v-model="confirmPassword" :type="showConfirmPass ? 'text' : 'password'"
          id="reg-confirm-password" placeholder=" " autocomplete="new-password"
          required class="field__input field__input--pass" />
        <label for="reg-confirm-password" class="field__label">Confirmar contraseña</label>
        <button type="button" class="field__eye"
          :aria-label="showConfirmPass ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showConfirmPass = !showConfirmPass">
          <svg v-if="!showConfirmPass" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
        <span v-else>Crear cuenta</span>
      </button>

    </form>

    <div class="auth-separator"></div>

    <p class="auth-footer">¿Ya tenés cuenta? <RouterLink to="/login">Iniciar sesión</RouterLink></p>

  </AuthLayout>
</template>

<style scoped>
/* RegisterPage no necesita estilos adicionales — todos los estilos
   compartidos están en shared/styles/auth-form.css */
</style>
