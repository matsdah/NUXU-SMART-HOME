<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { api } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import TemperatureControl from '../shared/TemperatureControl.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'

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
const saveError = ref('')
const toastMessage = ref('')
const showToast = ref(false)
const savedState = ref<OvenState | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | null = null

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

onBeforeUnmount(() => {
  if (toastTimer !== null) {
    clearTimeout(toastTimer)
  }
})

function togglePower() {
  state.value.isOn = !state.value.isOn
  emit('powerToggled', state.value.isOn)
}

async function saveChanges() {
  if (saving.value) {
    return
  }

  saveError.value = ''
  saving.value = true
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state.value))
    savedState.value = snapshotState()
    toastMessage.value = 'Datos guardados correctamente.'
    showToast.value = true
    if (toastTimer !== null) {
      clearTimeout(toastTimer)
    }
    toastTimer = setTimeout(() => {
      showToast.value = false
      toastTimer = null
    }, 2000)
  } catch {
    saveError.value = 'No se pudo guardar. Volvé a intentarlo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="oven-loading">Cargando...</div>

  <div v-else class="oven-shell">
    <section class="oven-card">
      <ControlSidebar
        :title="props.deviceName || 'Horno'"
        room-label="COCINA"
        :temperature="state.temperature"
        :is-on="state.isOn"
        :badge-icon="currentHeatSourceIcon"
        :badge-label="currentHeatSourceLabel.toUpperCase()"
        @toggle-power="togglePower"
      />

      <div class="oven-controls">
        <section class="oven-section">
          <p class="oven-label">Fuente de calor</p>
          <PillButtons v-model="state.heatSource" :options="HEAT_SOURCES" appearance="container" />
        </section>

        <section class="oven-section">
          <p class="oven-label">Ajuste de temperatura</p>
          <TemperatureControl v-model="state.temperature" :min="TEMP_MIN" :max="TEMP_MAX" label="temperatura" />
        </section>

        <section class="oven-section">
          <p class="oven-label">Potencia</p>
          <PillButtons v-model="state.powerLevel" :options="POWER_LEVELS" appearance="container" />
        </section>

        <section class="oven-section">
          <p class="oven-label">Modo convección</p>
          <PillButtons v-model="state.convectionMode" :options="CONVECTION_MODES" appearance="container" />
        </section>

        <div class="oven-actions">
          <p v-if="saveError" class="oven-save__error" role="alert">{{ saveError }}</p>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="showToast" class="toast toast--success">
        {{ toastMessage }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.oven-loading {
  padding: 2rem;
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.9rem;
}

.oven-shell {
  width: 100%;
}

.oven-card {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 640px;
  border-radius: 28px;
  overflow: hidden;
  background: #f7f5f0;
  box-shadow: 0 28px 70px rgba(42, 40, 37, 0.16);
}

.oven-controls {
  padding: 2.6rem 2.2rem 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.oven-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.oven-label {
  margin: 0;
  font-size: 0.82rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(42, 40, 37, 0.55);
}

.oven-actions {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.oven-save__error {
  margin: 0;
  font-size: 0.85rem;
  color: #9d4d43;
}

.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.85rem;
  z-index: 200;
  animation: toast-in 0.3s ease;
}

.toast--success {
  background: #2d6a4f;
  box-shadow: 0 4px 15px rgba(45, 106, 79, 0.3);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (max-width: 900px) {
  .oven-card {
    grid-template-columns: 1fr;
  }

  .oven-controls {
    padding: 1.5rem;
  }
}
</style>
