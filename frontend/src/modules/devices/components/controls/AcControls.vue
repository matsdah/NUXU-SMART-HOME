<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/services/api/client'

const props = defineProps<{ deviceId: string }>()

type AcState = {
  mode: 'fan' | 'cool' | 'heat'
  temperature: number
  verticalSwing: string
  horizontalSwing: string
  fanSpeed: string
}

const TEMP_MIN = 18
const TEMP_MAX = 38

const VERTICAL_OPTIONS   = ['auto', '22', '45', '67', '90']
const HORIZONTAL_OPTIONS = ['auto', '-90', '-45', '0', '45']
const FAN_OPTIONS        = ['auto', '25', '50', '75', '100']

const state = ref<AcState>({
  mode: 'cool',
  temperature: 24,
  verticalSwing: 'auto',
  horizontalSwing: 'auto',
  fanSpeed: '50',
})

const loading = ref(true)

onMounted(async () => {
  try {
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    if (raw.mode)             state.value.mode            = raw.mode as AcState['mode']
    if (raw.temperature)      state.value.temperature     = raw.temperature as number
    if (raw.verticalSwing)    state.value.verticalSwing   = raw.verticalSwing as string
    if (raw.horizontalSwing)  state.value.horizontalSwing = raw.horizontalSwing as string
    if (raw.fanSpeed)         state.value.fanSpeed        = raw.fanSpeed as string
  } catch {
    // Si falla, se usan los valores por defecto
  } finally {
    loading.value = false
  }
})

async function setState(patch: Partial<AcState>) {
  Object.assign(state.value, patch)
  try {
    await api.put(`/devices/${props.deviceId}/state`, state.value)
  } catch {
    // Los controles muestran el estado optimista; si falla el backend se ignora silenciosamente
  }
}

function changeTemp(delta: number) {
  const next = state.value.temperature + delta
  if (next >= TEMP_MIN && next <= TEMP_MAX) {
    setState({ temperature: next })
  }
}

function labelFor(option: string, unit = '') {
  return option === 'auto' ? 'Auto' : `${option}${unit}`
}
</script>

<template>
  <div v-if="loading" class="ac-loading">Cargando...</div>

  <div v-else class="ac">

    <!-- Modo de operación -->
    <section class="ac-section">
      <p class="ac-label">Modo de operación</p>
      <div class="ac-pills">
        <button
          v-for="m in (['fan', 'cool', 'heat'] as const)" :key="m"
          class="ac-pill" :class="{ 'ac-pill--active': state.mode === m }"
          @click="setState({ mode: m })"
        >
          <span v-if="m === 'fan'">💨 Ventilación</span>
          <span v-else-if="m === 'cool'">❄️ Frío</span>
          <span v-else>☀️ Calor</span>
        </button>
      </div>
    </section>

    <!-- Temperatura -->
    <section class="ac-section">
      <p class="ac-label">Ajuste de temperatura</p>
      <div class="ac-temp">
        <button class="ac-temp__btn" @click="changeTemp(-1)" :disabled="state.temperature <= TEMP_MIN">−</button>
        <div class="ac-temp__display">
          <span class="ac-temp__value">{{ state.temperature }}</span>
          <span class="ac-temp__unit">°C</span>
          <span class="ac-temp__range">{{ TEMP_MIN }}° – {{ TEMP_MAX }}°</span>
        </div>
        <button class="ac-temp__btn" @click="changeTemp(1)" :disabled="state.temperature >= TEMP_MAX">+</button>
      </div>
    </section>

    <!-- Aspas verticales -->
    <section class="ac-section ac-section--row">
      <div class="ac-sub">
        <p class="ac-label">Aspas verticales</p>
        <div class="ac-pills ac-pills--small">
          <button
            v-for="v in VERTICAL_OPTIONS" :key="v"
            class="ac-pill ac-pill--sm" :class="{ 'ac-pill--active': state.verticalSwing === v }"
            @click="setState({ verticalSwing: v })"
          >{{ labelFor(v, '°') }}</button>
        </div>
      </div>

      <div class="ac-sub">
        <p class="ac-label">Aspas horizontales</p>
        <div class="ac-pills ac-pills--small">
          <button
            v-for="h in HORIZONTAL_OPTIONS" :key="h"
            class="ac-pill ac-pill--sm" :class="{ 'ac-pill--active': state.horizontalSwing === h }"
            @click="setState({ horizontalSwing: h })"
          >{{ labelFor(h, '°') }}</button>
        </div>
      </div>
    </section>

    <!-- Velocidad ventilador -->
    <section class="ac-section">
      <p class="ac-label">Velocidad ventilador</p>
      <div class="ac-pills">
        <button
          v-for="f in FAN_OPTIONS" :key="f"
          class="ac-pill" :class="{ 'ac-pill--active': state.fanSpeed === f }"
          @click="setState({ fanSpeed: f })"
        >{{ labelFor(f, '%') }}</button>
      </div>
    </section>

  </div>
</template>

<style scoped>
.ac-loading {
  padding: 2rem;
  color: rgba(42, 40, 37, 0.5);
  font-size: 0.9rem;
}

.ac {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-top: 0.5rem;
}

.ac-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.ac-section--row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.ac-sub {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ac-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(42, 40, 37, 0.45);
}

/* Grupo de pills */
.ac-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ac-pill {
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: none;
  background: rgba(42, 40, 37, 0.07);
  color: rgba(42, 40, 37, 0.75);
  font-size: 0.85rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.ac-pill:hover {
  background: rgba(42, 40, 37, 0.13);
}

.ac-pill--active {
  background: rgba(42, 40, 37, 0.88);
  color: #fff;
}

.ac-pill--sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.78rem;
}

/* Control de temperatura */
.ac-temp {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(190, 190, 166, 0.3);
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
}

.ac-temp__btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.85);
  font-size: 1.4rem;
  font-weight: 300;
  cursor: pointer;
  display: grid;
  place-items: center;
  color: rgba(42, 40, 37, 0.8);
  transition: background 0.15s;
  flex-shrink: 0;
}

.ac-temp__btn:hover:not(:disabled) {
  background: #fff;
}

.ac-temp__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ac-temp__display {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ac-temp__value {
  font-size: 2.8rem;
  font-weight: 300;
  line-height: 1;
  color: var(--color-text);
}

.ac-temp__unit {
  font-size: 0.9rem;
  color: rgba(42, 40, 37, 0.5);
}

.ac-temp__range {
  font-size: 0.7rem;
  color: rgba(42, 40, 37, 0.4);
  margin-top: 0.2rem;
}
</style>
