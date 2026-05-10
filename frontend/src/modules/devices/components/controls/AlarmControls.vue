<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api, ApiError } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import { useToast } from '@/shared/composables/useToast'
import '@/shared/styles/control-panel.css'

const props = defineProps<{ deviceId: string; deviceName?: string }>()

type AlarmMode = 'disarmed' | 'armedStay' | 'armedAway'

const MODE_OPTIONS: PillOption[] = [
  { value: 'disarmed',  label: 'Desactivada'  },
  { value: 'armedStay', label: 'Modo Casa'    },
  { value: 'armedAway', label: 'Modo Regular' },
]

const MODE_LABELS: Record<AlarmMode, string> = {
  disarmed:  'Desactivada',
  armedStay: 'Modo Casa',
  armedAway: 'Modo Regular',
}

const MODE_ACTIONS: Record<AlarmMode, string> = {
  disarmed:  'disarm',
  armedStay: 'armStay',
  armedAway: 'armAway',
}

const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()
const { showToast } = useToast()

const currentMode   = ref<AlarmMode>('disarmed')
const loading       = ref(true)
const actionPending = ref(false)

const pendingMode   = ref<AlarmMode | null>(null)
const securityCode  = ref('')
const currentCode   = ref('')
const newCode       = ref('')
const changingCode  = ref(false)

const isArmed = computed(() => currentMode.value !== 'disarmed')

function parseMode(status: string): AlarmMode | null {
  if (status === 'disarmed') return 'disarmed'
  if (status === 'armedHome' || status === 'armedStay') return 'armedStay'
  if (status === 'armedAway') return 'armedAway'
  return null
}

onMounted(async () => {
  try {
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    const mode = parseMode(raw.status as string)
    if (mode) currentMode.value = mode
  } catch {
    // Se usan valores por defecto
  } finally {
    loading.value = false
  }
})

function onModeSelect(value: string) {
  if (value === currentMode.value || actionPending.value) return
  const mode = value as AlarmMode
  pendingMode.value = mode
  securityCode.value = '1234'
}

async function confirmCode() {
  if (!pendingMode.value || actionPending.value) return
  await applyMode(pendingMode.value, securityCode.value)
}

async function applyMode(newMode: AlarmMode, code: string) {
  actionPending.value = true
  const previous = currentMode.value
  currentMode.value = newMode
  try {
    await api.patch(`/devices/${props.deviceId}/${MODE_ACTIONS[newMode]}`, { securityCode: code })
    const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
    const parsed = parseMode(raw.status as string)
    if (parsed) currentMode.value = parsed
    pendingMode.value = null
    securityCode.value = ''
    emit('powerToggled', currentMode.value !== 'disarmed')
    showToast(`Alarma: ${MODE_LABELS[newMode]}`, 'success')
  } catch (e) {
    currentMode.value = previous
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
    } else {
      showToast('Error inesperado. Intentá de nuevo.', 'error')
    }
  } finally {
    actionPending.value = false
  }
}

async function changeCode() {
  if (changingCode.value) return
  if (!currentCode.value || !newCode.value) {
    showToast('Completá ambos códigos.', 'error')
    return
  }
  changingCode.value = true
  try {
    await api.patch(`/devices/${props.deviceId}/changeSecurityCode`, {
      oldSecurityCode: currentCode.value,
      newSecurityCode: newCode.value,
    })
    currentCode.value = ''
    newCode.value = ''
    showToast('Código de seguridad actualizado', 'success')
  } catch (e) {
    if (e instanceof ApiError) {
      const msg = (e.body as { error?: { description?: string } })?.error?.description
      showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
    } else {
      showToast('Error inesperado. Intentá de nuevo.', 'error')
    }
  } finally {
    changingCode.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="cp-loading">Cargando...</div>

  <div v-else class="cp-shell">
    <section class="cp-card">
      <ControlSidebar
        :title="props.deviceName || 'Alarma'"
        room-label="SEGURIDAD"
        :temperature="0"
        :show-temperature="false"
        :is-on="isArmed"
        :show-power-button="false"
      >
        <template #center>
          <div class="alarm-badges">
            <div class="alarm-badge" :class="isArmed ? 'alarm-badge--armed' : 'alarm-badge--off'">
              {{ isArmed ? 'Activada' : 'Desactivada' }}
            </div>
            <div v-if="isArmed" class="alarm-badge alarm-badge--mode">
              {{ MODE_LABELS[currentMode] }}
            </div>
          </div>
        </template>
      </ControlSidebar>

      <div class="cp-controls cp-controls--scrollable">

        <section class="cp-section">
          <p class="cp-label">Modo</p>
          <div :class="{ 'cp-controls--disabled': actionPending || !!pendingMode }">
            <PillButtons
              :model-value="pendingMode ?? currentMode"
              :options="MODE_OPTIONS"
              appearance="container"
              @update:model-value="(v: string) => onModeSelect(v)"
            />
          </div>

          <div v-if="pendingMode" class="alarm-code-prompt">
            <p class="alarm-hint">
              <span v-if="pendingMode === 'disarmed'">Ingresá el código para desactivar la alarma</span>
              <span v-else>Ingresá el código para activar <strong>{{ MODE_LABELS[pendingMode] }}</strong></span>
            </p>
            <input
              v-model="securityCode"
              type="password"
              inputmode="numeric"
              maxlength="4"
              pattern="[0-9]{4}"
              placeholder="0000"
              class="alarm-code-input"
              autocomplete="one-time-code"
              @keyup.enter="confirmCode"
            />
            <div class="alarm-prompt-actions">
              <button
                type="button"
                class="alarm-code-btn alarm-code-btn--secondary"
                :disabled="actionPending"
                @click="pendingMode = null; securityCode = ''"
              >Cancelar</button>
              <button
                type="button"
                class="alarm-code-btn"
                :disabled="actionPending || securityCode.length === 0"
                @click="confirmCode"
              >{{ actionPending ? 'Activando...' : 'Confirmar' }}</button>
            </div>
          </div>

        </section>

        <section class="cp-section cp-section--divider">
          <p class="cp-label">Cambiar código de seguridad</p>

          <div class="alarm-code-row">
            <div class="alarm-code-field">
              <label class="alarm-code-label">Código actual</label>
              <input
                v-model="currentCode"
                type="password"
                inputmode="numeric"
                maxlength="4"
                pattern="[0-9]{4}"
                placeholder="0000"
                class="alarm-code-input"
                autocomplete="current-password"
              />
            </div>
            <div class="alarm-code-field">
              <label class="alarm-code-label">Código nuevo</label>
              <input
                v-model="newCode"
                type="password"
                inputmode="numeric"
                maxlength="4"
                pattern="[0-9]{4}"
                placeholder="0000"
                class="alarm-code-input"
                autocomplete="new-password"
              />
            </div>
          </div>

          <button
            type="button"
            class="alarm-code-btn"
            :disabled="changingCode"
            @click="changeCode"
          >
            {{ changingCode ? 'Guardando...' : 'Actualizar código' }}
          </button>

        </section>

      </div>
    </section>

  </div>
</template>

<style scoped>
.cp-section--divider {
  padding-top: 1.5rem;
  border-top: 1px solid rgba(52, 47, 41, 0.1);
}

.alarm-hint {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(52, 47, 41, 0.45);
}

.alarm-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.alarm-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.52);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(52, 47, 41, 0.88);
}

.alarm-badge--armed {
  background: rgba(170, 60, 40, 0.15);
  color: #8c2d1a;
}

.alarm-badge--off {
  background: rgba(255, 255, 255, 0.52);
  color: rgba(52, 47, 41, 0.6);
}

.alarm-badge--mode {
  background: rgba(255, 255, 255, 0.52);
  color: rgba(52, 47, 41, 0.88);
}


.alarm-code-input {
  width: 100%;
  height: 48px;
  padding: 0 1rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1.5px solid rgba(52, 47, 41, 0.2);
  border-radius: 12px;
  font-size: 1.1rem;
  letter-spacing: 0.3em;
  font-family: var(--font-sans);
  color: var(--color-text);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
  text-align: center;
}

.alarm-code-input:focus {
  border-color: rgba(52, 47, 41, 0.6);
}

.alarm-code-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.alarm-code-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.alarm-code-label {
  font-size: 0.75rem;
  color: rgba(52, 47, 41, 0.55);
}

.alarm-code-btn {
  width: 100%;
  height: 46px;
  border-radius: 999px;
  background: rgba(52, 47, 41, 0.88);
  border: none;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.alarm-code-btn:hover:not(:disabled) {
  background: rgba(52, 47, 41, 1);
  box-shadow: 0 8px 24px rgba(52, 47, 41, 0.18);
  transform: translateY(-1px);
}

.alarm-code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alarm-code-btn--secondary {
  background: rgba(52, 47, 41, 0.12);
  color: rgba(52, 47, 41, 0.88);
}

.alarm-code-btn--secondary:hover:not(:disabled) {
  background: rgba(52, 47, 41, 0.2);
}

.alarm-code-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 14px;
  border: 1.5px solid rgba(52, 47, 41, 0.12);
}

.alarm-prompt-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

@media (max-width: 900px) {
  .alarm-code-row { grid-template-columns: 1fr; }
}
</style>
