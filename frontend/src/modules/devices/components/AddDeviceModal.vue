<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api, ApiError } from '@/services/api/client'
import { useDashboardStore } from '@/app/stores/dashboard'
import type { DeviceType, DeviceKind } from '@/app/stores/dashboard'

const KIND_LABELS: Record<DeviceKind, string> = {
  ac: 'Aire acondicionado', vacuum: 'Aspiradora', lamp: 'Lámpara',
  speaker: 'Parlante', tap: 'Canilla', blind: 'Persiana',
  oven: 'Horno', door: 'Puerta', fridge: 'Heladera', other: 'Otro',
}
function kindLabel(kind: DeviceKind): string { return KIND_LABELS[kind] ?? kind }

const props = defineProps<{
  roomId: string
  roomName: string
}>()

const emit = defineEmits<{
  close: []
  created: [payload: { deviceId: string; typeName: string }]
}>()

const store = useDashboardStore()

// Tipos conocidos como fallback si el endpoint no responde correctamente
const FALLBACK_TYPES: DeviceType[] = [
  { id: 'go46xmbqei8eoaomjk3p', name: 'Aire acondicionado' },
  { id: 'ofglvd9gzubmmk9hzfal', name: 'Aspiradora' },
  { id: 'eu0v2xgprrhhg41o',     name: 'Lámpara' },
  { id: 'im77xyzlyfm3oijpo3eh', name: 'Parlante' },
  { id: 'dbrlpeuy8t19pbt0mlkr', name: 'Canilla' },
  { id: 'lsq3up3bkgqk0k0f64jf', name: 'Persiana' },
  { id: 'otmbrewtofbpfqm6dxne', name: 'Horno' },
  { id: 's1b0bk0tj4lpyzm6oc2l', name: 'Puerta' },
  { id: 'rnizejujvmx3dxl1o6km', name: 'Heladera' },
]

const deviceTypes = ref<DeviceType[]>([])
const name = ref('')
const selectedTypeId = ref('')
const error = ref('')
const loading = ref(false)
const loadingTypes = ref(true)
type ApiDeviceDetail = { type?: { id?: string; name?: string } }
type ApiCreatedDevice = { id?: string }

async function loadDeviceTypes(): Promise<DeviceType[]> {
  const types = await api.get<DeviceType[]>('/devicetypes')
  return Array.isArray(types) ? types : []
}

onMounted(async () => {
  try {
    const backendTypes = await loadDeviceTypes()
    if (backendTypes.length > 0) {
      deviceTypes.value = backendTypes
      selectedTypeId.value =
        backendTypes.find(type => type.name.toLowerCase().includes('aire acondicionado'))?.id
        ?? backendTypes[0].id
      loadingTypes.value = false
      return
    }
  } catch {
    // Sigue con los fallbacks locales.
  }

  if (store.deviceTypes.length > 0) {
    deviceTypes.value = store.deviceTypes
    selectedTypeId.value =
      store.deviceTypes.find(type => type.name.toLowerCase().includes('aire acondicionado'))?.id
      ?? store.deviceTypes[0].id
    loadingTypes.value = false
    return
  }

  if (store.devices.length > 0) {
    const seen = new Set<string>()
    const fromDetails: DeviceType[] = []

    await Promise.all(store.devices.map(async (d) => {
      try {
        const detail = await api.get<ApiDeviceDetail>(`/devices/${d.id}`)
        const typeId = detail.type?.id
        const typeName = detail.type?.name ?? kindLabel(d.kind)
        if (typeId && !seen.has(typeId)) {
          seen.add(typeId)
          fromDetails.push({ id: typeId, name: typeName })
        }
      } catch {
        // ignora dispositivos que fallen
      }
    }))

    if (fromDetails.length > 0) {
      deviceTypes.value = fromDetails
      selectedTypeId.value =
        fromDetails.find(type => type.name.toLowerCase().includes('aire acondicionado'))?.id
        ?? fromDetails[0].id
      loadingTypes.value = false
      return
    }
  }

  deviceTypes.value = FALLBACK_TYPES
  selectedTypeId.value =
    FALLBACK_TYPES.find(type => type.name.toLowerCase().includes('aire acondicionado'))?.id
    ?? FALLBACK_TYPES[0].id
  loadingTypes.value = false
  document.addEventListener('keydown', onKeyDown)
})

async function handleSubmit() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Ingresá un nombre para el dispositivo.'
    return
  }
  if (!selectedTypeId.value) {
    error.value = 'Seleccioná un tipo de dispositivo.'
    return
  }
  loading.value = true
  try {
    const selectedType = deviceTypes.value.find(type => type.id === selectedTypeId.value)

    const roomId = props.roomId || store.activeRoomId || store.rooms[0]?.id
    if (!roomId) {
      error.value = 'No hay una habitación seleccionada.'
      loading.value = false
      return
    }

    const created = await api.post<ApiCreatedDevice>(`/devices`, {
      name: name.value.trim(),
      type: { id: selectedTypeId.value },
      state: {},
      room: { id: roomId },
      metadata: {},
    })

    const deviceId = created.id
    if (!deviceId) {
      error.value = 'No se pudo obtener el dispositivo creado.'
      return
    }

    emit('created', {
      deviceId,
      typeName: selectedType?.name ?? '',
    })
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      error.value = msg ?? `Error ${e.status}. Intentá de nuevo.`
    } else {
      error.value = 'Error inesperado. Intentá de nuevo.'
    }
  } finally {
    loading.value = false
  }
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onBeforeUnmount(() => { document.removeEventListener('keydown', onKeyDown) })
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal">

        <div class="modal__header">
          <h2 class="modal__title">Agregar dispositivo</h2>
          <button type="button" class="modal__close" @click="emit('close')" aria-label="Cerrar">✕</button>
        </div>

        <div v-if="error" class="modal__error" role="alert">{{ error }}</div>

        <div v-if="loadingTypes" class="modal__loading">Cargando tipos...</div>

        <form v-else class="modal__form" @submit.prevent="handleSubmit" novalidate>

          <div class="field">
            <input
              v-model="name"
              type="text"
              id="device-name"
              placeholder=" "
              required
              class="field__input"
              autocomplete="off"
            />
            <label for="device-name" class="field__label">Nombre del dispositivo</label>
          </div>

          <div class="field">
            <select
              v-model="selectedTypeId"
              id="device-type"
              class="field__select"
              required
            >
              <option v-for="t in deviceTypes" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
            <label for="device-type" class="field__label field__label--select">Tipo</label>
          </div>


          <button type="submit" class="modal__submit" :disabled="loading">
            <svg v-if="loading" width="18" height="18" viewBox="0 0 24 24" fill="none"
              aria-hidden="true" class="spinner">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"
                stroke-dasharray="60" stroke-dashoffset="20"/>
            </svg>
            <span v-else>Agregar</span>
          </button>

        </form>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  background: rgba(42, 40, 37, 0.25);
  padding: 1.5rem;
}

@supports not (backdrop-filter: blur(1px)) {
  .overlay {
    background: rgba(42, 40, 37, 0.72);
  }
}

.modal {
  background: #fff;
  border-radius: 24px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 32px 64px rgba(42, 40, 37, 0.22);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.modal__title {
  font-size: 1.4rem;
  font-weight: 300;
  color: var(--color-text);
}

.modal__close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(42, 40, 37, 0.08);
  color: rgba(42, 40, 37, 0.7);
  font-size: 0.9rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.modal__close:hover { background: rgba(42, 40, 37, 0.15); }

.modal__error {
  padding: 0.6rem 0.9rem;
  background: rgba(180, 60, 60, 0.1);
  border: 1px solid rgba(180, 60, 60, 0.3);
  border-radius: 12px;
  color: #a03030;
  font-size: 0.85rem;
}

.modal__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  position: relative;
}

.field__input {
  width: 100%;
  height: 54px;
  padding: 18px 1rem 4px;
  background: rgba(255, 255, 255, 0.6);
  border: 1.5px solid var(--color-sage);
  border-radius: 12px;
  font-size: 0.95rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s;
}

.field__input:focus { border-color: var(--color-brown); }

.field__label {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.95rem;
  font-weight: 300;
  color: var(--color-text-muted);
  pointer-events: none;
  transition: top 0.18s ease, font-size 0.18s ease, color 0.18s ease;
}

.field__input:focus ~ .field__label,
.field__input:not(:placeholder-shown) ~ .field__label {
  top: 10px;
  font-size: 0.72rem;
  color: var(--color-brown);
}

.field__select {
  width: 100%;
  height: 54px;
  padding: 22px 1rem 4px;
  background: rgba(255, 255, 255, 0.6);
  border: 1.5px solid var(--color-sage);
  border-radius: 12px;
  font-size: 0.95rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  transition: border-color 0.2s;
}

.field__select:focus { border-color: var(--color-brown); }

.field__label--select {
  top: 10px;
  font-size: 0.72rem;
  color: var(--color-brown);
}

.modal__submit {
  width: 100%;
  height: 50px;
  border-radius: 12px;
  background-color: var(--color-brown);
  border: none;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 400;
  font-family: var(--font-sans);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.modal__submit:hover:not(:disabled) { background-color: #7a5240; }
.modal__submit:disabled { opacity: 0.6; cursor: not-allowed; }

.modal__loading {
  font-size: 0.9rem;
  color: rgba(42, 40, 37, 0.5);
  text-align: center;
  padding: 1rem 0;
}

@keyframes spin { to { transform: rotate(360deg); } }
.spinner { animation: spin 0.9s linear infinite; }
</style>
