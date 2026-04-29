import { computed, onMounted, ref, watch } from 'vue'
import { api, ApiError } from '@/services/api/client'

type ApiHome = {
  id: string
  name: string
}

type ApiRoom = {
  id: string
  name: string
}

type ApiDevice = {
  id: string
  name: string
  type?: { name?: string }
  typeId?: string
}

type ApiRoutine = {
  id: string
  name: string
  actions?: unknown[]
  schedule?: { time?: string }
}

type ApiDeviceState = {
  status?: string
  on?: boolean
  temperature?: number
  brightness?: number
}

type Room = {
  id: string
  name: string
}

type Device = {
  id: string
  name: string
  status: string
  roomId: string
  kind: 'vacuum' | 'speaker' | 'tap' | 'blind' | 'lamp' | 'oven' | 'ac' | 'door' | 'fridge' | 'other'
  isOn: boolean
  tone?: 'sage' | 'neutral'
}

type Routine = {
  id: string
  name: string
  summary: string
  time: string
  icon: 'moon' | 'sun' | 'movie'
}

function normalizeDeviceKind(device: ApiDevice): Device['kind'] {
  const source = `${device.type?.name ?? ''} ${device.typeId ?? ''}`.toLowerCase()
  if (source.includes('vacuum')) return 'vacuum'
  if (source.includes('speaker') || source.includes('audio')) return 'speaker'
  if (source.includes('tap') || source.includes('faucet')) return 'tap'
  if (source.includes('blind') || source.includes('curtain')) return 'blind'
  if (source.includes('lamp') || source.includes('light')) return 'lamp'
  if (source.includes('oven')) return 'oven'
  if (source.includes('air') || source.includes('ac') || source.includes('conditioner')) return 'ac'
  if (source.includes('door') || source.includes('lock')) return 'door'
  if (source.includes('fridge') || source.includes('refrigerator')) return 'fridge'
  return 'other'
}

function formatStatus(state?: ApiDeviceState): string {
  if (!state) return 'Sin estado'
  if (typeof state.status === 'string') return state.status
  if (typeof state.on === 'boolean') return state.on ? 'Encendido' : 'Apagado'
  if (typeof state.temperature === 'number') return `${state.temperature}C`
  if (typeof state.brightness === 'number') return `Brillo ${state.brightness}%`
  return 'Sin estado'
}

function resolveIsOn(state?: ApiDeviceState): boolean {
  if (!state) return false
  if (typeof state.on === 'boolean') return state.on
  if (typeof state.status === 'string') {
    const status = state.status.toLowerCase()
    return ['on', 'encendido', 'abierto', 'open', 'active', 'running', 'playing', 'cool', 'cooling', 'heat', 'heating', 'locked'].includes(status)
  }
  return false
}

//falta agregar iconos genericos
function mapRoutineIcon(name: string): Routine['icon'] {
  const text = name.toLowerCase()
  if (text.includes('dorm') || text.includes('noche')) return 'moon'
  if (text.includes('dia') || text.includes('manana')) return 'sun'
  return 'movie'
}

export function useHomesDashboard() {
  const homes = ref<ApiHome[]>([])
  const rooms = ref<Room[]>([])
  const devices = ref<Device[]>([])
  const routines = ref<Routine[]>([])
  const activeHomeId = ref('')
  const activeRoomId = ref('')
  const loading = ref(true)
  const error = ref('')
  const pendingActions = ref(new Set<string>())

  const filteredDevices = computed(() =>
    devices.value.filter(device => device.roomId === activeRoomId.value)
  )

  async function loadHomes() {
    const data = await api.get<ApiHome[]>('/homes')
    homes.value = data
    activeHomeId.value = data[0]?.id ?? ''
  }

  async function loadRooms(homeId: string) {
    if (!homeId) {
      rooms.value = []
      activeRoomId.value = ''
      return
    }
    const data = await api.get<ApiRoom[]>(`/homes/${homeId}/rooms`)
    rooms.value = data.map(room => ({ id: room.id, name: room.name }))
    if (!rooms.value.find(room => room.id === activeRoomId.value)) {
      activeRoomId.value = rooms.value[0]?.id ?? ''
    }
  }

  async function loadDevices(roomId: string) {
    if (!roomId) {
      devices.value = []
      return
    }
    const data = await api.get<ApiDevice[]>(`/rooms/${roomId}/devices`)
    const states = await Promise.all(
      data.map(device =>
        api
          .get<ApiDeviceState>(`/devices/${device.id}/state`)
          .then(state => ({ id: device.id, state }))
          .catch(() => ({ id: device.id, state: undefined }))
      )
    )
    const stateMap = new Map(states.map(item => [item.id, item.state]))
    devices.value = data.map(device => {
      const state = stateMap.get(device.id)
      return {
        id: device.id,
        name: device.name,
        roomId,
        kind: normalizeDeviceKind(device),
        status: formatStatus(state),
        isOn: resolveIsOn(state),
        tone: resolveIsOn(state) ? 'sage' : 'neutral',
      }
    })
  }

  async function loadRoutines() {
    const data = await api.get<ApiRoutine[]>('/routines')
    routines.value = data.map(routine => ({
      id: routine.id,
      name: routine.name,
      summary: routine.actions ? `${routine.actions.length} acciones` : 'Manual',
      time: routine.schedule?.time ?? '',
      icon: mapRoutineIcon(routine.name),
    }))
  }

  async function toggleDevice(id: string) {
    const target = devices.value.find(device => device.id === id)
    if (!target || pendingActions.value.has(id)) return

    pendingActions.value.add(id)
    const nextAction = target.isOn ? 'turnOff' : 'turnOn'
    const previous = target.isOn
    target.isOn = !target.isOn
    try {
      await api.patch(`/devices/${id}/${nextAction}`, {})
      const state = await api.get<ApiDeviceState>(`/devices/${id}/state`).catch(() => undefined)
      target.status = formatStatus(state)
      target.isOn = resolveIsOn(state)
    } catch (err) {
      target.isOn = previous
      if (err instanceof ApiError) {
        error.value = `No se pudo actualizar ${target.name}. (${err.status})`
      } else {
        error.value = `No se pudo actualizar ${target.name}.`
      }
    } finally {
      pendingActions.value.delete(id)
    }
  }

  async function loadDashboard() {
    loading.value = true
    error.value = ''
    try {
      await loadHomes()
      await Promise.all([
        loadRooms(activeHomeId.value),
        loadRoutines(),
      ])
      await loadDevices(activeRoomId.value)
    } catch (err) {
      if (err instanceof ApiError) {
        error.value = `Error ${err.status} cargando datos.`
      } else {
        error.value = 'Error inesperado cargando datos.'
      }
    } finally {
      loading.value = false
    }
  }

  onMounted(loadDashboard)

  watch(activeHomeId, async (homeId, prev) => {
    if (homeId === prev) return
    error.value = ''
    try {
      await loadRooms(homeId)
      await loadDevices(activeRoomId.value)
    } catch (err) {
      if (err instanceof ApiError) {
        error.value = `Error ${err.status} cargando habitaciones.`
      } else {
        error.value = 'Error inesperado cargando habitaciones.'
      }
    }
  })

  watch(activeRoomId, async (roomId, prev) => {
    if (roomId === prev) return
    error.value = ''
    try {
      await loadDevices(roomId)
    } catch (err) {
      if (err instanceof ApiError) {
        error.value = `Error ${err.status} cargando dispositivos.`
      } else {
        error.value = 'Error inesperado cargando dispositivos.'
      }
    }
  })

  return {
    homes,
    rooms,
    devices,
    routines,
    activeHomeId,
    activeRoomId,
    filteredDevices,
    loading,
    error,
    pendingActions,
    toggleDevice,
  }
}
