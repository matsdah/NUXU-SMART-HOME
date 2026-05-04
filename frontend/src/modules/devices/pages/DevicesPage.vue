<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/services/api/client'
import { useDashboardStore } from '@/app/stores/dashboard'
import type { Device, DeviceKind } from '@/app/stores/dashboard'
import DeviceModal from '../components/DeviceModal.vue'

const store = useDashboardStore()

// Dispositivos de todos los cuartos cargados localmente (sin pisar el store)
const allDevices = ref<Device[]>([])
const loadingDevices = ref(true)

// Filtro activo: 'all' o un roomId
const activeFilter = ref<'all' | string>('all')

// Modal
const selectedDevice = ref<Device | null>(null)
const selectedRoomName = ref('')

const filteredDevices = computed(() => {
  if (activeFilter.value === 'all') return allDevices.value
  return allDevices.value.filter(d => d.roomId === activeFilter.value)
})

function roomName(roomId: string): string {
  return store.rooms.find(r => r.id === roomId)?.name ?? ''
}

function openModal(device: Device) {
  selectedDevice.value = device
  selectedRoomName.value = roomName(device.roomId)
}

function closeModal() {
  selectedDevice.value = null
  selectedRoomName.value = ''
}

type ApiDevice  = { id: string; name: string; type?: { name?: string }; typeId?: string }
type ApiState   = { status?: string; on?: boolean; temperature?: number; brightness?: number }

function toKind(d: ApiDevice): DeviceKind {
  const s = `${d.type?.name ?? ''} ${d.typeId ?? ''}`.toLowerCase()
  if (s.includes('vacuum'))                          return 'vacuum'
  if (s.includes('speaker') || s.includes('audio')) return 'speaker'
  if (s.includes('tap')     || s.includes('faucet'))return 'tap'
  if (s.includes('blind')   || s.includes('curtain'))return 'blind'
  if (s.includes('lamp')    || s.includes('light')) return 'lamp'
  if (s.includes('oven'))                            return 'oven'
  if (s.includes('air')     || s.includes('ac') || s.includes('conditioner')) return 'ac'
  if (s.includes('door')    || s.includes('lock'))  return 'door'
  if (s.includes('fridge')  || s.includes('refrigerator')) return 'fridge'
  return 'other'
}

function toStatus(state?: ApiState): string {
  if (!state) return 'Sin estado'
  if (typeof state.status      === 'string') return state.status
  if (typeof state.on          === 'boolean') return state.on ? 'Encendido' : 'Apagado'
  if (typeof state.temperature === 'number') return `${state.temperature}°C`
  if (typeof state.brightness  === 'number') return `Brillo ${state.brightness}%`
  return 'Sin estado'
}

function toIsOn(state?: ApiState): boolean {
  if (!state) return false
  if (typeof state.on === 'boolean') return state.on
  if (typeof state.status === 'string') {
    return ['on','encendido','abierto','open','active','running',
            'playing','cool','cooling','heat','heating','locked']
      .includes(state.status.toLowerCase())
  }
  return false
}

async function loadRoomDevices(roomId: string): Promise<Device[]> {
  const raw = await api.get<ApiDevice[]>(`/rooms/${roomId}/devices`)
  const states = await Promise.all(
    raw.map(d =>
      api.get<ApiState>(`/devices/${d.id}/state`)
        .then(s => ({ id: d.id, state: s }))
        .catch(() => ({ id: d.id, state: undefined }))
    )
  )
  const stateMap = new Map(states.map(s => [s.id, s.state]))
  return raw.map(d => {
    const state = stateMap.get(d.id)
    const isOn  = toIsOn(state)
    return {
      id: d.id, name: d.name, roomId,
      kind:   toKind(d),
      status: toStatus(state),
      isOn,
      tone: isOn ? 'sage' : 'neutral',
    }
  })
}

async function loadAllDevices() {
  loadingDevices.value = true
  try {
    const results = await Promise.all(
      store.rooms.map(room => loadRoomDevices(room.id).catch(() => [] as Device[]))
    )
    allDevices.value = results.flat()
  } finally {
    loadingDevices.value = false
  }
}

async function toggleDevice(device: Device) {
  if (store.pendingActions.has(device.id)) return
  // Optimistic update en la lista local
  device.isOn = !device.isOn
  device.tone = device.isOn ? 'sage' : 'neutral'
  const action = device.isOn ? 'turnOn' : 'turnOff'
  store.pendingActions.add(device.id)
  try {
    await api.patch(`/devices/${device.id}/${action}`, {})
    const state = await api.get<ApiState>(`/devices/${device.id}/state`).catch(() => undefined)
    device.status = toStatus(state)
    device.isOn   = toIsOn(state)
    device.tone   = device.isOn ? 'sage' : 'neutral'
  } catch {
    // Revertir si falla
    device.isOn = !device.isOn
    device.tone = device.isOn ? 'sage' : 'neutral'
  } finally {
    store.pendingActions.delete(device.id)
  }
}

onMounted(async () => {
  await store.loadDashboard()
  await loadAllDevices()
})
</script>

<template>
  <section class="devices-page">

    <div class="devices-page__header">
      <p class="section-label">Dispositivos</p>

      <div class="room-tabs">
        <button
          class="room-tab" :class="{ 'room-tab--active': activeFilter === 'all' }"
          type="button" @click="activeFilter = 'all'"
        >
          Todos
        </button>
        <button
          v-for="room in store.rooms" :key="room.id"
          class="room-tab" :class="{ 'room-tab--active': activeFilter === room.id }"
          type="button" @click="activeFilter = room.id"
        >
          {{ room.name }}
        </button>
      </div>
    </div>

    <div v-if="store.error" class="notice notice--error" role="alert">{{ store.error }}</div>
    <div v-else-if="store.loading || loadingDevices" class="notice">Cargando dispositivos...</div>

    <div v-else class="device-grid">
      <article
        v-for="device in filteredDevices" :key="device.id"
        class="device-card" :class="{ 'device-card--accent': device.tone === 'sage' }"
        @click="openModal(device)"
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
              :disabled="store.pendingActions.has(device.id)"
              @change="toggleDevice(device)"
            />
            <span class="switch__track"></span>
          </label>
        </div>

        <div class="device-card__body">
          <p class="device-card__room">{{ roomName(device.roomId) }}</p>
          <h3>{{ device.name }}</h3>
          <p>{{ device.status }}</p>
        </div>
      </article>

      <div v-if="filteredDevices.length === 0" class="devices-empty">
        No hay dispositivos en esta habitación.
      </div>
    </div>

    <DeviceModal
      v-if="selectedDevice"
      :device="selectedDevice"
      :room-name="selectedRoomName"
      @close="closeModal"
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
  flex-direction: column;
  gap: 0.75rem;
}

.section-label {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.room-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.6rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  background: rgba(255, 255, 255, 0.55);
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
  white-space: nowrap;
  transition: all 0.2s ease;
}

.room-tab--active {
  background: rgba(42, 40, 37, 0.95);
  color: #f7f3e7;
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

.device-card__room {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(42, 40, 37, 0.45);
  margin-bottom: 0.15rem;
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

.devices-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 2rem;
  color: rgba(42, 40, 37, 0.45);
  font-size: 0.9rem;
}

@media (max-width: 720px) {
  .device-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
