<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-layout">
    <nav class="app-nav">
      <div class="nav-brand">Nuxu Home</div>
      <div class="nav-links">
        <RouterLink to="/homes">Homes</RouterLink>
        <RouterLink to="/routines">Routines</RouterLink>
        <RouterLink to="/logs">Logs</RouterLink>
      </div>
      <div class="nav-user">
        <span v-if="auth.user">{{ auth.user.name }}</span>
        <button @click="handleLogout">Logout</button>
      </div>
    </nav>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-nav {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0 2rem;
  height: 60px;
  background: #1a1a2e;
  color: white;
}

.nav-brand {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.02em;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
  flex: 1;
}

.nav-links a {
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.15s;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: white;
}

.nav-links a.router-link-active {
  font-weight: 600;
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-user span {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.65);
}

.nav-user button {
  padding: 0.3rem 0.85rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 0.88rem;
  transition: background 0.15s;
}

.nav-user button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.app-main {
  flex: 1;
  padding: 2rem;
}
</style>
