/**
 * Composable compartido para manejar la lista de dispositivos,
 * incluyendo refresh, comparación de cambios, y sincronización
 * con la store. Usado por HomesPage y DevicesPage.
 */
import { ref, watch, type Ref } from 'vue'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useSocketStore } from '@/app/stores/socket'
import type { Device } from '@/app/stores/dashboard'

export function useDeviceList(activeHomeId: Ref<string>) {
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
        current.tone !== next.tone
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

  /** Actualiza un dispositivo localmente cuando llega un evento de cambio de estado. */
  function applyDeviceUpdate(id: string, isOn: boolean): void {
    const d = allDevices.value.find(x => x.id === id)
    if (!d) return
    d.isOn = isOn
    d.tone = isOn ? 'sage' : 'neutral'
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

  // ---- WebSocket watchers ----

  /** Extrae deviceId de un evento WebSocket (formato anidado o plano). */
  function extractDeviceIdFromEvent(eventData: Record<string, unknown>): string | undefined {
    const nested = eventData['data'] as Record<string, unknown> | undefined
    return (nested?.['deviceId'] ?? nested?.['device_id'] ?? eventData['deviceId'] ?? eventData['device_id']) as string | undefined
  }

  /** Watcher: actualización quirúrgica cuando el payload tiene device ID. */
  function watchDeviceEvents(): void {
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

    // Refresh completo cuando el payload no tiene device ID reconocible
    watch(() => socketStore.deviceStateVersion, () => {
      const ev = socketStore.lastDeviceEvent
      const deviceId = ev ? extractDeviceIdFromEvent(ev) : undefined
      if (deviceId && allDevices.value.some(d => d.id === deviceId)) return
      void refreshDevices({ silent: true })
    })

    // Refresh completo cuando cambia la lista (creado/eliminado)
    watch(() => socketStore.deviceListVersion, () => {
      void refreshDevices({ silent: true })
    })
  }

  return {
    allDevices,
    loadingDevices,
    refreshingDevices,
    refreshDevices,
    hasDeviceListChanged,
    applyDeviceUpdate,
    toggleDevice,
    extractDeviceIdFromEvent,
    watchDeviceEvents,
  }
}
