<script setup lang="ts">
import { onBeforeUnmount, onMounted, computed } from 'vue'
import type { Device } from '@/app/stores/dashboard'
import { useDashboardStore } from '@/app/stores/dashboard'
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

const store = useDashboardStore()

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

const isAirConditioner = computed(() => {
  const source = [
    props.device.kind,
    props.device.typeId ?? '',
    props.device.name,
    props.device.status,
  ].join(' ').toLowerCase()

  return source.includes('air')
    || source.includes(' ac ') || source.includes('ac ') || props.device.kind === 'ac'
    || source.includes('conditioner')
    || source.includes('aire')
    || source.includes('acondicion')
    || props.device.typeId === 'go46xmbqei8eoaomjk3p'
})

const isOven = computed(() => {
  const source = [
    props.device.kind,
    props.device.typeId ?? '',
    props.device.name,
    props.device.status,
  ].join(' ').toLowerCase()

  return source.includes('oven')
    || source.includes('horno')
    || source.includes('stove')
})

const isFridge = computed(() => {
  const source = [
    props.device.kind,
    props.device.typeId ?? '',
    props.device.name,
    props.device.status,
  ].join(' ').toLowerCase()

  return source.includes('fridge')
    || source.includes('heladera')
    || source.includes('refrigerator')
    || source.includes('freezer')
})

const isLamp = computed(() => {
  const source = [
    props.device.kind,
    props.device.typeId ?? '',
    props.device.name,
    props.device.status,
  ].join(' ').toLowerCase()

  return source.includes('lamp')
    || source.includes('light')
    || source.includes('luz')
    || source.includes('lampara')
    || source.includes('lámpara')
})

const isDoor = computed(() => {
  const source = [
    props.device.kind,
    props.device.typeId ?? '',
    props.device.name,
    props.device.status,
  ].join(' ').toLowerCase()

  return source.includes('door')
    || source.includes('puerta')
})

const isAlarm = computed(() => {
  const source = [props.device.kind, props.device.typeId ?? '', props.device.name].join(' ').toLowerCase()
  return props.device.kind === 'alarm' || source.includes('alarm') || source.includes('alarma')
})

const isBlind = computed(() => {
  const source = [props.device.kind, props.device.typeId ?? '', props.device.name].join(' ').toLowerCase()
  return props.device.kind === 'blind'
    || source.includes('blind') || source.includes('persiana')
    || source.includes('curtain') || source.includes('roller')
    || props.device.typeId === 'lsq3up3bkgqk0k0f64jf'
})

const isVacuum = computed(() => {
  const source = [props.device.kind, props.device.typeId ?? '', props.device.name].join(' ').toLowerCase()
  return props.device.kind === 'vacuum'
    || source.includes('vacuum') || source.includes('aspiradora')
    || props.device.typeId === 'ofglvd9gzubmmk9hzfal'
})

const isSpeaker = computed(() => {
  const source = [props.device.kind, props.device.typeId ?? '', props.device.name].join(' ').toLowerCase()
  return props.device.kind === 'speaker'
    || source.includes('speaker') || source.includes('parlante') || source.includes('audio')
    || props.device.typeId === 'im77xyzlyfm3oijpo3eh'
})

const isTap = computed(() => {
  const source = [props.device.kind, props.device.typeId ?? '', props.device.name].join(' ').toLowerCase()
  return props.device.kind === 'tap'
    || source.includes('tap') || source.includes('faucet')
    || source.includes('canilla') || source.includes('sprinkler')
    || source.includes('aspersor')
    || props.device.typeId === 'dbrlpeuy8t19pbt0mlkr'
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

          <VacuumControls  v-if="isVacuum"           :device-id="device.id" :device-name="device.name" />
          <AcControls      v-else-if="isAirConditioner" :device-id="device.id" :device-name="device.name" :initial-is-on="device.isOn" @power-toggled="(isOn) => emit('deviceUpdated', device.id, isOn)" />
          <OvenControls    v-else-if="isOven"       :device-id="device.id" :device-name="device.name" :initial-is-on="device.isOn" @power-toggled="(isOn) => emit('deviceUpdated', device.id, isOn)" />
          <FridgeControls  v-else-if="isFridge"     :device-id="device.id" :device-name="device.name" />
          <LampControls    v-else-if="isLamp"       :device-id="device.id" :device-name="device.name" :initial-is-on="device.isOn" @power-toggled="(isOn) => emit('deviceUpdated', device.id, isOn)" />
          <DoorControls    v-else-if="isDoor"       :device-id="device.id" :device-name="device.name" />
          <AlarmControls   v-else-if="isAlarm"      :device-id="device.id" :device-name="device.name" />
          <BlindControls   v-else-if="isBlind"      :device-id="device.id" :device-name="device.name" />
          <SpeakerControls v-else-if="isSpeaker"    :device-id="device.id" :device-name="device.name" />
          <TapControls     v-else-if="isTap"        :device-id="device.id" :device-name="device.name" />
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

