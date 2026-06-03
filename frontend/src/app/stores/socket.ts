import { defineStore } from 'pinia'
import { ref } from 'vue'
import { socketManager } from '@/services/websocket/socket'
import { useDashboardStore } from './dashboard'

export const useSocketStore = defineStore('socket', () => {
  const connected = ref(false)

  // Signals que los componentes pueden observar para reaccionar a cambios
  const deviceStateVersion = ref(0)             // sube en device.event (cambio de estado)
  const deviceListVersion  = ref(0)             // sube en created / updated / deleted
  const lastDeviceEvent    = ref<Record<string, unknown> | null>(null)  // payload del último device.event

  let cleanups: (() => void)[] = []

  function connect(): void {
    cleanup()

    cleanups = [
      socketManager.on('ws:connected',    () => { connected.value = true }),
      socketManager.on('ws:disconnected', () => { connected.value = false }),

      socketManager.on('device.event',   onDeviceEvent),
      socketManager.on('device.created', onDeviceListChange),
      socketManager.on('device.updated', onDeviceListChange),
      socketManager.on('device.deleted', onDeviceListChange),
      socketManager.on('home.shared',    onHomeShared),
      socketManager.on('home.unshared',  onHomeUnshared),
    ]

    socketManager.connect()
  }

  function disconnect(): void {
    cleanup()
    socketManager.disconnect()
    connected.value = false
  }

  function cleanup(): void {
    cleanups.forEach(fn => fn())
    cleanups = []
  }

  function onDeviceEvent(data: unknown): void {
    deviceStateVersion.value++
    // Spread para garantizar nueva referencia aunque el contenido sea igual
    lastDeviceEvent.value = (data !== null && typeof data === 'object')
      ? { ...(data as Record<string, unknown>) }
      : null
  }

  function onDeviceListChange(): void {
    deviceListVersion.value++
  }

  function onHomeShared(): void {
    // Re-cargar la lista de hogares para que aparezca el nuevo
    const dashboard = useDashboardStore()
    dashboard.homesLoaded = false
    dashboard.dashboardLoaded = false
    void dashboard.loadDashboard()
  }

  function onHomeUnshared(): void {
    // Re-cargar hogares ya que uno fue removido
    const dashboard = useDashboardStore()
    dashboard.homesLoaded = false
    dashboard.dashboardLoaded = false
    void dashboard.loadDashboard()
  }

  return { connected, deviceStateVersion, deviceListVersion, lastDeviceEvent, connect, disconnect }
})
