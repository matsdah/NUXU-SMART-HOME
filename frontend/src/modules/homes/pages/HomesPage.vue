<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHomesDashboard } from '@/modules/homes/composables/useHomesDashboard'
import { useDashboardStore } from '@/app/stores/dashboard'
import type { Device } from '@/app/stores/dashboard'
import { ApiError } from '@/services/api/client'
import DeviceModal from '@/modules/devices/components/DeviceModal.vue'
import AddDeviceModal from '@/modules/devices/components/AddDeviceModal.vue'
import AddRoomModal from '@/modules/homes/components/AddRoomModal.vue'
import DeleteRoomConfirmModal from '@/modules/homes/components/DeleteRoomConfirmModal.vue'
import EditRoomModal from '@/modules/homes/components/EditRoomModal.vue'

const { rooms, routines, activeHomeId, activeRoomId, loading, error, pendingActions } = useHomesDashboard()

const store = useDashboardStore()

const showAddDevice = ref(false)
const showAddRoom = ref(false)
const showDeleteRoomConfirm = ref(false)
const showEditRoomModal = ref(false)
const selectedDevice = ref<Device | null>(null)
const selectedRoomName = ref('')
const activeRoomFilter = ref<'all' | string>('all')
const allDevices = ref<Device[]>([])
const loadingDevices = ref(false)
const roomActionError = ref('')
const pendingRoomDeletion = ref<{ id: string; name: string } | null>(null)
const deletingRoom = ref(false)
const pendingRoomEdition = ref<{ id: string; name: string } | null>(null)
const renamingRoom = ref(false)
const editRoomError = ref('')

function openDeviceModal(device: Device) {
  selectedDevice.value = device
  selectedRoomName.value = store.rooms.find(r => r.id === device.roomId)?.name ?? ''
}

function closeDeviceModal() {
  selectedDevice.value = null
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

const displayedDevices = computed(() => {
  if (activeRoomFilter.value === 'all') {
    return allDevices.value
  }
  return allDevices.value.filter(device => device.roomId === activeRoomFilter.value)
})

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
  activeRoomFilter.value = 'all'
}

function selectRoom(roomId: string) {
  roomActionError.value = ''
  activeRoomFilter.value = roomId
  activeRoomId.value = roomId
}

async function onToggleDevice(id: string) {
  await store.toggleDevice(id)
  await refreshHomeDevices()
}

async function onRoomCreated() {
  showAddRoom.value = false
  activeRoomFilter.value = store.activeRoomId || 'all'
  await refreshHomeDevices()
}

function requestRoomRename() {
  roomActionError.value = ''
  editRoomError.value = ''
  if (activeRoomFilter.value === 'all') {
    roomActionError.value = 'Seleccioná una habitación para editar.'
    return
  }

  const room = store.rooms.find(currentRoom => currentRoom.id === activeRoomFilter.value)
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
  if (activeRoomFilter.value === 'all') {
    roomActionError.value = 'Seleccioná una habitación para eliminar.'
    return
  }

  const room = store.rooms.find(currentRoom => currentRoom.id === activeRoomFilter.value)
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
    activeRoomFilter.value = store.activeRoomId || 'all'
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
</script>

<template>
  <section class="homes">
    <div class="homes__header">
      <div>
        <p class="section-label">Habitaciones</p>
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

    <div v-if="roomActionError" class="notice notice--error" role="alert">{{ roomActionError }}</div>
    <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>
    <div v-else-if="loading || loadingDevices" class="notice">Cargando dashboard...</div>

    <div v-else class="homes__content">
      <section class="panel panel--devices">
        <header class="panel__header">
          <h2 class="panel__title">Dispositivos</h2>
<RouterLink class="panel__link" to="/devices">Ver todas</RouterLink>
        </header>

        <div class="device-grid">
          <article
            v-for="device in displayedDevices" :key="device.id"
            class="device-card" :class="{ 'device-card--accent': device.tone === 'sage' }"
            @click="openDeviceModal(device)"
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

              <label v-if="device.kind !== 'fridge'" class="switch" :aria-label="`Cambiar ${device.name}`" @click.stop>
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

          <button class="device-card device-card--new" type="button" aria-label="Agregar dispositivo"
            @click="showAddDevice = true">
            <span class="device-card__plus">+</span>
            <span>Nuevo</span>
          </button>
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
            <span class="routine-arrow" aria-hidden="true">›</span>
          </article>

          <button class="routine-card routine-card--new" type="button" aria-label="Crear rutina">
            <span class="routine-card__plus">+</span>
            <span>Nuevo</span>
          </button>
        </div>
      </aside>
    </div>

    <DeviceModal
      v-if="selectedDevice"
      :device="selectedDevice"
      :room-name="selectedRoomName"
      @close="closeDeviceModal"
      @device-updated="(id, isOn) => {
        const d = allDevices.find(x => x.id === id)
        if (d) { d.isOn = isOn; d.tone = isOn ? 'sage' : 'neutral' }
      }"
    />

    <AddDeviceModal
      v-if="showAddDevice"
      :room-id="activeRoomId"
      :room-name="store.rooms.find(r => r.id === activeRoomId)?.name ?? ''"
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

.notice {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 16px;
  padding: 0.8rem 1rem;
  margin-top: 0.2rem;
  font-weight: 600;
  color: rgba(42, 40, 37, 0.7);
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.08);
}

.notice--error {
  color: #8a2d2d;
  background: rgba(180, 60, 60, 0.12);
  box-shadow: inset 0 0 0 1px rgba(180, 60, 60, 0.2);
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

.room-tabs::-webkit-scrollbar {
  display: none;
}

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

.homes__content {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 0.9fr);
  gap: 1.8rem;
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

.panel__link {
  font-size: 0.85rem;
  color: rgba(42, 40, 37, 0.65);
  font-weight: 600;
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

.device-card__body h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.device-card__body p {
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

.switch input:checked {
  background: rgba(63, 129, 102, 0.65);
}

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

.switch input:checked + .switch__track {
  transform: translateX(14px);
}

.switch input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.switch input:disabled + .switch__track {
  background: #e0e0e0;
}

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

.routine-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.routine-card {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 16px;
  padding: 0.9rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.8rem;
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
}

.routine-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(190, 190, 166, 0.45);
  color: rgba(42, 40, 37, 0.85);
}

.routine-icon svg {
  width: 22px;
  height: 22px;
}

.routine-info h3 {
  font-size: 0.95rem;
  font-weight: 600;
}

.routine-info p {
  font-size: 0.78rem;
  color: rgba(42, 40, 37, 0.6);
}

.routine-info span {
  font-size: 0.72rem;
  color: rgba(42, 40, 37, 0.6);
}

.routine-arrow {
  font-size: 1.2rem;
  color: rgba(42, 40, 37, 0.55);
}

.routine-card--new {
  border: 1px dashed rgba(42, 40, 37, 0.2);
  background: transparent;
  justify-content: center;
  grid-template-columns: auto auto;
  cursor: pointer;
}

.routine-card__plus {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  color: rgba(42, 40, 37, 0.55);
}

@media (max-width: 1024px) {
  .homes__content {
    grid-template-columns: 1fr;
  }
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
