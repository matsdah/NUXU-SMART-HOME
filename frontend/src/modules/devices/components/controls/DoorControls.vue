<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api, ApiError } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'

const props = defineProps<{ deviceId: string; deviceName?: string }>()

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
const error = ref('')
const toastMessage = ref('')
const showToast = ref(false)
const autoCloseSecondsLeft = ref(0)

let toastTimer: ReturnType<typeof setTimeout> | null = null
let autoCloseInterval: ReturnType<typeof setInterval> | null = null

const accessDisabled = computed(() => state.value.lock === 'locked' || actionPending.value)
const lockDisabled = computed(() => state.value.status === 'open' || actionPending.value)

function clearAutoClose() {
  if (autoCloseInterval !== null) { clearInterval(autoCloseInterval); autoCloseInterval = null }
  autoCloseSecondsLeft.value = 0
}

function startAutoClose() {
  clearAutoClose()
  autoCloseSecondsLeft.value = AUTO_CLOSE_SECONDS
  autoCloseInterval = setInterval(async () => {
    autoCloseSecondsLeft.value -= 1
    if (autoCloseSecondsLeft.value > 0) return
    clearAutoClose()
    state.value.status = 'closed'
    try {
      await api.patch(`/devices/${props.deviceId}/close`, {})
      const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
      if (raw.status === 'open' || raw.status === 'closed') state.value.status = raw.status
      if (raw.lock === 'locked' || raw.lock === 'unlocked') state.value.lock = raw.lock
    } catch {
      // Se mantiene cerrada visualmente aunque falle la API
    }
    showSuccessToast('Puerta cerrada automáticamente')
  }, 1000)
}

onMounted(async () => {
  try {
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    if (raw.status === 'open' || raw.status === 'closed') state.value.status = raw.status
    if (raw.lock === 'locked' || raw.lock === 'unlocked') state.value.lock = raw.lock
  } catch {
    // Se usan valores por defecto
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
  clearAutoClose()
})

async function performAction(action: 'open' | 'close' | 'lock' | 'unlock') {
  if (actionPending.value) return
  error.value = ''
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

    if (action === 'open') {
      showSuccessToast('Puerta abierta')
      startAutoClose()
    } else if (action === 'close') {
      clearAutoClose()
      showSuccessToast('Puerta cerrada')
    } else {
      showSuccessToast(action === 'lock' ? 'Puerta bloqueada' : 'Puerta desbloqueada')
    }
  } catch (e) {
    state.value = previous
    if (action === 'open') clearAutoClose()
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      error.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
    } else {
      error.value = 'Error inesperado. Intentá de nuevo.'
    }
  } finally {
    actionPending.value = false
  }
}

function showSuccessToast(msg: string) {
  toastMessage.value = msg
  showToast.value = true
  if (toastTimer !== null) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { showToast.value = false; toastTimer = null }, 2000)
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
  <div v-if="loading" class="door-loading">Cargando...</div>

  <div v-else class="door-shell">
    <section class="door-card">
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

      <div class="door-controls">
        <section class="door-section">
          <p class="door-label">Acceso</p>
          <div :class="{ 'door-pills--disabled': accessDisabled }">
            <PillButtons
              :model-value="state.status"
              :options="ACCESS_OPTIONS"
              appearance="container"
              @update:model-value="onAccessChange"
            />
          </div>

          <div v-if="autoCloseSecondsLeft > 0" class="door-autoclose">
            <div class="door-autoclose__bar">
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

        <section class="door-section">
          <p class="door-label">Seguridad</p>
          <div :class="{ 'door-pills--disabled': lockDisabled }">
            <PillButtons
              :model-value="state.lock"
              :options="LOCK_OPTIONS"
              appearance="container"
              @update:model-value="onLockChange"
            />
          </div>
        </section>

        <div v-if="error" class="door-error" role="alert">{{ error }}</div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="showToast" class="toast toast--success">{{ toastMessage }}</div>
    </Teleport>
  </div>
</template>

<style scoped>
.door-loading {
  padding: 2rem;
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.9rem;
}

.door-shell { width: 100%; }

.door-card {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  border-radius: 28px;
  overflow: hidden;
  background: #f7f5f0;
  box-shadow: 0 28px 70px rgba(42, 40, 37, 0.16);
}

.door-controls {
  padding: 2.6rem 2.2rem 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.door-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.door-label {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(52, 47, 41, 0.42);
}

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

.door-pills--disabled {
  opacity: 0.4;
  pointer-events: none;
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

.door-error {
  padding: 0.6rem 0.9rem;
  background: rgba(180, 60, 60, 0.1);
  border: 1px solid rgba(180, 60, 60, 0.3);
  border-radius: 12px;
  color: #a03030;
  font-size: 0.85rem;
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
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (max-width: 900px) {
  .door-card { grid-template-columns: 1fr; }
  .door-controls { padding: 1.5rem; }
}
</style>
