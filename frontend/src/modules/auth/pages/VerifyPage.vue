<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '@/services/api/client'
import { sendVerificationEmail } from '@/services/email'
import AuthLayout from '../components/AuthLayout.vue'

const route = useRoute()
const router = useRouter()

const code = ref('')
const error = ref('')
const info = ref(
  route.query.notice === 'needs-resend'
    ? 'La cuenta ya fue creada, pero no pudimos enviar el primer mail. Pedí un nuevo código.'
    : '',
)
const loading = ref(false)
const resendLoading = ref(false)

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
  error.value = ''
  info.value = ''

  if (!verificationEmail.value) {
    error.value = 'No encontramos el email a verificar. Volvé a crear la cuenta.'
    return
  }

  if (!code.value) {
    error.value = 'Ingresá el código de verificación.'
    return
  }

  loading.value = true
  try {
    await api.post('/users/verify-account', { email: verificationEmail.value, code: code.value })
    router.push({ name: 'login' })
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      error.value = msg ?? 'Código incorrecto. Revisá tu mail e intentá de nuevo.'
    } else {
      error.value = 'Error inesperado. Intentá de nuevo.'
    }
  } finally {
    loading.value = false
  }
}

async function handleResendCode() {
  error.value = ''
  info.value = ''

  if (!verificationEmail.value) {
    error.value = 'No encontramos el email a verificar. Volvé a crear la cuenta.'
    return
  }

  resendLoading.value = true
  try {
    const { code: verificationCode } = await api.post<{ code: string }>('/users/send-verification', {
      email: verificationEmail.value,
    })
    await sendVerificationEmail(verificationEmail.value, verificationCode)
    info.value = `Reenviamos un nuevo código a ${verificationEmail.value}.`
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      error.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
    } else {
      error.value = 'No se pudo reenviar el código. Intentá de nuevo.'
    }
  } finally {
    resendLoading.value = false
  }
}
</script>

<template>
  <AuthLayout>

    <div class="verify__header">
      <h1 class="verify__title">Verificación de cuenta</h1>
      <p class="verify__subtitle">Ingresar el número de 6 dígitos enviados al mail {{ targetEmail }}</p>
    </div>

    <div v-if="error" class="verify__error" role="alert">{{ error }}</div>
    <div v-if="info" class="verify__info" role="status">{{ info }}</div>

    <form class="verify__form" @submit.prevent="handleSubmit" novalidate>

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
      <span v-else>No recibí el mail, reenviar código</span>
    </button>

    <p class="auth-footer">
      <RouterLink to="/login">Volver al inicio de sesión</RouterLink>
    </p>

  </AuthLayout>
</template>

<style scoped>

.verify__header {
  width: 100%;
  text-align: center;
}

.verify__title {
  font-size: clamp(1.5rem, 5vw, 2rem);
  font-weight: 300;
  color: var(--color-text);
  margin-bottom: 0.15rem;
}

.verify__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-weight: 300;
}

.verify__error {
  width: 100%;
  padding: 0.6rem 0.9rem;
  background: rgba(180, 60, 60, 0.1);
  border: 1px solid rgba(180, 60, 60, 0.3);
  border-radius: 12px;
  color: #a03030;
  font-size: 0.85rem;
  text-align: center;
}

.verify__info {
  width: 100%;
  padding: 0.6rem 0.9rem;
  background: rgba(92, 122, 92, 0.14);
  border: 1px solid rgba(92, 122, 92, 0.35);
  border-radius: 12px;
  color: #415d41;
  font-size: 0.85rem;
  text-align: center;
}

.verify__form {
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

.field__input--code {
  text-align: center;
  letter-spacing: 0.45em;
  font-variant-numeric: tabular-nums;
}

.field__input:focus { border-color: var(--color-brown); }

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

.field__input:focus ~ .field__label,
.field__input:not(:placeholder-shown) ~ .field__label {
  top: 10px;
  font-size: 0.72rem;
  color: var(--color-brown);
}

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

@keyframes spin { to { transform: rotate(360deg); } }
.spinner { animation: spin 0.9s linear infinite; }

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
