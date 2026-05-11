/**
 * Composable compartido para manejar las pestañas de habitaciones
 * (room tabs) tanto en HomesPage como en DevicesPage.
 *
 * Centraliza la lógica de selección, filtrado y modales de CRUD
 * de habitaciones. Elimina la duplicación de ~100 líneas entre ambos pages.
 *
 * Retorna un objeto reactivo para que los refs se desenvuelvan
 * automáticamente en los templates.
 */
import { ref, reactive, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useToast } from './useToast'
import { handleApiError } from '@/shared/utils/api-error-handler'

export type RoomFilter = 'all' | string

export type RoomTabsCallbacks = {
  /** Invocado después de crear, renombrar o eliminar una habitación. */
  onRoomsChanged?: () => Promise<void>
}

export function useRoomTabs(activeFilter: Ref<RoomFilter>, callbacks?: RoomTabsCallbacks) {
  const store = useDashboardStore()
  const { rooms } = storeToRefs(store)
  const { showToast } = useToast()

  const showAddRoom = ref(false)
  const showDeleteRoomConfirm = ref(false)
  const showEditRoomModal = ref(false)
  const deletingRoom = ref(false)
  const renamingRoom = ref(false)
  const pendingRoomDeletion = ref<{ id: string; name: string } | null>(null)
  const pendingRoomEdition = ref<{ id: string; name: string } | null>(null)

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
    await callbacks?.onRoomsChanged?.()
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
      await callbacks?.onRoomsChanged?.()
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

  async function confirmRoomDeletion() {
    if (!pendingRoomDeletion.value) return
    deletingRoom.value = true
    try {
      await store.deleteRoom(pendingRoomDeletion.value.id)
      activeFilter.value = store.activeRoomId || 'all'
      showDeleteRoomConfirm.value = false
      pendingRoomDeletion.value = null
      await callbacks?.onRoomsChanged?.()
    } catch (e) {
      const { message } = handleApiError(e)
      showToast(message, 'error')
    } finally {
      deletingRoom.value = false
    }
  }

  return reactive({
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
  })
}
