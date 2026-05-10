<script setup lang="ts">
import { useToast } from '@/shared/composables/useToast'

const { toasts, persistentToasts } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="t.type === 'success' ? 'toast--success' : 'toast--error'"
          role="status"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>

      <div
        v-for="msg in persistentToasts"
        :key="msg"
        class="toast toast--persistent"
        role="status"
      >
        {{ msg }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.85rem;
  font-family: var(--font-sans);
  color: #fff;
  white-space: nowrap;
  pointer-events: auto;
}

.toast--success {
  background: #2d6a4f;
  box-shadow: 0 4px 15px rgba(45, 106, 79, 0.3);
}

.toast--error {
  background: #8a2d2d;
  box-shadow: 0 4px 15px rgba(138, 45, 45, 0.3);
}

.toast--persistent {
  background: rgba(42, 40, 37, 0.95);
  color: #f7f3e7;
}

.toast-enter-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
