<script setup lang="ts">
import { onBeforeUnmount, onMounted, computed } from 'vue'
import type { Device } from '@/app/stores/dashboard'
import { useDashboardStore } from '@/app/stores/dashboard'
import AcControls from './controls/AcControls.vue'

const props = defineProps<{
  device: Device
  roomName: string
}>()

const emit = defineEmits<{ close: [] }>()

const store = useDashboardStore()

let previousBodyOverflow = ''
let previousHtmlOverflow = ''

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  previousHtmlOverflow = document.documentElement.style.overflow
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  document.documentElement.style.overflow = previousHtmlOverflow
})

const isPending = computed(() => store.pendingActions.has(props.device.id))
const isAirConditioner = computed(() => {
  const source = [
    props.device.kind,
    props.device.typeId ?? '',
    props.device.name,
    props.device.status,
  ].join(' ').toLowerCase()

  return source.includes('air')
    || source.includes('ac')
    || source.includes('conditioner')
    || source.includes('aire')
    || source.includes('acondicion')
})

function toggle() {
  store.toggleDevice(props.device.id)
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click="onOverlayClick">
      <div class="modal">
        <div class="modal__right">
          <button class="modal__close" @click="emit('close')" aria-label="Cerrar">✕</button>

          <AcControls v-if="isAirConditioner" :device-id="device.id" />
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
  padding: 0;
  overscroll-behavior: contain;
}

.modal {
  display: flex;
  width: min(92vw, 900px);
  max-width: 760px;
  max-height: 90vh;
  box-sizing: border-box;
  border-radius: 40px;
  overflow: hidden;
  box-shadow: 0 32px 64px rgba(42, 40, 37, 0.22);
}

.modal__right {
  flex: 1;
  background: #fff;
  padding: 0;
  overflow-y: auto;
  max-height: 90vh;
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
    width: 95%;
    max-width: 420px;
    max-height: 95vh;
  }

  .modal__right {
    padding: 0.5rem;
    max-height: 95vh;
  }
}
</style>

