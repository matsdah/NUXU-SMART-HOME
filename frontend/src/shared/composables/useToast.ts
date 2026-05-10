import { ref } from 'vue'

export type ToastType = 'success' | 'error'

interface Toast {
  id: number
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])
const persistentToasts = ref<string[]>([])
let nextId = 0

export function useToast() {
  function showToast(message: string, type: ToastType = 'success') {
    const id = ++nextId
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3500)
  }

  function showPersistentToast(message: string) {
    if (!persistentToasts.value.includes(message)) {
      persistentToasts.value.push(message)
    }
  }

  function hidePersistentToast(message: string) {
    persistentToasts.value = persistentToasts.value.filter(m => m !== message)
  }

  return { toasts, showToast, persistentToasts, showPersistentToast, hidePersistentToast }
}
