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
  gap: 1rem;
  min-height: calc(100vh - 6rem);
  padding: 0;
}

.ac-controls-page__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0 0.25rem;
}

.ac-controls-page__header h1 {
  font-size: 1.9rem;
  font-weight: 600;
  color: var(--color-text);
}

.ac-controls-page__content {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0;
}
</style>