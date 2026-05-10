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
let dismissTimer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  function showToast(message: string, type: ToastType = 'success') {
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer)
      dismissTimer = null
    }
    const id = ++nextId
    toasts.value = [{ id, message, type }]
    dismissTimer = setTimeout(() => {
      toasts.value = []
      dismissTimer = null
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
