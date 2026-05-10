/**
 * Utilidad para manejar errores de API de forma consistente en toda la app.
 * Elimina la repetición del patrón `if (e instanceof ApiError) { ... }`.
 */
import { ApiError } from '@/services/api/client'
import type { ToastType } from '@/shared/composables/useToast'

/** Payload de error tipado que la API puede devolver. */
type ApiErrorBody = {
  error?: {
    description?: string
  }
}

/**
 * Extrae el mensaje de error descriptivo del cuerpo de un ApiError.
 * Si no hay descripción, genera un mensaje genérico con el código HTTP.
 */
function extractApiErrorMessage(err: ApiError): string {
  const body = err.body as ApiErrorBody | null
  return body?.error?.description ?? `Error ${err.status}. Intentá de nuevo.`
}

/**
 * Procesa un error desconocido y devuelve un mensaje legible + tipo de toast.
 * Sirve como punto único para todas las llamadas `showToast` con errores.
 */
export function handleApiError(err: unknown): { message: string; type: ToastType } {
  if (err instanceof ApiError) {
    return {
      message: extractApiErrorMessage(err),
      type: 'error',
    }
  }

  if (err instanceof Error) {
    return {
      message: err.message,
      type: 'error',
    }
  }

  return {
    message: 'Error inesperado. Intentá de nuevo.',
    type: 'error',
  }
}
