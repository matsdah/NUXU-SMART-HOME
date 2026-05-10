<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHomesDashboard } from '@/modules/homes/composables/useHomesDashboard'
import { useDashboardStore, statusForKind } from '@/app/stores/dashboard'
import { useSocketStore } from '@/app/stores/socket'
import type { Device } from '@/app/stores/dashboard'
import { api, ApiError } from '@/services/api/client'
import { useToast } from '@/shared/composables/useToast'
import DeviceModal from '@/modules/devices/components/DeviceModal.vue'
import AddDeviceModal from '@/modules/devices/components/AddDeviceModal.vue'
import AddRoomModal from '@/modules/homes/components/AddRoomModal.vue'
import DeleteRoomConfirmModal from '@/modules/homes/components/DeleteRoomConfirmModal.vue'
import EditRoomModal from '@/modules/homes/components/EditRoomModal.vue'
import RoutineFormModal from '@/modules/routines/components/RoutineFormModal.vue'
import type { RoutineCard } from '@/modules/routines/components/RoutineFormModal.vue'
import '@/shared/styles/device-card.css'
import '@/shared/styles/room-tabs.css'
import '@/shared/styles/shared-panel.css'

const { rooms, routines, activeHomeId, activeRoomId, loading, error, pendingActions } = useHomesDashboard()

const store = useDashboardStore()
const socketStore = useSocketStore()

const showAddDevice = ref(false)
const showAddRoom = ref(false)
const showDeleteRoomConfirm = ref(false)
const showEditRoomModal = ref(false)
const selectedDevice = ref<Device | null>(null)
const selectedRoomName = ref('')
const activeRoomFilter = ref<'all' | string>('all')
const allDevices = ref<Device[]>([])
const loadingDevices = ref(false)
const refreshingDevices = ref(false)
const pendingRoomDeletion = ref<{ id: string; name: string } | null>(null)
const deletingRoom = ref(false)
const pendingRoomEdition = ref<{ id: string; name: string } | null>(null)
const renamingRoom = ref(false)
const showCreateRoutine = ref(false)
const runningRoutineId = ref<string | null>(null)

const { showToast } = useToast()

function openDeviceModal(device: Device) {
  selectedDevice.value = device
  selectedRoomName.value = store.rooms.find(r => r.id === device.roomId)?.name ?? ''
}

function closeDeviceModal() {
  selectedDevice.value = null
}

function onDeviceUpdated(id: string, isOn: boolean) {
  const d = allDevices.value.find(x => x.id === id)
  if (!d) return
  d.isOn = isOn
  d.tone = isOn ? 'sage' : 'neutral'
  d.status = statusForKind(d.kind, isOn)
  store.fetchDeviceState(id).then(state => {
    if (!state) return
    const device = allDevices.value.find(x => x.id === id)
    if (device) device.status = state.status
  })
}

async function onDeviceCreated() {
  showAddDevice.value = false
  await refreshHomeDevices({ silent: true })
}

const displayedDevices = computed(() => {
  if (activeRoomFilter.value === 'all') {
    return allDevices.value
  }
  return allDevices.value.filter(device => device.roomId === activeRoomFilter.value)
})

function hasDeviceListChanged(nextDevices: Device[]): boolean {
  if (allDevices.value.length !== nextDevices.length) {
    return true
  }

  const currentById = new Map(allDevices.value.map(device => [device.id, device]))
  for (const next of nextDevices) {
    const current = currentById.get(next.id)
    if (!current) {
      return true
    }

    if (
      current.name !== next.name
      || current.roomId !== next.roomId
      || current.kind !== next.kind
      || current.status !== next.status
      || current.isOn !== next.isOn
      || current.tone !== next.tone
    ) {
      return true
    }
  }

  return false
}

async function refreshHomeDevices(options: { silent?: boolean } = {}) {
  if (!activeHomeId.value) {
    allDevices.value = []
    return
  }
  if (refreshingDevices.value) {
    return
  }

  const silent = options.silent === true
  refreshingDevices.value = true
  if (!silent) {
    loadingDevices.value = true
  }
  try {
    const nextDevices = await store.fetchHomeDevices(activeHomeId.value)
    if (hasDeviceListChanged(nextDevices)) {
      allDevices.value = nextDevices
      store.devices.splice(0, store.devices.length, ...nextDevices)
    }
  } finally {
    refreshingDevices.value = false
    if (!silent) {
      loadingDevices.value = false
    }
  }
}


function selectAllRooms() {
  activeRoomFilter.value = 'all'
}

function selectRoom(roomId: string) {
  activeRoomFilter.value = roomId
  activeRoomId.value = roomId
}

async function onToggleDevice(id: string) {
  await store.toggleDevice(id)
  const storeDevice = store.devices.find(d => d.id === id)
  if (storeDevice) {
    const local = allDevices.value.find(d => d.id === id)
    if (local) {
      local.isOn = storeDevice.isOn
      local.tone = storeDevice.tone
      local.status = storeDevice.status
    }
  }
}

async function onRoomCreated() {
  showAddRoom.value = false
  activeRoomFilter.value = store.activeRoomId || 'all'
  await refreshHomeDevices({ silent: true })
}

function requestRoomRename() {
  if (activeRoomFilter.value === 'all') {
    showToast('Seleccioná una habitación para editar.', 'error')
    return
  }

  const room = store.rooms.find(currentRoom => currentRoom.id === activeRoomFilter.value)
  if (!room) {
    showToast('No se encontró la habitación seleccionada.', 'error')
    return
  }

  pendingRoomEdition.value = { id: room.id, name: room.name }
  showEditRoomModal.value = true
}

async function executeRoutine(id: string) {
  if (runningRoutineId.value) return
  runningRoutineId.value = id
  try {
    await api.patch(`/routines/${id}/execute`, {})
    // Refresh device states to reflect any changes made by the routine execution
    await refreshHomeDevices({ silent: true })
    showToast('Rutina ejecutada correctamente.', 'success')
  } catch (e) {
    const msg = e instanceof ApiError
      ? `Error ${e.status} al ejecutar la rutina.`
      : 'No se pudo ejecutar la rutina.'
    showToast(msg, 'error')
  } finally {
    runningRoutineId.value = null
  }
}

function onRoutineCreated(_routine: RoutineCard) {
  showCreateRoutine.value = false
  store.invalidateRoutines()
  void store.loadRoutines()
}

function closeEditRoomModal() {
  if (renamingRoom.value) {
    return
  }
  showEditRoomModal.value = false
  pendingRoomEdition.value = null
}

async function confirmRoomRename(name: string) {
  if (!pendingRoomEdition.value) {
    return
  }

  renamingRoom.value = true
  try {
    await store.updateRoomName(pendingRoomEdition.value.id, name)
    showEditRoomModal.value = false
    pendingRoomEdition.value = null
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
      return
    }
    showToast(e instanceof Error ? e.message : 'Error inesperado. Intentá de nuevo.', 'error')
  } finally {
    renamingRoom.value = false
  }
}

function requestRoomDeletion() {
  if (activeRoomFilter.value === 'all') {
    showToast('Seleccioná una habitación para eliminar.', 'error')
    return
  }

  const room = store.rooms.find(currentRoom => currentRoom.id === activeRoomFilter.value)
  if (!room) {
    showToast('No se encontró la habitación seleccionada.', 'error')
    return
  }

  pendingRoomDeletion.value = { id: room.id, name: room.name }
  showDeleteRoomConfirm.value = true
}

function closeDeleteRoomConfirm() {
  if (deletingRoom.value) {
    return
  }
  showDeleteRoomConfirm.value = false
  pendingRoomDeletion.value = null
}

async function confirmRoomDeletion() {
  if (!pendingRoomDeletion.value) {
    return
  }

  deletingRoom.value = true
  try {
    await store.deleteRoom(pendingRoomDeletion.value.id)
    activeRoomFilter.value = store.activeRoomId || 'all'
    showDeleteRoomConfirm.value = false
    pendingRoomDeletion.value = null
    await refreshHomeDevices({ silent: true })
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
      return
    }
    showToast('Error inesperado. Intentá de nuevo.', 'error')
  } finally {
    deletingRoom.value = false
  }
}

watch([loading, activeHomeId], async ([isLoading, homeId], previousValue) => {
  const previousHomeId = previousValue?.[1]

  if (!homeId) {
    allDevices.value = []
    activeRoomFilter.value = 'all'
    return
  }

  if (homeId !== previousHomeId) {
    activeRoomFilter.value = 'all'
  }

  if (!isLoading) {
    await refreshHomeDevices()
  }
}, { immediate: true })

function extractDeviceIdFromEvent(eventData: Record<string, unknown>): string | undefined {
  const nested = eventData['data'] as Record<string, unknown> | undefined
  return (nested?.['deviceId'] ?? nested?.['device_id'] ?? eventData['deviceId'] ?? eventData['device_id']) as string | undefined
}

// Update quirúrgico cuando el payload WS trae device ID (1-2 llamadas en vez de N+1)
watch(() => socketStore.lastDeviceEvent, async (eventData) => {
  if (!eventData) return
  const deviceId = extractDeviceIdFromEvent(eventData)
  if (!deviceId) return
  const updated = await store.fetchDeviceState(deviceId)
  if (!updated) { void refreshHomeDevices({ silent: true }); return }
  const local = allDevices.value.find(d => d.id === deviceId)
  if (!local) { void refreshHomeDevices({ silent: true }); return }
  local.isOn = updated.isOn
  local.tone = updated.tone
  local.status = updated.status
})

// Refresh completo solo cuando el payload no tiene device ID reconocible
watch(() => socketStore.deviceStateVersion, () => {
  const ev = socketStore.lastDeviceEvent
  const deviceId = ev ? extractDeviceIdFromEvent(ev) : undefined
  if (deviceId && allDevices.value.some(d => d.id === deviceId)) return
  void refreshHomeDevices({ silent: true })
})

watch(() => socketStore.deviceListVersion, () => {
  void refreshHomeDevices({ silent: true })
})
</script>

<template>
  <section class="homes">
    <div class="homes__header">
      <div>
        <header class="panel__header">
          <h2 class="panel__title">Habitaciones</h2>
        </header>
        <div class="room-tabs">
          <button
            type="button"
            class="room-tab"
            :class="{ 'room-tab--active': activeRoomFilter === 'all' }"
            @click="selectAllRooms"
          >
            Todos
          </button>
          <button
            v-for="room in rooms" :key="room.id" type="button"
            class="room-tab" :class="{ 'room-tab--active': room.id === activeRoomFilter }"
            @click="selectRoom(room.id)"
          >
            {{ room.name }}
          </button>
          <button
            class="room-tab room-tab--icon"
            type="button"
            aria-label="Agregar habitación"
            @click="showAddRoom = true"
          >
            +
          </button>
          <button
            class="room-tab room-tab--icon"
            type="button"
            aria-label="Eliminar habitación"
            :disabled="rooms.length === 0 || activeRoomFilter === 'all'"
            @click="requestRoomDeletion"
          >
            <span aria-hidden="true">&#128465;</span>
          </button>
          <button
            class="room-tab room-tab--icon"
            type="button"
            aria-label="Editar habitación"
            :disabled="rooms.length === 0 || activeRoomFilter === 'all'"
            @click="requestRoomRename"
          >
            <span aria-hidden="true">&#9998;</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>
    <div v-else-if="loading || loadingDevices" class="notice">Cargando dashboard...</div>

    <div v-else class="homes__content">
      <section class="panel panel--devices">
        <header class="panel__header">
          <h2 class="panel__title">Dispositivos</h2>
          <RouterLink class="panel__link" to="/devices">Ver todas</RouterLink>
        </header>

        <div class="device-grid">
          <button class="device-card device-card--new" type="button" aria-label="Agregar dispositivo"
            @click="showAddDevice = true">
            <span class="device-card__plus">+</span>
            <span>Nuevo</span>
          </button>
          <article
            v-for="device in displayedDevices" :key="device.id"
            class="device-card" :class="{ 'device-card--accent': device.tone === 'sage' }"
            @click="openDeviceModal(device)"
          >
            <div class="device-card__top">
              <div
                class="device-icon"
                :class="{ 'device-icon--off': !device.isOn && device.kind !== 'fridge' && device.kind !== 'door' && device.kind !== 'alarm' }"
                aria-hidden="true"
              >
                <svg v-if="device.kind === 'vacuum'" viewBox="0 0 24 24">
                  <rect x="6" y="3" width="12" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M12 13v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <svg v-else-if="device.kind === 'speaker'" viewBox="0 0 24 24">
                  <rect x="7" y="3" width="10" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                  <circle cx="12" cy="9" r="2" fill="currentColor" />
                  <circle cx="12" cy="15" r="3" fill="none" stroke="currentColor" stroke-width="2" />
                </svg>
                <svg v-else-if="device.kind === 'tap'" viewBox="0 0 24 24">
                  <path d="M6 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M9 8v5a3 3 0 0 0 6 0V8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <circle cx="12" cy="18" r="1" fill="currentColor" />
                </svg>
                <svg v-else-if="device.kind === 'blind'" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="12" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M6 9h12" stroke="currentColor" stroke-width="2" />
                  <path d="M6 13h12" stroke="currentColor" stroke-width="2" />
                </svg>
                <svg v-else-if="device.kind === 'lamp'" viewBox="0 0 24 24">
                  <path d="M8 10a4 4 0 0 1 8 0c0 2-2 3-2 5H10c0-2-2-3-2-5z" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <svg v-else-if="device.kind === 'oven'" viewBox="0 0 24 24">
                  <rect x="5" y="4" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                  <rect x="8" y="9" width="8" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="2" />
                  <circle cx="8" cy="6.5" r="1" fill="currentColor" />
                  <circle cx="12" cy="6.5" r="1" fill="currentColor" />
                </svg>
                <svg v-else-if="device.kind === 'ac'" viewBox="0 0 24 24">
                  <path d="M6 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M7 11h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <svg v-else-if="device.kind === 'door'" viewBox="0 0 24 24">
                  <rect x="7" y="4" width="10" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                  <circle cx="14" cy="12" r="1" fill="currentColor" />
                </svg>
                <svg v-else viewBox="0 0 24 24">
                  <rect x="6" y="4" width="12" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M6 10h12" stroke="currentColor" stroke-width="2" />
                </svg>
              </div>

              <label v-if="device.kind !== 'fridge' && device.kind !== 'door' && device.kind !== 'alarm'" class="switch" :aria-label="`Cambiar ${device.name}`" @click.stop>
                <input
                  type="checkbox" :checked="device.isOn"
                  :disabled="pendingActions.has(device.id)"
                  @change="onToggleDevice(device.id)"
                />
                <span class="switch__track"></span>
              </label>
            </div>

            <div class="device-card__body">
              <h3>{{ device.name }}</h3>
              <p>{{ device.status }}</p>
            </div>
          </article>

          
        </div>
      </section>

      <aside class="panel panel--routines">
        <header class="panel__header">
          <h2 class="panel__title">Rutinas</h2>
          <RouterLink class="panel__link" to="/routines">Ver todas</RouterLink>
        </header>

        <div class="routine-list">
          <article v-for="routine in routines" :key="routine.id" class="routine-card">
            <div class="routine-icon" aria-hidden="true">
              <svg v-if="routine.icon === 'moon'" viewBox="0 0 24 24">
                <path d="M15 3a8 8 0 1 0 6 13 7 7 0 0 1-6-13z" fill="currentColor" />
              </svg>
              <svg v-else-if="routine.icon === 'sun'" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" fill="currentColor" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <path d="M4 6h16v12H4z" fill="none" stroke="currentColor" stroke-width="2" />
                <path d="M9 10l6 3-6 3z" fill="currentColor" />
              </svg>
            </div>
            <div class="routine-info">
              <h3>{{ routine.name }}</h3>
              <p>{{ routine.summary }}</p>
              <span v-if="routine.time">{{ routine.time }}</span>
            </div>
            <button
              type="button"
              class="routine-card__play"
              :disabled="runningRoutineId !== null"
              :aria-label="`Ejecutar ${routine.name}`"
              @click="executeRoutine(routine.id)"
            >
              <svg
                v-if="runningRoutineId === routine.id"
                class="spinner"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="60" stroke-dashoffset="20" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </article>

          <button class="routine-card routine-card--new" type="button" aria-label="Crear rutina" @click="showCreateRoutine = true">
            <span class="routine-card__plus">+</span>
            <span>Nueva</span>
          </button>
        </div>
      </aside>
    </div>

    <DeviceModal
      v-if="selectedDevice"
      :device="selectedDevice"
      :room-name="selectedRoomName"
      @close="closeDeviceModal"
      @device-updated="onDeviceUpdated"
    />

    <AddDeviceModal
      v-if="showAddDevice"
      :room-id="activeRoomId"
      :room-name="store.rooms.find(r => r.id === activeRoomId)?.name ?? ''"
      :show-room-selector="activeRoomFilter === 'all'"
      @close="showAddDevice = false"
      @created="onDeviceCreated"
    />

    <AddRoomModal
      v-if="showAddRoom"
      @close="showAddRoom = false"
      @created="onRoomCreated"
    />

    <DeleteRoomConfirmModal
      v-if="showDeleteRoomConfirm && pendingRoomDeletion"
      :room-name="pendingRoomDeletion.name"
      :loading="deletingRoom"
      @close="closeDeleteRoomConfirm"
      @confirm="confirmRoomDeletion"
    />

    <RoutineFormModal
      v-if="showCreateRoutine"
      mode="create"
      @close="showCreateRoutine = false"
      @created="onRoutineCreated"
    />

    <EditRoomModal
      v-if="showEditRoomModal && pendingRoomEdition"
      :room-name="pendingRoomEdition.name"
      :loading="renamingRoom"
      @close="closeEditRoomModal"
      @updated="confirmRoomRename"
    />

  </section>
</template>

<style scoped>
.homes {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.homes__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.homes__content {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 0.9fr);
  gap: 1.8rem;
}

@media (max-width: 1024px) {
  .homes__content {
    grid-template-columns: 1fr;
  }
}

.toast--success .toast__dot {
  background: #52c47d;
}
.toast--error .toast__dot {
  background: #e05252;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
