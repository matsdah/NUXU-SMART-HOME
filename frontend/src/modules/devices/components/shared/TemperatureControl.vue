<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min: number
  max: number
  unit?: string
  step?: number
  label?: string
  editable?: boolean
}>(), {
  unit: '°C',
  step: 1,
  label: 'valor',
  editable: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const inputRef = ref<HTMLInputElement>()
const editing = ref(false)
const draft = ref(props.modelValue)

function startEdit() {
  if (!props.editable) return
  draft.value = props.modelValue
  editing.value = true
  nextTick(() => inputRef.value?.select())
}

function commit() {
  editing.value = false
  const clamped = Math.max(props.min, Math.min(props.max, draft.value))
  if (clamped !== props.modelValue) {
    emit('update:modelValue', clamped)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    ;(e.target as HTMLInputElement).blur()
  } else if (e.key === 'Escape') {
    editing.value = false
  }
}
</script>

<template>
  <div class="temp-control">
    <button
      class="temp-control__btn"
      type="button"
      :aria-label="`Disminuir ${label}`"
      @click="emit('update:modelValue', Math.max(min, modelValue - step))"
      :disabled="modelValue <= min"
    >
      −
    </button>
    <div class="temp-control__display" @dblclick="startEdit">
      <input
        v-if="editing"
        ref="inputRef"
        v-model.number="draft"
        type="number"
        class="temp-control__input"
        aria-label="Valor de temperatura"
        :min="min"
        :max="max"
        @blur="commit"
        @keydown="onKeydown"
      />
      <span v-else class="temp-control__value" :class="{ 'temp-control__value--editable': editable }" @click="startEdit">{{ modelValue }}</span>
      <span class="temp-control__unit">{{ unit }}</span>
      <span class="temp-control__range">{{ min }}{{ unit }} - {{ max }}{{ unit }}</span>
    </div>
    <button
      class="temp-control__btn"
      type="button"
      :aria-label="`Aumentar ${label}`"
      @click="emit('update:modelValue', Math.min(max, modelValue + step))"
      :disabled="modelValue >= max"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.temp-control {
  display: grid;
  grid-template-columns: 68px 1fr 68px;
  align-items: center;
  gap: 0.7rem;
  background: rgba(186, 186, 158, 0.62);
  border-radius: 22px;
  padding: 0.7rem 0.7rem;
}

.temp-control__btn {
  width: 42px;
  height: 42px;
  justify-self: center;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.88);
  color: rgba(52, 47, 41, 0.9);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}

.temp-control__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.temp-control__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.temp-control__display {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  flex-wrap: wrap;
  line-height: 1;
}

.temp-control__value {
  font-size: 2.5rem;
  font-weight: 600;
  letter-spacing: -0.06em;
  color: rgba(52, 47, 41, 0.92);
}

.temp-control__value--editable {
  cursor: text;
  border-bottom: 2px dotted rgba(52, 47, 41, 0.25);
  transition: border-color 0.15s;
}

.temp-control__value--editable:hover {
  border-color: rgba(52, 47, 41, 0.5);
}

.temp-control__input {
  width: 4rem;
  font-size: 2.5rem;
  font-weight: 600;
  letter-spacing: -0.06em;
  color: rgba(52, 47, 41, 0.92);
  background: transparent;
  border: none;
  border-bottom: 2px solid rgba(52, 47, 41, 0.35);
  outline: none;
  text-align: center;
  font-family: var(--font-sans);
  -moz-appearance: textfield;
  appearance: textfield;
}

.temp-control__input:focus-visible {
  outline: 2px solid var(--color-charcoal);
  outline-offset: 2px;
}

.temp-control__input::-webkit-inner-spin-button,
.temp-control__input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.temp-control__input:focus {
  border-bottom-color: rgba(52, 47, 41, 0.75);
}

.temp-control__unit {
  margin-top: 0;
  font-size: 0.8rem;
  color: rgba(52, 47, 41, 0.72);
}

.temp-control__range {
  margin-top: 0.25rem;
  flex-basis: 100%;
  text-align: center;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: #6B6860;
}
</style>
