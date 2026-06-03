<script setup lang="ts">
import { onBeforeUnmount, onMounted, computed, type Component } from 'vue'
import type { Device } from '@/app/stores/dashboard'
import AcControls from './controls/AcControls.vue'
import OvenControls from './controls/OvenControls.vue'
import FridgeControls from './controls/FridgeControls.vue'
import LampControls from './controls/LampControls.vue'
import DoorControls from './controls/DoorControls.vue'
import AlarmControls from './controls/AlarmControls.vue'
import BlindControls from './controls/BlindControls.vue'
import TapControls from './controls/TapControls.vue'
import SpeakerControls from './controls/SpeakerControls.vue'
import VacuumControls from './controls/VacuumControls.vue'

const props = defineProps<{
  device: Device
  roomName: string
}>()

const emit = defineEmits<{ close: []; deviceUpdated: [id: string, isOn: boolean] }>()

/** Mapa de kind → componente de control. */
const controlRegistry: Record<string, Component> = {
  vacuum: VacuumControls,
  ac: AcControls,
  oven: OvenControls,
  fridge: FridgeControls,
  lamp: LampControls,
  door: DoorControls,
  alarm: AlarmControls,
  blind: BlindControls,
  speaker: SpeakerControls,
  tap: TapControls,
}

const controlComponent = computed(() => controlRegistry[props.device.kind] ?? null)

/** Solo AC, horno y lámpara reciben la prop initialIsOn. */
const needsInitialPower = computed(() => ['ac', 'oven', 'lamp'].includes(props.device.kind))

const controlProps = computed(() => {
  const base: Record<string, unknown> = {
    deviceId: props.device.id,
    deviceName: props.device.name,
  }
  if (needsInitialPower.value) {
    base.initialIsOn = props.device.isOn
  }
  return base
})

let previousBodyOverflow = ''
let previousHtmlOverflow = ''

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  previousHtmlOverflow = document.documentElement.style.overflow
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  document.documentElement.style.overflow = previousHtmlOverflow
  document.removeEventListener('keydown', onKeyDown)
})

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click="onOverlayClick">
      <div class="modal">
        <div class="modal__right">
          <button type="button" class="modal__close" @click="emit('close')" aria-label="Cerrar">✕</button>

          <component
            v-if="controlComponent"
            :is="controlComponent"
            v-bind="controlProps"
            @power-toggled="(isOn: boolean) => emit('deviceUpdated', device.id, isOn)"
          />
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
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  background: rgba(42, 40, 37, 0.25);
  padding: 0;
  overscroll-behavior: contain;
}

@supports not (backdrop-filter: blur(1px)) {
  .modal-overlay {
    background: rgba(42, 40, 37, 0.72);
  }
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
