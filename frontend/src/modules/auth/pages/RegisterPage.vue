<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError } from '@/services/api/client'

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const router = useRouter()

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await api.post('/users/register', { name: name.value, email: email.value, password: password.value })
    router.push({ name: 'verify' })
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      error.value = msg ?? `Registration failed (${e.status}).`
    } else {
      error.value = 'Unexpected error. Try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <form class="auth-form" @submit.prevent="handleSubmit">
      <h1>Create account</h1>
      <div v-if="error" class="form-error">{{ error }}</div>
      <label>
        Name
        <input v-model="name" type="text" required autocomplete="name" />
      </label>
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="email" />
      </label>
      <label>
        Password
        <input v-model="password" type="password" required autocomplete="new-password" />
      </label>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Registering…' : 'Register' }}
      </button>
      <div class="auth-links">
        <RouterLink to="/login">Already have an account?</RouterLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 360px;
  padding: 2rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.auth-form h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.auth-form label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.88rem;
  font-weight: 500;
  color: #333;
}

.auth-form input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
}

.auth-form input:focus {
  outline: none;
  border-color: #1a1a2e;
}

.auth-form button[type='submit'] {
  padding: 0.6rem;
  background: #1a1a2e;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 0.25rem;
  transition: opacity 0.15s;
}

.auth-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-error {
  padding: 0.5rem 0.75rem;
  background: #fff0f0;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
  font-size: 0.88rem;
}

.auth-links {
  font-size: 0.85rem;
}

.auth-links a {
  color: #1a1a2e;
}
</style>
