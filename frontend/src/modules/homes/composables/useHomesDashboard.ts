import { onMounted } from 'vue'
import { useDashboardStore } from '@/app/stores/dashboard'
import { storeToRefs } from 'pinia'

export function useHomesDashboard() {
  const store = useDashboardStore()
  
  const { 
    homes, 
    activeHomeId, 
    rooms, 
    routines, 
    activeRoomId, 
    filteredDevices,
    loading, 
    error, 
    pendingActions 
  } = storeToRefs(store)

  onMounted(store.loadDashboard)

  return { 
    homes, 
    activeHomeId, 
    rooms, 
    routines, 
    activeRoomId, 
    filteredDevices,
    loading, 
    error, 
    pendingActions,
    toggleDevice: store.toggleDevice 
  }
}