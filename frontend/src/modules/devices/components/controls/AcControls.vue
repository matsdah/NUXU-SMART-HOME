<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { api } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import TemperatureControl from '../shared/TemperatureControl.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import { useToast } from '@/shared/composables/useToast'

const props = defineProps<{ deviceId: string; deviceName?: string; initialIsOn?: boolean }>()

const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()

type AcState = {
  isOn: boolean
  mode: 'fan' | 'cool' | 'heat'
  temperature: number
  verticalSwing: string
  horizontalSwing: string
  fanSpeed: string
}

const TEMP_MIN = 18
const TEMP_MAX = 38
const STORAGE_KEY_PREFIX = 'ac-controls-state:'

const MODES: PillOption[] = [
  { value: 'fan', label: 'Ventilación', icon: '≋' },
  { value: 'cool', label: 'Frío', icon: '❄' },
  { value: 'heat', label: 'Calor', icon: '☼' },
]

const VERTICAL_OPTIONS: PillOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '22°', label: '22°' },
  { value: '45°', label: '45°' },
  { value: '67°', label: '67°' },
  { value: '90°', label: '90°' },
]

const HORIZONTAL_OPTIONS: PillOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '-90°', label: '-90°' },
  { value: '-45°', label: '-45°' },
  { value: '0°', label: '0°' },
  { value: '45°', label: '45°' },
]

const FAN_OPTIONS: PillOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '25%', label: '25%' },
  { value: '50%', label: '50%' },
  { value: '75%', label: '75%' },
  { value: '100%', label: '100%' },
]

const modeLabels: Record<AcState['mode'], string> = {
  fan: 'Ventilación',
  cool: 'Frío',
  heat: 'Calor',
}

const state = ref<AcState>({
  isOn: props.initialIsOn ?? true,
  mode: 'cool',
  temperature: 24,
  verticalSwing: 'auto',
  horizontalSwing: 'auto',
  fanSpeed: 'auto',
})

const loading = ref(true)
const saving = ref(false)
const savedState = ref<AcState | null>(null)

const { showToast } = useToast()

const currentModeLabel = computed(() => modeLabels[state.value.mode])
const currentModeIcon = computed(() => {
  if (state.value.mode === 'fan') return '≋'
  if (state.value.mode === 'heat') return '☼'
  return '❄'
})

function snapshotState(): AcState {
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

function readPersistedState(): Partial<AcState> | null {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AcState>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function applyStatePatch(patch: Partial<AcState>) {
  if (typeof patch.isOn === 'boolean') state.value.isOn = patch.isOn
  if (patch.mode) state.value.mode = patch.mode
  if (typeof patch.temperature === 'number') state.value.temperature = patch.temperature
  if (patch.verticalSwing) state.value.verticalSwing = patch.verticalSwing
  if (patch.horizontalSwing) state.value.horizontalSwing = patch.horizontalSwing
  if (patch.fanSpeed) state.value.fanSpeed = patch.fanSpeed
}

onMounted(async () => {
  try {
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    if (typeof raw.on === 'boolean') state.value.isOn = raw.on
    if (raw.mode) state.value.mode = raw.mode as AcState['mode']
    if (raw.temperature) state.value.temperature = raw.temperature as number
    if (raw.verticalSwing) state.value.verticalSwing = raw.verticalSwing as string
    if (raw.horizontalSwing) state.value.horizontalSwing = raw.horizontalSwing as string
    if (raw.fanSpeed) state.value.fanSpeed = raw.fanSpeed as string
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
      if (cur.mode !== prev.mode) {
        try { await api.patch(`/devices/${props.deviceId}/setMode`, { mode: cur.mode }) } catch { /* skip */ }
      }
      if (cur.temperature !== prev.temperature) {
        try { await api.patch(`/devices/${props.deviceId}/setTemperature`, { temperature: cur.temperature }) } catch { /* skip */ }
      }
      if (cur.verticalSwing !== prev.verticalSwing) {
        try { await api.patch(`/devices/${props.deviceId}/setVerticalSwing`, { verticalSwing: cur.verticalSwing }) } catch { /* skip */ }
      }
      if (cur.horizontalSwing !== prev.horizontalSwing) {
        try { await api.patch(`/devices/${props.deviceId}/setHorizontalSwing`, { horizontalSwing: cur.horizontalSwing }) } catch { /* skip */ }
      }
      if (cur.fanSpeed !== prev.fanSpeed) {
        try { await api.patch(`/devices/${props.deviceId}/setFanSpeed`, { fanSpeed: cur.fanSpeed }) } catch { /* skip */ }
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
  <div v-if="loading" class="ac-loading">Cargando...</div>

  <div v-else class="ac-shell">
    <section class="ac-card">
      <ControlSidebar
        :title="props.deviceName || 'Aire Acondicionado'"
        room-label="SALÓN"
        :temperature="state.temperature"
        :is-on="state.isOn"
        :badge-icon="currentModeIcon"
        :badge-label="`MODO ${currentModeLabel.toUpperCase()}`"
        @toggle-power="togglePower"
      />

      <div class="ac-controls">
        <section class="ac-section">
          <p class="ac-label">Modo de operación</p>
          <PillButtons v-model="state.mode" :options="MODES" variant="mode" />
        </section>

        <section class="ac-section">
          <p class="ac-label">Ajuste de temperatura</p>
          <TemperatureControl v-model="state.temperature" :min="TEMP_MIN" :max="TEMP_MAX" label="temperatura" />
        </section>

        <section class="ac-section ac-section--split">
          <div class="ac-sub">
            <p class="ac-label">Aspas verticales</p>
            <PillButtons v-model="state.verticalSwing" :options="VERTICAL_OPTIONS" size="small" class="ac-swing-buttons" />
          </div>

          <div class="ac-sub">
            <p class="ac-label">Aspas horizontales</p>
            <PillButtons v-model="state.horizontalSwing" :options="HORIZONTAL_OPTIONS" size="small" class="ac-swing-buttons" />
          </div>
        </section>

        <section class="ac-section">
          <p class="ac-label">Velocidad ventilador</p>
          <PillButtons v-model="state.fanSpeed" :options="FAN_OPTIONS" appearance="container" size="fan" />
        </section>

      </div>
    </section>
  </div>
</template>

<style scoped>
.ac-loading {
  padding: 2rem;
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.9rem;
}

.ac-shell {
  width: 100%;
}

.ac-card {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 640px;
  border-radius: 28px;
  overflow: hidden;
  background: #f7f5f0;
  box-shadow: 0 28px 70px rgba(42, 40, 37, 0.16);
}

.ac-controls {
  padding: 2.6rem 2.2rem 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.ac-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.ac-section--split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.ac-sub {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ac-swing-buttons :deep(.pill-button) {
  background: rgba(158, 155, 142, 0.35);
}

.ac-swing-buttons :deep(.pill-button--active) {
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  box-shadow: 0 8px 18px rgba(52, 47, 41, 0.18);
}

.ac-label {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(52, 47, 41, 0.42);
}

@media (max-width: 900px) {
  .ac-card {
    grid-template-columns: 1fr;
  }

  .ac-controls {
    padding: 1.5rem;
  }
}

@media (max-width: 640px) {
  .ac-section--split {
    grid-template-columns: 1fr;
  }
}
</style>

