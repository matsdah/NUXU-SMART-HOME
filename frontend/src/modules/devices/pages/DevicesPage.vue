<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { api, ApiError } from '@/services/api/client'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useSocketStore } from '@/app/stores/socket'
import type { Device } from '@/app/stores/dashboard'
import { useToast } from '@/shared/composables/useToast'
import DeviceModal from '../components/DeviceModal.vue'
import DeleteDeviceConfirmModal from '@/modules/devices/components/DeleteDeviceConfirmModal.vue'
import AddDeviceModal from '@/modules/devices/components/AddDeviceModal.vue'
import EditDeviceModal from '@/modules/devices/components/EditDeviceModal.vue'
import AddRoomModal from '@/modules/homes/components/AddRoomModal.vue'
import DeleteRoomConfirmModal from '@/modules/homes/components/DeleteRoomConfirmModal.vue'
import EditRoomModal from '@/modules/homes/components/EditRoomModal.vue'

const store = useDashboardStore()
const socketStore = useSocketStore()
const { showToast } = useToast()
const { rooms, activeHomeId, loading, error, pendingActions } = storeToRefs(store)

const allDevices = ref<Device[]>([])
const loadingDevices = ref(false)
const refreshingDevices = ref(false)
const activeFilter = ref<'all' | string>('all')
const showAddDevice = ref(false)
const showAddRoom = ref(false)
const showDeleteDeviceConfirm = ref(false)
const showEditDeviceModal = ref(false)
const showDeleteRoomConfirm = ref(false)
const showEditRoomModal = ref(false)
const pendingDeviceDeletion = ref<{ id: string; name: string } | null>(null)
const deletingDevice = ref(false)
const pendingDeviceEdition = ref<{ id: string; name: string; roomId: string } | null>(null)
const editingDevice = ref(false)
const pendingRoomDeletion = ref<{ id: string; name: string } | null>(null)
const deletingRoom = ref(false)
const pendingRoomEdition = ref<{ id: string; name: string } | null>(null)
const renamingRoom = ref(false)
const isDeviceEditMode = ref(false)

const selectedDevice = ref<Device | null>(null)
const selectedRoomName = ref('')

const filteredDevices = computed(() => {
  if (activeFilter.value === 'all') return allDevices.value
  return allDevices.value.filter(d => d.roomId === activeFilter.value)
})

const selectedCreationRoomId = computed(() =>
  activeFilter.value === 'all'
    ? (store.activeRoomId || rooms.value[0]?.id || '')
    : activeFilter.value,
)

const selectedCreationRoomName = computed(() =>
  rooms.value.find(room => room.id === selectedCreationRoomId.value)?.name ?? '',
)

function roomName(roomId: string): string {
  return rooms.value.find(r => r.id === roomId)?.name ?? ''
}

function openModal(device: Device) {
  selectedDevice.value = device
  selectedRoomName.value = roomName(device.roomId)
}

function closeModal() {
  selectedDevice.value = null
  selectedRoomName.value = ''
}

function onDeviceUpdated(id: string, isOn: boolean) {
  const d = allDevices.value.find(x => x.id === id)
  if (d) {
    d.isOn = isOn
    d.tone = isOn ? 'sage' : 'neutral'
  }
}

function toggleDeviceEditMode() {
  isDeviceEditMode.value = !isDeviceEditMode.value
  if (isDeviceEditMode.value) {
    closeModal()
    closeEditDeviceModal()
  }
}

function onDeviceCardClick(device: Device) {
  if (isDeviceEditMode.value) {
    requestDeviceEdition(device)
    return
  }
  openModal(device)
}

function requestDeviceEdition(device: Device) {
  if (editingDevice.value) {
    return
  }

  pendingDeviceEdition.value = { id: device.id, name: device.name, roomId: device.roomId }
  showEditDeviceModal.value = true
}

function closeEditDeviceModal() {
  if (editingDevice.value) {
    return
  }
  showEditDeviceModal.value = false
  pendingDeviceEdition.value = null
}

function requestDeviceDeletionFromEditModal() {
  if (!pendingDeviceEdition.value || deletingDevice.value || editingDevice.value) {
    return
  }

  pendingDeviceDeletion.value = {
    id: pendingDeviceEdition.value.id,
    name: pendingDeviceEdition.value.name,
  }
  showDeleteDeviceConfirm.value = true
  showEditDeviceModal.value = false
  pendingDeviceEdition.value = null
}

async function confirmDeviceEdition(payload: { name: string; roomId: string }) {
  if (!pendingDeviceEdition.value) {
    return
  }

  editingDevice.value = true
  try {
    await store.updateDevice(pendingDeviceEdition.value.id, payload)
    showEditDeviceModal.value = false
    pendingDeviceEdition.value = null
    await refreshHomeDevices({ silent: true })
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
      return
    }
    showToast(e instanceof Error ? e.message : 'Error inesperado. Intentá de nuevo.', 'error')
  } finally {
    editingDevice.value = false
  }
}

function requestDeviceDeletion(device: Device) {
  if (deletingDevice.value) {
    return
  }
  pendingDeviceDeletion.value = { id: device.id, name: device.name }
  showDeleteDeviceConfirm.value = true
}

function closeDeleteDeviceConfirm() {
  if (deletingDevice.value) {
    return
  }
  showDeleteDeviceConfirm.value = false
  pendingDeviceDeletion.value = null
}

async function confirmDeviceDeletion() {
  if (!pendingDeviceDeletion.value) {
    return
  }

  deletingDevice.value = true
  try {
    await api.delete(`/devices/${pendingDeviceDeletion.value.id}`)
    await store.pruneDeletedDevicesFromRoutines([pendingDeviceDeletion.value.id])
    if (selectedDevice.value?.id === pendingDeviceDeletion.value.id) {
      closeModal()
    }
    showDeleteDeviceConfirm.value = false
    pendingDeviceDeletion.value = null
    await refreshHomeDevices({ silent: true })
    socketStore.deviceListVersion++
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
      return
    }
    showToast('Error inesperado. Intentá de nuevo.', 'error')
  } finally {
    deletingDevice.value = false
  }
}

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
    }
  } finally {
    refreshingDevices.value = false
    if (!silent) {
      loadingDevices.value = false
    }
  }
}


function selectAllRooms() {
  activeFilter.value = 'all'
}

function selectRoom(roomId: string) {
  activeFilter.value = roomId
  store.activeRoomId = roomId
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

async function onDeviceCreated() {
  showAddDevice.value = false
  await refreshHomeDevices({ silent: true })
}

async function onRoomCreated() {
  showAddRoom.value = false
  activeFilter.value = store.activeRoomId || 'all'
  await refreshHomeDevices({ silent: true })
}

function requestRoomRename() {
  if (activeFilter.value === 'all') {
    showToast('Seleccioná una habitación para editar.', 'error')
    return
  }

  const room = rooms.value.find(currentRoom => currentRoom.id === activeFilter.value)
  if (!room) {
    showToast('No se encontró la habitación seleccionada.', 'error')
    return
  }

  pendingRoomEdition.value = { id: room.id, name: room.name }
  showEditRoomModal.value = true
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
  if (activeFilter.value === 'all') {
    showToast('Seleccioná una habitación para eliminar.', 'error')
    return
  }

  const room = rooms.value.find(currentRoom => currentRoom.id === activeFilter.value)
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
    activeFilter.value = store.activeRoomId || 'all'
    showDeleteRoomConfirm.value = false
    pendingRoomDeletion.value = null
    await refreshHomeDevices({ silent: true })
    socketStore.deviceListVersion++
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
    activeFilter.value = 'all'
    return
  }

  if (homeId !== previousHomeId) {
    activeFilter.value = 'all'
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

onMounted(async () => {
  await store.loadDashboard()
})
</script>

<template>
  <section class="devices-page">

    <div class="devices-page__header">
      <div>
        <header class="panel__header">
          <h2 class="panel__title">Habitaciones</h2>
        </header>
        <div class="room-tabs">
          <button
            class="room-tab" :class="{ 'room-tab--active': activeFilter === 'all' }"
            type="button" @click="selectAllRooms"
          >
            Todos
          </button>
          <button
            v-for="room in rooms" :key="room.id"
            class="room-tab" :class="{ 'room-tab--active': activeFilter === room.id }"
            type="button" @click="selectRoom(room.id)"
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
            :disabled="rooms.length === 0 || activeFilter === 'all'"
            @click="requestRoomDeletion"
          >
            <span aria-hidden="true">&#128465;</span>
          </button>
          <button
            class="room-tab room-tab--icon"
            type="button"
            aria-label="Editar habitación"
            :disabled="rooms.length === 0 || activeFilter === 'all'"
            @click="requestRoomRename"
          >
            <span aria-hidden="true">&#9998;</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>
    <div v-else-if="loading || loadingDevices" class="notice">Cargando dispositivos...</div>

    <section v-else class="panel panel--devices">
      <header class="panel__header">
        <h2 class="panel__title">Dispositivos</h2>
        <button
          type="button"
          class="panel__edit-toggle"
          :class="{ 'panel__edit-toggle--active': isDeviceEditMode }"
          @click="toggleDeviceEditMode"
        >
          {{ isDeviceEditMode ? 'Salir de Modo Administrador' : 'Modo Administrador' }}
        </button>
      </header>

      <p v-if="isDeviceEditMode" class="panel__edit-hint">
        Modo Administrador activo: tocá un dispositivo para renombrarlo o eliminarlo.
      </p>

      <div class="device-grid">
        <button
          class="device-card device-card--new"
          :class="{ 'device-card--new--editing': isDeviceEditMode }"
          type="button"
          aria-label="Agregar dispositivo"
          :disabled="rooms.length === 0 || isDeviceEditMode"
          @click="showAddDevice = true"
        >
          <span class="device-card__plus">+</span>
          <span>Nuevo</span>
        </button>
        <article
          v-for="device in filteredDevices" :key="device.id"
          class="device-card"
          :class="{
            'device-card--accent': device.tone === 'sage',
            'device-card--delete-mode': isDeviceEditMode,
          }"
          @click="onDeviceCardClick(device)"
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
                :disabled="pendingActions.has(device.id) || isDeviceEditMode"
                @change="onToggleDevice(device.id)"
              />
              <span class="switch__track"></span>
            </label>
          </div>

          <div class="device-card__body">
            <h3>{{ device.name }}</h3>
            <p class="device-card__status">{{ device.status }}</p>
            <p v-if="activeFilter === 'all'" class="device-card__room">{{ roomName(device.roomId) }}</p>
          </div>
        </article>
        
      </div>
    </section>

    <DeviceModal
      v-if="selectedDevice"
      :device="selectedDevice"
      :room-name="selectedRoomName"
      @close="closeModal"
      @device-updated="onDeviceUpdated"
    />

    <AddDeviceModal
      v-if="showAddDevice"
      :room-id="selectedCreationRoomId"
      :room-name="selectedCreationRoomName"
      :show-room-selector="activeFilter === 'all'"
      @close="showAddDevice = false"
      @created="onDeviceCreated"
    />

    <EditDeviceModal
      v-if="showEditDeviceModal && pendingDeviceEdition"
      :device-name="pendingDeviceEdition.name"
      :room-id="pendingDeviceEdition.roomId"
      :rooms="rooms"
      :loading="editingDevice"
      @close="closeEditDeviceModal"
      @updated="confirmDeviceEdition"
      @delete="requestDeviceDeletionFromEditModal"
    />

    <DeleteDeviceConfirmModal
      v-if="showDeleteDeviceConfirm && pendingDeviceDeletion"
      :device-name="pendingDeviceDeletion.name"
      :loading="deletingDevice"
      @close="closeDeleteDeviceConfirm"
      @confirm="confirmDeviceDeletion"
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
.devices-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.devices-page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.section-label {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-bottom: 0.75rem;
}

.room-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.6rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  background: #9e9b8e;
  border-radius: 999px;
  padding: 0.45rem 0.7rem;
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.08);
  scrollbar-width: none;
}

.room-tabs::-webkit-scrollbar { display: none; }

.room-tab {
  border: none;
  background: rgba(255, 255, 255, 0.65);
  color: rgba(42, 40, 37, 0.8);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.room-tab:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.85);
  color: rgba(42, 40, 37, 0.95);
}

.room-tab--active {
  background: rgba(42, 40, 37, 0.95);
  color: #f7f3e7;
}

.room-tab--icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  line-height: 1;
}

.room-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notice {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 16px;
  padding: 0.8rem 1rem;
  font-weight: 600;
  color: rgba(42, 40, 37, 0.7);
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.08);
}

.notice--error {
  color: #8a2d2d;
  background: rgba(180, 60, 60, 0.12);
  box-shadow: inset 0 0 0 1px rgba(180, 60, 60, 0.2);
}

.panel {
  background: rgba(244, 244, 244, 0.7);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 20px 40px rgba(42, 40, 37, 0.08);
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
}

.panel__title {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  font-weight: 600;
}

.panel__edit-hint {
  margin: -0.4rem 0 1rem;
  padding: 0.55rem 0.8rem;
  border-radius: 10px;
  background: rgba(42, 40, 37, 0.95);
  color: #f7f3e7;
  font-size: 0.8rem;
  font-weight: 600;
}

.panel__edit-toggle {
  border: none;
  background: rgba(255, 255, 255, 0.7);
  color: rgba(42, 40, 37, 0.85);
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.panel__edit-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

.panel__edit-toggle--active {
  background: rgba(42, 40, 37, 0.95);
  color: #f7f3e7;
  box-shadow: 0 0 0 1px rgba(42, 40, 37, 0.45);
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.device-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 18px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1.4rem;
  min-height: 150px;
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.device-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

.device-card--accent {
  background: rgba(190, 190, 166, 0.6);
}

.device-card--delete-mode {
  box-shadow:
    inset 0 0 0 2px rgba(42, 40, 37, 0.95),
    0 0 0 1px rgba(42, 40, 37, 0.3);
  background: rgba(255, 255, 255, 0.4);
}

.device-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.device-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  display: grid;
  place-items: center;
  color: rgba(42, 40, 37, 0.85);
  box-shadow: 0 6px 12px rgba(42, 40, 37, 0.08);
}

.device-icon--off {
  background: rgba(42, 40, 37, 0.08);
  color: rgba(42, 40, 37, 0.42);
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
}

.device-icon svg {
  width: 20px;
  height: 20px;
}

.device-card__body {
  display: flex;
  flex-direction: column;
  min-height: 68px;
  min-width: 0;
}

.device-card__room {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(42, 40, 37, 0.45);
  margin-top: auto;
  align-self: flex-end;
  text-align: right;
}

.device-card__body h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-card__status {
  font-size: 0.8rem;
  color: rgba(42, 40, 37, 0.6);
}

.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.switch input {
  -webkit-appearance: none;
  appearance: none;
  width: 36px;
  height: 22px;
  background: rgba(42, 40, 37, 0.18);
  border-radius: 999px;
  position: relative;
  outline: none;
  cursor: pointer;
  transition: background 0.2s ease;
}

.switch input:checked { background: rgba(63, 129, 102, 0.65); }

.switch__track {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  left: 4px;
  transition: transform 0.2s ease;
  pointer-events: none;
}

.switch input:checked + .switch__track { transform: translateX(14px); }

.switch input:disabled { opacity: 0.5; cursor: not-allowed; }
.switch input:disabled + .switch__track { background: #e0e0e0; }

.device-card--new {
  border: none;
  align-items: center;
  justify-content: center;
  background: rgba(42, 40, 37, 0.07);
}

.device-card--new--editing {
  background: transparent !important;
}

.device-card--new:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.device-card__plus {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  line-height: 1;
  color: rgba(42, 40, 37, 0.8);
}

.devices-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 2rem;
  color: rgba(42, 40, 37, 0.45);
  font-size: 0.9rem;
}

@media (max-width: 720px) {
  .panel {
    padding: 1.1rem;
  }

  .device-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
