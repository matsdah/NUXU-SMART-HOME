<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { api } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import TemperatureControl from '../shared/TemperatureControl.vue'

const props = defineProps<{ deviceId: string; deviceName?: string; initialIsOn?: boolean }>()

const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()

type LampState = {
  isOn: boolean
  brightness: number
  color: string
}

const BRIGHTNESS_MIN = 0
const BRIGHTNESS_MAX = 100
const BRIGHTNESS_STEP = 5
const STORAGE_KEY_PREFIX = 'lamp-controls-state:'

const PRESET_COLORS = [
  { label: 'Blanco cálido', value: '#FFD580' },
  { label: 'Blanco frío', value: '#E8F4FF' },
  { label: 'Rojo', value: '#FF4D4D' },
  { label: 'Verde', value: '#4DFF91' },
  { label: 'Azul', value: '#4D9FFF' },
  { label: 'Violeta', value: '#A64DFF' },
]

const state = ref<LampState>({
  isOn: props.initialIsOn ?? true,
  brightness: 80,
  color: '#FFD580',
})

const loading = ref(true)
const saving = ref(false)
const saveError = ref('')
const toastMessage = ref('')
const showToast = ref(false)
const savedState = ref<LampState | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | null = null

function snapshotState(): LampState {
  return { ...state.value }
}

function storageKey() {
  return `${STORAGE_KEY_PREFIX}${props.deviceId}`
}

function readPersistedState(): Partial<LampState> | null {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LampState>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function applyStatePatch(patch: Partial<LampState>) {
  if (typeof patch.isOn === 'boolean') state.value.isOn = patch.isOn
  if (typeof patch.brightness === 'number') state.value.brightness = patch.brightness
  if (typeof patch.color === 'string') state.value.color = patch.color
}

function hasUnsavedChanges(): boolean {
  if (!savedState.value) return false
  return JSON.stringify(state.value) !== JSON.stringify(savedState.value)
}

onMounted(async () => {
  try {
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    if (typeof raw.on === 'boolean') state.value.isOn = raw.on
    if (typeof raw.brightness === 'number') state.value.brightness = raw.brightness
    if (typeof raw.color === 'string') state.value.color = raw.color
  } catch {
    // Se usan valores por defecto
  } finally {
    const persisted = readPersistedState()
    if (persisted) applyStatePatch(persisted)
    savedState.value = snapshotState()
    loading.value = false
  }
})

watch(state, async () => {
  if (loading.value || !hasUnsavedChanges()) return
  await saveChanges()
}, { deep: true })

onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
})

function togglePower() {
  state.value.isOn = !state.value.isOn
  emit('powerToggled', state.value.isOn)
}

function hslToHex(h: number): string {
  const s = 1, l = 0.5
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return Math.round(h * 360)
}

const currentHue = computed(() => hexToHue(state.value.color))

function setHue(hue: number) {
  state.value.color = hslToHex(hue)
}

function selectColor(color: string) {
  state.value.color = color
}

async function saveChanges() {
  if (saving.value) return
  saveError.value = ''
  saving.value = true
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state.value))
    savedState.value = snapshotState()
    toastMessage.value = 'Datos guardados correctamente.'
    showToast.value = true
    if (toastTimer !== null) clearTimeout(toastTimer)
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
  <div v-if="loading" class="lamp-loading">Cargando...</div>

  <div v-else class="lamp-shell">
    <section class="lamp-card">
      <ControlSidebar
        :title="props.deviceName || 'Luz'"
        room-label="HABITACIÓN"
        :temperature="state.brightness"
        :is-on="state.isOn"
        unit="%"
        :badge-label="`${state.brightness}% INTENSIDAD`"
        @toggle-power="togglePower"
      />

      <div class="lamp-controls">
        <section class="lamp-section">
          <p class="lamp-label">Intensidad</p>
          <TemperatureControl
            v-model="state.brightness"
            :min="BRIGHTNESS_MIN"
            :max="BRIGHTNESS_MAX"
            :step="BRIGHTNESS_STEP"
            unit="%"
            label="brillo"
          />
        </section>

        <section class="lamp-section">
          <p class="lamp-label">Color</p>
          <div class="color-picker">
            <!-- [html-validate-disable-next no-inline-style: color is a runtime hex value that cannot be expressed as a CSS class] -->
            <button
              v-for="preset in PRESET_COLORS"
              :key="preset.value"
              class="color-swatch"
              :class="{ 'color-swatch--active': state.color === preset.value }"
              :style="{ background: preset.value }"
              :aria-label="preset.label"
              type="button"
              @click="selectColor(preset.value)"
            />
            <label class="color-swatch color-swatch--custom" title="Color personalizado">
              <span class="color-swatch__custom-icon">+</span>
              <input
                type="color"
                :value="state.color"
                class="color-swatch__input"
                @input="(e) => selectColor((e.target as HTMLInputElement).value)"
              />
            </label>
          </div>
          <div class="hue-slider-wrap">
            <input
              class="hue-slider"
              type="range"
              min="0"
              max="360"
              :value="currentHue"
              @input="(e) => setHue(Number((e.target as HTMLInputElement).value))"
            />
          </div>

          <!-- [html-validate-disable-next no-inline-style: color is a runtime hex value that cannot be expressed as a CSS class] -->
          <div class="color-preview" :style="{ background: state.color }">
            <span class="color-preview__hex">{{ state.color }}</span>
          </div>
        </section>

        <div class="lamp-actions">
          <p v-if="saveError" class="lamp-save__error" role="alert">{{ saveError }}</p>
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
.lamp-loading {
  padding: 2rem;
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.9rem;
}

.lamp-shell {
  width: 100%;
}

.lamp-card {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  border-radius: 28px;
  overflow: hidden;
  background: #f7f5f0;
  box-shadow: 0 28px 70px rgba(42, 40, 37, 0.16);
}

.lamp-controls {
  padding: 2.6rem 2.2rem 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.lamp-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.lamp-label {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: #6B6860;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  justify-content: center;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2.5px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
  box-shadow: 0 0 0 1.5px rgba(42, 40, 37, 0.18);
}

.color-swatch:hover {
  transform: scale(1.12);
}

.color-swatch--active {
  border-color: rgba(52, 47, 41, 0.7);
  box-shadow: 0 0 0 2px rgba(52, 47, 41, 0.15);
}

.color-swatch--custom {
  background: rgba(186, 186, 158, 0.5);
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
}

.color-swatch__custom-icon {
  font-size: 1.2rem;
  color: rgba(52, 47, 41, 0.6);
  pointer-events: none;
}

.color-swatch__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.hue-slider-wrap {
  padding: 0.4rem 0;
}

.hue-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 28px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
    hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
    hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
    hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
    hsl(360,100%,50%)
  );
  outline: none;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.hue-slider::-webkit-slider-runnable-track {
  height: 28px;
  border-radius: 999px;
}

.hue-slider::-moz-range-track {
  height: 28px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
    hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
    hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
    hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
    hsl(360,100%,50%)
  );
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.hue-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(255,255,255,0.9);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  cursor: pointer;
  transition: transform 0.15s;
  margin-top: -1px;
}

.hue-slider::-moz-range-thumb {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(255,255,255,0.9);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  cursor: pointer;
}

.hue-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.color-preview {
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.color-preview__hex {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6B6860;
  mix-blend-mode: multiply;
  text-transform: uppercase;
}

.lamp-actions {
  margin-top: 0.5rem;
}

.lamp-save__error {
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
  .lamp-card {
    grid-template-columns: 1fr;
  }

  .lamp-controls {
    padding: 1.5rem;
  }
}
</style>
