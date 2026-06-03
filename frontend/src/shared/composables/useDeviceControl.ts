/**
 * Composable para manejar el estado de controles de dispositivos que
 * persisten en localStorage y sincronizan con la API vía PATCH.
 *
 * Reemplaza el patrón repetido de:
 *   - `snapshotState()`, `storageKey()`, `readPersistedState()`,
 *     `applyStatePatch()`, `hasUnsavedChanges()`, `saveChanges()`
 * que aparece en AcControls, OvenControls, LampControls y FridgeControls.
 */
import { ref, type Ref, watch } from 'vue'
import { api } from '@/services/api/client'
import { useToast } from './useToast'

/**
 * Tipo base para cualquier estado de control de dispositivo.
 * Los tipos específicos (AcState, OvenState, etc.) extienden esto.
 */
export type DeviceState = Record<string, unknown>

/**
 * Opciones de configuración para el composable.
 */
export type DeviceControlOptions<T extends DeviceState> = {
  deviceId: string
  storagePrefix: string
  initialState: T
  /** Si el dispositivo está inicialmente encendido (opcional, default true). */
  initialIsOn?: boolean
  /**
   * Función que mapea la respuesta de la API `/devices/{id}/state`
   * al tipo de estado local.
   */
  mapApiState?: (raw: Record<string, unknown>) => Partial<T>
  /** Función que determina si el estado local cambió respecto al snapshot. */
  hasChanges?: (current: T, saved: T) => boolean
}

/**
 * Hook que encapsula el ciclo de vida de un control de dispositivo:
 *   1. Carga estado remoto → aplica estado persistido local → snapshot
 *   2. Watch profundo: detecta cambios → llama saveChanges()
 *   3. saveChanges(): diff contra snapshot → PATCH por campos cambiados
 *   4. Persiste en localStorage después de cada save exitoso
 */
export function useDeviceControl<T extends DeviceState>(options: DeviceControlOptions<T>) {
  const {
    deviceId,
    storagePrefix,
    initialState,
    initialIsOn,
    mapApiState,
    hasChanges,
  } = options

  const state = ref<T>({ ...initialState }) as Ref<T>
  const loading = ref(true)
  const saving = ref(false)
  const savedState = ref<T | null>(null)

  const { showToast } = useToast()

  /** Toma una foto del estado actual. */
  function snapshot(): T {
    return { ...state.value }
  }

  /** Clave de localStorage para este dispositivo. */
  function storageKey(): string {
    return `${storagePrefix}${deviceId}`
  }

  /** Lee el estado persistido de localStorage. */
  function readPersisted(): Partial<T> | null {
    try {
      const raw = localStorage.getItem(storageKey())
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<T>
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }

  /** Aplica un parche parcial al estado local. */
  function applyPatch(patch: Partial<T>) {
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        ;(state.value as Record<string, unknown>)[key] = value
      }
    }
  }

  /** Determina si hay cambios sin guardar respecto al snapshot. */
  function unsaved(): boolean {
    if (!savedState.value) return false
    if (hasChanges) return hasChanges(state.value, savedState.value)
    return JSON.stringify(state.value) !== JSON.stringify(savedState.value)
  }

  /** Carga inicial: API → localStorage → snapshot. */
  async function load(): Promise<void> {
    try {
      const raw = await api.get<Record<string, unknown>>(`/devices/${deviceId}/state`)
      if (raw && typeof raw === 'object' && mapApiState) {
        applyPatch(mapApiState(raw) as Partial<T>)
      } else if (raw && typeof raw === 'object') {
        // Fallback: copia directa de propiedades del API
        applyPatch(raw as Partial<T>)
      }
    } catch {
      // Si falla la API, se usan valores por defecto
    } finally {
      const persisted = readPersisted()
      if (persisted) applyPatch(persisted)
      savedState.value = snapshot()
      loading.value = false
    }
  }

  /** Watcher que persiste automáticamente al detectar cambios. */
  watch(state, async () => {
    if (loading.value || !unsaved()) return
    await saveChanges()
  }, { deep: true })

  /**
   * Guarda los cambios: diff contra snapshot y PATCH por cada
   * campo modificado al backend.
   */
  async function saveChanges(): Promise<void> {
    if (saving.value) return
    saving.value = true
    const cur = state.value
    const prev = savedState.value
    try {
      if (prev) {
        await saveDiffs(cur, prev)
      }
      localStorage.setItem(storageKey(), JSON.stringify(cur))
      savedState.value = snapshot()
      showToast('Datos guardados correctamente.', 'success')
    } catch {
      showToast('No se pudo guardar. Volvé a intentarlo.', 'error')
    } finally {
      saving.value = false
    }
  }

  /**
   * Envía PATCH por cada campo que cambió.
   * Cada subclase debe implementar `saveDiffs` si usa este composable
   * directamente, o sobreescribir `saveChanges`.
   */
  async function saveDiffs(_cur: T, _prev: T): Promise<void> {
    // Por defecto no hace nada — los componentes específicos
    // definen sus propios diffs en la función saveChanges sobreescrita.
  }

  /** Alterna el power del dispositivo. */
  function togglePower(): void {
    ;(state.value as Record<string, unknown>).isOn = !(state.value as Record<string, unknown>).isOn
  }

  return {
    state,
    loading,
    saving,
    savedState,
    load,
    saveChanges,
    togglePower,
    snapshot,
    storageKey,
    readPersisted,
    applyPatch,
    unsaved,
    showToast,
  }
}
