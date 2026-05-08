<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError } from '@/services/api/client'
import { sendVerificationEmail } from '@/services/email'
import AuthLayout from '../components/AuthLayout.vue'

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPass = ref(false)

const router = useRouter()

async function handleSubmit() {
  error.value = ''
  const normalizedEmail = email.value.trim()
  if (!normalizedEmail) {
    error.value = 'Ingresá un email válido.'
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
      error.value = 'Este mail ya tiene una cuenta. Podés iniciar sesión directamente.'
    } else if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      error.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
    } else {
      error.value = 'No se pudo enviar el mail de verificación. Intentá de nuevo.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>

    <div class="register__header">
      <h1 class="register__title">Crear cuenta</h1>
      <p class="register__subtitle">Registrate para continuar</p>
    </div>

    <div v-if="error" class="register__error" role="alert">{{ error }}</div>

    <form class="register__form" @submit.prevent="handleSubmit" novalidate>

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
        <span v-else>Crear cuenta</span>
      </button>

    </form>

    <div class="auth-separator"></div>

    <p class="auth-footer">¿Ya tenés cuenta? <RouterLink to="/login">Iniciar sesión</RouterLink></p>

  </AuthLayout>
</template>

<style scoped>

.register__header {
  width: 100%;
  text-align: center;
}

.register__title {
  font-size: clamp(1.75rem, 6vw, 2.25rem);
  font-weight: 300;
  color: var(--color-text);
  margin-bottom: 0.15rem;
}

.register__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-weight: 300;
}

.register__error {
  width: 100%;
  padding: 0.6rem 0.9rem;
  background: rgba(180, 60, 60, 0.1);
  border: 1px solid rgba(180, 60, 60, 0.3);
  border-radius: 12px;
  color: #a03030;
  font-size: 0.85rem;
  text-align: center;
}

.register__form {
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

.field__input--pass { padding-right: 2.75rem; }
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
