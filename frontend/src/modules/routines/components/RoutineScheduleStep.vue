<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import PillButtons from '@/modules/devices/components/shared/PillButtons.vue'
import type { PillOption } from '@/modules/devices/components/shared/PillButtons.vue'

export type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly'

export type RoutineScheduleConfig = {
  enabled: boolean
  time: string
  frequency: ScheduleFrequency
  daysOfWeek: number[]
}

const props = defineProps<{
  modelValue: RoutineScheduleConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RoutineScheduleConfig]
}>()

const EXECUTION_MODES: PillOption[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'scheduled', label: 'Programable' },
]

const FREQUENCIES: PillOption[] = [
  { value: 'once', label: 'Puntual' },
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
]

const WEEK_DAYS = [
  { label: 'Dom', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mié', value: 3 },
  { label: 'Jue', value: 4 },
  { label: 'Vie', value: 5 },
  { label: 'Sáb', value: 6 },
]

function updateEnabled(enabled: boolean) {
  emit('update:modelValue', { ...props.modelValue, enabled })
}

function updateFrequency(frequency: ScheduleFrequency) {
  const next: RoutineScheduleConfig = { ...props.modelValue, frequency }
  if (frequency === 'weekly' && next.daysOfWeek.length === 0) {
    next.daysOfWeek = [1, 2, 3, 4, 5]
  }
  emit('update:modelValue', next)
}

function toggleDay(day: number) {
  const current = new Set(props.modelValue.daysOfWeek)
  if (current.has(day)) {
    current.delete(day)
  } else {
    current.add(day)
  }
  emit('update:modelValue', {
    ...props.modelValue,
    daysOfWeek: Array.from(current).sort((a, b) => a - b),
  })
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number)
  return {
    hours: h || 8,
    minutes: m || 0,
  }
}

function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function shiftTime(deltaMinutes: number) {
  const { hours, minutes } = parseTime(props.modelValue.time)
  let total = hours * 60 + minutes + deltaMinutes
  total = ((total % 1440) + 1440) % 1440
  const newHours = Math.floor(total / 60)
  const newMinutes = total % 60
  emit('update:modelValue', {
    ...props.modelValue,
    time: formatTime(newHours, newMinutes),
  })
}

/* Edición directa del tiempo (igual que TemperatureControl) */
const timeInputRef = ref<HTMLInputElement>()
const timeEditing = ref(false)
const timeDraft = ref(props.modelValue.time)

function startTimeEdit() {
  timeDraft.value = props.modelValue.time
  timeEditing.value = true
  nextTick(() => timeInputRef.value?.select())
}

function commitTime() {
  timeEditing.value = false
  const { hours, minutes } = parseTime(timeDraft.value)
  const valid = hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
  if (valid) {
    emit('update:modelValue', {
      ...props.modelValue,
      time: formatTime(hours, minutes),
    })
  }
}

function onTimeKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    ;(e.target as HTMLInputElement).blur()
  } else if (e.key === 'Escape') {
    timeEditing.value = false
  }
}

const timeDisplay = computed(() => {
  const { hours, minutes } = parseTime(props.modelValue.time)
  return formatTime(hours, minutes)
})

const isDaySelected = (day: number) => props.modelValue.daysOfWeek.includes(day)

const summaryText = computed(() => {
  if (!props.modelValue.enabled) {
    return ''
  }

  const { time, frequency, daysOfWeek } = props.modelValue
  const timeStr = time || '--:--'

  switch (frequency) {
    case 'once':
      return `La rutina se ejecutará una vez a las ${timeStr}.`
    case 'daily':
      return `La rutina se ejecutará todos los días a las ${timeStr}.`
    case 'weekly': {
      if (daysOfWeek.length === 0) {
        return `La rutina se ejecutará semanalmente a las ${timeStr}. Seleccioná al menos un día.`
      }
      const dayLabels = daysOfWeek
        .map((d) => WEEK_DAYS.find((wd) => wd.value === d)?.label ?? '')
        .filter(Boolean)
      return `La rutina se ejecutará los días ${dayLabels.join(', ')} a las ${timeStr}.`
    }
    default:
      return ''
  }
})
</script>

<template>
  <div class="schedule-step">
    <!-- Execution mode toggle -->
    <div class="schedule-section">
      <label class="schedule-section__label">Modo de ejecución</label>
      <PillButtons
        :model-value="modelValue.enabled ? 'scheduled' : 'manual'"
        :options="EXECUTION_MODES"
        appearance="container"
        @update:model-value="(v: string) => updateEnabled(v === 'scheduled')"
      />
    </div>

    <!-- Manual mode message -->
    <div v-if="!modelValue.enabled" class="schedule-section">
      <div class="manual-hint">
        <svg class="manual-hint__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <p class="manual-hint__text">
          La rutina solo se ejecutará al presionar el botón de play.
        </p>
      </div>
    </div>

    <!-- Schedule controls (only when enabled) -->
    <template v-if="modelValue.enabled">
      <!-- Frequency -->
      <div class="schedule-section">
        <label class="schedule-section__label">Frecuencia</label>
        <PillButtons
          :model-value="modelValue.frequency"
          :options="FREQUENCIES"
          appearance="container"
          @update:model-value="(v: string) => updateFrequency(v as ScheduleFrequency)"
        />
      </div>

      <!-- Days of week (weekly only) -->
      <div v-if="modelValue.frequency === 'weekly'" class="schedule-section">
        <label class="schedule-section__label">Días de la semana</label>
        <div class="day-pills">
          <button
            v-for="day in WEEK_DAYS"
            :key="day.value"
            type="button"
            class="day-pill"
            :class="{ 'day-pill--active': isDaySelected(day.value) }"
            @click="toggleDay(day.value)"
          >
            {{ day.label }}
          </button>
        </div>
      </div>

      <!-- Time picker (TemperatureControl style) -->
      <div class="schedule-section">
        <label class="schedule-section__label">Horario de ejecución</label>
        <div class="time-control">
          <button
            class="time-control__btn"
            type="button"
            aria-label="Retroceder 15 minutos"
            @click="shiftTime(-15)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
          </button>
          <div class="time-control__display" @click="startTimeEdit">
            <input
              v-if="timeEditing"
              ref="timeInputRef"
              v-model="timeDraft"
              type="time"
              class="time-control__input"
              aria-label="Editar horario"
              @blur="commitTime"
              @keydown="onTimeKeydown"
            />
            <template v-else>
              <span class="time-control__value">{{ timeDisplay }}</span>
              <span class="time-control__unit">hs</span>
            </template>
            <span class="time-control__range">00:00 - 23:59</span>
          </div>
          <button
            class="time-control__btn"
            type="button"
            aria-label="Avanzar 15 minutos"
            @click="shiftTime(15)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>

      
    </template>

    <!-- Summary (only when there's something to show) -->
    <div v-if="summaryText" class="schedule-summary">
      <p class="schedule-summary__text">{{ summaryText }}</p>
    </div>
  </div>
</template>

<style scoped>
.schedule-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.schedule-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.schedule-section__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(52, 47, 41, 0.45);
}

/* ── Manual hint ── */
.manual-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 1.5rem;
  background: rgba(190, 190, 166, 0.22);
  border-radius: 18px;
  text-align: center;
}

.manual-hint__icon {
  width: 36px;
  height: 36px;
  color: rgba(52, 47, 41, 0.55);
}

.manual-hint__text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: rgba(42, 40, 37, 0.7);
  max-width: 220px;
}

/* ── Frequency pills ── */
/* ── Time control (TemperatureControl style) ── */
.time-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: rgba(186, 186, 158, 0.62);
  border-radius: 22px;
  padding: 0.7rem 1rem;
}

.time-control__btn {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.88);
  color: rgba(52, 47, 41, 0.9);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}

.time-control__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.time-control__display {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  line-height: 1;
  cursor: text;
  min-width: 0;
}

.time-control__value {
  font-size: 2.2rem;
  font-weight: 600;
  letter-spacing: -0.04em;
  color: rgba(52, 47, 41, 0.92);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.time-control__unit {
  font-size: 0.75rem;
  color: rgba(52, 47, 41, 0.72);
  margin-left: 0.25rem;
}

.time-control__range {
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: #6B6860;
}

.time-control__input {
  width: 6.5rem;
  font-size: 2.2rem;
  font-weight: 600;
  letter-spacing: -0.04em;
  color: rgba(52, 47, 41, 0.92);
  background: transparent;
  border: none;
  border-bottom: 2px solid rgba(52, 47, 41, 0.35);
  outline: none;
  text-align: center;
  font-family: var(--font-sans);
  cursor: text;
  padding: 0;
}

.time-control__input:focus {
  border-bottom-color: rgba(52, 47, 41, 0.75);
}

.time-control__input::-webkit-calendar-picker-indicator {
  display: none;
}

/* ── Day pills (AC swing button style) ── */
.day-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
}

.day-pill {
  width: 52px;
  height: 38px;
  border-radius: 999px;
  border: none;
  background: rgba(158, 155, 142, 0.35);
  color: rgba(42, 40, 37, 0.85);
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.12s, box-shadow 0.15s;
}

.day-pill:hover:not(.day-pill--active) {
  transform: translateY(-1px);
  background: rgba(158, 155, 142, 0.5);
}

.day-pill--active {
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  box-shadow: 0 8px 18px rgba(52, 47, 41, 0.18);
}

/* ── Summary ── */
.schedule-summary {
  margin-top: 0.5rem;
  padding: 0.9rem 1.1rem;
  background: rgba(190, 190, 166, 0.22);
  border-radius: 14px;
}

.schedule-summary__text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: rgba(42, 40, 37, 0.75);
}
</style>
