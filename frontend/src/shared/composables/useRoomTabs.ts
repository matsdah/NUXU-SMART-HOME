/**
 * Composable compartido para manejar las pestañas de habitaciones
 * (room tabs) tanto en HomesPage como en DevicesPage.
 *
 * Centraliza la lógica de selección, filtrado y modales de CRUD
 * de habitaciones.
 */
import { ref, computed, type Ref } from 'vue'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useToast } from './useToast'
import { handleApiError } from '@/shared/utils/api-error-handler'
import type { Room } from '@/app/stores/dashboard'

export type RoomFilter = 'all' | string

export function useRoomTabs(activeFilter: Ref<RoomFilter>) {
  const store = useDashboardStore()
  const { showToast } = useToast()

  // Modales
  const showAddRoom = ref(false)
  const showDeleteRoomConfirm = ref(false)
  const showEditRoomModal = ref(false)
  const deletingRoom = ref(false)
  const renamingRoom = ref(false)
  const pendingRoomDeletion = ref<{ id: string; name: string } | null>(null)
  const pendingRoomEdition = ref<{ id: string; name: string } | null>(null)

  const rooms = computed(() => store.rooms)

  function selectAllRooms() {
    activeFilter.value = 'all'
  }

  function selectRoom(roomId: string) {
    activeFilter.value = roomId
    store.activeRoomId = roomId
  }

  // ---- Creación ----
  async function onRoomCreated() {
    showAddRoom.value = false
    activeFilter.value = store.activeRoomId || 'all'
  }

  // ---- Edición ----
  function requestRoomRename() {
    if (activeFilter.value === 'all') {
      showToast('Seleccioná una habitación para editar.', 'error')
      return
    }
    const room = store.rooms.find(r => r.id === activeFilter.value)
    if (!room) {
      showToast('No se encontró la habitación seleccionada.', 'error')
      return
    }
    pendingRoomEdition.value = { id: room.id, name: room.name }
    showEditRoomModal.value = true
  }

  function closeEditRoomModal() {
    if (renamingRoom.value) return
    showEditRoomModal.value = false
    pendingRoomEdition.value = null
  }

  async function confirmRoomRename(name: string) {
    if (!pendingRoomEdition.value) return
    renamingRoom.value = true
    try {
      await store.updateRoomName(pendingRoomEdition.value.id, name)
      showEditRoomModal.value = false
      pendingRoomEdition.value = null
    } catch (e) {
      const { message } = handleApiError(e)
      showToast(message, 'error')
    } finally {
      renamingRoom.value = false
    }
  }

  // ---- Eliminación ----
  function requestRoomDeletion() {
    if (activeFilter.value === 'all') {
      showToast('Seleccioná una habitación para eliminar.', 'error')
      return
    }
    const room = store.rooms.find(r => r.id === activeFilter.value)
    if (!room) {
      showToast('No se encontró la habitación seleccionada.', 'error')
      return
    }
    pendingRoomDeletion.value = { id: room.id, name: room.name }
    showDeleteRoomConfirm.value = true
  }

  function closeDeleteRoomConfirm() {
    if (deletingRoom.value) return
    showDeleteRoomConfirm.value = false
    pendingRoomDeletion.value = null
  }

  async function confirmRoomDeletion(onDeleted?: () => Promise<void>) {
    if (!pendingRoomDeletion.value) return
    deletingRoom.value = true
    try {
      await store.deleteRoom(pendingRoomDeletion.value.id)
      activeFilter.value = store.activeRoomId || 'all'
      showDeleteRoomConfirm.value = false
      pendingRoomDeletion.value = null
      await onDeleted?.()
    } catch (e) {
      const { message } = handleApiError(e)
      showToast(message, 'error')
    } finally {
      deletingRoom.value = false
    }
  }

  return {
    rooms,
    showAddRoom,
    showDeleteRoomConfirm,
    showEditRoomModal,
    deletingRoom,
    renamingRoom,
    pendingRoomDeletion,
    pendingRoomEdition,
    selectAllRooms,
    selectRoom,
    onRoomCreated,
    requestRoomRename,
    closeEditRoomModal,
    confirmRoomRename,
    requestRoomDeletion,
    closeDeleteRoomConfirm,
    confirmRoomDeletion,
  }
}
