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
  type?: { id?: string; name?: string }
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

export type DeviceType = {
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
  typeId?: string              /* ID del tipo, para poder crear dispositivos del mismo tipo */
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
  const source = `${device.type?.name ?? ''} ${device.typeId ?? ''} ${device.name ?? ''}`.toLowerCase()
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

  if (source.includes('lamp') || source.includes('light') || source.includes('luz') || source.includes('lámpara')){
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

  if (source.includes('fridge') || source.includes('refrigerator') || source.includes('heladera')){
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

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/* Store de dashboard */

export const useDashboardStore = defineStore('dashboard', () => {

  /* Estado reactivo */
  const homes = ref<ApiHome[]>([])
  const rooms = ref<Room[]>([])
  const devices = ref<Device[]>([])
  const deviceTypes = ref<DeviceType[]>([])
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

  async function mapRoomDevices(roomId: string): Promise<Device[]> {
    if(!roomId){
      return []
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

    return data.map(device => {
      const state = stateMap.get(device.id)

      /* Acumulamos tipos únicos para usarlos al crear nuevos dispositivos. */
      const typeId   = device.type?.id ?? device.typeId
      const typeName = device.type?.name
      if (typeId && typeName && !deviceTypes.value.find(t => t.id === typeId)) {
        deviceTypes.value.push({ id: typeId, name: typeName })
      }

      const rawTypeId = device.type?.id ?? device.typeId
      const kind = normalizeDeviceKind(device)
      const isFridge = kind === 'fridge'

      return {
        id: device.id,
        name: device.name,
        roomId,
        kind,
        status: formatStatus(state),
        isOn: isFridge ? true : resolveIsOn(state),
        tone: isFridge ? 'sage' : (resolveIsOn(state) ? 'sage' : 'neutral'),
        typeId: rawTypeId,
      }
    })
  }

  async function loadDevices(roomId: string): Promise<void> {
    devices.value = await mapRoomDevices(roomId)
  }

  async function fetchHomeDevices(homeId: string): Promise<Device[]> {
    if (!homeId) {
      return []
    }

    const homeRooms = await api.get<ApiRoom[]>(`/homes/${homeId}/rooms`)
    const devicesByRoom = await Promise.all(
      homeRooms.map(async (room) => {
        try {
          return await mapRoomDevices(room.id)
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            return []
          }
          throw err
        }
      }),
    )

    return devicesByRoom.flat()
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

  async function updateRoomName(roomId: string, name: string, homeId = activeHomeId.value): Promise<void> {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Ingresá un nombre para la habitación.')
    }

    const targetRoom = rooms.value.find(room => room.id === roomId)
    if (!targetRoom) {
      throw new Error('No se encontró la habitación seleccionada.')
    }

    try {
      await api.put(`/rooms/${roomId}`, { name: trimmedName })
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404 || !homeId) {
        throw err
      }
      await api.put(`/homes/${homeId}/rooms/${roomId}`, { name: trimmedName })
    }

    targetRoom.name = trimmedName
  }

  async function createRoom(name: string, homeId = activeHomeId.value): Promise<void> {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Ingresá un nombre para la habitación.')
    }
    if (!homeId) {
      throw new Error('No hay un hogar seleccionado.')
    }

    let room: ApiRoom
    try {
      room = await api.post<ApiRoom>(`/homes/${homeId}/rooms`, {
        name: trimmedName,
        metadata: {},
      })
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404) {
        throw err
      }

      // Algunos backends exponen creación de habitaciones en /rooms.
      room = await api.post<ApiRoom>('/rooms', {
        name: trimmedName,
        home: { id: homeId },
        metadata: {},
      })
    }

    if (!room?.id) {
      await loadRooms(homeId)
      const createdRoom = rooms.value.find(currentRoom => currentRoom.name === trimmedName)
      if (createdRoom) {
        activeRoomId.value = createdRoom.id
      }
      return
    }

    rooms.value.push({ id: room.id, name: room.name ?? trimmedName })
    activeRoomId.value = room.id
  }

  function finalizeRoomDeletion(roomId: string): void {
    rooms.value = rooms.value.filter(room => room.id !== roomId)
    devices.value = devices.value.filter(device => device.roomId !== roomId)

    const activeStillExists = rooms.value.some(room => room.id === activeRoomId.value)
    if (!activeStillExists) {
      activeRoomId.value = rooms.value[0]?.id ?? ''
    }
  }

  async function clearRoomDevices(roomId: string): Promise<void> {
    let roomDevices: ApiDevice[] = []
    try {
      roomDevices = await api.get<ApiDevice[]>(`/rooms/${roomId}/devices`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return
      }
      throw err
    }

    await Promise.all(roomDevices.map(async (device) => {
      try {
        await api.delete(`/devices/${device.id}`)
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err
        }
      }
    }))
  }

  async function deleteRoomRequest(roomId: string, homeId = activeHomeId.value): Promise<void> {
    try {
      await api.delete(`/rooms/${roomId}`)
      return
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404 || !homeId) {
        throw err
      }
    }

    await api.delete(`/homes/${homeId}/rooms/${roomId}`)
  }

  async function deleteRoom(roomId: string): Promise<void> {
    try {
      await deleteRoomRequest(roomId)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        finalizeRoomDeletion(roomId)
        return
      }

      if (!(err instanceof ApiError) || err.status !== 409) {
        throw err
      }

      await clearRoomDevices(roomId)
      try {
        await deleteRoomRequest(roomId)
      } catch (secondErr) {
        if (secondErr instanceof ApiError && secondErr.status === 404) {
          finalizeRoomDeletion(roomId)
          return
        }
        throw secondErr
      }
    }

    finalizeRoomDeletion(roomId)
  }

  async function clearHomeResources(homeId: string): Promise<void> {
    let homeMembers: ApiMember[] = []
    let homeRooms: ApiRoom[] = []
    try {
      ;[homeMembers, homeRooms] = await Promise.all([
        api.get<ApiMember[]>(`/homes/${homeId}/share`),
        api.get<ApiRoom[]>(`/homes/${homeId}/rooms`),
      ])
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return
      }
      throw err
    }

    if (homeMembers.length > 0) {
      try {
        await api.delete(`/homes/${homeId}/share`, {
          emails: homeMembers.map(member => member.email),
        })
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err
        }
      }
    }

    for (const room of homeRooms) {
      let roomDevices: ApiDevice[] = []
      try {
        roomDevices = await api.get<ApiDevice[]>(`/rooms/${room.id}/devices`)
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err
        }
      }
      await Promise.all(roomDevices.map(async (device) => {
        try {
          await api.delete(`/devices/${device.id}`)
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) {
            throw err
          }
        }
      }))
      try {
        await api.delete(`/rooms/${room.id}`)
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err
        }
      }
    }
  }

  function finalizeHomeDeletion(homeId: string, updatedHomes?: ApiHome[]): void {
    const wasActiveDeleted = activeHomeId.value === homeId
    const nextHomes = updatedHomes ?? homes.value.filter(h => h.id !== homeId)
    homes.value = nextHomes

    const activeStillExists = nextHomes.some(h => h.id === activeHomeId.value)
    if (!activeStillExists) {
      activeHomeId.value = nextHomes[0]?.id ?? ''
      members.value = []
    } else if (wasActiveDeleted) {
      members.value = []
    }

    if (!activeHomeId.value) {
      rooms.value = []
      devices.value = []
      routines.value = []
      activeRoomId.value = ''
    }
  }

  async function reconcileDeletedHome(homeId: string): Promise<boolean> {
    const attempts = 4
    for (let i = 0; i < attempts; i += 1) {
      const serverHomes = await api.get<ApiHome[]>('/homes')
      const homeStillExists = serverHomes.some(h => h.id === homeId)
      if (!homeStillExists) {
        finalizeHomeDeletion(homeId, serverHomes)
        return true
      }
      if (i < attempts - 1) {
        await wait(250)
      }
    }
    return false
  }

  async function deleteHome(homeId: string): Promise<void> {
    try {
      try {
        await api.delete(`/homes/${homeId}`)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          finalizeHomeDeletion(homeId)
          return
        }
        if (!(err instanceof ApiError) || err.status !== 409) {
          throw err
        }
        await clearHomeResources(homeId)
        try {
          await api.delete(`/homes/${homeId}`)
        } catch (secondErr) {
          if (secondErr instanceof ApiError && secondErr.status === 404) {
            finalizeHomeDeletion(homeId)
            return
          }
          throw secondErr
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const reconciled = await reconcileDeletedHome(homeId)
          if (reconciled) {
            return
          }
        } catch {
          // Si no podemos reconciliar contra backend, propagamos el error original.
        }
      }
      throw err
    }

    finalizeHomeDeletion(homeId)
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
    if(pendingActions.value.has(id)){
      return
    }

    const target = devices.value.find(d => d.id === id)

    if (target?.kind === 'fridge') {
      return
    }
    pendingActions.value.add(id)
    const previous = target?.isOn

    if (target) {
      target.isOn = !target.isOn // optimistic update
      target.tone = target.isOn ? 'sage' : 'neutral'
    }

    try {
      let isCurrentlyOn = previous
      if (typeof isCurrentlyOn !== 'boolean') {
        const currentState = await api.get<ApiDeviceState>(`/devices/${id}/state`).catch(() => undefined)
        isCurrentlyOn = resolveIsOn(currentState)
      }

      const nextAction = isCurrentlyOn ? 'turnOff' : 'turnOn'
      await api.patch(`/devices/${id}/${nextAction}`, {})
      if (target) {
        const state = await api.get<ApiDeviceState>(`/devices/${id}/state`).catch(() => undefined)
        target.status = formatStatus(state)
        target.isOn = resolveIsOn(state)
        target.tone = target.isOn ? 'sage' : 'neutral'
      }
    }catch (err){
      if (target && typeof previous === 'boolean') {
        target.isOn = previous // rollback
        target.tone = previous ? 'sage' : 'neutral'
      }
      error.value = err instanceof ApiError
        ? `No se pudo actualizar ${target?.name ?? 'dispositivo'}. (${err.status})`
        : `No se pudo actualizar ${target?.name ?? 'dispositivo'}.`
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
    deviceTypes.value = []
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
    deviceTypes,
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
    loadRooms,
    loadRoutines,
    loadDevices,
    fetchHomeDevices,
    loadMembers,
    addMember,
    removeMember,
    updateHomeName,
    updateRoomName,
    createHome,
    createRoom,
    deleteHome,
    deleteRoom,
    toggleDevice,

    reset,
  }
})
