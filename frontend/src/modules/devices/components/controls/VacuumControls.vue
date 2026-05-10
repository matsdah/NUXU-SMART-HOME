<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api, ApiError } from '@/services/api/client'
import { useDashboardStore } from '@/app/stores/dashboard'
import ControlSidebar from '../shared/ControlSidebar.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import { useToast } from '@/shared/composables/useToast'

const props = defineProps<{ deviceId: string; deviceName?: string }>()
const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()

type VacuumStatus = 'active' | 'inactive' | 'paused' | 'docked'

const store = useDashboardStore()

const CONTROL_OPTIONS: PillOption[] = [
  { value: 'start', label: 'Iniciar' },
  { value: 'pause', label: 'Pausar'  },
]

const MODE_OPTIONS: PillOption[] = [
  { value: 'vacuum', label: 'Aspirar'  },
  { value: 'mop',    label: 'Trapear'  },
]

const STATUS_LABEL: Record<VacuumStatus, string> = {
  active:   'Encendida',
  inactive: 'Apagada',
  paused:   'Pausada',
  docked:   'En base',
}

const vacuumStatus  = ref<VacuumStatus>('inactive')
const mode          = ref('vacuum')
const locationId    = ref('')
const locationName  = ref('')
const dockId        = ref('')
const dockName      = ref('')

const loading       = ref(true)
const actionPending = ref(false)

const { showToast } = useToast()

const isActive  = computed(() => vacuumStatus.value === 'active')
const isPaused  = computed(() => vacuumStatus.value === 'paused')
const isDocked  = computed(() => vacuumStatus.value === 'docked')
const isRunning = computed(() => isActive.value || isPaused.value)

const deviceInStore = computed(() => store.devices.find(d => d.id === props.deviceId))

const deviceRoomName = computed(() => {
  if (!deviceInStore.value?.roomId) return ''
  return store.rooms.find(r => r.id === deviceInStore.value.roomId)?.name ?? ''
})

const roomOptions = computed<PillOption[]>(() =>
  store.rooms.map(r => ({ value: r.id, label: r.name.length > 8 ? r.name.slice(0, 7) + '...' : r.name }))
)

function parseStatus(s: unknown): VacuumStatus {
  if (s === 'active' || s === 'on')  return 'active'
  if (s === 'paused')                return 'paused'
  if (s === 'docked')                return 'docked'
  return 'inactive'
}

function parseMode(m: unknown): string {
  if (m === 'mop' || m === 'trapear') return 'mop'
  return 'vacuum'
}

async function fetchState() {
  const [raw, detail] = await Promise.all([
    api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`),
    api.get<Record<string, unknown>>(`/devices/${props.deviceId}`).catch(() => null),
  ])
  vacuumStatus.value = parseStatus(raw.status)
  mode.value = parseMode(raw.mode)

  const dock = raw.dockingStation as Record<string, unknown> | null | undefined

  const loc = (raw.location ?? detail?.location ?? detail?.state?.location) as
    | Record<string, unknown>
    | string
    | null
    | undefined
  const resolvedLoc = typeof loc === 'object' && loc ? loc
    : typeof loc === 'string' && loc ? { id: loc } as Record<string, unknown>
    : null

  if (resolvedLoc) {
    locationId.value = String(resolvedLoc.id ?? resolvedLoc.roomId ?? '')
    locationName.value = String(resolvedLoc.name ?? '')
  } else if (deviceInStore.value?.roomId) {
    locationId.value = deviceInStore.value.roomId
    locationName.value = store.rooms.find(r => r.id === deviceInStore.value.roomId)?.name ?? ''
  } else {
    locationId.value = ''
    locationName.value = ''
  }

  dockId.value = typeof dock === 'object' && dock
    ? String(dock.id ?? dock.roomId ?? '')
    : ''
  dockName.value = typeof dock === 'object' && dock
    ? String(dock.name ?? '')
    : ''
}

onMounted(async () => {
  try { await fetchState() } catch { /* valores por defecto */ }
  finally { loading.value = false }
})

function handleError(e: unknown) {
  if (e instanceof ApiError) {
    const msg = (e.body as { error?: { description?: string } })?.error?.description
    showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
  } else {
    showToast('Error inesperado. Intentá de nuevo.', 'error')
  }
}

async function doAction(action: string, body: Record<string, unknown> = {}, toast?: string) {
  if (actionPending.value) return
  actionPending.value = true
  try {
    await api.patch(`/devices/${props.deviceId}/${action}`, body)
    await fetchState()
    emit('powerToggled', vacuumStatus.value === 'active' || vacuumStatus.value === 'paused')
    if (toast) showToast(toast, 'success')
  } catch (e) {
    handleError(e)
  } finally {
    actionPending.value = false
  }
}

async function onModeChange(val: string) {
  mode.value = val
  await doAction('setMode', { mode: val }, val === 'mop' ? 'Modo: trapear' : 'Modo: aspirar')
}

async function onLocationChange(roomId: string) {
  locationId.value = roomId
  const name = store.rooms.find(r => r.id === roomId)?.name ?? roomId
  locationName.value = name
  if (actionPending.value) return
  actionPending.value = true
  try {
    await api.patch(`/devices/${props.deviceId}/setLocation`, { roomId })
    emit('powerToggled', vacuumStatus.value === 'active' || vacuumStatus.value === 'paused')
    showToast(`Ubicación: ${name}`, 'success')
  } catch (e) {
    handleError(e)
    locationId.value = deviceInStore.value?.roomId ?? ''
    locationName.value = deviceRoomName.value
  } finally {
    actionPending.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="vac-loading">Cargando...</div>

  <div v-else class="vac-shell">
    <section class="vac-card">
      <ControlSidebar
        :title="props.deviceName || 'Aspiradora'"
        room-label="AMBIENTE"
        :temperature="0"
        :show-temperature="false"
        :is-on="isRunning"
        :show-power-button="false"
      >
        <template #center>
          <div class="vac-sidebar-center">
            <div class="vac-status-badge" :class="`vac-status--${vacuumStatus}`">
              {{ STATUS_LABEL[vacuumStatus] }}
            </div>
            <div v-if="isRunning" class="vac-mode-badge">
              {{ mode === 'mop' ? 'Trapeando' : 'Aspirando' }}
            </div>
            <p v-if="locationName && isRunning" class="vac-sidebar-location">{{ locationName }}</p>
          </div>
        </template>
      </ControlSidebar>

      <div class="vac-controls">

        <!-- Aspiradora -->
        <div class="vac-group">
          <p class="vac-group-title">Aspiradora</p>

          <section class="vac-section">
            <p class="vac-label">Control</p>
            <div :class="{ 'vac-disabled': actionPending }">
              <PillButtons
                :model-value="isActive ? 'start' : 'pause'"
                :options="CONTROL_OPTIONS"
                appearance="container"
                @update:model-value="(v: string) => doAction(v, {}, v === 'start' ? 'Aspiradora iniciada' : 'Aspiradora pausada')"
              />
            </div>
          </section>

          <section class="vac-section">
            <p class="vac-label">Modo</p>
            <div :class="{ 'vac-disabled': actionPending }">
              <PillButtons
                :model-value="mode"
                :options="MODE_OPTIONS"
                appearance="container"
                @update:model-value="(v: string) => onModeChange(v)"
              />
            </div>
          </section>

          <section v-if="roomOptions.length" class="vac-section">
            <p class="vac-label">Ubicación de accion</p>
            <div :class="{ 'vac-disabled': actionPending }">
              <PillButtons
                :model-value="locationId"
                :options="roomOptions"
                appearance="container"
                @update:model-value="(v: string) => onLocationChange(v)"
              />
            </div>
          </section>
        </div>

        <!-- Base de carga -->
        <div class="vac-group">
          <p class="vac-group-title">Base de carga</p>

          <section class="vac-section">
            <p class="vac-label">Control</p>
            <button
              type="button"
              class="vac-dock-btn"
              :disabled="actionPending || (!isRunning && !isDocked)"
              @click="doAction('dock', {}, 'Regresando a base')"
            >Regresar a base de carga</button>
          </section>

          <section class="vac-section">
            <p class="vac-label">Ubicación de la base</p>
            <div v-if="deviceRoomName" class="vac-dock-info">
              {{ deviceRoomName }}
            </div>
            <p v-else class="vac-hint">Vinculá el dispositivo a una habitación para configurar la base.</p>
          </section>
        </div>

      </div>
    </section>
  </div>
</template>

<style scoped>
.vac-loading {
  padding: 2rem;
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.9rem;
}

.vac-shell { width: 100%; }

.vac-card {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  border-radius: 28px;
  overflow: hidden;
  background: #f7f5f0;
  box-shadow: 0 28px 70px rgba(42, 40, 37, 0.16);
}

.vac-controls {
  padding: 2.6rem 2.2rem 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  overflow-y: auto;
}

/* Grupos */
.vac-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.4rem;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 18px;
}

.vac-group-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(52, 47, 41, 0.7);
  letter-spacing: 0.04em;
}

.vac-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.vac-label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(52, 47, 41, 0.38);
}

.vac-hint {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(52, 47, 41, 0.45);
}

.vac-disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* Sidebar */
.vac-sidebar-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.vac-status-badge,
.vac-mode-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.vac-status--active  { background: rgba(45, 106, 79, 0.15); color: #1f5c43; }
.vac-status--paused  { background: rgba(180, 140, 40, 0.15); color: #7a5c10; }
.vac-status--docked  { background: rgba(52, 100, 160, 0.12); color: #2a4f80; }
.vac-status--inactive { background: rgba(52, 47, 41, 0.1); color: rgba(52, 47, 41, 0.55); }

.vac-mode-badge {
  background: rgba(255, 255, 255, 0.52);
  color: rgba(52, 47, 41, 0.75);
}

.vac-sidebar-location {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(52, 47, 41, 0.5);
}

/* Buttons */
.vac-dock-btn {
  width: 100%;
  border: none;
  border-radius: 999px;
  padding: 0.85rem 1rem;
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}

.vac-dock-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.vac-dock-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}


.vac-dock-info {
  padding: 0.6rem 0.9rem;
  background: rgba(52, 100, 160, 0.08);
  border-radius: 12px;
  font-size: 0.85rem;
  color: #2a4f80;
  font-weight: 500;
}

.vac-controls .pill-buttons--container .pill-button {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vac-controls .pill-buttons--container .pill-button {
  flex: 0 0 auto;
  min-width: 0;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.65rem 0.75rem;
}

@media (max-width: 900px) {
  .vac-card { grid-template-columns: 1fr; }
  .vac-controls { padding: 1.5rem; }
}
</style>
