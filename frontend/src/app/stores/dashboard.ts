import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { api, ApiError } from '@/services/api/client'

/* Tipos de la API */

type ApiHome = {
  id: string
  name: string
}

type ApiMember = {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
}

type ApiRoom = {
  id: string
  name: string
}

type ApiDevice = {
  id: string
  name: string
  type?: { name?: string }  /* type o typeId pueden ser opcionales. */
  typeId?: string
}

type ApiRoutine = {
  id: string
  name: string
  actions?: unknown[]       /* Cada elemento puede tener una estructura diferente. */
  schedule?: { time?: string }
}

type ApiDeviceState = {
  status?: string
  on?: boolean
  temperature?: number
  brightness?: number
}

/* Tipos internos */

export type Room = {
  id: string
  name: string
}

export type Member = {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
}

export type DeviceKind =          /* Mapeo de dispositivos. */
  | 'vacuum' | 'speaker' | 'tap' | 'blind'
  | 'lamp'   | 'oven'    | 'ac'  | 'door'
  | 'fridge' | 'other'

export type Device = {
  id: string
  name: string
  status: string
  roomId: string
  kind: DeviceKind
  isOn: boolean
  tone?: 'sage' | 'neutral'   /* sage -> encendido, neutral -> apagado */
}

export type Routine = {
  id: string
  name: string
  summary: string
  time: string
  icon: 'moon' | 'sun' | 'movie'
}

/* Helpers de mapeo y formateo */

function normalizeDeviceKind(device: ApiDevice): DeviceKind {
  const source = `${device.type?.name ?? ''} ${device.typeId ?? ''}`.toLowerCase()
  if (source.includes('vacuum')){
    return 'vacuum'
  }

  if (source.includes('speaker') || source.includes('audio')){
    return 'speaker'
  }

  if (source.includes('tap') || source.includes('faucet')){
    return 'tap'
  }

  if (source.includes('blind') || source.includes('curtain')){
    return 'blind'
  }

  if (source.includes('lamp') || source.includes('light')){
    return 'lamp'
  }

  if (source.includes('oven')){
    return 'oven'
  }

  if (source.includes('air') || source.includes('ac') || source.includes('conditioner')){
    return 'ac'
  }

  if (source.includes('door') || source.includes('lock')){
    return 'door'
  }

  if (source.includes('fridge') || source.includes('refrigerator')){
    return 'fridge'
  }

  return 'other'
}

function formatStatus(state?: ApiDeviceState): string {
  if(!state){
    return 'Sin estado'
  }

  if (typeof state.status === 'string'){
    return state.status
  }

  if (typeof state.on === 'boolean'){
    return state.on ? 'Encendido' : 'Apagado'
  }

  if (typeof state.temperature === 'number'){
    return `${state.temperature}°C`
  }

  if (typeof state.brightness === 'number') {
    return `Brillo ${state.brightness}%`
  }

  return 'Sin estado'   /* Fallback genérico. */
}

function resolveIsOn(state?: ApiDeviceState): boolean {
  if(!state){ 
    return false
  }

  if(typeof state.on === 'boolean'){
    return state.on
  }

  if(typeof state.status === 'string'){
    const s = state.status.toLowerCase()
    return ['on', 'encendido', 'abierto', 'open', 'active',
            'running', 'playing', 'cool', 'cooling',
            'heat', 'heating', 'locked'].includes(s)
  }

  return false
}

function mapRoutineIcon(name: string): Routine['icon'] {
  const text = name.toLowerCase()

  if(text.includes('dorm') || text.includes('noche')){
    return 'moon'
  }

  if(text.includes('dia')  || text.includes('manana')){
    return 'sun'
  }

  return 'movie'
}

/* Store de dashboard */

export const useDashboardStore = defineStore('dashboard', () => {

  /* Estado reactivo */
  const homes = ref<ApiHome[]>([])
  const rooms = ref<Room[]>([])
  const devices = ref<Device[]>([])
  const routines = ref<Routine[]>([])
  const members = ref<Member[]>([])
  const activeHomeId = ref('')
  const activeRoomId = ref('')
  const loading = ref(false)
  const error = ref('')
  const pendingActions = ref(new Set<string>())

  const filteredDevices = computed(() =>
    devices.value.filter(d => d.roomId === activeRoomId.value)
  )

  /* Loaders: funciones para cargar datos desde la API */
  async function loadHomes(): Promise<void> {
    let data = await api.get<ApiHome[]>('/homes')
    
    // Si la API no devuelve casas, creamos una por defecto en el backend
    if (data.length === 0) {
      try {
        const newHome = await api.post<ApiHome>('/homes', { name: "Casa 1", metadata: {} })

        /* Asignamos la casa recién creada con un ID real de la BD. */
        data = [newHome]

      }catch (err){
        console.error("No se pudo crear la casa por defecto", err)
      
        /* Si falla, dejamos el array vacío para que UI no colapse. */
        data = [] 
      }
    }

    homes.value = data
    activeHomeId.value = data[0]?.id ?? ''
  }

  async function loadRooms(homeId: string): Promise<void> {
    if(!homeId){
      rooms.value     = []
      activeRoomId.value = ''
      return
    }

    const data = await api.get<ApiRoom[]>(`/homes/${homeId}/rooms`)
    rooms.value = data.map(r => ({ id: r.id, name: r.name }))

    /* Si el room activo ya no existe en el nuevo home, reseteamos */
    if(!rooms.value.find(r => r.id === activeRoomId.value)){
      activeRoomId.value = rooms.value[0]?.id ?? ''
    }
  }

  async function loadDevices(roomId: string): Promise<void> {
    if(!roomId){
      devices.value = []
      return
    }
    const data = await api.get<ApiDevice[]>(`/rooms/${roomId}/devices`)

    /* Fetcheamos todos los estados en paralelo */
    const states = await Promise.all(
      data.map(device =>
        api.get<ApiDeviceState>(`/devices/${device.id}/state`)
          .then(state => ({ id: device.id, state }))
          .catch(()  => ({ id: device.id, state: undefined }))
      )
    )
    const stateMap = new Map(states.map(s => [s.id, s.state]))

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

  async function loadRoutines(): Promise<void> {
    const data = await api.get<ApiRoutine[]>('/routines')
    routines.value = data.map(r => ({
      id: r.id,
      name: r.name,
      summary: r.actions ? `${r.actions.length} acciones` : 'Manual',
      time: r.schedule?.time ?? '',
      icon: mapRoutineIcon(r.name),
    }))
  }

  async function loadMembers(homeId: string): Promise<void> {
    if (!homeId) {
      members.value = []
      return
    }
    const data = await api.get<ApiMember[]>(`/homes/${homeId}/share`)
    members.value = data.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role as Member['role'],
    }))
  }

  async function addMember(homeId: string, email: string): Promise<void> {
    const newMembers = await api.post<ApiMember[]>(`/homes/${homeId}/share`, { emails: [email] })
    const existingIds = new Set(members.value.map(m => m.id))
    for (const m of newMembers) {
      if (!existingIds.has(m.id)) {
        members.value.push({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role as Member['role'],
        })
      }
    }
  }

  async function removeMember(homeId: string, email: string): Promise<void> {
    await api.delete(`/homes/${homeId}/share`, { emails: [email] })
    members.value = members.value.filter(m => m.email !== email)
  }

  async function updateHomeName(homeId: string, name: string): Promise<void> {
    const home = homes.value.find(h => h.id === homeId)
    if (!home) return
    await api.put(`/homes/${homeId}`, { name })
    home.name = name
  }

  async function deleteHome(homeId: string): Promise<void> {
    await api.delete(`/homes/${homeId}`)
    const idx = homes.value.findIndex(h => h.id === homeId)
    if (idx !== -1) {
      homes.value.splice(idx, 1)
    }
    if (activeHomeId.value === homeId) {
      activeHomeId.value = homes.value[0]?.id ?? ''
    }
  }

  async function createHome(name: string): Promise<void> {
    const home = await api.post<ApiHome>('/homes', { name })
    homes.value.push(home)
    activeHomeId.value = home.id
  }

/* Carga inicial del dashboard, se llama desde AppLayout.vue */
  async function loadDashboard(): Promise<void> {

    // Si ya cargamos, no volvemos a fetchear todo
    if(homes.value.length > 0){
      return
    }

    loading.value = true
    error.value   = ''

    try {
      await loadHomes()
      await Promise.all([loadRooms(activeHomeId.value), loadRoutines(),])
      await loadDevices(activeRoomId.value)
    }catch(err){
      error.value = err instanceof ApiError
        ? `Error ${err.status} cargando datos.`
        : 'Error inesperado cargando datos.'
    }finally{
      loading.value = false
    }
  }

/* Acción para alternar el estado de un dispositivo (encender/apagar).*/
  async function toggleDevice(id: string): Promise<void> {
    const target = devices.value.find(d => d.id === id)
    if(!target || pendingActions.value.has(id)){
      return
    }

    pendingActions.value.add(id)
    const nextAction = target.isOn ? 'turnOff' : 'turnOn'
    const previous = target.isOn
    target.isOn = !target.isOn // optimistic update

    try {
      await api.patch(`/devices/${id}/${nextAction}`, {})
      const state = await api.get<ApiDeviceState>(`/devices/${id}/state`).catch(() => undefined)
      target.status = formatStatus(state)
      target.isOn = resolveIsOn(state)
      target.tone = target.isOn ? 'sage' : 'neutral'
    }catch (err){
      target.isOn = previous // rollback
      error.value = err instanceof ApiError
        ? `No se pudo actualizar ${target.name}. (${err.status})`
        : `No se pudo actualizar ${target.name}.`
    }finally{
      pendingActions.value.delete(id)   /* Libero el dispositivo. */
    }
  }

/* Watchers para recargar datos cuando cambian el home o la habitación activos. */
  watch(activeHomeId, async (id, prev) => {
    if(id === prev){
      return
    }

    error.value = ''

    try{
      await loadRooms(id)
      await loadDevices(activeRoomId.value)
    }catch (err){
      error.value = err instanceof ApiError
        ? `Error ${err.status} cargando habitaciones.`
        : 'Error inesperado cargando habitaciones.'
    }
  })

  watch(activeRoomId, async (id, prev) => {
    if(id === prev){
      return
    }

    error.value = ''

    try{
      await loadDevices(id)
    }catch (err){
      error.value = err instanceof ApiError
        ? `Error ${err.status} cargando dispositivos.`
        : 'Error inesperado cargando dispositivos.'
    }
  })
  function reset(): void {
    homes.value = []
    rooms.value = []
    devices.value = []
    routines.value = []
    members.value = []
    activeHomeId.value = ''
    activeRoomId.value = ''
    loading.value = false
    error.value = ''
    pendingActions.value = new Set()
  }
/* Retorno del store: estado y acciones disponibles para los componentes. */
  return {
    /* Estado */
    homes,
    rooms,
    devices,
    routines,
    members,
    activeHomeId,
    activeRoomId,
    filteredDevices,
    loading,
    error,
    pendingActions,
    /* Acciones */
    loadDashboard,
    loadRoutines,
    loadDevices,
    loadMembers,
    addMember,
    removeMember,
    updateHomeName,
    createHome,
    deleteHome,
    toggleDevice,

    reset,
  }
})