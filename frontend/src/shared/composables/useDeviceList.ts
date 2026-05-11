/**
 * Composable compartido para manejar la lista de dispositivos,
 * incluyendo refresh, comparación de cambios, y sincronización
 * con la store y WebSocket. Usado por HomesPage y DevicesPage.
 *
 * Centraliza:
 *   - allDevices / loadingDevices / refreshingDevices
 *   - hasDeviceListChanged (con displayOrder)
 *   - refreshDevices (con guarda anti-doble fetch)
 *   - applyDeviceUpdate (actualización local post-toggle)
 *   - toggleDevice (vía store)
 *   - Watchers WS (lastDeviceEvent, deviceStateVersion, deviceListVersion)
 *   - Watcher de sincronización inicial (loading + activeHomeId)
 */
import { ref, watch, type Ref } from 'vue'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useSocketStore } from '@/app/stores/socket'
import { statusForKind } from '@/shared/utils/store-helpers'
import type { Device } from '@/app/stores/dashboard'

export type DeviceListOptions = {
  /** ID del hogar activo (Ref reactivo). */
  activeHomeId: Ref<string>
  /** Flag de carga del store (para coordinar el fetch inicial). */
  loading?: Ref<boolean>
  /** Callback cuando cambia el hogar activo (ej: resetear filtro de habitación). */
  onHomeChanged?: () => void
}

export function useDeviceList(options: DeviceListOptions) {
  const { activeHomeId, loading, onHomeChanged } = options
  const store = useDashboardStore()
  const socketStore = useSocketStore()

  const allDevices = ref<Device[]>([])
  const loadingDevices = ref(false)
  const refreshingDevices = ref(false)

  /**
   * Compara dos listas de dispositivos para determinar si hubo cambios
   * significativos, evitando re-renders innecesarios.
   */
  function hasDeviceListChanged(nextDevices: Device[]): boolean {
    if (allDevices.value.length !== nextDevices.length) return true

    const currentById = new Map(allDevices.value.map(d => [d.id, d]))
    for (const next of nextDevices) {
      const current = currentById.get(next.id)
      if (!current) return true
      if (
        current.name !== next.name ||
        current.roomId !== next.roomId ||
        current.kind !== next.kind ||
        current.status !== next.status ||
        current.isOn !== next.isOn ||
        current.tone !== next.tone ||
        current.displayOrder !== next.displayOrder
      ) return true
    }
    return false
  }

  /**
   * Refresca la lista de dispositivos del hogar activo.
   * Usa hasDeviceListChanged para evitar mutaciones innecesarias.
   */
  async function refreshDevices(options: { silent?: boolean } = {}): Promise<void> {
    if (!activeHomeId.value) {
      allDevices.value = []
      return
    }
    if (refreshingDevices.value) return

    const silent = options.silent === true
    refreshingDevices.value = true
    if (!silent) loadingDevices.value = true

    try {
      const nextDevices = await store.fetchHomeDevices(activeHomeId.value)
      if (hasDeviceListChanged(nextDevices)) {
        allDevices.value = nextDevices
        store.devices.splice(0, store.devices.length, ...nextDevices)
      }
    } finally {
      refreshingDevices.value = false
      if (!silent) loadingDevices.value = false
    }
  }

  /**
   * Actualiza localmente un dispositivo tras un toggle o evento WS.
   * Luego consulta al backend el estado real (puede venir
   * con más detalle que el simple on/off).
   */
  function applyDeviceUpdate(id: string, isOn: boolean): void {
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

  /** Alterna el estado on/off de un dispositivo vía store. */
  async function toggleDevice(id: string): Promise<void> {
    await store.toggleDevice(id)
    const storeDevice = store.devices.find(d => d.id === id)
    if (!storeDevice) return
    const local = allDevices.value.find(d => d.id === id)
    if (!local) return
    local.isOn = storeDevice.isOn
    local.tone = storeDevice.tone
    local.status = storeDevice.status
  }

  /** Extrae deviceId de un evento WebSocket (formato anidado o plano). */
  function extractDeviceIdFromEvent(eventData: Record<string, unknown>): string | undefined {
    const nested = eventData['data'] as Record<string, unknown> | undefined
    return (nested?.['deviceId'] ?? nested?.['device_id'] ?? eventData['deviceId'] ?? eventData['device_id']) as string | undefined
  }

  // ---- WebSocket watchers (se activan automáticamente) ----

  /** Watcher: actualización quirúrgica cuando el payload tiene device ID (1-2 llamadas en vez de N+1). */
  watch(() => socketStore.lastDeviceEvent, async (eventData) => {
    if (!eventData) return
    const deviceId = extractDeviceIdFromEvent(eventData)
    if (!deviceId) return
    const updated = await store.fetchDeviceState(deviceId)
    if (!updated) { void refreshDevices({ silent: true }); return }
    const local = allDevices.value.find(d => d.id === deviceId)
    if (!local) { void refreshDevices({ silent: true }); return }
    local.isOn = updated.isOn
    local.tone = updated.tone
    local.status = updated.status
  })

  /** Refresh completo solo cuando el payload no tiene device ID reconocible. */
  watch(() => socketStore.deviceStateVersion, () => {
    const ev = socketStore.lastDeviceEvent
    const deviceId = ev ? extractDeviceIdFromEvent(ev) : undefined
    if (deviceId && allDevices.value.some(d => d.id === deviceId)) return
    void refreshDevices({ silent: true })
  })

  /** Refresh completo cuando cambia la lista (creado/eliminado). */
  watch(() => socketStore.deviceListVersion, () => {
    void refreshDevices({ silent: true })
  })

  // ---- Watcher de sincronización inicial ----
  // Se activa cuando loading termina (dashboard cargado) o cuando cambia el home.

  if (loading) {
    watch([loading, activeHomeId], async ([isLoading, homeId], prev) => {
      const prevHomeId = prev?.[1]

      if (!homeId) {
        allDevices.value = []
        return
      }

      if (homeId !== prevHomeId && onHomeChanged) {
        onHomeChanged()
      }

      if (!isLoading) {
        await refreshDevices()
      }
    }, { immediate: true })
  }

  return {
    allDevices,
    loadingDevices,
    refreshingDevices,
    refreshDevices,
    hasDeviceListChanged,
    applyDeviceUpdate,
    toggleDevice,
  }
}
