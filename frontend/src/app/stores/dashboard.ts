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

type ApiDeviceDetail = {
  type?: { id?: string }
  typeId?: string
  room?: { id?: string }
  roomId?: string
  state?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

type ApiCreatedDevice = {
  id?: string
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
}

export type DeviceKind =          /* Mapeo de dispositivos. */
  | 'vacuum' | 'speaker' | 'tap' | 'blind'
  | 'lamp'   | 'oven'    | 'ac'  | 'door'
  | 'fridge' | 'alarm'   | 'other'

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

const TYPE_ID_MAP: Record<string, DeviceKind> = {
  'go46xmbqei8eoaomjk3p': 'ac',
  'ofglvd9gzubmmk9hzfal': 'vacuum',
  'eu0v2xgprrhhg41o':     'lamp',
  'im77xyzlyfm3oijpo3eh': 'speaker',
  'dbrlpeuy8t19pbt0mlkr': 'tap',
  'lsq3up3bkgqk0k0f64jf': 'blind',
  'otmbrewtofbpfqm6dxne': 'oven',
  's1b0bk0tj4lpyzm6oc2l': 'door',
  'rnizejujvmx3dxl1o6km': 'fridge',
}

function normalizeDeviceKind(device: ApiDevice): DeviceKind {
  const resolvedTypeId = device.type?.id ?? device.typeId
if (resolvedTypeId && TYPE_ID_MAP[resolvedTypeId]) return TYPE_ID_MAP[resolvedTypeId]

  const source = `${device.type?.name ?? ''} ${device.typeId ?? ''} ${device.name ?? ''}`.toLowerCase()

  if (source.includes('vacuum') || source.includes('aspiradora')) return 'vacuum'
  if (source.includes('speaker') || source.includes('audio') || source.includes('parlante')) return 'speaker'
  if (source.includes('tap') || source.includes('faucet') || source.includes('canilla') || source.includes('sprinkler') || source.includes('aspersor')) return 'tap'
  if (source.includes('blind') || source.includes('curtain') || source.includes('persiana') || source.includes('roller')) return 'blind'
  if (source.includes('lamp') || source.includes('light') || source.includes('luz') || source.includes('lámpara')) return 'lamp'
  if (source.includes('oven') || source.includes('horno')) return 'oven'
  if (source.includes('air') || source.includes('conditioner') || source.includes('aire')) return 'ac'
  if (source.includes('alarm') || source.includes('alarma')) return 'alarm'
  if (source.includes('door') || source.includes('lock') || source.includes('puerta')) return 'door'
  if (source.includes('fridge') || source.includes('refrigerator') || source.includes('heladera')) return 'fridge'

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
            'running', 'playing', 'paused', 'opened', 'opening', 'cool', 'cooling',
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

const LOCAL_STATE_STORAGE_PREFIX: Partial<Record<DeviceKind, string>> = {
  ac: 'ac-controls-state:',
  oven: 'oven-controls-state:',
  lamp: 'lamp-controls-state:',
  fridge: 'fridge-controls-state:',
}

type PersistedControlKind = 'ac' | 'oven' | 'lamp' | 'fridge'

type PersistedControlEntry = {
  kind: PersistedControlKind
  rawState: Record<string, unknown>
  normalizedState: Record<string, unknown>
}

type DeviceToggleCommand = {
  action: string
  payload?: Record<string, unknown>
}

const PERSISTED_CONTROL_KINDS: PersistedControlKind[] = ['ac', 'oven', 'lamp', 'fridge']
const DEFAULT_ON_DEVICE_KINDS = new Set<DeviceKind>(['ac', 'oven', 'lamp'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readPersistedControlState(kind: DeviceKind | undefined, deviceId: string): Record<string, unknown> {
  if (!kind || typeof localStorage === 'undefined') {
    return {}
  }

  const prefix = LOCAL_STATE_STORAGE_PREFIX[kind]
  if (!prefix) {
    return {}
  }

  try {
    const raw = localStorage.getItem(`${prefix}${deviceId}`)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writePersistedControlState(kind: DeviceKind | undefined, deviceId: string, state: Record<string, unknown>): void {
  if (!kind || typeof localStorage === 'undefined') {
    return
  }

  const prefix = LOCAL_STATE_STORAGE_PREFIX[kind]
  if (!prefix) {
    return
  }

  localStorage.setItem(`${prefix}${deviceId}`, JSON.stringify(state))
}

function removePersistedControlState(kind: DeviceKind | undefined, deviceId: string): void {
  if (!kind || typeof localStorage === 'undefined') {
    return
  }

  const prefix = LOCAL_STATE_STORAGE_PREFIX[kind]
  if (!prefix) {
    return
  }

  localStorage.removeItem(`${prefix}${deviceId}`)
}

function normalizePersistedControlState(kind: DeviceKind | undefined, persisted: Record<string, unknown>): Record<string, unknown> {
  if (!kind) {
    return {}
  }

  if (kind === 'ac') {
    return {
      on: persisted.isOn,
      mode: persisted.mode,
      temperature: persisted.temperature,
      verticalSwing: persisted.verticalSwing,
      horizontalSwing: persisted.horizontalSwing,
      fanSpeed: persisted.fanSpeed,
    }
  }

  if (kind === 'lamp') {
    return {
      on: persisted.isOn,
      brightness: persisted.brightness,
      color: persisted.color,
    }
  }

  if (kind === 'oven') {
    return {
      on: persisted.isOn,
      temperature: persisted.temperature,
      heat: persisted.heatSource,
      grill: persisted.powerLevel,
      convection: persisted.convectionMode,
    }
  }

  if (kind === 'fridge') {
    return {
      mode: persisted.mode,
      freezerTemperature: persisted.freezerTemp,
      fridgeTemp: persisted.fridgeTemp,
    }
  }

  return {}
}

function readPersistedControlStates(deviceId: string, preferredKind?: DeviceKind): PersistedControlEntry[] {
  const orderedKinds: PersistedControlKind[] = preferredKind && PERSISTED_CONTROL_KINDS.includes(preferredKind as PersistedControlKind)
    ? [preferredKind as PersistedControlKind, ...PERSISTED_CONTROL_KINDS.filter(kind => kind !== preferredKind)]
    : [...PERSISTED_CONTROL_KINDS]

  const entries: PersistedControlEntry[] = []
  for (const kind of orderedKinds) {
    const rawState = readPersistedControlState(kind, deviceId)
    if (Object.keys(rawState).length === 0) {
      continue
    }
    entries.push({
      kind,
      rawState,
      normalizedState: normalizePersistedControlState(kind, rawState),
    })
  }

  return entries
}

function mergePersistedNormalizedState(entries: PersistedControlEntry[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const entry of entries) {
    for (const [key, value] of Object.entries(entry.normalizedState)) {
      if (!(key in merged)) {
        merged[key] = value
      }
    }
  }
  return merged
}

function hasRemotePowerSignal(state?: ApiDeviceState): boolean {
  return typeof state?.on === 'boolean' || typeof state?.status === 'string'
}

function mapRecordToDeviceState(state?: Record<string, unknown>): ApiDeviceState | undefined {
  if (!state) {
    return undefined
  }

  const mapped: ApiDeviceState = {}
  if (typeof state.status === 'string') {
    mapped.status = state.status
  }
  if (typeof state.on === 'boolean') {
    mapped.on = state.on
  }
  if (typeof state.temperature === 'number') {
    mapped.temperature = state.temperature
  }
  if (typeof state.brightness === 'number') {
    mapped.brightness = state.brightness
  }

  return Object.keys(mapped).length > 0 ? mapped : undefined
}

function mergeDeviceStates(
  primary?: ApiDeviceState,
  fallback?: ApiDeviceState,
): ApiDeviceState | undefined {
  if (!primary && !fallback) {
    return undefined
  }

  return {
    status: primary?.status ?? fallback?.status,
    on: primary?.on ?? fallback?.on,
    temperature: primary?.temperature ?? fallback?.temperature,
    brightness: primary?.brightness ?? fallback?.brightness,
  }
}

async function fetchDeviceStateWithFallback(deviceId: string): Promise<ApiDeviceState | undefined> {
  const stateFromStateEndpoint = await api.get<ApiDeviceState>(`/devices/${deviceId}/state`).catch(() => undefined)
  if (hasRemotePowerSignal(stateFromStateEndpoint)) {
    return stateFromStateEndpoint
  }

  const detail = await api.get<ApiDeviceDetail>(`/devices/${deviceId}`).catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 404) {
      return undefined
    }
    throw err
  })

  const detailState = mapRecordToDeviceState(isRecord(detail?.state) ? detail.state : undefined)
  return mergeDeviceStates(stateFromStateEndpoint, detailState)
}

function resolveDevicePowerState(
  state: ApiDeviceState | undefined,
  persistedState: Record<string, unknown>,
): boolean {
  if (hasRemotePowerSignal(state)) {
    return resolveIsOn(state)
  }

  if (typeof persistedState.on === 'boolean') {
    return persistedState.on
  }

  return resolveIsOn(state)
}

function syncPersistedPowerState(
  deviceId: string,
  isOn: boolean,
  preferredKind?: DeviceKind,
): void {
  const entries = readPersistedControlStates(deviceId, preferredKind)
  if (entries.length > 0) {
    for (const entry of entries) {
      writePersistedControlState(entry.kind, deviceId, { ...entry.rawState, isOn })
    }
    return
  }

  const prefix = preferredKind ? LOCAL_STATE_STORAGE_PREFIX[preferredKind] : undefined
  if (!prefix || !preferredKind) {
    return
  }

  const existing = readPersistedControlState(preferredKind, deviceId)
  writePersistedControlState(preferredKind, deviceId, { ...existing, isOn })
}

function resolveDeviceKindByTypeId(typeId?: string): DeviceKind | undefined {
  if (!typeId) {
    return undefined
  }
  return TYPE_ID_MAP[typeId]
}

function initialStateForNewDevice(typeId?: string): Record<string, unknown> {
  const kind = resolveDeviceKindByTypeId(typeId)
  if (!kind || !DEFAULT_ON_DEVICE_KINDS.has(kind)) {
    return {}
  }
  return { on: true }
}

function seedDeviceInitialPowerState(deviceId: string, typeId?: string): void {
  const kind = resolveDeviceKindByTypeId(typeId)
  if (!kind || !DEFAULT_ON_DEVICE_KINDS.has(kind)) {
    return
  }
  syncPersistedPowerState(deviceId, true, kind)
}

function getToggleCommands(kind: DeviceKind | undefined, isCurrentlyOn: boolean): DeviceToggleCommand[] {
  const powerAction = isCurrentlyOn ? 'turnOff' : 'turnOn'
  const accessAction = isCurrentlyOn ? 'close' : 'open'
  const mediaAction = isCurrentlyOn ? 'stop' : 'play'
  const vacuumAction = isCurrentlyOn ? 'pause' : 'start'

  if (kind === 'tap') {
    return [{ action: accessAction }, { action: powerAction }]
  }

  if (kind === 'blind') {
    return [
      { action: 'setLevel', payload: { level: isCurrentlyOn ? 0 : 100 } },
      { action: accessAction },
      { action: powerAction },
    ]
  }

  if (kind === 'speaker') {
    return [{ action: mediaAction }, { action: powerAction }]
  }

  if (kind === 'vacuum') {
    return [{ action: vacuumAction }, { action: powerAction }]
  }

  if (kind === 'fridge' || kind === 'door' || kind === 'alarm') {
    return []
  }

  if (kind === 'other') {
    return [{ action: powerAction }, { action: accessAction }]
  }

  return [{ action: powerAction }]
}

function isRecoverableActionError(err: unknown): err is ApiError {
  return err instanceof ApiError && [400, 404, 405, 422].includes(err.status)
}

function writePersistedControlStates(deviceId: string, entries: PersistedControlEntry[]): void {
  for (const entry of entries) {
    writePersistedControlState(entry.kind, deviceId, entry.rawState)
  }
}

function removePersistedControlStates(deviceId: string): void {
  for (const kind of PERSISTED_CONTROL_KINDS) {
    removePersistedControlState(kind, deviceId)
  }
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

  /* Flags de carga: evitan re-fetchear recursos ya cargados */
  const homesLoaded = ref(false)
  const routinesLoaded = ref(false)
  const dashboardLoaded = ref(false)

  const filteredDevices = computed(() =>
    devices.value.filter(d => d.roomId === activeRoomId.value)
  )

  /* Loaders: funciones para cargar datos desde la API */
  async function loadHomes(): Promise<void> {
    if (homesLoaded.value) return
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
    homesLoaded.value = true
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
        fetchDeviceStateWithFallback(device.id)
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
      const persistedEntries = readPersistedControlStates(device.id, kind)
      const persistedState = mergePersistedNormalizedState(persistedEntries)
      const resolvedIsOn = resolveDevicePowerState(state, persistedState)

      return {
        id: device.id,
        name: device.name,
        roomId,
        kind,
        status: formatStatus(state),
        isOn: isFridge ? true : resolvedIsOn,
        tone: isFridge ? 'sage' : (resolvedIsOn ? 'sage' : 'neutral'),
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

  function invalidateRoutines(): void {
    routinesLoaded.value = false
    routines.value = []
  }

  async function loadRoutines(): Promise<void> {
    if (routinesLoaded.value) return
    const data = await api.get<ApiRoutine[]>('/routines')
    routines.value = data.map(r => ({
      id: r.id,
      name: r.name,
      summary: r.actions ? `${r.actions.length} acciones` : 'Manual',
      time: r.schedule?.time ?? '',
      icon: mapRoutineIcon(r.name),
    }))
    routinesLoaded.value = true
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

  async function loadDeviceStateSnapshot(
    deviceId: string,
    device?: Device,
    persistedEntries?: PersistedControlEntry[],
  ): Promise<Record<string, unknown>> {
    let remoteState: Record<string, unknown> = {}
    try {
      const raw = await api.get<Record<string, unknown>>(`/devices/${deviceId}/state`)
      remoteState = isRecord(raw) ? raw : {}
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404) {
        throw err
      }
    }

    const entries = persistedEntries ?? readPersistedControlStates(deviceId, device?.kind)
    const persistedState = mergePersistedNormalizedState(entries)
    const snapshot = { ...remoteState, ...persistedState }

    if (device && typeof snapshot.on !== 'boolean') {
      snapshot.on = device.isOn
    }

    return snapshot
  }

  async function applyDeviceAction(
    deviceId: string,
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<boolean> {
    const endpoint = `/devices/${deviceId}/${action}`
    const hasPayload = Object.keys(payload).length > 0
    const attempts: Record<string, unknown>[] = hasPayload
      ? [payload, { params: Object.values(payload) }]
      : [{}]

    for (const body of attempts) {
      try {
        await api.patch(endpoint, body)
        return true
      } catch (err) {
        if (isRecoverableActionError(err)) {
          continue
        }
        throw err
      }
    }

    return false
  }

  async function executeDeviceToggle(
    deviceId: string,
    kind: DeviceKind | undefined,
    isCurrentlyOn: boolean,
  ): Promise<void> {
    const commands = getToggleCommands(kind, isCurrentlyOn)
    if (commands.length === 0) {
      throw new Error('No hay accion de toggle disponible para este dispositivo.')
    }

    let lastRecoverableError: ApiError | null = null

    for (const command of commands) {
      const endpoint = `/devices/${deviceId}/${command.action}`
      const payload = command.payload ?? {}
      const hasPayload = Object.keys(payload).length > 0
      const attempts: Record<string, unknown>[] = hasPayload
        ? [payload, { params: Object.values(payload) }]
        : [{}]

      for (const body of attempts) {
        try {
          await api.patch(endpoint, body)
          return
        } catch (err) {
          if (isRecoverableActionError(err)) {
            lastRecoverableError = err
            continue
          }
          throw err
        }
      }
    }

    if (lastRecoverableError) {
      throw lastRecoverableError
    }
    throw new Error('No se pudo ejecutar el toggle del dispositivo.')
  }

  async function restoreDeviceState(
    deviceId: string,
    kind: DeviceKind | undefined,
    snapshot: Record<string, unknown>,
  ): Promise<void> {
    const getString = (...values: unknown[]): string | null => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value
        }
      }
      return null
    }

    const getNumber = (...values: unknown[]): number | null => {
      for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value
        }
      }
      return null
    }

    const isOn = typeof snapshot.on === 'boolean' ? snapshot.on : null

    if (kind === 'ac') {
      const mode = getString(snapshot.mode)
      const temperature = getNumber(snapshot.temperature)
      const verticalSwing = getString(snapshot.verticalSwing)
      const horizontalSwing = getString(snapshot.horizontalSwing)
      const fanSpeed = getString(snapshot.fanSpeed)

      if (mode) await applyDeviceAction(deviceId, 'setMode', { mode })
      if (temperature !== null) await applyDeviceAction(deviceId, 'setTemperature', { temperature })
      if (verticalSwing) await applyDeviceAction(deviceId, 'setVerticalSwing', { verticalSwing })
      if (horizontalSwing) await applyDeviceAction(deviceId, 'setHorizontalSwing', { horizontalSwing })
      if (fanSpeed) await applyDeviceAction(deviceId, 'setFanSpeed', { fanSpeed })
      if (isOn !== null) await applyDeviceAction(deviceId, isOn ? 'turnOn' : 'turnOff')
      return
    }

    if (kind === 'lamp') {
      const brightness = getNumber(snapshot.brightness)
      const color = getString(snapshot.color)
      if (brightness !== null) await applyDeviceAction(deviceId, 'setBrightness', { brightness })
      if (color) await applyDeviceAction(deviceId, 'setColor', { color })
      if (isOn !== null) await applyDeviceAction(deviceId, isOn ? 'turnOn' : 'turnOff')
      return
    }

    if (kind === 'oven') {
      const temperature = getNumber(snapshot.temperature)
      const heat = getString(snapshot.heat, snapshot.heatSource)
      const grill = getString(snapshot.grill, snapshot.powerLevel)
      const convection = getString(snapshot.convection, snapshot.convectionMode)

      if (temperature !== null) await applyDeviceAction(deviceId, 'setTemperature', { temperature })
      if (heat) await applyDeviceAction(deviceId, 'setHeat', { heat })
      if (grill) await applyDeviceAction(deviceId, 'setGrill', { grill })
      if (convection) await applyDeviceAction(deviceId, 'setConvection', { convection })
      if (isOn !== null) await applyDeviceAction(deviceId, isOn ? 'turnOn' : 'turnOff')
      return
    }

    if (kind === 'fridge') {
      const mode = getString(snapshot.mode)
      const freezerTemperature = getNumber(snapshot.freezerTemperature, snapshot.freezerTemp)
      if (mode) await applyDeviceAction(deviceId, 'setMode', { mode })
      if (freezerTemperature !== null) {
        await applyDeviceAction(deviceId, 'setFreezerTemperature', { freezerTemperature })
      }
      return
    }

    if (kind === 'blind') {
      const level = getNumber(snapshot.level, snapshot.currentLevel, snapshot.position)
      if (level !== null) await applyDeviceAction(deviceId, 'setLevel', { level })
      return
    }

    if (kind === 'tap') {
      const status = getString(snapshot.status)?.toLowerCase()
      if (status === 'open' || status === 'opened') {
        await applyDeviceAction(deviceId, 'open')
      } else if (status === 'close' || status === 'closed') {
        await applyDeviceAction(deviceId, 'close')
      }
      return
    }

    if (kind === 'door') {
      const status = getString(snapshot.status)?.toLowerCase()
      const lock = getString(snapshot.lock)?.toLowerCase()

      if (status === 'open' || status === 'opened') {
        await applyDeviceAction(deviceId, 'open')
      } else if (status === 'closed' || status === 'close') {
        await applyDeviceAction(deviceId, 'close')
      }

      if (status !== 'open' && status !== 'opened') {
        if (lock === 'locked') {
          await applyDeviceAction(deviceId, 'lock')
        } else if (lock === 'unlocked') {
          await applyDeviceAction(deviceId, 'unlock')
        }
      }
      return
    }

    if (kind === 'alarm') {
      const status = getString(snapshot.status)?.toLowerCase()
      if (status === 'armedaway') {
        await applyDeviceAction(deviceId, 'armAway')
      } else if (status === 'armedhome' || status === 'armedstay') {
        await applyDeviceAction(deviceId, 'armStay')
      } else if (status === 'disarmed') {
        await applyDeviceAction(deviceId, 'disarm')
      }
      return
    }

    const genericMode = getString(snapshot.mode)
    const genericTemperature = getNumber(snapshot.temperature)
    const genericBrightness = getNumber(snapshot.brightness)
    const genericColor = getString(snapshot.color)
    const genericVerticalSwing = getString(snapshot.verticalSwing)
    const genericHorizontalSwing = getString(snapshot.horizontalSwing)
    const genericFanSpeed = getString(snapshot.fanSpeed)
    const genericHeat = getString(snapshot.heat, snapshot.heatSource)
    const genericGrill = getString(snapshot.grill, snapshot.powerLevel)
    const genericConvection = getString(snapshot.convection, snapshot.convectionMode)
    const genericFreezerTemperature = getNumber(snapshot.freezerTemperature, snapshot.freezerTemp)
    const genericLevel = getNumber(snapshot.level, snapshot.currentLevel, snapshot.position)

    if (genericMode) await applyDeviceAction(deviceId, 'setMode', { mode: genericMode })
    if (genericTemperature !== null) await applyDeviceAction(deviceId, 'setTemperature', { temperature: genericTemperature })
    if (genericBrightness !== null) await applyDeviceAction(deviceId, 'setBrightness', { brightness: genericBrightness })
    if (genericColor) await applyDeviceAction(deviceId, 'setColor', { color: genericColor })
    if (genericVerticalSwing) await applyDeviceAction(deviceId, 'setVerticalSwing', { verticalSwing: genericVerticalSwing })
    if (genericHorizontalSwing) await applyDeviceAction(deviceId, 'setHorizontalSwing', { horizontalSwing: genericHorizontalSwing })
    if (genericFanSpeed) await applyDeviceAction(deviceId, 'setFanSpeed', { fanSpeed: genericFanSpeed })
    if (genericHeat) await applyDeviceAction(deviceId, 'setHeat', { heat: genericHeat })
    if (genericGrill) await applyDeviceAction(deviceId, 'setGrill', { grill: genericGrill })
    if (genericConvection) await applyDeviceAction(deviceId, 'setConvection', { convection: genericConvection })
    if (genericFreezerTemperature !== null) {
      await applyDeviceAction(deviceId, 'setFreezerTemperature', { freezerTemperature: genericFreezerTemperature })
    }
    if (genericLevel !== null) await applyDeviceAction(deviceId, 'setLevel', { level: genericLevel })

    if (isOn !== null) await applyDeviceAction(deviceId, isOn ? 'turnOn' : 'turnOff')
  }

  async function verifyDeviceRoom(deviceId: string, expectedRoomId: string): Promise<boolean> {
    const attempts = 3
    for (let i = 0; i < attempts; i += 1) {
      try {
        const roomDevices = await api.get<ApiDevice[]>(`/rooms/${expectedRoomId}/devices`)
        if (roomDevices.some(device => device.id === deviceId)) {
          return true
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return false
        }
        throw err
      }

      if (i < attempts - 1) {
        await wait(150)
      }
    }
    return false
  }

  async function updateDevice(deviceId: string, payload: { name: string; roomId: string }, homeId = activeHomeId.value): Promise<void> {
    const trimmedName = payload.name.trim()
    if (!trimmedName) {
      throw new Error('Ingresá un nombre para el dispositivo.')
    }

    const roomExists = rooms.value.some(room => room.id === payload.roomId)
    if (!roomExists) {
      throw new Error('Seleccioná una habitación válida.')
    }

    const currentDevice = devices.value.find(device => device.id === deviceId)
    const roomChanged = currentDevice ? currentDevice.roomId !== payload.roomId : true
    const isRecoverableStatus = (status: number): boolean => [400, 404, 405, 422].includes(status)
    const persistedEntries = roomChanged ? readPersistedControlStates(deviceId, currentDevice?.kind) : []
    const stateSnapshot = roomChanged
      ? await loadDeviceStateSnapshot(deviceId, currentDevice, persistedEntries)
      : null

    function applyLocalUpdate(): void {
      const targetDevice = devices.value.find(device => device.id === deviceId)
      if (targetDevice) {
        targetDevice.name = trimmedName
        targetDevice.roomId = payload.roomId
      }
    }

    async function restoreMovedDeviceState(targetDeviceId: string): Promise<void> {
      if (!roomChanged || !stateSnapshot) {
        return
      }
      await restoreDeviceState(targetDeviceId, currentDevice?.kind, stateSnapshot)
    }

    try {
      await api.put(`/devices/${deviceId}`, {
        name: trimmedName,
        room: { id: payload.roomId },
      })
    } catch (err) {
      if (!(err instanceof ApiError)) {
        throw err
      }

      if (err.status === 400) {
        const detail = await api.get<ApiDeviceDetail>(`/devices/${deviceId}`)
        const typeId = detail.type?.id ?? detail.typeId ?? currentDevice?.typeId
        if (!typeId) {
          throw err
        }

        try {
          await api.put(`/devices/${deviceId}`, {
            name: trimmedName,
            type: { id: typeId },
            room: { id: payload.roomId },
            state: detail.state ?? {},
            metadata: detail.metadata ?? {},
          })
        } catch (fullPutErr) {
          if (!(fullPutErr instanceof ApiError) || !isRecoverableStatus(fullPutErr.status)) {
            throw fullPutErr
          }
        }
      } else if (!isRecoverableStatus(err.status)) {
        throw err
      }
    }

    if (await verifyDeviceRoom(deviceId, payload.roomId)) {
      await restoreMovedDeviceState(deviceId)
      applyLocalUpdate()
      return
    }

    try {
      await api.put(`/devices/${deviceId}`, {
        name: trimmedName,
        roomId: payload.roomId,
      })
      if (await verifyDeviceRoom(deviceId, payload.roomId)) {
        await restoreMovedDeviceState(deviceId)
        applyLocalUpdate()
        return
      }
    } catch (err) {
      if (!(err instanceof ApiError) || !isRecoverableStatus(err.status)) {
        throw err
      }
    }

    if (homeId) {
      try {
        await api.put(`/homes/${homeId}/rooms/${payload.roomId}/devices/${deviceId}`, {
          name: trimmedName,
        })
        if (await verifyDeviceRoom(deviceId, payload.roomId)) {
          await restoreMovedDeviceState(deviceId)
          applyLocalUpdate()
          return
        }
      } catch (err) {
        if (!(err instanceof ApiError) || !isRecoverableStatus(err.status)) {
          throw err
        }
      }
    }

    try {
      await api.put(`/rooms/${payload.roomId}/devices/${deviceId}`, {
        name: trimmedName,
      })
      if (await verifyDeviceRoom(deviceId, payload.roomId)) {
        await restoreMovedDeviceState(deviceId)
        applyLocalUpdate()
        return
      }
    } catch (err) {
      if (!(err instanceof ApiError) || !isRecoverableStatus(err.status)) {
        throw err
      }
    }

    if (roomChanged) {
      const detail = await api.get<ApiDeviceDetail>(`/devices/${deviceId}`)
      const typeId = detail.type?.id ?? detail.typeId ?? currentDevice?.typeId
      if (!typeId) {
        throw new Error('No se pudo identificar el tipo del dispositivo para cambiarlo de habitación.')
      }

      const created = await api.post<ApiCreatedDevice>('/devices', {
        name: trimmedName,
        type: { id: typeId },
        room: { id: payload.roomId },
        state: detail.state ?? {},
        metadata: detail.metadata ?? {},
      })
      if (!created.id) {
        throw new Error('No se pudo crear el dispositivo en la nueva habitación.')
      }

      try {
        await restoreMovedDeviceState(created.id)
        writePersistedControlStates(created.id, persistedEntries)
      } catch (restoreErr) {
        try {
          await api.delete(`/devices/${created.id}`)
        } catch (cleanupErr) {
          if (!(cleanupErr instanceof ApiError) || cleanupErr.status !== 404) {
            throw cleanupErr
          }
        }
        throw restoreErr
      }

      try {
        await api.delete(`/devices/${deviceId}`)
      } catch (deleteErr) {
        try {
          await api.delete(`/devices/${created.id}`)
        } catch (cleanupErr) {
          if (!(cleanupErr instanceof ApiError) || cleanupErr.status !== 404) {
            throw cleanupErr
          }
        }
        throw deleteErr
      }

      removePersistedControlStates(deviceId)

      return
    }

    throw new Error('No se pudo actualizar el dispositivo. Intentá de nuevo.')
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

    homesLoaded.value = false
    dashboardLoaded.value = false
    routinesLoaded.value = false
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

/* Carga datos de homes, rooms y devices. Se usa en páginas que los necesitan. */
  async function loadDashboard(): Promise<void> {
    if (dashboardLoaded.value) return

    loading.value = true
    error.value   = ''

    try {
      await loadHomes()
      await loadRooms(activeHomeId.value)
      await loadDevices(activeRoomId.value)
      dashboardLoaded.value = true
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

    if (target?.kind === 'fridge' || target?.kind === 'door' || target?.kind === 'alarm') {
      return
    }
    pendingActions.value.add(id)
    const previous = target?.isOn
    const persistedState = mergePersistedNormalizedState(readPersistedControlStates(id, target?.kind))

    if (target) {
      target.isOn = !target.isOn // optimistic update
      target.tone = target.isOn ? 'sage' : 'neutral'
    }

    try {
      let isCurrentlyOn = previous
      if (typeof isCurrentlyOn !== 'boolean') {
        const currentState = await fetchDeviceStateWithFallback(id).catch(() => undefined)
        isCurrentlyOn = resolveDevicePowerState(currentState, persistedState)
      }

      await executeDeviceToggle(id, target?.kind, isCurrentlyOn)
      const state = await fetchDeviceStateWithFallback(id).catch(() => undefined)
      const nextIsOn = hasRemotePowerSignal(state) ? resolveIsOn(state) : !isCurrentlyOn
      if (target) {
        target.status = formatStatus(state)
        target.isOn = nextIsOn
        target.tone = nextIsOn ? 'sage' : 'neutral'
      }
      syncPersistedPowerState(id, nextIsOn, target?.kind)
    }catch (err){
      if (target && typeof previous === 'boolean') {
        target.isOn = previous // rollback
        target.tone = previous ? 'sage' : 'neutral'
      }
      if (typeof previous === 'boolean') {
        syncPersistedPowerState(id, previous, target?.kind)
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
    homesLoaded.value = false
    routinesLoaded.value = false
    dashboardLoaded.value = false
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
    homesLoaded,
    dashboardLoaded,
    /* Acciones */
    loadDashboard,
    loadRooms,
    loadRoutines,
    invalidateRoutines,
    loadDevices,
    fetchHomeDevices,
    loadMembers,
    addMember,
    removeMember,
    updateHomeName,
    updateRoomName,
    updateDevice,
    createHome,
    createRoom,
    deleteHome,
    deleteRoom,
    toggleDevice,
    initialStateForNewDevice,
    seedDeviceInitialPowerState,

    reset,
  }
})
