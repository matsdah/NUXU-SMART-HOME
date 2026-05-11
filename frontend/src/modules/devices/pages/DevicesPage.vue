<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { api } from '@/services/api/client'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useSocketStore } from '@/app/stores/socket'
import type { Device } from '@/app/stores/dashboard'
import { useToast } from '@/shared/composables/useToast'
import { useDragReorder } from '@/shared/composables/useDragReorder'
import { useDeviceList } from '@/shared/composables/useDeviceList'
import { useRoomTabs } from '@/shared/composables/useRoomTabs'
import { handleApiError } from '@/shared/utils/api-error-handler'
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

// ---- Room tabs ----
const activeFilter = ref<'all' | string>('all')

const roomTabs = useRoomTabs(activeFilter, {
  onRoomsChanged: async () => {
    await deviceList.refreshDevices({ silent: true })
    socketStore.deviceListVersion++
  },
})

// ---- Device list ----
const deviceList = useDeviceList({
  activeHomeId,
  loading,
  onHomeChanged: () => { activeFilter.value = 'all' },
})

const { allDevices } = deviceList

const filteredDevices = computed(() => {
  if (activeFilter.value === 'all') return allDevices.value
  return allDevices.value.filter(d => d.roomId === activeFilter.value)
})

// ---- Add device props ----
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

// ---- Device modal ----
const selectedDevice = ref<Device | null>(null)
const selectedRoomName = ref('')

function openModal(device: Device) {
  selectedDevice.value = device
  selectedRoomName.value = roomName(device.roomId)
}

function closeModal() {
  selectedDevice.value = null
  selectedRoomName.value = ''
}

function onDeviceUpdated(id: string, isOn: boolean) {
  deviceList.applyDeviceUpdate(id, isOn)
}

async function onDeviceCreated() {
  showAddDevice.value = false
  await deviceList.refreshDevices({ silent: true })
}

// ---- Edit mode + drag reorder ----
const isDeviceEditMode = ref(false)

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

const { draggingId, dragOverId, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd } = useDragReorder(allDevices, {
  canDrag: () => isDeviceEditMode.value && activeFilter.value === 'all',
  onReorder: async (orderedIds) => {
    const updates: Promise<void>[] = []
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      if (!id) continue
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

function onDeviceCardClick(device: Device) {
  if (isDeviceEditMode.value) {
    requestDeviceEdition(device)
    return
  }
  openModal(device)
}

// ---- Device edition ----
const showEditDeviceModal = ref(false)
const editingDevice = ref(false)
const pendingDeviceEdition = ref<{ id: string; name: string; roomId: string } | null>(null)

function requestDeviceEdition(device: Device) {
  if (editingDevice.value) return
  pendingDeviceEdition.value = { id: device.id, name: device.name, roomId: device.roomId }
  showEditDeviceModal.value = true
}

function closeEditDeviceModal() {
  if (editingDevice.value) return
  showEditDeviceModal.value = false
  pendingDeviceEdition.value = null
}

async function confirmDeviceEdition(payload: { name: string; roomId: string }) {
  if (!pendingDeviceEdition.value) return
  editingDevice.value = true
  try {
    await store.updateDevice(pendingDeviceEdition.value.id, payload)
    showEditDeviceModal.value = false
    pendingDeviceEdition.value = null
    await deviceList.refreshDevices({ silent: true })
  } catch (e) {
    const { message, type } = handleApiError(e)
    showToast(message, type)
  } finally {
    editingDevice.value = false
  }
}

// ---- Device deletion ----
const showDeleteDeviceConfirm = ref(false)
const deletingDevice = ref(false)
const pendingDeviceDeletion = ref<{ id: string; name: string } | null>(null)

function requestDeviceDeletionFromEditModal() {
  if (!pendingDeviceEdition.value || deletingDevice.value || editingDevice.value) return
  pendingDeviceDeletion.value = {
    id: pendingDeviceEdition.value.id,
    name: pendingDeviceEdition.value.name,
  }
  showDeleteDeviceConfirm.value = true
  showEditDeviceModal.value = false
  pendingDeviceEdition.value = null
}

function closeDeleteDeviceConfirm() {
  if (deletingDevice.value) return
  showDeleteDeviceConfirm.value = false
  pendingDeviceDeletion.value = null
}

async function confirmDeviceDeletion() {
  if (!pendingDeviceDeletion.value) return
  deletingDevice.value = true
  try {
    await api.delete(`/devices/${pendingDeviceDeletion.value.id}`)
    await store.pruneDeletedDevicesFromRoutines([pendingDeviceDeletion.value.id])
    if (selectedDevice.value?.id === pendingDeviceDeletion.value.id) {
      closeModal()
    }
    showDeleteDeviceConfirm.value = false
    pendingDeviceDeletion.value = null
    await deviceList.refreshDevices({ silent: true })
    socketStore.deviceListVersion++
  } catch (e) {
    const { message, type } = handleApiError(e)
    showToast(message, type)
  } finally {
    deletingDevice.value = false
  }
}

// ---- Add device modal ----
const showAddDevice = ref(false)

// ---- Initial load ----
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
            type="button" @click="roomTabs.selectAllRooms"
          >
            Todos
          </button>
          <button
            v-for="room in roomTabs.rooms" :key="room.id"
            class="room-tab" :class="{ 'room-tab--active': activeFilter === room.id }"
            type="button" @click="roomTabs.selectRoom(room.id)"
          >
            {{ room.name }}
          </button>
          <button
            class="room-tab room-tab--icon"
            type="button"
            aria-label="Agregar habitación"
            @click="roomTabs.showAddRoom = true"
          >
            +
          </button>
          <button
            class="room-tab room-tab--icon"
            type="button"
            aria-label="Eliminar habitación"
            :disabled="roomTabs.rooms.length === 0 || activeFilter === 'all'"
            @click="roomTabs.requestRoomDeletion"
          >
            <span aria-hidden="true">&#128465;</span>
          </button>
          <button
            class="room-tab room-tab--icon"
            type="button"
            aria-label="Editar habitación"
            :disabled="roomTabs.rooms.length === 0 || activeFilter === 'all'"
            @click="roomTabs.requestRoomRename"
          >
            <span aria-hidden="true">&#9998;</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>
    <div v-else-if="loading || deviceList.loadingDevices.value" class="notice">Cargando dispositivos...</div>

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
          :disabled="roomTabs.rooms.length === 0 || isDeviceEditMode"
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
          @dragend="onDragEnd"
          @click="onDeviceCardClick(device)"
        >
          <div class="device-card__top">
            <div
              class="device-icon"
              :class="{ 'device-icon--off': !device.isOn && device.kind !== 'fridge' && device.kind !== 'door'}"
              aria-hidden="true"
            >
              <DeviceIcon :kind="device.kind" />
            </div>

            <label v-if="device.kind !== 'fridge' && device.kind !== 'door' && device.kind !== 'alarm'" class="switch" :aria-label="`Cambiar ${device.name}`" @click.stop>
              <input
                type="checkbox" :checked="device.isOn"
                :disabled="pendingActions.has(device.id) || isDeviceEditMode"
                @change="deviceList.toggleDevice(device.id)"
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
      :rooms="roomTabs.rooms"
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
      v-if="roomTabs.showAddRoom"
      @close="roomTabs.showAddRoom = false"
      @created="roomTabs.onRoomCreated"
    />

    <DeleteRoomConfirmModal
      v-if="roomTabs.showDeleteRoomConfirm && roomTabs.pendingRoomDeletion"
      :room-name="roomTabs.pendingRoomDeletion.name"
      :loading="roomTabs.deletingRoom"
      @close="roomTabs.closeDeleteRoomConfirm"
      @confirm="roomTabs.confirmRoomDeletion"
    />

    <EditRoomModal
      v-if="roomTabs.showEditRoomModal && roomTabs.pendingRoomEdition"
      :room-name="roomTabs.pendingRoomEdition.name"
      :loading="roomTabs.renamingRoom"
      @close="roomTabs.closeEditRoomModal"
      @updated="roomTabs.confirmRoomRename"
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
