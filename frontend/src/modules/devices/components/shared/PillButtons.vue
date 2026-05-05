<script setup lang="ts">
export type PillOption = {
  value: string
  label: string
  icon?: string
}

const props = defineProps<{
  modelValue: string
  options: PillOption[]
  variant?: 'default' | 'mode'
  appearance?: 'default' | 'container' | 'mode'
  size?: 'default' | 'small' | 'fan'
}>()

const emit = defineEmits<{
  'update:modelValue': (value: string) => void
}>()
</script>

<template>
  <div
    class="pill-buttons"
    :class="{
      'pill-buttons--mode': props.variant === 'mode' || props.appearance === 'mode',
      'pill-buttons--container': props.appearance === 'container',
      'pill-buttons--small': props.size === 'small',
      'pill-buttons--fan': props.size === 'fan'
    }"
  >
    <button
      v-for="option in props.options"
      :key="option.value"
      class="pill-button"
      :class="{ 'pill-button--active': props.modelValue === option.value }"
      type="button"
      @click="emit('update:modelValue', option.value)"
    >
      <span v-if="option.icon" class="pill-button__icon">{{ option.icon }}</span>
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.pill-buttons {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.pill-buttons--mode {
  background: rgba(128, 120, 103, 0.52);
  border-radius: 999px;
  padding: 0.28rem;
  flex-wrap: nowrap;
}

.pill-buttons--container {
  background: rgba(128, 120, 103, 0.52);
  border-radius: 999px;
  padding: 0.28rem;
}

.pill-buttons--small {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  justify-content: center;
}

.pill-buttons--fan {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.45rem;
  border-radius: 999px;
  padding: 0.28rem;
  background: rgba(128, 120, 103, 0.52);
}

.pill-button {
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(52, 47, 41, 0.95);
  padding: 0.65rem 0.9rem;
  font-family: var(--font-sans);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  flex: 1;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  font-size: 0.85rem;
}

.pill-button:hover {
  transform: translateY(-1px);
}

.pill-button--active {
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  box-shadow: 0 8px 18px rgba(52, 47, 41, 0.18);
}

.pill-button__icon {
  font-size: 0.95rem;
  line-height: 1;
}

@media (max-width: 640px) {
  .pill-buttons:not(.pill-buttons--mode) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .pill-button {
    padding: 0.45rem 0.5rem;
    font-size: 0.8rem;
  }
}
</style>
