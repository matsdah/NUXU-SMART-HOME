<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '@/services/api/client'
import { sendVerificationEmail } from '@/services/email'
import { handleApiError } from '@/shared/utils/api-error-handler'
import { translateAuthError } from '@/shared/utils/auth-error-translator'
import AuthLayout from '../components/AuthLayout.vue'
import { useToast } from '@/shared/composables/useToast'

import '@/shared/styles/auth-form.css'

const route = useRoute()
const router = useRouter()

const code = ref('')
const loading = ref(false)
const resendLoading = ref(false)

const { showToast } = useToast()

onMounted(() => {
  if (route.query.notice === 'needs-resend') {
    showToast('La cuenta ya fue creada, pero no pudimos enviar el primer mail. Pedí un nuevo código.', 'error')
  }
})

const verificationEmail = computed(() => {
  const email = typeof route.query.email === 'string' ? route.query.email.trim() : ''
  return email
})

const targetEmail = computed(() => {
  return verificationEmail.value || 'tu email'
})

function handleCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  code.value = target.value.trim()
}

async function handleSubmit() {
  if (!verificationEmail.value) {
    showToast('No encontramos el email a verificar. Volvé a crear la cuenta.', 'error')
    return
  }

  if (!code.value) {
    showToast('Ingresá el código de verificación.', 'error')
    return
  }

  loading.value = true
  try {
    await api.post('/users/verify-account', { email: verificationEmail.value, code: code.value })
    router.push({ name: 'login' })
  } catch (e) {
    const { message } = handleApiError(e)
    const translated = translateAuthError(message)
    showToast(translated || 'Código incorrecto. Revisá tu mail e intentá de nuevo.', 'error')
  } finally {
    loading.value = false
  }
}

async function handleResendCode() {
  if (!verificationEmail.value) {
    showToast('No encontramos el email a verificar. Volvé a crear la cuenta.', 'error')
    return
  }

  resendLoading.value = true
  try {
    const { code: verificationCode } = await api.post<{ code: string }>('/users/send-verification', {
      email: verificationEmail.value,
    })
    await sendVerificationEmail(verificationEmail.value, verificationCode)
    showToast(`Reenviamos un nuevo código a ${verificationEmail.value}.`, 'success')
  } catch (e) {
    const { message } = handleApiError(e)
    showToast(translateAuthError(message) || 'No se pudo reenviar el código. Intentá de nuevo.', 'error')
  } finally {
    resendLoading.value = false
  }
}
</script>

<template>
  <AuthLayout>

    <div class="auth-header">
      <h1 class="auth-title">Verificación de cuenta</h1>
      <p class="auth-subtitle">Ingresar el número de 6 dígitos enviados al mail {{ targetEmail }}</p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit" novalidate>

      <div class="field">
        <input
          :value="code"
          type="text"
          id="verify-code"
          placeholder=" "
          autocomplete="one-time-code"
          required
          class="field__input field__input--code"
          @input="handleCodeInput"
        />
        <label for="verify-code" class="field__label">Código de verificación</label>
      </div>

      <button type="submit" class="auth-submit" :disabled="loading || resendLoading">
        <svg v-if="loading" width="20" height="20" viewBox="0 0 24 24" fill="none"
          aria-hidden="true" class="spinner">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"
            stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        <span v-else>Verificar cuenta</span>
      </button>

    </form>

    <button
      type="button"
      class="verify__resend"
      :disabled="loading || resendLoading"
      @click="handleResendCode"
    >
      <span v-if="resendLoading">Reenviando código...</span>
      <span v-else>Reenviar código</span>
    </button>

    <p class="auth-footer">
      <RouterLink to="/login">Volver al inicio de sesión</RouterLink>
    </p>

  </AuthLayout>
</template>

<style scoped>

/* Único estilo específico de VerifyPage */
.verify__resend {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-brown);
  font-size: 0.84rem;
  font-weight: 300;
  cursor: pointer;
  text-decoration: underline;
}
.verify__resend:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  text-decoration: none;
}

/* El resto de estilos compartidos están en shared/styles/auth-form.css */
</style>
