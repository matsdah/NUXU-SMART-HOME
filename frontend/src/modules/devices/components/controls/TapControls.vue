<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api, ApiError } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import TemperatureControl from '../shared/TemperatureControl.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import { useToast } from '@/shared/composables/useToast'

const props = defineProps<{ deviceId: string; deviceName?: string }>()

type TapStatus = 'opened' | 'closed'

const UNIT_OPTIONS: PillOption[] = [
  { value: 'ml', label: 'ml' },
  { value: 'cl', label: 'cl' },
  { value: 'dl', label: 'dl' },
  { value: 'l',  label: 'l'  },
]

const ACCESS_OPTIONS: PillOption[] = [
  { value: 'open',  label: 'Abrir'  },
  { value: 'close', label: 'Cerrar' },
]

const status         = ref<TapStatus>('closed')
const dispensedQty   = ref(0)
const dispensedUnit  = ref('')

const dispenseQty    = ref(10)
const dispenseUnit   = ref('ml')

const loading        = ref(true)
const actionPending  = ref(false)
const dispensePending = ref(false)

const { showToast } = useToast()

function parseStatus(s: unknown): TapStatus {
  return s === 'opened' || s === 'open' ? 'opened' : 'closed'
}

async function fetchState() {
  const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
  status.value = parseStatus(raw.status)
  dispensedQty.value  = Number(raw.quantity ?? raw.dispensedQuantity ?? 0)
  dispensedUnit.value = String(raw.unit ?? raw.dispensedUnit ?? '')
}

onMounted(async () => {
  try { await fetchState() } catch { /* valores por defecto */ }
  finally { loading.value = false }
})

function handleError(e: unknown) {
  if (e instanceof ApiError) {
    const msg = (e.body as { error?: { description?: string } })?.error?.description
      ?? `Error ${e.status}. Intentá de nuevo.`
    showToast(msg, 'error')
  } else {
    showToast('Error inesperado. Intentá de nuevo.', 'error')
  }
}

async function onAccessChange(value: string) {
  if (actionPending.value) return
  const action = value as 'open' | 'close'
  if ((action === 'open') === (status.value === 'opened')) return
  actionPending.value = true
  const prev = status.value
  status.value = action === 'open' ? 'opened' : 'closed'
  try {
    await api.patch(`/devices/${props.deviceId}/${action}`, {})
    await fetchState()
    showToast(action === 'open' ? 'Aspersor abierto' : 'Aspersor cerrado', 'success')
  } catch (e) {
    status.value = prev
    handleError(e)
  } finally {
    actionPending.value = false
  }
}

async function onDispense() {
  if (dispensePending.value) return
  dispensePending.value = true
  try {
    await api.patch(`/devices/${props.deviceId}/dispense`, {
      quantity: dispenseQty.value,
      unit: dispenseUnit.value,
    })
    await fetchState()
    showToast(`Dispensando ${dispenseQty.value} ${dispenseUnit.value}`, 'success')
  } catch (e) {
    handleError(e)
  } finally {
    dispensePending.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="tap-loading">Cargando...</div>

  <div v-else class="tap-shell">
    <section class="tap-card">
      <ControlSidebar
        :title="props.deviceName || 'Aspersor'"
        room-label="AMBIENTE"
        :temperature="0"
        :show-temperature="false"
        :is-on="status === 'opened'"
        :show-power-button="false"
      >
        <template #center>
          <div class="tap-sidebar-center">
            <div class="tap-badge" :class="status === 'opened' ? 'tap-badge--open' : 'tap-badge--closed'">
              {{ status === 'opened' ? 'Abierto' : 'Cerrado' }}
            </div>
            <div v-if="status === 'opened' && dispensedQty > 0" class="tap-dispensed">
              {{ dispensedQty }}<span class="tap-dispensed-unit">{{ dispensedUnit }}</span>
            </div>
          </div>
        </template>
      </ControlSidebar>

      <div class="tap-controls">

        <section class="tap-section">
          <p class="tap-label">Estado</p>
          <div :class="{ 'tap-pills--disabled': actionPending }">
            <PillButtons
              :model-value="status === 'opened' ? 'open' : 'close'"
              :options="ACCESS_OPTIONS"
              appearance="container"
              @update:model-value="(v: string) => onAccessChange(v)"
            />
          </div>
        </section>

        <section class="tap-section">
          <p class="tap-label">Dispensar</p>

          <div :class="{ 'tap-pills--disabled': dispensePending || status === 'closed' }">
            <TemperatureControl
              :model-value="dispenseQty"
              :min="1"
              :max="100"
              unit=""
              :step="5"
              label="cantidad"
              @update:model-value="dispenseQty = $event"
            />
          </div>

          <div :class="{ 'tap-pills--disabled': dispensePending || status === 'closed' }">
            <PillButtons
              :model-value="dispenseUnit"
              :options="UNIT_OPTIONS"
              appearance="container"
              @update:model-value="(v: string) => { dispenseUnit = v }"
            />
          </div>

          <button
            type="button"
            class="tap-dispense-btn"
            :disabled="dispensePending || status === 'closed'"
            @click="onDispense"
          >
            {{ status === 'closed' ? 'Abrí el grifo para dispensar' : dispensePending ? 'Dispensando...' : `Dispensar ${dispenseQty} ${dispenseUnit}` }}
          </button>
        </section>

      </div>
    </section>
  </div>
</template>

<style scoped>
.tap-loading {
  padding: 2rem;
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.9rem;
}

.tap-shell { width: 100%; }

.tap-card {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  border-radius: 28px;
  overflow: hidden;
  background: #f7f5f0;
  box-shadow: 0 28px 70px rgba(42, 40, 37, 0.16);
}

.tap-controls {
  padding: 2.6rem 2.2rem 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  overflow-y: auto;
}

.tap-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.tap-label {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgba(52, 47, 41, 0.42);
}

.tap-sidebar-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.tap-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1.1rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tap-badge--open {
  background: rgba(45, 106, 79, 0.15);
  color: #1f5c43;
}

.tap-badge--closed {
  background: rgba(52, 47, 41, 0.1);
  color: rgba(52, 47, 41, 0.6);
}

.tap-dispensed {
  font-size: 2.2rem;
  font-weight: 400;
  letter-spacing: -0.04em;
  color: rgba(52, 47, 41, 0.88);
  line-height: 1;
}

.tap-dispensed-unit {
  font-size: 0.9rem;
  color: rgba(52, 47, 41, 0.55);
  margin-left: 0.15rem;
}

.tap-pills--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.tap-dispense-btn {
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

.tap-dispense-btn:hover:not(:disabled) {
  background: rgba(52, 47, 41, 1);
  box-shadow: 0 8px 24px rgba(52, 47, 41, 0.18);
  transform: translateY(-1px);
}

.tap-dispense-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .tap-card { grid-template-columns: 1fr; }
  .tap-controls { padding: 1.5rem; }
}
</style>
