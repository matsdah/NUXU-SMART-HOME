<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LockClosedIcon, UserIcon } from '@heroicons/vue/24/outline'
import { api, ApiError, TOKEN_KEY } from '@/services/api/client'
import AuthLayout from '../components/AuthLayout.vue'

const route = useRoute()
const router = useRouter()

const initialEmail = typeof route.query.email === 'string' ? route.query.email : ''

const email = ref(initialEmail)
const code = ref('')
const currentPassword = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)
const showCurrentPass = ref(false)
const showPass = ref(false)
const showConfirm = ref(false)

// Si no hay sesión activa de recuperación, significa que el código ya fue usado o nunca se pidió uno
const hasActiveSession = !!sessionStorage.getItem('recovery_session')
const step = ref<'email' | 'code' | 'password'>(
  initialEmail && hasActiveSession ? 'code' : 'email'
)

function handleEmailStep() {
  error.value = ''
  if (!email.value.trim()) {
    error.value = 'Ingresá tu email para continuar.'
    return
  }
  step.value = 'code'
}

function handleCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  code.value = target.value.replace(/\D/g, '').slice(0, 6)
}

function handleCodeStep() {
  error.value = ''

  if (code.value.length !== 6) {
    error.value = 'Ingresá un código de 6 dígitos.'
    return
  }

  const savedCode = sessionStorage.getItem('recovery_code')
  if (code.value !== savedCode) {
    error.value = 'Código incorrecto. Revisá tu mail e intentá de nuevo.'
    return
  }

  step.value = 'password'
}

async function handlePasswordStep() {
  error.value = ''

  if (password.value !== confirm.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }

  loading.value = true
  try {
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

    sessionStorage.removeItem('recovery_code')
    sessionStorage.removeItem('recovery_session')

    router.push({ name: 'login' })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      error.value = 'Contraseña actual incorrecta.'
    } else if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      error.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
    } else {
      error.value = 'Error inesperado. Intentá de nuevo.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>

    <div class="reset__header">
      <h1 class="reset__title">
        {{ step === 'email' ? 'Cambiar contraseña' : step === 'code' ? 'Verificar identidad' : 'Nueva contraseña' }}
      </h1>
      <p class="reset__subtitle">
        {{ step === 'email' ? 'Ingresá tu email para continuar' : step === 'code' ? `Ingresá el código enviado a ${email}` : 'Ingresá tu contraseña actual y la nueva' }}
      </p>
    </div>

    <div v-if="error" class="reset__error" role="alert">{{ error }}</div>

    <form v-if="step === 'email'" class="reset__form" @submit.prevent="handleEmailStep" novalidate>

      <div class="field">
        <span class="field__icon" aria-hidden="true">
          <UserIcon />
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

    <form v-else-if="step === 'code'" class="reset__form" @submit.prevent="handleCodeStep" novalidate>

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

    <form v-else class="reset__form" @submit.prevent="handlePasswordStep" novalidate>

      <div class="field">
        <span class="field__icon" aria-hidden="true">
          <LockClosedIcon />
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
          <LockClosedIcon />
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
          <LockClosedIcon />
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
      <RouterLink to="/login">Volver al inicio de sesión</RouterLink>
    </p>

  </AuthLayout>
</template>

<style scoped>

.reset__header {
  width: 100%;
  text-align: center;
}

.reset__title {
  font-size: clamp(1.5rem, 5vw, 2rem);
  font-weight: 300;
  color: var(--color-text);
  margin-bottom: 0.15rem;
}

.reset__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-weight: 300;
}

.reset__error {
  width: 100%;
  padding: 0.6rem 0.9rem;
  background: rgba(180, 60, 60, 0.1);
  border: 1px solid rgba(180, 60, 60, 0.3);
  border-radius: 12px;
  color: #a03030;
  font-size: 0.85rem;
  text-align: center;
}

.reset__form {
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

.field__input--code {
  text-align: center;
  letter-spacing: 0.45em;
  font-variant-numeric: tabular-nums;
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
