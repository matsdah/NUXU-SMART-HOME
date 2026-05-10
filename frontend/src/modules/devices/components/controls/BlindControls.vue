<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api, ApiError } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import TemperatureControl from '../shared/TemperatureControl.vue'
import { useToast } from '@/shared/composables/useToast'

const props = defineProps<{ deviceId: string; deviceName?: string }>()
const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()

type BlindStatus = 'opened' | 'closed' | 'opening' | 'closing'

const STATUS_LABELS: Record<BlindStatus, string> = {
  opened:  'Abierta',
  closed:  'Cerrada',
  opening: 'Abriéndose',
  closing: 'Cerrándose',
}

const ACTION_OPTIONS: PillOption[] = [
  { value: 'open',  label: 'Abrir'  },
  { value: 'close', label: 'Cerrar' },
]

const status       = ref<BlindStatus>('closed')
const level        = ref(0)
const displayLevel = ref(0)
const loading      = ref(true)
const actionPending = ref(false)

const { showToast } = useToast()

const isMoving   = computed(() => status.value === 'opening' || status.value === 'closing')
const isOpen     = computed(() => status.value === 'opened' || status.value === 'opening')
const pillValue  = computed(() => isOpen.value ? 'open' : 'close')

function parseStatus(s: unknown): BlindStatus {
  if (s === 'opened' || s === 'open') return 'opened'
  if (s === 'opening') return 'opening'
  if (s === 'closing') return 'closing'
  return 'closed'
}

async function fetchState() {
  const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
  status.value = parseStatus(raw.status)
  const rawLevel = Number(raw.level ?? raw.currentLevel ?? raw.position ?? 0)
  level.value = rawLevel
  displayLevel.value = rawLevel
}

onMounted(async () => {
  try { await fetchState() } catch { /* se usan valores por defecto */ }
  finally { loading.value = false }
})

async function setLevel(newLevel: number, toastMsg?: string) {
  if (actionPending.value) return
  actionPending.value = true
  const prevStatus = status.value
  const prevLevel  = level.value
  level.value = newLevel
  displayLevel.value = newLevel
  try {
    await api.patch(`/devices/${props.deviceId}/setLevel`, { level: newLevel })
    await fetchState()
    emit('powerToggled', status.value === 'opened' || status.value === 'opening')
    showToast(toastMsg ?? `Posición: ${newLevel}%`, 'success')
  } catch (e) {
    status.value  = prevStatus
    level.value   = prevLevel
    displayLevel.value = prevLevel
    handleError(e)
  } finally {
    actionPending.value = false
  }
}

async function performAction(action: 'open' | 'close') {
  await setLevel(
    action === 'open' ? 100 : 0,
    action === 'open' ? 'Persiana abierta' : 'Persiana cerrada',
  )
}

function handleError(e: unknown) {
  if (e instanceof ApiError) {
    const msg = (e.body as { error?: { description?: string } })?.error?.description
    showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
  } else {
    showToast('Error inesperado. Intentá de nuevo.', 'error')
  }
}

function onActionChange(value: string) {
  if (actionPending.value) return
  performAction(value as 'open' | 'close')
}

function onLevelChange(val: number) {
  displayLevel.value = val
  setLevel(val)
}
</script>

<template>
  <div v-if="loading" class="blind-loading">Cargando...</div>

  <div v-else class="blind-shell">
    <section class="blind-card">
      <ControlSidebar
        :title="props.deviceName || 'Persiana'"
        room-label="AMBIENTE"
        :temperature="0"
        :show-temperature="false"
        :is-on="isOpen"
        :show-power-button="false"
      >
        <template #center>
          <div class="blind-sidebar-center">
            <div class="blind-level-display">
              <span class="blind-level-value">{{ displayLevel }}</span>
              <span class="blind-level-unit">%</span>
            </div>
            <div class="blind-badge" :class="`blind-badge--${status}`">
              {{ STATUS_LABELS[status] }}
            </div>
          </div>
        </template>
      </ControlSidebar>

      <div class="blind-controls">

        <section class="blind-section">
          <p class="blind-label">Posición</p>
          <div :class="{ 'blind-pills--disabled': actionPending }">
            <TemperatureControl
              :model-value="displayLevel"
              :min="0"
              :max="100"
              unit="%"
              :step="5"
              label="posición"
              @update:model-value="onLevelChange"
            />
          </div>
        </section>

        <section class="blind-section">
          <p class="blind-label">Control</p>
          <div :class="{ 'blind-pills--disabled': actionPending }">
            <PillButtons
              :model-value="pillValue"
              :options="ACTION_OPTIONS"
              appearance="container"
              @update:model-value="(v: string) => onActionChange(v)"
            />
          </div>
          <p v-if="isMoving" class="blind-hint blind-hint--moving">
            {{ STATUS_LABELS[status] }}...
          </p>
        </section>

      </div>
    </section>
  </div>
</template>

<style scoped>
.blind-loading {
  padding: 2rem;
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.9rem;
}

.blind-shell { width: 100%; }

.blind-card {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  border-radius: 28px;
  overflow: hidden;
  background: #f7f5f0;
  box-shadow: 0 28px 70px rgba(42, 40, 37, 0.16);
}

.blind-controls {
  padding: 2.6rem 2.2rem 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.blind-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.blind-label {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(52, 47, 41, 0.42);
}

.blind-hint {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(52, 47, 41, 0.45);
}

.blind-hint--moving {
  color: rgba(52, 47, 41, 0.65);
  font-style: italic;
}

.blind-sidebar-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.blind-level-display {
  display: inline-flex;
  align-items: baseline;
  gap: 0.15rem;
}

.blind-level-value {
  font-size: clamp(3rem, 6vw, 4.2rem);
  font-weight: 400;
  letter-spacing: -0.04em;
  line-height: 0.9;
  color: rgba(52, 47, 41, 0.88);
}

.blind-level-unit {
  font-size: 1rem;
  color: rgba(52, 47, 41, 0.6);
}

.blind-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.52);
  color: rgba(52, 47, 41, 0.7);
}

.blind-badge--opened {
  background: rgba(45, 106, 79, 0.15);
  color: #1f5c43;
}

.blind-badge--closed {
  background: rgba(52, 47, 41, 0.1);
  color: rgba(52, 47, 41, 0.6);
}

.blind-badge--opening,
.blind-badge--closing {
  background: rgba(180, 140, 40, 0.15);
  color: #7a5c10;
}


.blind-pills--disabled {
  opacity: 0.4;
  pointer-events: none;
}

@media (max-width: 900px) {
  .blind-card { grid-template-columns: 1fr; }
  .blind-controls { padding: 1.5rem; }
}
</style>
