import { ref, type Ref } from 'vue'

export type DragReorderItem = { id: string }

export function useDragReorder<T extends DragReorderItem>(
  items: Ref<T[]>,
  options: {
    onReorder: (orderedIds: string[]) => void | Promise<void>
    canDrag?: () => boolean
  }
) {
  const draggingId = ref<string | null>(null)
  const dragOverId = ref<string | null>(null)

  function onDragStart(id: string) {
    if (options.canDrag && !options.canDrag()) return
    draggingId.value = id
  }

  function onDragOver(e: DragEvent, id: string) {
    e.preventDefault()
    dragOverId.value = id
  }

  function onDragLeave() {
    dragOverId.value = null
  }

  function onDrop(e: DragEvent, targetId: string) {
    e.preventDefault()
    const sourceId = draggingId.value
    if (!sourceId || sourceId === targetId) {
      draggingId.value = null
      dragOverId.value = null
      return
    }

    draggingId.value = null
    dragOverId.value = null

    const current = items.value.slice()
    const sourceIndex = current.findIndex(i => i.id === sourceId)
    const targetIndex = current.findIndex(i => i.id === targetId)
    if (sourceIndex === -1 || targetIndex === -1) return

    const [moved] = current.splice(sourceIndex, 1)
    if (!moved) return
    current.splice(targetIndex, 0, moved)

    items.value = current
    void options.onReorder(current.map(i => i.id))
  }

  function onDragEnd() {
    draggingId.value = null
    dragOverId.value = null
  }

  return {
    draggingId,
    dragOverId,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
  }
}
