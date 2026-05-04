<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AcControls from '../components/controls/AcControls.vue'

const route = useRoute()

const deviceId = computed(() => String(route.params.deviceId ?? ''))
</script>

<template>
  <section class="ac-controls-page">
    <header class="ac-controls-page__header">
      <p class="section-label">Dispositivo</p>
      <h1>Controles de aire acondicionado</h1>
    </header>

    <div v-if="deviceId" class="ac-controls-page__content">
      <AcControls :device-id="deviceId" />
    </div>

    <div v-else class="notice notice--error" role="alert">
      Falta el identificador del dispositivo.
    </div>
  </section>
</template>

<style scoped>
.ac-controls-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.ac-controls-page__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ac-controls-page__header h1 {
  font-size: 1.9rem;
  font-weight: 600;
  color: var(--color-text);
}

.ac-controls-page__content {
  background: rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.08);
}
</style>