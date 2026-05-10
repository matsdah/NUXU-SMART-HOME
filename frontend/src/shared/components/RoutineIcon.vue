<script setup lang="ts">
defineProps<{
  icon: string
}>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="icon === 'bolt'">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </template>
    <template v-else-if="icon === 'sun'">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </template>
    <template v-else-if="icon === 'moon'">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </template>
    <template v-else-if="icon === 'home'">
      <path d="M4 12l8-7 8 7" />
      <path d="M7 11v7h10v-7" />
    </template>
    <template v-else-if="icon === 'star'">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </template>
    <template v-else-if="icon === 'clock'">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </template>
  </svg>
</template>
