<script setup lang="ts">
defineProps<{
  modelValue: number
  min: number
  max: number
}>()

defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <div class="temp-control">
    <button
      class="temp-control__btn"
      type="button"
      @click="$emit('update:modelValue', modelValue - 1)"
      :disabled="modelValue <= min"
    >
      −
    </button>
    <div class="temp-control__display">
      <span class="temp-control__value">{{ modelValue }}</span>
      <span class="temp-control__unit">°C</span>
      <span class="temp-control__range">{{ min }}° - {{ max }}°</span>
    </div>
    <button
      class="temp-control__btn"
      type="button"
      @click="$emit('update:modelValue', modelValue + 1)"
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
  color: rgba(52, 47, 41, 0.42);
}
</style>
