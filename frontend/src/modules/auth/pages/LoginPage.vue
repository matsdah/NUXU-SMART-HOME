<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'
import { ApiError } from '@/services/api/client'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPass = ref(false)

const auth = useAuthStore()
const router = useRouter()

async function handleSubmit() {
  error.value   = ''
  loading.value = true

  try{
    await auth.login(email.value, password.value)
    router.push({ name: 'homes' })
  }catch (e){
    if(e instanceof ApiError){
      error.value = e.status === 401 || e.status === 400
        ? 'Usuario o contraseña incorrectos.'
        : `Error ${e.status}. Intentá de nuevo.`
    }else{
      error.value = 'Error inesperado. Intentá de nuevo.'
    }
  }finally{
    loading.value = false
  }
}
</script>

<template>
  <div class="login">

    <!-- Fondo vectorial -->
    <svg class="bg-svg" viewBox="0 0 320 620" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMinYMid meet">

      <!-- óvalo crema de fondo -->
      <ellipse cx="105" cy="300" rx="185" ry="215" fill="#DFDDC8" transform="rotate(-12 105 300)"/>

      <!-- arco superior (creciente) -->
      <path fill-rule="evenodd" fill="#BEBEA6"
        d="M 20,55
           C 110,-30 320,55 305,230
           C 290,390 165,455 65,400
           C -30,350 -35,185 20,55 Z
           M 85,118
           C 158,55 295,120 278,240
           C 262,348 168,400 90,355
           C 18,312 15,200 85,118 Z"/>
           
      <!-- ola inferior sage -->
      <path fill="#BEBEA6"
        d="M 10,390
           C 75,335 210,365 268,445
           C 308,500 278,578 205,585
           C 140,592 55,548 14,488
           C -18,442 -22,418 10,390 Z"/>
    </svg>

    <!-- Logo lámpara colgante -->
    <RouterLink to="/" class="logo" aria-label="Ir al inicio">
      <img src="@/assets/lamp.webp" alt="Lámpara NUXU" class="logo__lamp" />
      <span class="logo__name">NUXU</span>
    </RouterLink>

    <!-- Formulario -->
    <main class="login__card">
      <h1 class="login__title">¡Hola!</h1>

      <div v-if="error" class="login__error" role="alert">{{ error }}</div>

      <form class="login__form" @submit.prevent="handleSubmit" novalidate>

        <!-- Email / Usuario -->
        <div class="field">
          <span class="field__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </span>
          <input
            v-model="email"
            type="email"
            placeholder="Usuario"
            autocomplete="email"
            required
            class="field__input"
          />
        </div>

        <!-- Contraseña -->
        <div class="field">
          <span class="field__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
          <input
            v-model="password"
            :type="showPass ? 'text' : 'password'"
            placeholder="Contraseña"
            autocomplete="current-password"
            required
            class="field__input"
          />
          <button
            type="button"
            class="field__eye"
            :aria-label="showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            @click="showPass = !showPass"
          >
            <svg v-if="!showPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>

        <!-- Olvidé mi contraseña -->
        <RouterLink to="/recover" class="login__recover">¿Olvidaste tu contraseña?</RouterLink>

        <!-- Botón submit -->
        <button type="submit" class="login__submit" :disabled="loading" aria-label="Iniciar sesión">
          <svg v-if="!loading" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M4 11h14M13 5l6 6-6 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="login__spinner">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="60" stroke-dashoffset="20"/>
          </svg>
        </button>

      </form>

      <!-- Social -->
      <div class="login__social">
        <button class="social-btn" type="button" aria-label="Continuar con Google">
          <svg viewBox="0 0 48 48" width="22" height="22">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"/>
          </svg>
        </button>
        <button class="social-btn" type="button" aria-label="Continuar con Facebook">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#1877F2">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.514c-1.491 0-1.956.93-1.956 1.887v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
        </button>
      </div>

      <!-- Crear cuenta -->
      <RouterLink to="/register" class="login__register">Crear cuenta</RouterLink>
    </main>
  </div>
</template>

<style scoped>
/* ── Layout ──────────────────────────────────────────────── */
.login {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background-color: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--font-sans);
}

/* ── SVG de fondo ────────────────────────────────────────── */
.bg-svg {
  position: absolute;
  left: 0;
  top: 0;
  height: 100vh;
  width: auto;
  pointer-events: none;
  z-index: 1;
}

/* ── Logo ────────────────────────────────────────────────── */
.logo {
  position: absolute;
  top: 0;
  left: 2rem;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 0.4rem;
  text-decoration: none;
  z-index: 10;
  background-color: var(--color-cream);
  padding: 0 1rem 0.5rem 0.5rem;
  border-radius: 0 0 16px 16px;
}

.logo__lamp {
  width: clamp(36px, 4vw, 52px);
  height: 14vh;
  object-fit: contain;
  object-position: top center;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,0.10));
  flex-shrink: 0;
}

.logo__name {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-text);
  padding-bottom: 0.3rem;
}

/* ── Card ────────────────────────────────────────────────── */
.login__card {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: min(340px, 90vw);
}

/* ── Título ──────────────────────────────────────────────── */
.login__title {
  font-size: clamp(2rem, 8vw, 2.75rem);
  font-weight: 400;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}

/* ── Error ───────────────────────────────────────────────── */
.login__error {
  width: 100%;
  padding: 0.6rem 0.9rem;
  background: rgba(180, 60, 60, 0.1);
  border: 1px solid rgba(180, 60, 60, 0.3);
  border-radius: 12px;
  color: #a03030;
  font-size: 0.85rem;
  text-align: center;
}

/* ── Form ────────────────────────────────────────────────── */
.login__form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

/* ── Field ───────────────────────────────────────────────── */
.field {
  width: 100%;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 14px;
  padding: 0 1rem;
  height: 52px;
  backdrop-filter: blur(6px);
}

.field__icon {
  color: var(--color-text);
  opacity: 0.5;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-right: 0.6rem;
}

.field__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.95rem;
  font-family: var(--font-sans);
  color: var(--color-text);
}

.field__input::placeholder {
  color: var(--color-text);
  opacity: 0.45;
}

.field__eye {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: var(--color-text);
  opacity: 0.45;
  transition: opacity 0.15s;
}
.field__eye:hover { opacity: 0.8; }

/* ── Recover ─────────────────────────────────────────────── */
.login__recover {
  align-self: center;
  font-size: 0.85rem;
  color: var(--color-text);
  opacity: 0.7;
  text-decoration: none;
  transition: opacity 0.15s;
}
.login__recover:hover { opacity: 1; text-decoration: underline; }

/* ── Submit ──────────────────────────────────────────────── */
.login__submit {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-btn);
  background-color: var(--color-brown);
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.25rem;
  transition: background-color 0.2s, transform 0.15s;
}
.login__submit:hover:not(:disabled) {
  background-color: #7a5240;
  transform: translateX(3px);
}
.login__submit:disabled { opacity: 0.6; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
.login__spinner { animation: spin 0.9s linear infinite; }

/* ── Social ──────────────────────────────────────────────── */
.login__social {
  display: flex;
  gap: 1rem;
}

.social-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1.5px solid rgba(42, 40, 37, 0.15);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s, transform 0.15s;
}
.social-btn:hover { background: rgba(255, 255, 255, 0.85); transform: translateY(-2px); }

/* ── Registro ────────────────────────────────────────────── */
.login__register {
  width: 100%;
  max-width: 220px;
  text-align: center;
  padding: 0.65rem 1.5rem;
  border: 1.5px solid rgba(42, 40, 37, 0.3);
  border-radius: var(--radius-btn);
  background: transparent;
  font-size: 0.9rem;
  color: var(--color-text);
  text-decoration: none;
  transition: background-color 0.15s, border-color 0.15s;
}
.login__register:hover {
  background: rgba(42, 40, 37, 0.07);
  border-color: rgba(42, 40, 37, 0.5);
}
</style>
