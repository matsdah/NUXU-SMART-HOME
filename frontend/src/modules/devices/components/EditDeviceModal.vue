<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Room } from '@/app/stores/dashboard'

const props = withDefaults(defineProps<{
  deviceName: string
  roomId: string
  rooms: Room[]
  loading?: boolean
  error?: string
}>(), {
  loading: false,
  error: '',
})

const emit = defineEmits<{
  close: []
  updated: [payload: { name: string; roomId: string }]
  delete: []
}>()

const editedName = ref(props.deviceName)
const selectedRoomId = ref(props.roomId)
const validationError = ref('')
const isRoomMenuOpen = ref(false)
const roomSelectorRef = ref<HTMLElement | null>(null)

watch(() => props.deviceName, (nextName) => {
  editedName.value = nextName
})

watch(() => props.roomId, (nextRoomId) => {
  selectedRoomId.value = nextRoomId
})

const selectedRoomName = computed(() => (
  props.rooms.find(room => room.id === selectedRoomId.value)?.name ?? 'Seleccionar habitación'
))

function selectRoom(roomId: string) {
  selectedRoomId.value = roomId
  validationError.value = ''
  isRoomMenuOpen.value = false
}

function toggleRoomMenu() {
  if (props.loading || props.rooms.length === 0) {
    return
  }
  isRoomMenuOpen.value = !isRoomMenuOpen.value
}

function closeRoomMenuOnClickOutside(event: MouseEvent) {
  if (isRoomMenuOpen.value && roomSelectorRef.value && !roomSelectorRef.value.contains(event.target as Node)) {
    isRoomMenuOpen.value = false
  }
}

function handleSubmit() {
  validationError.value = ''
  const trimmedName = editedName.value.trim()
  if (!trimmedName) {
    validationError.value = 'Ingresá un nombre para el dispositivo.'
    return
  }

  if (!props.rooms.some(room => room.id === selectedRoomId.value)) {
    validationError.value = 'Seleccioná una habitación para el dispositivo.'
    return
  }

  emit('updated', { name: trimmedName, roomId: selectedRoomId.value })
}

function onOverlayClick(event: MouseEvent) {
  if (props.loading) {
    return
  }
  if (event.target === event.currentTarget) {
    emit('close')
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return
  }

  if (isRoomMenuOpen.value) {
    isRoomMenuOpen.value = false
    return
  }

  if (!props.loading) {
    emit('close')
  }
}

function requestDeletion() {
  if (props.loading) {
    return
  }
  emit('delete')
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('click', closeRoomMenuOnClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('click', closeRoomMenuOnClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal">
        <div class="modal__header">
          <h2 class="modal__title">Editar dispositivo</h2>
          <button
            class="modal__close"
            type="button"
            :disabled="loading"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <div v-if="error || validationError" class="modal__error" role="alert">
          {{ validationError || error }}
        </div>

        <form class="modal__form" @submit.prevent="handleSubmit" novalidate>
          <div class="field">
            <input
              v-model="editedName"
              type="text"
              id="device-edit-name"
              placeholder=" "
              required
              class="field__input"
              autocomplete="off"
              maxlength="25"
            />
            <label for="device-edit-name" class="field__label">Nombre del dispositivo</label>
          </div>

          <div class="field field--room">
            <p class="field__legend">Habitación</p>
            <div class="room-selector" ref="roomSelectorRef">
              <button
                class="room-switch"
                type="button"
                aria-label="Cambiar habitación del dispositivo"
                :aria-expanded="isRoomMenuOpen"
                :disabled="loading || rooms.length === 0"
                @click="toggleRoomMenu"
              >
                <span class="room-switch__icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12l8-7 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M7 11v7h10v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
                <span class="room-switch__label">{{ selectedRoomName }}</span>
                <span class="room-switch__chev">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
              </button>

              <Transition name="fade-slide">
                <div v-if="isRoomMenuOpen" class="room-dropdown">
                  <button
                    v-for="room in rooms"
                    :key="room.id"
                    type="button"
                    class="room-dropdown__item"
                    :class="{ 'room-dropdown__item--active': room.id === selectedRoomId }"
                    @click="selectRoom(room.id)"
                  >
                    {{ room.name }}
                  </button>
                </div>
              </Transition>
            </div>
            <p v-if="rooms.length === 0" class="field__help">No hay habitaciones disponibles.</p>
          </div>

          <div class="modal__actions">
            <button type="button" class="modal__delete" :disabled="loading" @click="requestDeletion">
              Eliminar
            </button>
            <button type="submit" class="modal__submit" :disabled="loading">
              Guardar
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

.modal__close:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.15);
}

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

.field--room {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.field__legend {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(42, 40, 37, 0.75);
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

.field__input:focus {
  border-color: var(--color-brown);
}

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

.field__help {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(42, 40, 37, 0.55);
}

.room-selector {
  position: relative;
}

.room-switch {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.62rem 0.9rem;
  border-radius: 12px;
  border: 1px solid rgba(42, 40, 37, 0.15);
  background: rgba(255, 255, 255, 0.7);
  color: var(--color-text, rgba(42, 40, 37, 1));
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 8px 20px rgba(42, 40, 37, 0.08);
  cursor: pointer;
  transition: background 0.2s ease;
}

.room-switch:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.9);
}

.room-switch:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.room-switch__icon,
.room-switch__chev {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
}

.room-switch__icon svg,
.room-switch__chev svg {
  width: 18px;
  height: 18px;
}

.room-switch__label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-switch__chev svg {
  transition: transform 0.2s ease;
}

.room-switch[aria-expanded="true"] .room-switch__chev svg {
  transform: rotate(180deg);
}

.room-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(42, 40, 37, 0.1);
  border-radius: 16px;
  padding: 0.5rem;
  box-shadow: 0 10px 30px rgba(42, 40, 37, 0.15);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  z-index: 12;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 220px;
  overflow-y: auto;
}

@supports not (backdrop-filter: blur(1px)) {
  .room-dropdown {
    background: rgba(42, 40, 37, 0.72);
  }
}

.room-dropdown__item {
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: none;
  background: transparent;
  text-align: left;
  font-family: inherit;
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(42, 40, 37, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.room-dropdown__item:hover {
  background: rgba(42, 40, 37, 0.05);
}

.room-dropdown__item--active {
  background: rgba(63, 129, 102, 0.15);
  color: rgba(42, 85, 67, 1);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.modal__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.modal__submit,
.modal__delete {
  height: 50px;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.2s, box-shadow 0.2s;
}

.modal__delete {
  border: none;
  color: #fff;
  background: #b54444;
}

.modal__delete:hover:not(:disabled) {
  background: #992f2f;
  box-shadow: 0 8px 24px rgba(153, 47, 47, 0.2);
  transform: translateY(-1px);
}

.modal__submit {
  border: none;
  color: #fff;
  background-color: var(--color-brown);
}

.modal__submit:hover:not(:disabled) {
  background-color: #7a5240;
  box-shadow: 0 8px 24px rgba(122, 82, 64, 0.2);
  transform: translateY(-1px);
}

.modal__submit:disabled,
.modal__delete:disabled,
.modal__close:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 560px) {
  .modal__actions {
    grid-template-columns: 1fr;
  }
}
</style>
