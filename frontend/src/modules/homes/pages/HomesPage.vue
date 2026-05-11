<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHomesDashboard } from '@/modules/homes/composables/useHomesDashboard'
import { useDashboardStore } from '@/app/stores/dashboard'
import type { Device } from '@/app/stores/dashboard'
import { api, ApiError } from '@/services/api/client'
import { useToast } from '@/shared/composables/useToast'
import { useDeviceList } from '@/shared/composables/useDeviceList'
import { useRoomTabs } from '@/shared/composables/useRoomTabs'
import { handleApiError } from '@/shared/utils/api-error-handler'
import DeviceIcon from '@/shared/components/DeviceIcon.vue'
import RoutineIcon from '@/shared/components/RoutineIcon.vue'
import DeviceModal from '@/modules/devices/components/DeviceModal.vue'
import AddDeviceModal from '@/modules/devices/components/AddDeviceModal.vue'
import AddRoomModal from '@/modules/homes/components/AddRoomModal.vue'
import DeleteRoomConfirmModal from '@/modules/homes/components/DeleteRoomConfirmModal.vue'
import EditRoomModal from '@/modules/homes/components/EditRoomModal.vue'
import RoutineFormModal from '@/modules/routines/components/RoutineFormModal.vue'
import type { RoutineCard } from '@/modules/routines/components/RoutineFormModal.vue'
import { useSocketStore } from '@/app/stores/socket'
import '@/shared/styles/device-card.css'
import '@/shared/styles/room-tabs.css'
import '@/shared/styles/shared-panel.css'

const { activeHomeId, routines, loading, error, pendingActions } = useHomesDashboard()
const store = useDashboardStore()
const socketStore = useSocketStore()
const { showToast } = useToast()

// ---- Room tabs ----
const activeRoomFilter = ref<'all' | string>('all')

const roomTabs = useRoomTabs(activeRoomFilter, {
  onRoomsChanged: async () => {
    await deviceList.refreshDevices({ silent: true })
    socketStore.deviceListVersion++
  },
})

// ---- Device list ----
const deviceList = useDeviceList({
  activeHomeId,
  loading,
  onHomeChanged: () => { activeRoomFilter.value = 'all' },
})

const { allDevices } = deviceList

const displayedDevices = computed(() => {
  if (activeRoomFilter.value === 'all') return allDevices.value
  return allDevices.value.filter(d => d.roomId === activeRoomFilter.value)
})

// ---- Device modal ----
const selectedDevice = ref<Device | null>(null)
const selectedRoomName = ref('')

function openDeviceModal(device: Device) {
  selectedDevice.value = device
  selectedRoomName.value = store.rooms.find(r => r.id === device.roomId)?.name ?? ''
}

function closeDeviceModal() {
  selectedDevice.value = null
}

function onDeviceUpdated(id: string, isOn: boolean) {
  deviceList.applyDeviceUpdate(id, isOn)
}

async function onDeviceCreated() {
  showAddDevice.value = false
  await deviceList.refreshDevices({ silent: true })
}

// ---- Add device ----
const showAddDevice = ref(false)

// ---- Routines ----
const showCreateRoutine = ref(false)
const runningRoutineId = ref<string | null>(null)

async function executeRoutine(id: string) {
  if (runningRoutineId.value) return
  runningRoutineId.value = id
  try {
    await api.patch(`/routines/${id}/execute`, {})
    await deviceList.refreshDevices({ silent: true })
    showToast('Rutina ejecutada correctamente.', 'success')
  } catch (e) {
    const { message, type } = handleApiError(e)
    showToast(message, type)
  } finally {
    runningRoutineId.value = null
  }
}

async function toggleRoutineSchedule(id: string) {
  const idx = routines.value.findIndex((r) => r.id === id)
  if (idx < 0) return
  const routine = routines.value[idx]!
  if (routine.scheduleMode !== 'scheduled') return

  try {
    const existing = await api.get<{ id: string; name: string; actions?: unknown[]; metadata?: Record<string, unknown> }>(`/routines/${id}`)
    const nextEnabled = !routine.scheduleEnabled
    await api.put(`/routines/${id}`, {
      name: existing.name,
      actions: existing.actions ?? [],
      metadata: {
        ...existing.metadata,
        scheduleEnabled: nextEnabled,
      },
    })
    routine.scheduleEnabled = nextEnabled
    showToast(nextEnabled ? 'Programación activada.' : 'Programación pausada.', 'success')
  } catch (e: unknown) {
    const apiError = e instanceof ApiError ? e : null
    const msg = apiError
      ? `Error ${apiError.status} al cambiar el estado.`
      : 'No se pudo cambiar el estado de la programación.'
    showToast(msg, 'error')
  }
}

function onRoutineCreated(_routine: RoutineCard) {
  showCreateRoutine.value = false
  store.invalidateRoutines()
  void store.loadRoutines()
}
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
            @click="roomTabs.selectAllRooms"
          >
            Todos
          </button>
          <button
            v-for="room in roomTabs.rooms" :key="room.id" type="button"
            class="room-tab" :class="{ 'room-tab--active': room.id === activeRoomFilter }"
            @click="roomTabs.selectRoom(room.id)"
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
            :disabled="roomTabs.rooms.length === 0 || activeRoomFilter === 'all'"
            @click="roomTabs.requestRoomDeletion"
          >
            <span aria-hidden="true">&#128465;</span>
          </button>
          <button
            class="room-tab room-tab--icon"
            type="button"
            aria-label="Editar habitación"
            :disabled="roomTabs.rooms.length === 0 || activeRoomFilter === 'all'"
            @click="roomTabs.requestRoomRename"
          >
            <span aria-hidden="true">&#9998;</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>
    <div v-else-if="loading || deviceList.loadingDevices.value" class="notice">Cargando dashboard...</div>

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
                :class="{ 'device-icon--off': !device.isOn && device.kind !== 'fridge' && device.kind !== 'door' }"
                aria-hidden="true"
              >
                <DeviceIcon :kind="device.kind" />
              </div>

              <label v-if="device.kind !== 'fridge' && device.kind !== 'door' && device.kind !== 'alarm'" class="switch" :aria-label="`Cambiar ${device.name}`" @click.stop>
                <input
                  type="checkbox" :checked="device.isOn"
                  :disabled="pendingActions.has(device.id)"
                  @change="deviceList.toggleDevice(device.id)"
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
          <button class="routine-card routine-card--new" type="button" aria-label="Crear rutina" @click="showCreateRoutine = true">
            <span class="routine-card__plus">+</span>
            <span>Nueva</span>
          </button>
          <article
            v-for="routine in routines"
            :key="routine.id"
            class="routine-card"
            :class="{
              'routine-card--scheduled': routine.scheduleMode === 'scheduled' && routine.scheduleEnabled,
              'routine-card--scheduled-paused': routine.scheduleMode === 'scheduled' && !routine.scheduleEnabled,
            }"
          >
            <div class="routine-icon" aria-hidden="true">
              <RoutineIcon :icon="routine.icon" />
            </div>
            <div class="routine-info">
              <h3>{{ routine.name }}</h3>
              <p>{{ routine.summary }}</p>
              <span v-if="routine.time">{{ routine.time }}</span>
            </div>
            <button
              v-if="routine.scheduleMode !== 'scheduled'"
              type="button"
              class="routine-card__play"
              :disabled="runningRoutineId !== null"
              :aria-label="`Ejecutar ${routine.name}`"
              @click.stop="executeRoutine(routine.id)"
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
            <button
              v-else
              type="button"
              class="routine-card__play"
              :class="{
                'routine-card__play--scheduled-on': routine.scheduleEnabled,
                'routine-card__play--scheduled-off': !routine.scheduleEnabled,
              }"
              :aria-label="routine.scheduleEnabled ? 'Pausar programación' : 'Activar programación'"
              @click.stop="toggleRoutineSchedule(routine.id)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </button>
          </article>
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
      :room-id="store.activeRoomId"
      :room-name="store.rooms.find(r => r.id === store.activeRoomId)?.name ?? ''"
      :show-room-selector="activeRoomFilter === 'all'"
      @close="showAddDevice = false"
      @created="onDeviceCreated"
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

    <RoutineFormModal
      v-if="showCreateRoutine"
      mode="create"
      @close="showCreateRoutine = false"
      @created="onRoutineCreated"
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

/* Scheduled routine card states — match device on/off colours */
.routine-card--scheduled {
  background: rgba(190, 190, 166, 0.6);
  box-shadow: inset 0 0 0 1px rgba(158, 155, 142, 0.3);
}

.routine-card--scheduled:hover {
  background: rgba(190, 190, 166, 0.75);
}

.routine-card--scheduled-paused {
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
}

.routine-card--scheduled-paused:hover {
  background: rgba(255, 255, 255, 0.95);
}

/* Schedule toggle button states — match device switch */
.routine-card__play--scheduled-on {
  background: rgba(63, 129, 102, 0.65);
  color: #fff;
}

.routine-card__play--scheduled-on:hover:not(:disabled) {
  background: rgba(63, 129, 102, 0.85);
}

.routine-card__play--scheduled-off {
  background: rgba(42, 40, 37, 0.18);
  color: rgba(42, 40, 37, 0.6);
}

.routine-card__play--scheduled-off:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.3);
}
</style>
