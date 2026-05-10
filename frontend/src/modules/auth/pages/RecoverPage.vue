<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError } from '@/services/api/client'
import { generateVerificationCode, sendVerificationEmail } from '@/services/email'
import AuthLayout from '../components/AuthLayout.vue'
import { useToast } from '@/shared/composables/useToast'

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
    } else if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
    } else {
      showToast('No se pudo enviar el mail. Intentá de nuevo.', 'error')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>

    <div class="recover__header">
      <h1 class="recover__title">Cambiar contraseña</h1>
      <p class="recover__subtitle">Ingresá tu email para continuar</p>
    </div>

    <form class="recover__form" @submit.prevent="handleSubmit" novalidate>

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

.recover__header {
  width: 100%;
  text-align: center;
}

.recover__title {
  font-size: clamp(1.5rem, 5vw, 2rem);
  font-weight: 300;
  color: var(--color-text);
  margin-bottom: 0.15rem;
}

.recover__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-weight: 300;
}

.recover__form {
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
