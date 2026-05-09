<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ApiError } from '@/services/api/client'
import { useDashboardStore } from '@/app/stores/dashboard'

const emit = defineEmits<{
  close: []
  created: []
}>()

const store = useDashboardStore()

const spaceName = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  if (!spaceName.value.trim()) {
    error.value = 'Ingresá un nombre para el espacio.'
    return
  }

  loading.value = true
  try {
    await store.createRoom(spaceName.value.trim())
    emit('created')
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      error.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
      return
    }
    error.value = e instanceof Error ? e.message : 'Error inesperado. Intentá de nuevo.'
  } finally {
    loading.value = false
  }
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => { document.addEventListener('keydown', onKeyDown) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKeyDown) })
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal">
        <div class="modal__header">
          <h2 class="modal__title">Agregar habitación</h2>
          <button class="modal__close" type="button" @click="emit('close')" aria-label="Cerrar">✕</button>
        </div>

        <div v-if="error" class="modal__error" role="alert">{{ error }}</div>

        <form class="modal__form" @submit.prevent="handleSubmit" novalidate>
          <div class="field">
            <input
              v-model="spaceName"
              type="text"
              id="room-name"
              placeholder=" "
              required
              class="field__input"
              autocomplete="off"
              maxlength="25"
            />
            <label for="room-name" class="field__label">Nombre del espacio</label>
          </div>

          <div class="modal__actions">
            <button type="button" class="modal__cancel" :disabled="loading" @click="emit('close')">
              Cancelar
            </button>
            <button type="submit" class="modal__submit" :disabled="loading">
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  background: rgba(42, 40, 37, 0.25);
  padding: 1.5rem;
}

@supports not (backdrop-filter: blur(1px)) {
  .overlay {
    background: rgba(42, 40, 37, 0.72);
  }
}

.modal {
  background: #fff;
  border-radius: 24px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 32px 64px rgba(42, 40, 37, 0.22);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.modal__title {
  font-size: 1.4rem;
  font-weight: 300;
  color: var(--color-text);
}

.modal__close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(42, 40, 37, 0.08);
  color: rgba(42, 40, 37, 0.7);
  font-size: 0.9rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.modal__close:hover {
  background: rgba(42, 40, 37, 0.15);
}

.modal__error {
  padding: 0.6rem 0.9rem;
  background: rgba(180, 60, 60, 0.1);
  border: 1px solid rgba(180, 60, 60, 0.3);
  border-radius: 12px;
  color: #a03030;
  font-size: 0.85rem;
}

.modal__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  position: relative;
}

.field__input {
  width: 100%;
  height: 58px;
  padding: 26px 1rem 8px;
  background: rgba(255, 255, 255, 0.6);
  border: 1.5px solid var(--color-sage);
  border-radius: 12px;
  font-size: 0.95rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s;
}

.field__input:focus {
  border-color: var(--color-brown);
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
  transition: top 0.18s ease, font-size 0.18s ease, color 0.18s ease;}

.field__input:focus ~ .field__label,
.field__input:not(:placeholder-shown) ~ .field__label {
  top: 16px;
  font-size: 0.72rem;
  color: var(--color-black);
}

.modal__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.modal__cancel,
.modal__submit {
  height: 50px;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.2s, box-shadow 0.2s;
}

.modal__cancel {
  border: 1px solid rgba(42, 40, 37, 0.2);
  color: rgba(42, 40, 37, 0.8);
  background: #fff;
}

.modal__cancel:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.06);
  transform: translateY(-1px);
}

.modal__submit {
  border: none;
  color: #fff;
  background-color: var(--color-brown);
}

.modal__submit:hover:not(:disabled) {
  background-color: #7a5240;
  box-shadow: 0 8px 24px rgba(122, 82, 64, 0.2);
  transform: translateY(-1px);
}

.modal__cancel:disabled,
.modal__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
