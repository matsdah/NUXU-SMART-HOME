<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

interface Option { id: string; label: string }

const props = defineProps<{
  modelValue: string
  options: Option[]
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const selectedLabel = computed(
  () => props.options.find(o => o.id === props.modelValue)?.label ?? ''
)

function select(id: string) {
  emit('update:modelValue', id)
  isOpen.value = false
}

function onDocumentClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') isOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="custom-select" ref="rootRef">
    <button
      type="button"
      class="custom-select__trigger"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <span
        class="custom-select__label"
        :class="{ 'custom-select__label--placeholder': !selectedLabel }"
      >
        {{ selectedLabel || placeholder }}
      </span>
      <span class="custom-select__chev" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <Transition name="fade-slide">
      <div v-if="isOpen" class="custom-select__dropdown">
        <button
          v-for="opt in options" :key="opt.id"
          type="button"
          class="custom-select__item"
          :class="{ 'custom-select__item--active': opt.id === modelValue }"
          @click="select(opt.id)"
        >
          {{ opt.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.custom-select {
  position: relative;
  width: 100%;
}

.custom-select__trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: 54px;
  padding: 0 1rem;
  border-radius: 12px;
  border: 1.5px solid var(--color-sage);
  background: rgba(255, 255, 255, 0.6);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 400;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.custom-select__trigger:hover,
.custom-select__trigger[aria-expanded="true"] {
  border-color: var(--color-brown);
}

.custom-select__label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-select__label--placeholder {
  color: var(--color-text-muted);
  font-weight: 400;
}

.custom-select__chev {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.5;
  transition: transform 0.2s ease;
}

.custom-select__chev svg {
  width: 14px;
  height: 14px;
}

.custom-select__trigger[aria-expanded="true"] .custom-select__chev {
  transform: rotate(180deg);
}

.custom-select__dropdown {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  right: 0;
  z-index: 10;
  background: #fff;
  border: 1px solid rgba(42, 40, 37, 0.12);
  border-radius: 12px;
  padding: 0.4rem;
  box-shadow: 0 12px 32px rgba(42, 40, 37, 0.12);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  max-height: 240px;
  overflow-y: auto;
}

.custom-select__item {
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.75rem;
  border: none;
  background: transparent;
  border-radius: 8px;
  font: inherit;
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.15s;
}

.custom-select__item:hover {
  background: rgba(42, 40, 37, 0.06);
}

.custom-select__item--active {
  background: rgba(42, 40, 37, 0.1);
  font-weight: 500;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>