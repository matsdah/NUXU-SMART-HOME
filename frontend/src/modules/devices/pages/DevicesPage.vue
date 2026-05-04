<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { api, ApiError } from '@/services/api/client'
import { useDashboardStore } from '@/app/stores/dashboard'
import type { Device } from '@/app/stores/dashboard'
import DeviceModal from '../components/DeviceModal.vue'
import DeleteDeviceConfirmModal from '@/modules/devices/components/DeleteDeviceConfirmModal.vue'
import AddDeviceModal from '@/modules/devices/components/AddDeviceModal.vue'
import AddRoomModal from '@/modules/homes/components/AddRoomModal.vue'
import DeleteRoomConfirmModal from '@/modules/homes/components/DeleteRoomConfirmModal.vue'
import EditRoomModal from '@/modules/homes/components/EditRoomModal.vue'

const store = useDashboardStore()
const router = useRouter()
const { rooms, activeHomeId, loading, error, pendingActions } = storeToRefs(store)

const allDevices = ref<Device[]>([])
const loadingDevices = ref(false)
const activeFilter = ref<'all' | string>('all')
const roomActionError = ref('')
const deviceActionError = ref('')
const showAddDevice = ref(false)
const showAddRoom = ref(false)
const showDeleteDeviceConfirm = ref(false)
const showDeleteRoomConfirm = ref(false)
const showEditRoomModal = ref(false)
const pendingDeviceDeletion = ref<{ id: string; name: string } | null>(null)
const deletingDevice = ref(false)
const pendingRoomDeletion = ref<{ id: string; name: string } | null>(null)
const deletingRoom = ref(false)
const pendingRoomEdition = ref<{ id: string; name: string } | null>(null)
const renamingRoom = ref(false)
const editRoomError = ref('')
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

function toggleDeviceEditMode() {
  isDeviceEditMode.value = !isDeviceEditMode.value
  if (isDeviceEditMode.value) {
    closeModal()
  }
}

function onDeviceCardClick(device: Device) {
  if (isDeviceEditMode.value) {
    requestDeviceDeletion(device)
    return
  }
  openModal(device)
}

function requestDeviceDeletion(device: Device) {
  if (deletingDevice.value) {
    return
  }
  deviceActionError.value = ''
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
    if (selectedDevice.value?.id === pendingDeviceDeletion.value.id) {
      closeModal()
    }
    showDeleteDeviceConfirm.value = false
    pendingDeviceDeletion.value = null
    await refreshHomeDevices()
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      deviceActionError.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
      return
    }
    deviceActionError.value = 'Error inesperado. Intentá de nuevo.'
  } finally {
    deletingDevice.value = false
  }
}

async function refreshHomeDevices() {
  if (!activeHomeId.value) {
    allDevices.value = []
    return
  }

  loadingDevices.value = true
  try {
    allDevices.value = await store.fetchHomeDevices(activeHomeId.value)
  } finally {
    loadingDevices.value = false
  }
}

function selectAllRooms() {
  roomActionError.value = ''
  activeFilter.value = 'all'
}

function selectRoom(roomId: string) {
  roomActionError.value = ''
  activeFilter.value = roomId
  store.activeRoomId = roomId
}

async function onToggleDevice(id: string) {
  await store.toggleDevice(id)
  await refreshHomeDevices()
}

type CreatedDevicePayload = { deviceId: string; typeName: string }

async function onDeviceCreated(payload: CreatedDevicePayload) {
  showAddDevice.value = false

  const isAirConditioner = payload.typeName.toLowerCase().includes('aire acondicionado')
  if (isAirConditioner) {
    await router.push({ name: 'device-ac-controls', params: { deviceId: payload.deviceId } })
    return
  }

  await refreshHomeDevices()
}

async function onRoomCreated() {
  showAddRoom.value = false
  activeFilter.value = store.activeRoomId || 'all'
  await refreshHomeDevices()
}

function requestRoomRename() {
  roomActionError.value = ''
  editRoomError.value = ''
  if (activeFilter.value === 'all') {
    roomActionError.value = 'Seleccioná una habitación para editar.'
    return
  }

  const room = rooms.value.find(currentRoom => currentRoom.id === activeFilter.value)
  if (!room) {
    roomActionError.value = 'No se encontró la habitación seleccionada.'
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
  editRoomError.value = ''
}

async function confirmRoomRename(name: string) {
  if (!pendingRoomEdition.value) {
    return
  }

  renamingRoom.value = true
  editRoomError.value = ''
  try {
    await store.updateRoomName(pendingRoomEdition.value.id, name)
    showEditRoomModal.value = false
    pendingRoomEdition.value = null
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      editRoomError.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
      return
    }
    editRoomError.value = e instanceof Error ? e.message : 'Error inesperado. Intentá de nuevo.'
  } finally {
    renamingRoom.value = false
  }
}

function requestRoomDeletion() {
  roomActionError.value = ''
  if (activeFilter.value === 'all') {
    roomActionError.value = 'Seleccioná una habitación para eliminar.'
    return
  }

  const room = rooms.value.find(currentRoom => currentRoom.id === activeFilter.value)
  if (!room) {
    roomActionError.value = 'No se encontró la habitación seleccionada.'
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
    await refreshHomeDevices()
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      roomActionError.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
      return
    }
    roomActionError.value = 'Error inesperado. Intentá de nuevo.'
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

onMounted(async () => {
  await store.loadDashboard()
})
</script>

<template>
  <section class="devices-page">

    <div class="devices-page__header">
      <div>
        <p class="section-label">Habitaciones</p>
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

    <div v-if="roomActionError" class="notice notice--error" role="alert">{{ roomActionError }}</div>
    <div v-if="deviceActionError" class="notice notice--error" role="alert">{{ deviceActionError }}</div>
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
          {{ isDeviceEditMode ? 'Salir edición' : 'Modo edición' }}
        </button>
      </header>

      <p v-if="isDeviceEditMode" class="panel__edit-hint">
        Modo edición activo: tocá un dispositivo para eliminarlo.
      </p>

      <div class="device-grid">
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
            <div class="device-icon" aria-hidden="true">
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

            <label class="switch" :aria-label="`Cambiar ${device.name}`" @click.stop>
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

        <button
          class="device-card device-card--new"
          type="button"
          aria-label="Agregar dispositivo"
          :disabled="rooms.length === 0"
          @click="showAddDevice = true"
        >
          <span class="device-card__plus">+</span>
          <span>Nuevo</span>
        </button>

        <div v-if="filteredDevices.length === 0" class="devices-empty">
          No tiene dispositivos
        </div>
      </div>
    </section>

    <DeviceModal
      v-if="selectedDevice"
      :device="selectedDevice"
      :room-name="selectedRoomName"
      @close="closeModal"
    />

    <AddDeviceModal
      v-if="showAddDevice"
      :room-id="selectedCreationRoomId"
      :room-name="selectedCreationRoomName"
      @close="showAddDevice = false"
      @created="onDeviceCreated"
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
      :error="editRoomError"
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
  background: rgba(181, 68, 68, 0.14);
  color: #7a2323;
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

.panel__edit-toggle--active {
  background: #b54444;
  color: #fff;
  box-shadow: 0 0 0 1px rgba(122, 35, 35, 0.45);
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
    inset 0 0 0 2px #b54444,
    0 0 0 1px rgba(181, 68, 68, 0.22);
  background: rgba(255, 244, 244, 0.88);
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

.device-icon svg {
  width: 20px;
  height: 20px;
}

.device-card__body {
  display: flex;
  flex-direction: column;
  min-height: 68px;
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
  border: 1px dashed rgba(42, 40, 37, 0.2);
  align-items: center;
  justify-content: center;
  background: transparent;
  cursor: pointer;
  transform: none !important;
  box-shadow: none !important;
}

.device-card__plus {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  display: grid;
  place-items: center;
  font-size: 1.6rem;
  color: rgba(42, 40, 37, 0.6);
}

.device-card--new:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
