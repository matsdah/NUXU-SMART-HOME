<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { api } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import TemperatureControl from '../shared/TemperatureControl.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import { useToast } from '@/shared/composables/useToast'

import '@/shared/styles/control-panel.css'

const props = defineProps<{ deviceId: string; deviceName?: string }>()
const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()

type FridgeState = {
  mode: 'default' | 'party' | 'vacation'
  fridgeTemp: number
  freezerTemp: number
}

const FRIDGE_TEMP_MIN = 2
const FRIDGE_TEMP_MAX = 8
const FREEZER_TEMP_MIN = -20
const FREEZER_TEMP_MAX = -8
const STORAGE_KEY_PREFIX = 'fridge-controls-state:'

const MODES: PillOption[] = [
  { value: 'default', label: 'Normal' },
  { value: 'party', label: 'Fiesta' },
  { value: 'vacation', label: 'Vacaciones' },
]

const state = ref<FridgeState>({
  mode: 'default',
  fridgeTemp: 4,
  freezerTemp: -18,
})

const loading = ref(true)
const saving = ref(false)
const savedState = ref<FridgeState | null>(null)

const { showToast } = useToast()

const currentModeLabel = computed(() => {
  const modeMap: Record<FridgeState['mode'], string> = {
    default: 'Normal',
    party: 'Fiesta',
    vacation: 'Vacaciones',
  }
  return modeMap[state.value.mode] || 'Normal'
})

function snapshotState(): FridgeState {
  return { ...state.value }
}

function storageKey() {
  return `${STORAGE_KEY_PREFIX}${props.deviceId}`
}

function readPersistedState(): Partial<FridgeState> | null {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FridgeState>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function applyStatePatch(patch: Partial<FridgeState>) {
  if (patch.mode) state.value.mode = normalizeMode(patch.mode)
  if (typeof patch.fridgeTemp === 'number') state.value.fridgeTemp = patch.fridgeTemp
  if (typeof patch.freezerTemp === 'number') state.value.freezerTemp = patch.freezerTemp
}

function hasUnsavedChanges(): boolean {
  if (!savedState.value) {
    return false
  }

  return JSON.stringify(state.value) !== JSON.stringify(savedState.value)
}

onMounted(async () => {
  try {
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    if (raw.mode) state.value.mode = normalizeMode(raw.mode)
    if (raw.fridgeTemp) state.value.fridgeTemp = raw.fridgeTemp as number
    if (raw.freezerTemp) state.value.freezerTemp = raw.freezerTemp as number
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

async function saveChanges() {
  if (saving.value) return
  saving.value = true
  const cur = state.value
  const prev = savedState.value
  try {
    if (prev) {
      if (cur.mode !== prev.mode) {
        try { await api.patch(`/devices/${props.deviceId}/setMode`, { mode: cur.mode }) } catch { /* skip */ }
      }
      if (cur.fridgeTemp !== prev.fridgeTemp) {
        try { await api.patch(`/devices/${props.deviceId}/setTemperature`, { temperature: cur.fridgeTemp }) } catch { /* skip */ }
      }
      if (cur.freezerTemp !== prev.freezerTemp) {
        try { await api.patch(`/devices/${props.deviceId}/setFreezerTemperature`, { freezerTemperature: cur.freezerTemp }) } catch { /* skip */ }
      }
    }
    localStorage.setItem(storageKey(), JSON.stringify(cur))
    savedState.value = snapshotState()
    emit('powerToggled', true)
    showToast('Datos guardados correctamente.', 'success')
  } catch {
    showToast('No se pudo guardar. Volvé a intentarlo.', 'error')
  } finally {
    saving.value = false
  }
}

function normalizeMode(raw: unknown): FridgeState['mode'] {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'normal') return 'default'
  if (value === 'party') return 'party'
  if (value === 'vacation') return 'vacation'
  return 'default'
}
</script>

<template>
  <div v-if="loading" class="cp-loading">Cargando...</div>

  <div v-else class="cp-shell">
    <section class="cp-card">
      <ControlSidebar
        :title="props.deviceName || 'Heladera'"
        room-label="COCINA"
        :temperature="state.fridgeTemp"
        :is-on="true"
        :show-power-button="false"
        :badge-label="`MODO ${currentModeLabel.toUpperCase()}`"
      />

      <div class="cp-controls">
        <section class="cp-section">
          <p class="cp-label">Modo de operación</p>
          <PillButtons v-model="state.mode" :options="MODES" appearance="container" />
        </section>

        <section class="cp-section">
          <p class="cp-label">Ajuste de temperatura heladera</p>
          <TemperatureControl v-model="state.fridgeTemp" :min="FRIDGE_TEMP_MIN" :max="FRIDGE_TEMP_MAX" label="temperatura heladera" />
        </section>

        <section class="cp-section">
          <p class="cp-label">Ajuste de temperatura freezer</p>
          <TemperatureControl v-model="state.freezerTemp" :min="FREEZER_TEMP_MIN" :max="FREEZER_TEMP_MAX" label="temperatura freezer" />
        </section>

      </div>
    </section>
  </div>
</template>

<style scoped>
/* El layout base está en shared/styles/control-panel.css */
</style>
