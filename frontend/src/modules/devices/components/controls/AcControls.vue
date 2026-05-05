<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { api } from '@/services/api/client'

const props = defineProps<{ deviceId: string }>()

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

const MODES = [
  { value: 'fan', label: 'Ventilación', icon: '≋' },
  { value: 'cool', label: 'Frío', icon: '❄' },
  { value: 'heat', label: 'Calor', icon: '☼' },
] as const

const VERTICAL_OPTIONS = ['auto', '22°', '45°', '67°', '90°']
const HORIZONTAL_OPTIONS = ['auto', '-90°', '-45°', '0°', '45°']
const FAN_OPTIONS = ['auto', '25%', '50%', '75%', '100%']

const modeLabels: Record<AcState['mode'], string> = {
  fan: 'Ventilación',
  cool: 'Frío',
  heat: 'Calor',
}

const state = ref<AcState>({
  isOn: true,
  mode: 'cool',
  temperature: 24,
  verticalSwing: 'auto',
  horizontalSwing: 'auto',
  fanSpeed: '50',
})

const savedState = ref<AcState | null>(null)
const loading = ref(true)
const saving = ref(false)
const saveError = ref('')
const currentModeLabel = computed(() => modeLabels[state.value.mode])
const currentModeIcon = computed(() => {
  if (state.value.mode === 'fan') return '≋'
  if (state.value.mode === 'heat') return '☼'
  return '❄'
})

const hasUnsavedChanges = computed(() => {
  if (!savedState.value) return false

  return (
    state.value.isOn !== savedState.value.isOn
    || state.value.mode !== savedState.value.mode
    || state.value.temperature !== savedState.value.temperature
    || state.value.verticalSwing !== savedState.value.verticalSwing
    || state.value.horizontalSwing !== savedState.value.horizontalSwing
    || state.value.fanSpeed !== savedState.value.fanSpeed
  )
})

function snapshotState(): AcState {
  return { ...state.value }
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
    if (raw.mode)             state.value.mode            = raw.mode as AcState['mode']
    if (raw.temperature)      state.value.temperature     = raw.temperature as number
    if (raw.verticalSwing)    state.value.verticalSwing   = raw.verticalSwing as string
    if (raw.horizontalSwing)  state.value.horizontalSwing = raw.horizontalSwing as string
    if (raw.fanSpeed)         state.value.fanSpeed        = raw.fanSpeed as string
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

function setState(patch: Partial<AcState>) {
  Object.assign(state.value, patch)
}

function changeTemp(delta: number) {
  const next = state.value.temperature + delta
  if (next >= TEMP_MIN && next <= TEMP_MAX) {
    setState({ temperature: next })
  }
}

function labelFor(option: string) {
  return option === 'auto' ? 'Auto' : option
}

function togglePower() {
  setState({ isOn: !state.value.isOn })
}

async function saveChanges() {
  saveError.value = ''
  saving.value = true

  try {
    localStorage.setItem(storageKey(), JSON.stringify(state.value))
    savedState.value = snapshotState()
  } catch {
    saveError.value = 'No se pudo guardar. Volvé a intentarlo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="ac-loading">Cargando...</div>

  <div v-else class="ac-shell">
    <section class="ac-card">
      <aside class="ac-summary" :class="{ 'ac-summary--off': !state.isOn }">
        <div class="ac-summary__header">
          <p class="ac-room">SALÓN</p>
          <h2 class="ac-title">Aire Acondicionado</h2>
        </div>

        <div class="ac-center">
          <div class="ac-summary__temp">
            <span class="ac-summary__temp-value">{{ state.temperature }}</span>
            <span class="ac-summary__temp-unit">°C</span>
          </div>

          <div class="ac-badge">
            <span class="ac-badge__icon">{{ currentModeIcon }}</span>
            <span>MODO {{ currentModeLabel.toUpperCase() }}</span>
          </div>
        </div>

        <button class="ac-power" type="button" @click="togglePower">
          <span class="ac-power__dot" :class="{ 'ac-power__dot--on': state.isOn }"></span>
          {{ state.isOn ? 'ENCENDIDO' : 'APAGADO' }}
        </button>
      </aside>

      <div class="ac-controls">
        <section class="ac-section">
          <p class="ac-label">Modo de operación</p>
          <div class="ac-pills ac-pills--modes">
            <button
              v-for="m in MODES" :key="m.value"
              class="ac-pill ac-pill--mode"
              :class="{ 'ac-pill--active': state.mode === m.value }"
              type="button"
              @click="setState({ mode: m.value })"
            >
              <span class="ac-pill__icon">{{ m.icon }}</span>
              <span>{{ m.label }}</span>
            </button>
          </div>
        </section>

        <section class="ac-section">
          <p class="ac-label">Ajuste de temperatura</p>
          <div class="ac-temp">
            <button class="ac-temp__btn" type="button" @click="changeTemp(-1)" :disabled="state.temperature <= TEMP_MIN">−</button>
            <div class="ac-temp__display">
              <span class="ac-temp__value">{{ state.temperature }}</span>
              <span class="ac-temp__unit">°C</span>
              <span class="ac-temp__range">{{ TEMP_MIN }}° - {{ TEMP_MAX }}°</span>
            </div>
            <button class="ac-temp__btn" type="button" @click="changeTemp(1)" :disabled="state.temperature >= TEMP_MAX">+</button>
          </div>
        </section>

        <section class="ac-section ac-section--split">
          <div class="ac-sub">
            <p class="ac-label">Aspas verticales</p>
            <div class="ac-pills ac-pills--small">
              <button
                v-for="v in VERTICAL_OPTIONS" :key="v"
                class="ac-pill ac-pill--sm"
                :class="{ 'ac-pill--active': state.verticalSwing === v }"
                type="button"
                @click="setState({ verticalSwing: v })"
              >{{ labelFor(v) }}</button>
            </div>
          </div>

          <div class="ac-sub">
            <p class="ac-label">Aspas horizontales</p>
            <div class="ac-pills ac-pills--small">
              <button
                v-for="h in HORIZONTAL_OPTIONS" :key="h"
                class="ac-pill ac-pill--sm"
                :class="{ 'ac-pill--active': state.horizontalSwing === h }"
                type="button"
                @click="setState({ horizontalSwing: h })"
              >{{ labelFor(h) }}</button>
            </div>
          </div>
        </section>

        <section class="ac-section">
          <p class="ac-label">Velocidad ventilador</p>
          <div class="ac-fan">
            <button
              v-for="f in FAN_OPTIONS" :key="f"
              class="ac-fan__option"
              :class="{ 'ac-fan__option--active': state.fanSpeed === f }"
              type="button"
              @click="setState({ fanSpeed: f })"
            >{{ f }}</button>
          </div>
        </section>

        <div class="ac-actions">
          <button class="ac-save" type="button" :disabled="saving" @click="saveChanges">
            <span class="ac-save__dot" :class="{ 'ac-save__dot--busy': saving }"></span>
            {{ saving ? 'GUARDANDO...' : hasUnsavedChanges ? 'GUARDAR CAMBIOS' : 'GUARDAR' }}
          </button>
          <p v-if="saveError" class="ac-save__error" role="alert">{{ saveError }}</p>
        </div>
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

.ac-summary {
  background: linear-gradient(180deg, #e7dcc0 0%, #e2d4b5 100%);
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: rgba(52, 47, 41, 0.88);
  gap: 7.4rem;
}

.ac-summary--off {
  opacity: 0.7;
}

.ac-room {
  font-size: 0.82rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(52, 47, 41, 0.42);
  margin-top: 0rem;
}
.ac-summary__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ac-title {
  margin-top: 0rem;
  font-size: 1.15rem;
  line-height: 1.1;
  font-weight: 600;
}

.ac-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.ac-summary__temp {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.ac-summary__temp-value {
  font-size: clamp(3rem, 6vw, 4.2rem);
  font-weight: 400;
  letter-spacing: -0.04em;
  line-height: 0.9;
}

.ac-summary__temp-unit {
  font-size: 1rem;
  line-height: 1;
  color: rgba(52, 47, 41, 0.8);
}

.ac-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.52);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ac-badge__icon {
  font-size: 0.95rem;
}

.ac-power {
  margin-top: 0.5rem;
  width: 100%;
  max-width: 170px;
  border: none;
  border-radius: 999px;
  padding: 0.85rem 1rem;
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.ac-power__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  position: relative;
}

.ac-power__dot::after {
  content: '';
  position: absolute;
  inset: 2px 3px 2px 3px;
  border-radius: inherit;
  background: transparent;
  transition: background 0.15s;
}

.ac-power__dot--on::after {
  background: currentColor;
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

.ac-sub:nth-child(2) {
  text-align: right;
}

.ac-label {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(52, 47, 41, 0.42);
}

.ac-pills {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.ac-pills--small {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 0.28fr));
  gap: 0.4rem;
  justify-content: start;
}

.ac-sub:nth-child(2) .ac-pills--small {
  justify-content: end;
}

.ac-pills--modes {
  flex-wrap: nowrap;
  background: rgba(128, 120, 103, 0.52);
  border-radius: 999px;
  padding: 0.28rem;
}

.ac-pill {
  border: none;
  border-radius: 999px;
  background: rgba(52, 47, 41, 0.09);
  color: rgba(52, 47, 41, 0.8);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

.ac-pill:hover {
  transform: translateY(-1px);
}

.ac-pill--mode {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.65rem 0.9rem;
  background: transparent;
  color: rgba(52, 47, 41, 0.95);
}

.ac-pill--active {
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  box-shadow: 0 8px 18px rgba(52, 47, 41, 0.18);
}

.ac-pill__icon {
  font-size: 0.95rem;
  line-height: 1;
}

.ac-pill--sm {
  width: auto;
  min-width: 0;
  padding: 0.45rem 0.5rem;
  font-size: 0.8rem;
}

.ac-temp {
  display: grid;
  grid-template-columns: 68px 1fr 68px;
  align-items: center;
  gap: 0.7rem;
  background: rgba(186, 186, 158, 0.62);
  border-radius: 22px;
  padding: 0.7rem 0.7rem;
}

.ac-temp__btn {
  width: 42px;
  height: 42px;
  justify-self: center;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.88);
  color: rgba(52, 47, 41, 0.9);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.ac-temp__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ac-temp__display {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  flex-wrap: wrap;
  line-height: 1;
}

.ac-temp__value {
  font-size: 2.5rem;
  font-weight: 600;
  letter-spacing: -0.06em;
  color: rgba(52, 47, 41, 0.92);
}

.ac-temp__unit {
  margin-top: 0;
  font-size: 0.8rem;
  color: rgba(52, 47, 41, 0.72);
}

.ac-temp__range {
  margin-top: 0.25rem;
  flex-basis: 100%;
  text-align: center;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: rgba(52, 47, 41, 0.42);
}

.ac-fan {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.45rem;
  background: rgba(128, 120, 103, 0.52);
  border-radius: 999px;
  padding: 0.28rem;
}

.ac-fan__option {
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(52, 47, 41, 0.95);
  padding: 0.65rem 0.9rem;
  font-family: var(--font-sans);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.ac-fan__option--active {
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  box-shadow: 0 8px 18px rgba(52, 47, 41, 0.18);
}

.ac-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.1rem;
}

.ac-save {
  border: none;
  border-radius: 999px;
  padding: 0.78rem 1.25rem;
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.ac-save:hover:not(:disabled) {
  transform: translateY(-1px);
}

.ac-save:disabled {
  opacity: 0.72;
  cursor: wait;
}

.ac-save__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  position: relative;
}

.ac-save__dot::after {
  content: '';
  position: absolute;
  inset: 2px 3px;
  border-radius: inherit;
  background: transparent;
}

.ac-save__dot--busy::after {
  background: currentColor;
}

.ac-save__error {
  margin: 0;
  font-size: 0.78rem;
  color: #8a2d2d;
  text-align: center;
}

@media (max-width: 900px) {
  .ac-card {
    grid-template-columns: 1fr;
  }

  .ac-summary {
    padding-bottom: 2.2rem;
  }

  .ac-controls {
    padding: 1.5rem;
  }
}

@media (max-width: 640px) {
  .ac-section--split {
    grid-template-columns: 1fr;
  }

  .ac-temp {
    grid-template-columns: 50px 1fr 50px;
    padding: 1rem;
  }

  .ac-fan {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-radius: 24px;
  }
}
</style>

