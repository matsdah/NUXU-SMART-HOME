<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'

const auth = useAuthStore()
const router = useRouter()

onMounted(async () => {
  if (auth.isAuthenticated) {
    try {
      await auth.fetchProfile()
    } catch {
      // Token expired or invalid — clear session and redirect
      auth.clearSession()
      router.push({ name: 'login' })
    }
  }
})
</script>

<template>
  <RouterView />
</template>
