<script setup lang="ts">
import { computed } from 'vue'
import type { Device } from '@/app/stores/dashboard'
import { useDashboardStore } from '@/app/stores/dashboard'
import AcControls from './controls/AcControls.vue'

const props = defineProps<{
  device: Device
  roomName: string
}>()

const emit = defineEmits<{ close: [] }>()

const store = useDashboardStore()

const isPending = computed(() => store.pendingActions.has(props.device.id))

function toggle() {
  store.toggleDevice(props.device.id)
}

// Cierra al hacer click en el overlay (fuera del modal)
function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click="onOverlayClick">
      <div class="modal">

        <!-- Panel izquierdo: info del dispositivo -->
        <div class="modal__left">
          <p class="modal__room">{{ roomName }}</p>
          <h2 class="modal__name">{{ device.name }}</h2>

          <div class="modal__status">{{ device.status }}</div>

          <button
            class="modal__power"
            :class="{ 'modal__power--on': device.isOn }"
            :disabled="isPending"
            @click="toggle"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 2v6"/>
              <path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>
            </svg>
            {{ device.isOn ? 'Encendido' : 'Apagado' }}
          </button>
        </div>

        <!-- Panel derecho: controles específicos del dispositivo -->
        <div class="modal__right">
          <button class="modal__close" @click="emit('close')" aria-label="Cerrar">✕</button>

          <AcControls v-if="device.kind === 'ac'" :device-id="device.id" />
          <p v-else class="modal__no-controls">Sin controles disponibles para este dispositivo.</p>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(12px);
  background: rgba(42, 40, 37, 0.25);
  padding: 1.5rem;
}

.modal {
  display: flex;
  width: 100%;
  max-width: 780px;
  max-height: 90vh;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 32px 64px rgba(42, 40, 37, 0.22);
}

/* Panel izquierdo */
.modal__left {
  width: 240px;
  flex-shrink: 0;
  background: var(--color-beige, #f2ede0);
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modal__room {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(42, 40, 37, 0.5);
}

.modal__name {
  font-size: 1.5rem;
  font-weight: 300;
  color: var(--color-text);
  line-height: 1.2;
  margin-bottom: 0.5rem;
}

.modal__status {
  font-size: 3.5rem;
  font-weight: 300;
  color: var(--color-text);
  line-height: 1;
  margin: auto 0;
}

.modal__power {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.2rem;
  border-radius: 999px;
  border: none;
  background: rgba(42, 40, 37, 0.88);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: opacity 0.15s;
}

.modal__power:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal__power--on {
  background: rgba(63, 129, 102, 0.85);
}

/* Panel derecho */
.modal__right {
  flex: 1;
  background: #fff;
  padding: 2rem;
  overflow-y: auto;
  position: relative;
}

.modal__close {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
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
  transition: background 0.15s;
}

.modal__close:hover {
  background: rgba(42, 40, 37, 0.15);
}

.modal__no-controls {
  font-size: 0.9rem;
  color: rgba(42, 40, 37, 0.5);
  margin-top: 2rem;
  text-align: center;
}

@media (max-width: 600px) {
  .modal {
    flex-direction: column;
    max-height: 95vh;
  }
  .modal__left {
    width: 100%;
    padding: 1.5rem;
  }
  .modal__status {
    font-size: 2.5rem;
  }
}
</style>
