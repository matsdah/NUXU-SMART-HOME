<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { api } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import TemperatureControl from '../shared/TemperatureControl.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import { useToast } from '@/shared/composables/useToast'

import '@/shared/styles/control-panel.css'

const props = defineProps<{ deviceId: string; deviceName?: string; initialIsOn?: boolean }>()

const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()

type OvenState = {
  isOn: boolean
  heatSource: 'convencional' | 'abajo' | 'arriba'
  temperature: number
  powerLevel: 'off' | 'eco' | 'full'
  convectionMode: 'off' | 'eco' | 'conventional'
}

const TEMP_MIN = 90
const TEMP_MAX = 230
const STORAGE_KEY_PREFIX = 'oven-controls-state:'

const HEAT_SOURCES: PillOption[] = [
  { value: 'convencional', label: 'Convencional', icon: '◆' },
  { value: 'abajo', label: 'Abajo', icon: '▼' },
  { value: 'arriba', label: 'Arriba', icon: '▲' },
]

const POWER_LEVELS: PillOption[] = [
  { value: 'off', label: 'Apagado' },
  { value: 'eco', label: 'Económico' },
  { value: 'full', label: 'Completo' },
]

const CONVECTION_MODES: PillOption[] = [
  { value: 'off', label: 'Apagado' },
  { value: 'eco', label: 'Económico' },
  { value: 'conventional', label: 'Convencional' },
]

const state = ref<OvenState>({
  isOn: props.initialIsOn ?? true,
  heatSource: 'convencional',
  temperature: 150,
  powerLevel: 'full',
  convectionMode: 'conventional',
})

const loading = ref(true)
const saving = ref(false)
const savedState = ref<OvenState | null>(null)

const { showToast } = useToast()

const currentHeatSourceLabel = computed(() => {
  const source = HEAT_SOURCES.find(hs => hs.value === state.value.heatSource)
  return source?.label || 'Convencional'
})

const currentHeatSourceIcon = computed(() => {
  const source = HEAT_SOURCES.find(hs => hs.value === state.value.heatSource)
  return source?.icon || '◆'
})

function snapshotState(): OvenState {
  return { ...state.value }
}

function hasUnsavedChanges(): boolean {
  if (!savedState.value) {
    return false
  }

  return JSON.stringify(state.value) !== JSON.stringify(savedState.value)
}

function storageKey() {
  return `${STORAGE_KEY_PREFIX}${props.deviceId}`
}

function readPersistedState(): Partial<OvenState> | null {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OvenState>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function applyStatePatch(patch: Partial<OvenState>) {
  if (typeof patch.isOn === 'boolean') state.value.isOn = patch.isOn
  if (patch.heatSource) state.value.heatSource = patch.heatSource
  if (typeof patch.temperature === 'number') state.value.temperature = patch.temperature
  if (patch.powerLevel) state.value.powerLevel = patch.powerLevel
  if (patch.convectionMode) state.value.convectionMode = patch.convectionMode
}

onMounted(async () => {
  try {
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    if (typeof raw.on === 'boolean') state.value.isOn = raw.on
    if (raw.heatSource) state.value.heatSource = raw.heatSource as OvenState['heatSource']
    if (raw.temperature) state.value.temperature = raw.temperature as number
    if (raw.powerLevel) state.value.powerLevel = raw.powerLevel as OvenState['powerLevel']
    if (raw.convectionMode) state.value.convectionMode = raw.convectionMode as OvenState['convectionMode']
  } catch {
    // Si falla, se usan los valores por defecto
  } finally {
    const persisted = readPersistedState()
    if (persisted) {
      applyStatePatch(persisted)
    }
    savedState.value = snapshotState()
    loading.value = false
  }
})

watch(state, async () => {
  if (loading.value || !hasUnsavedChanges()) {
    return
  }

  await saveChanges()
}, { deep: true })

function togglePower() {
  state.value.isOn = !state.value.isOn
  emit('powerToggled', state.value.isOn)
}

async function saveChanges() {
  if (saving.value) return
  saving.value = true
  const cur = state.value
  const prev = savedState.value
  try {
    if (prev) {
      if (cur.isOn !== prev.isOn) {
        try { await api.patch(`/devices/${props.deviceId}/${cur.isOn ? 'turnOn' : 'turnOff'}`, {}) } catch { /* skip */ }
      }
      if (cur.temperature !== prev.temperature) {
        try { await api.patch(`/devices/${props.deviceId}/setTemperature`, { temperature: cur.temperature }) } catch { /* skip */ }
      }
      if (cur.heatSource !== prev.heatSource) {
        try { await api.patch(`/devices/${props.deviceId}/setHeat`, { heat: cur.heatSource }) } catch { /* skip */ }
      }
      if (cur.powerLevel !== prev.powerLevel) {
        try { await api.patch(`/devices/${props.deviceId}/setGrill`, { grill: cur.powerLevel }) } catch { /* skip */ }
      }
      if (cur.convectionMode !== prev.convectionMode) {
        try { await api.patch(`/devices/${props.deviceId}/setConvection`, { convection: cur.convectionMode }) } catch { /* skip */ }
      }
    }
    localStorage.setItem(storageKey(), JSON.stringify(cur))
    savedState.value = snapshotState()
    showToast('Datos guardados correctamente.', 'success')
  } catch {
    showToast('No se pudo guardar. Volvé a intentarlo.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="cp-loading">Cargando...</div>

  <div v-else class="cp-shell">
    <section class="cp-card">
      <ControlSidebar
        :title="props.deviceName || 'Horno'"
        room-label="COCINA"
        :temperature="state.temperature"
        :is-on="state.isOn"
        :badge-icon="currentHeatSourceIcon"
        :badge-label="currentHeatSourceLabel.toUpperCase()"
        @toggle-power="togglePower"
      />

      <div class="cp-controls">
        <section class="cp-section">
          <p class="cp-label">Fuente de calor</p>
          <PillButtons v-model="state.heatSource" :options="HEAT_SOURCES" appearance="container" />
        </section>

        <section class="cp-section">
          <p class="cp-label">Ajuste de temperatura</p>
          <TemperatureControl v-model="state.temperature" :min="TEMP_MIN" :max="TEMP_MAX" label="temperatura" />
        </section>

        <section class="cp-section">
          <p class="cp-label">Potencia</p>
          <PillButtons v-model="state.powerLevel" :options="POWER_LEVELS" appearance="container" />
        </section>

        <section class="cp-section">
          <p class="cp-label">Modo convección</p>
          <PillButtons v-model="state.convectionMode" :options="CONVECTION_MODES" appearance="container" />
        </section>

      </div>
    </section>
  </div>
</template>

<style scoped>
/* El layout base está en shared/styles/control-panel.css */
</style>
