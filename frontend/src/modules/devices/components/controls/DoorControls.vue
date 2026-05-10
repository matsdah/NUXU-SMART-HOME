<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api, ApiError } from '@/services/api/client'
import { useDashboardStore } from '@/app/stores/dashboard'
import ControlSidebar from '../shared/ControlSidebar.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import { useToast } from '@/shared/composables/useToast'
import '@/shared/styles/control-panel.css'
import { persistClose, cancelClose, getRemainingMs } from './doorCloseTracker'

const props = defineProps<{ deviceId: string; deviceName?: string }>()
const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()

type DoorStatus = 'open' | 'closed'
type LockStatus = 'locked' | 'unlocked'
type DoorState = { status: DoorStatus; lock: LockStatus }

const AUTO_CLOSE_SECONDS = 10

const ACCESS_OPTIONS: PillOption[] = [
  { value: 'closed', label: 'Cerrar' },
  { value: 'open',   label: 'Abrir'  },
]

const LOCK_OPTIONS: PillOption[] = [
  { value: 'unlocked', label: 'Desbloquear' },
  { value: 'locked',   label: 'Bloquear'    },
]

const state = ref<DoorState>({ status: 'closed', lock: 'unlocked' })
const loading = ref(true)
const actionPending = ref(false)
const autoCloseSecondsLeft = ref(0)

const { showToast } = useToast()
const store = useDashboardStore()

let autoCloseTimer: ReturnType<typeof setTimeout> | null = null
let initialDelayTimer: ReturnType<typeof setTimeout> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null
let componentActive = true
let autoCloseFired = false

const accessDisabled = computed(() => state.value.lock === 'locked' || actionPending.value)
const lockDisabled = computed(() => state.value.status === 'open' || actionPending.value)

async function executeAutoClose() {
  autoCloseFired = true
  autoCloseTimer = null
  cancelClose(props.deviceId)
  if (countdownInterval !== null) { clearInterval(countdownInterval); countdownInterval = null }
  try {
    await api.patch(`/devices/${props.deviceId}/close`, {})
    // Sync store so the page card updates even if the popup is closed
    const dev = store.devices.find(d => d.id === props.deviceId)
    if (dev) {
      dev.isOn = false
      dev.tone = 'neutral'
      dev.status = 'Cerrado'
    }
    if (componentActive) {
      const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
      if (raw.status === 'open' || raw.status === 'closed') state.value.status = raw.status
      if (raw.lock === 'locked' || raw.lock === 'unlocked') state.value.lock = raw.lock
      emit('powerToggled', false)
      showToast('Puerta cerrada automáticamente', 'success')
    }
  } catch {
    // Se mantiene cerrada visualmente aunque falle la API
  }
}

function clearAutoClose() {
  if (initialDelayTimer !== null) { clearTimeout(initialDelayTimer); initialDelayTimer = null }
  if (autoCloseTimer !== null) { clearTimeout(autoCloseTimer); autoCloseTimer = null }
  if (countdownInterval !== null) { clearInterval(countdownInterval); countdownInterval = null }
  autoCloseSecondsLeft.value = 0
  cancelClose(props.deviceId)
}

function startAutoClose() {
  clearAutoClose()
  autoCloseSecondsLeft.value = AUTO_CLOSE_SECONDS

  countdownInterval = setInterval(() => {
    autoCloseSecondsLeft.value -= 1
    if (autoCloseSecondsLeft.value <= 0) {
      if (countdownInterval !== null) { clearInterval(countdownInterval); countdownInterval = null }
    }
  }, 1000)

  const delayMs = AUTO_CLOSE_SECONDS * 1000
  const timer = setTimeout(executeAutoClose, delayMs)
  autoCloseTimer = timer
  persistClose(props.deviceId, Date.now() + delayMs, timer)
}

onMounted(async () => {
  // Restore pending auto-close if re-entering before the timer fires
  const remainingMs = getRemainingMs(props.deviceId)
  if (remainingMs > 0) {
    // Optimistic: we know the door is open if an auto-close is scheduled
    state.value.status = 'open'

    const displaySeconds = Math.ceil(remainingMs / 1000)
    autoCloseSecondsLeft.value = displaySeconds
    cancelClose(props.deviceId)
    const timer = setTimeout(executeAutoClose, remainingMs)
    autoCloseTimer = timer
    persistClose(props.deviceId, Date.now() + remainingMs, timer)

    // Precise countdown: first tick accounts for the fractional ms
    const firstTickDelay = remainingMs % 1000 || 1000
    let tick = displaySeconds
    initialDelayTimer = setTimeout(() => {
      initialDelayTimer = null
      tick -= 1
      autoCloseSecondsLeft.value = tick
      countdownInterval = setInterval(() => {
        tick -= 1
        autoCloseSecondsLeft.value = tick
        if (tick <= 0 && countdownInterval !== null) {
          clearInterval(countdownInterval)
          countdownInterval = null
        }
      }, 1000)
    }, firstTickDelay)
  }

  try {
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    if (!autoCloseFired) {
      const backendStatus = raw.status as string | undefined
      if (backendStatus === 'closed' && remainingMs > 0) {
        cancelClose(props.deviceId)
        clearAutoClose()
      }
      if (backendStatus === 'open' || backendStatus === 'closed') state.value.status = backendStatus
      if (raw.lock === 'locked' || raw.lock === 'unlocked') state.value.lock = raw.lock
    }
  } catch {
    // Se usan valores por defecto
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  componentActive = false
  if (initialDelayTimer !== null) clearTimeout(initialDelayTimer)
  if (countdownInterval !== null) clearInterval(countdownInterval)
  // autoCloseTimer stays alive via persistClose — door closes on backend
})

async function performAction(action: 'open' | 'close' | 'lock' | 'unlock') {
  if (actionPending.value) return
  actionPending.value = true
  const previous = { ...state.value }
  if (action === 'open') state.value.status = 'open'
  else if (action === 'close') state.value.status = 'closed'
  else if (action === 'lock') state.value.lock = 'locked'
  else if (action === 'unlock') state.value.lock = 'unlocked'
  try {
    await api.patch(`/devices/${props.deviceId}/${action}`, {})
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    if (raw.status === 'open' || raw.status === 'closed') state.value.status = raw.status
    if (raw.lock === 'locked' || raw.lock === 'unlocked') state.value.lock = raw.lock
    emit('powerToggled', state.value.status === 'open' || state.value.lock === 'unlocked')

    if (action === 'open') {
      showToast('Puerta abierta', 'success')
      startAutoClose()
    } else if (action === 'close') {
      clearAutoClose()
      showToast('Puerta cerrada', 'success')
    } else {
      showToast(action === 'lock' ? 'Puerta bloqueada' : 'Puerta desbloqueada', 'success')
    }
  } catch (e) {
    state.value = previous
    if (action === 'open') clearAutoClose()
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
    } else {
      showToast('Error inesperado. Intentá de nuevo.', 'error')
    }
  } finally {
    actionPending.value = false
  }
}

function onAccessChange(value: string) {
  if (value === state.value.status) return
  if (value === 'close' || value === 'closed') clearAutoClose()
  performAction(value === 'open' ? 'open' : 'close')
}

function onLockChange(value: string) {
  if (value === state.value.lock) return
  performAction(value === 'locked' ? 'lock' : 'unlock')
}
</script>

<template>
  <div v-if="loading" class="cp-loading">Cargando...</div>

  <div v-else class="cp-shell">
    <section class="cp-card">
      <ControlSidebar
        :title="props.deviceName || 'Puerta'"
        room-label="HABITACIÓN"
        :temperature="0"
        :show-temperature="false"
        :is-on="state.status === 'open' || state.lock === 'unlocked'"
        :show-power-button="false"
      >
        <template #center>
          <div class="door-badges">
            <div class="door-badge">
              {{ state.status === 'open' ? 'Abierta' : 'Cerrada' }}
            </div>
            <div class="door-badge">
              {{ state.lock === 'locked' ? 'Bloqueada' : 'Desbloqueada' }}
            </div>
          </div>
        </template>
      </ControlSidebar>

      <div class="cp-controls">
        <section class="cp-section">
          <p class="cp-label">Acceso</p>
          <div :class="{ 'cp-controls--disabled': accessDisabled }">
            <PillButtons
              :model-value="state.status"
              :options="ACCESS_OPTIONS"
              appearance="container"
              @update:model-value="onAccessChange"
            />
          </div>

          <div v-if="autoCloseSecondsLeft > 0" class="door-autoclose">
            <div class="door-autoclose__bar">
              <!-- [html-validate-disable-next no-inline-style: progress bar width is a runtime-computed percentage] -->
              <div
                class="door-autoclose__progress"
                :style="{ width: `${(autoCloseSecondsLeft / AUTO_CLOSE_SECONDS) * 100}%` }"
              />
            </div>
            <p class="door-autoclose__text">
              La puerta se cerrará automáticamente en <strong>{{ autoCloseSecondsLeft }}s</strong>
            </p>
          </div>
        </section>

        <section class="cp-section">
          <p class="cp-label">Seguridad</p>
          <div :class="{ 'cp-controls--disabled': lockDisabled }">
            <PillButtons
              :model-value="state.lock"
              :options="LOCK_OPTIONS"
              appearance="container"
              @update:model-value="onLockChange"
            />
          </div>
        </section>

      </div>
    </section>
  </div>
</template>

<style scoped>
.door-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.door-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.52);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(52, 47, 41, 0.88);
}

.door-autoclose {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.25rem;
}

.door-autoclose__bar {
  height: 4px;
  border-radius: 999px;
  background: rgba(52, 47, 41, 0.12);
  overflow: hidden;
}

.door-autoclose__progress {
  height: 100%;
  border-radius: 999px;
  background: rgba(52, 47, 41, 0.55);
  transition: width 1s linear;
}

.door-autoclose__text {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(52, 47, 41, 0.55);
}

.door-autoclose__text strong {
  color: rgba(52, 47, 41, 0.8);
}
</style>
