<script setup lang="ts">
const props = withDefaults(defineProps<{
  roomName: string
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  close: []
  confirm: []
}>()

function onOverlayClick(e: MouseEvent) {
  if (props.loading) {
    return
  }
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal">
        <div class="modal__header">
          <h2 class="modal__title">Eliminar habitación</h2>
          <button
            class="modal__close"
            type="button"
            :disabled="loading"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <p class="modal__message">
          ¿Estás seguro de querer borrar el espacio <strong>"{{ roomName }}"</strong>?
        </p>

        <div class="modal__actions">
          <button type="button" class="modal__cancel" :disabled="loading" @click="emit('close')">
            Cancelar
          </button>
          <button type="button" class="modal__confirm" :disabled="loading" @click="emit('confirm')">
            Eliminar
          </button>
        </div>
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

.modal__close:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.15);
}

.modal__message {
  color: rgba(42, 40, 37, 0.75);
  line-height: 1.4;
}

.modal__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.modal__cancel,
.modal__confirm {
  height: 50px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 400;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s;
}

.modal__cancel {
  border: 1px solid rgba(42, 40, 37, 0.2);
  color: rgba(42, 40, 37, 0.8);
  background: #fff;
}

.modal__cancel:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.06);
}

.modal__confirm {
  border: none;
  color: #fff;
  background: #b54444;
}

.modal__confirm:hover:not(:disabled) {
  background: #992f2f;
}

.modal__cancel:disabled,
.modal__confirm:disabled,
.modal__close:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
