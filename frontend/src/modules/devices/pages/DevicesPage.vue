<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { api, ApiError } from '@/services/api/client'
import { useDashboardStore, statusForKind } from '@/app/stores/dashboard'
import { useSocketStore } from '@/app/stores/socket'
import type { Device } from '@/app/stores/dashboard'
import { useToast } from '@/shared/composables/useToast'
import { useDragReorder } from '@/shared/composables/useDragReorder'
import DeviceIcon from '@/shared/components/DeviceIcon.vue'
import DeviceModal from '../components/DeviceModal.vue'
import DeleteDeviceConfirmModal from '@/modules/devices/components/DeleteDeviceConfirmModal.vue'
import AddDeviceModal from '@/modules/devices/components/AddDeviceModal.vue'
import EditDeviceModal from '@/modules/devices/components/EditDeviceModal.vue'
import AddRoomModal from '@/modules/homes/components/AddRoomModal.vue'
import DeleteRoomConfirmModal from '@/modules/homes/components/DeleteRoomConfirmModal.vue'
import EditRoomModal from '@/modules/homes/components/EditRoomModal.vue'
import '@/shared/styles/device-card.css'
import '@/shared/styles/room-tabs.css'
import '@/shared/styles/shared-panel.css'

const store = useDashboardStore()
const socketStore = useSocketStore()
const { showToast, showPersistentToast, hidePersistentToast } = useToast()
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

const { draggingId, dragOverId, onDragStart, onDragOver, onDragLeave, onDrop } = useDragReorder(allDevices, {
  canDrag: () => isDeviceEditMode.value && activeFilter.value === 'all',
  onReorder: async (orderedIds) => {
    const updates: Promise<void>[] = []
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      const device = allDevices.value.find(d => d.id === id)
      if (device && device.displayOrder !== i) {
        device.displayOrder = i
        updates.push(store.updateDeviceDisplayOrder(id, i))
      }
    }
    if (updates.length > 0) {
      try {
        await Promise.all(updates)
        store.devices.splice(0, store.devices.length, ...allDevices.value)
      } catch (e) {
        showToast('No se pudo guardar el orden de los dispositivos.', 'error')
      }
    }
  },
})

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

const ADMIN_HINT = 'Modo edición activo: arrastrá los dispositivos para ordenarlos, o tocá uno para renombrarlo o eliminarlo.'

function toggleDeviceEditMode() {
  isDeviceEditMode.value = !isDeviceEditMode.value
  if (isDeviceEditMode.value) {
    closeModal()
    closeEditDeviceModal()
    showPersistentToast(ADMIN_HINT)
  } else {
    hidePersistentToast(ADMIN_HINT)
  }
}

onBeforeUnmount(() => {
  hidePersistentToast(ADMIN_HINT)
})

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
      || current.displayOrder !== next.displayOrder
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
          {{ isDeviceEditMode ? 'Salir de Modo edición' : 'Modo edición' }}
        </button>
      </header>

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
            'device-card--dragging': draggingId === device.id,
            'device-card--drag-over': dragOverId === device.id,
          }"
          :draggable="isDeviceEditMode && activeFilter === 'all'"
          @dragstart="onDragStart(device.id)"
          @dragover="onDragOver($event, device.id)"
          @dragleave="onDragLeave"
          @drop="onDrop($event, device.id)"
          @click="onDeviceCardClick(device)"
        >
          <div class="device-card__top">
            <div
              class="device-icon"
              :class="{ 'device-icon--off': !device.isOn && device.kind !== 'fridge' && device.kind !== 'door' && device.kind !== 'alarm' }"
              aria-hidden="true"
            >
              <DeviceIcon :kind="device.kind" />
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

.device-card--delete-mode {
  box-shadow:
    inset 0 0 0 2px rgba(42, 40, 37, 0.95),
    0 0 0 1px rgba(42, 40, 37, 0.3);
  background: rgba(255, 255, 255, 0.4);
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

.device-card__status {
  font-size: 0.8rem;
  color: rgba(42, 40, 37, 0.6);
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

.devices-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 2rem;
  color: rgba(42, 40, 37, 0.45);
  font-size: 0.9rem;
}

.device-card--dragging {
  opacity: 0.5;
}

.device-card--drag-over {
  box-shadow: inset 0 0 0 2px var(--color-sage), 0 0 0 1px rgba(42, 40, 37, 0.3);
}
</style>
