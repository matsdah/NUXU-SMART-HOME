<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '@/services/api/client'
import { useDashboardStore, labelForTypeId } from '@/app/stores/dashboard'
import type { DeviceType } from '@/app/stores/dashboard'
import CustomSelect from '@/shared/components/CustomSelect.vue'
import { useToast } from '@/shared/composables/useToast'
import { handleApiError } from '@/shared/utils/api-error-handler'
import '@/shared/styles/auth-form.css'

const props = defineProps<{
  roomId: string
  roomName: string
  showRoomSelector?: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [payload: { deviceId: string; typeName: string }]
}>()

const store = useDashboardStore()
const { showToast } = useToast()

const deviceTypes = ref<DeviceType[]>([])
const name = ref('')
const selectedTypeId = ref('')
const loading = ref(false)
const loadingTypes = ref(true)
type ApiCreatedDevice = { id?: string }

const selectedRoomId = ref('')
const selectedRoomName = ref('')

async function loadDeviceTypes(): Promise<DeviceType[]> {
  const types = await api.get<DeviceType[]>('/devicetypes')
  return Array.isArray(types) ? types : []
}

onMounted(async () => {
  const backendTypes = await loadDeviceTypes()
  deviceTypes.value = backendTypes
  selectedTypeId.value = ''
  loadingTypes.value = false
  document.addEventListener('keydown', onKeyDown)
})

async function handleSubmit() {
  if (!name.value.trim()) {
    showToast('Ingresá un nombre para el dispositivo.', 'error')
    return
  }
  if (!selectedTypeId.value) {
    showToast('Elegí un tipo de dispositivo.', 'error')
    return
  }
  if (props.showRoomSelector && !selectedRoomId.value) {
    showToast('Elegí un ambiente.', 'error')
    return
  }
  loading.value = true
  try {
    const selectedType = deviceTypes.value.find(type => type.id === selectedTypeId.value)

    const roomId = props.showRoomSelector
      ? selectedRoomId.value
      : (props.roomId || store.activeRoomId || store.rooms[0]?.id)
    if (!roomId) {
      showToast('No hay una habitación seleccionada.', 'error')
      loading.value = false
      return
    }

    const created = await api.post<ApiCreatedDevice>(`/devices`, {
      name: name.value.trim(),
      type: { id: selectedTypeId.value },
      state: store.initialStateForNewDevice(selectedTypeId.value),
      room: { id: roomId },
      metadata: {},
    })

    const deviceId = created.id
    if (!deviceId) {
      showToast('No se pudo obtener el dispositivo creado.', 'error')
      return
    }
    store.seedDeviceInitialPowerState(deviceId, selectedTypeId.value)
    try { await api.patch(`/devices/${deviceId}/turnOn`, {}) } catch { /* skip */ }

    emit('created', {
      deviceId,
      typeName: selectedType?.name ?? '',
    })
  } catch (e) {
    const { message, type } = handleApiError(e)
    showToast(message, type)
  } finally {
    loading.value = false
  }
}

function selectRoom(id: string, name: string) {
  selectedRoomId.value = id
  selectedRoomName.value = name
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal">

        <div class="modal__header">
          <h2 class="modal__title">Agregar dispositivo</h2>
          <button type="button" class="modal__close" @click="emit('close')" aria-label="Cerrar">✕</button>
        </div>

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
              maxlength="25"
            />
            <label for="device-name" class="field__label">Nombre del dispositivo</label>
          </div>

          <CustomSelect
            v-model="selectedTypeId"
            :options="deviceTypes.map(t => ({ id: t.id, label: labelForTypeId(t.id) }))"
            placeholder="Elegí dispositivo"
          />

          <CustomSelect
            v-if="showRoomSelector"
            :model-value="selectedRoomId ?? ''"
            :options="store.rooms.map(r => ({ id: r.id, label: r.name }))"
            placeholder="Elegí ambiente"
            @update:model-value="(id) => selectRoom(id, store.rooms.find(r => r.id === id)?.name ?? '')"
          />

          <div class="modal__actions">
            <button type="button" class="modal__cancel" :disabled="loading" @click="emit('close')">
              Cancelar
            </button>
            <button type="submit" class="modal__submit" :disabled="loading">
              <svg v-if="loading" width="18" height="18" viewBox="0 0 24 24" fill="none"
                aria-hidden="true" class="spinner">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"
                  stroke-dasharray="60" stroke-dashoffset="20"/>
              </svg>
              <span v-else>Agregar</span>
            </button>
          </div>

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

.modal__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.modal__cancel,
.modal__submit {
  height: 50px;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.2s, box-shadow 0.2s;
}

.modal__cancel {
  border: 1px solid rgba(42, 40, 37, 0.2);
  color: rgba(42, 40, 37, 0.8);
  background: #fff;
}

.modal__cancel:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.06);
  transform: translateY(-1px);
}

.modal__submit {
  border: none;
  background-color: var(--color-brown);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal__submit:hover:not(:disabled) {
  background-color: #7a5240;
  box-shadow: 0 8px 24px rgba(122, 82, 64, 0.2);
  transform: translateY(-1px);
}

.modal__cancel:disabled,
.modal__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal__loading {
  font-size: 0.9rem;
  color: rgba(42, 40, 37, 0.5);
  text-align: center;
  padding: 1rem 0;
}
</style>
