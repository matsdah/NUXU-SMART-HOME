<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  roomLabel: string
  temperature: number
  isOn: boolean
  badgeIcon?: string
  badgeLabel?: string
  showPowerButton?: boolean
}>(), {
  showPowerButton: true,
})

defineEmits<{
  togglePower: []
}>()
</script>

<template>
  <aside class="control-sidebar" :class="{ 'control-sidebar--off': !isOn }">
    <div class="control-sidebar__header">
      <p class="control-sidebar__room">{{ roomLabel }}</p>
      <h2 class="control-sidebar__title">{{ title }}</h2>
    </div>

    <div class="control-sidebar__center">
      <div class="control-sidebar__temp">
        <span class="control-sidebar__temp-value">{{ temperature }}</span>
        <span class="control-sidebar__temp-unit">°C</span>
      </div>

      <div v-if="badgeIcon && badgeLabel" class="control-sidebar__badge">
        <span class="control-sidebar__badge-icon">{{ badgeIcon }}</span>
        <span>{{ badgeLabel }}</span>
      </div>
    </div>

    <button v-if="showPowerButton !== false" class="control-sidebar__power" type="button" @click="$emit('togglePower')">
      <span class="control-sidebar__power-dot" :class="{ 'control-sidebar__power-dot--on': isOn }"></span>
      {{ isOn ? 'ENCENDIDO' : 'APAGADO' }}
    </button>
  </aside>
</template>

<style scoped>
.control-sidebar {
  background: linear-gradient(180deg, #e7dcc0 0%, #e2d4b5 100%);
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: rgba(52, 47, 41, 0.88);
  gap: 7.4rem;
}

.control-sidebar--off {
  opacity: 0.7;
}

.control-sidebar__room {
  font-size: 0.82rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(52, 47, 41, 0.42);
  margin: 0;
}

.control-sidebar__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.control-sidebar__title {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.1;
  font-weight: 600;
}

.control-sidebar__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.control-sidebar__temp {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.control-sidebar__temp-value {
  font-size: clamp(3rem, 6vw, 4.2rem);
  font-weight: 400;
  letter-spacing: -0.04em;
  line-height: 0.9;
}

.control-sidebar__temp-unit {
  font-size: 1rem;
  line-height: 1;
  color: rgba(52, 47, 41, 0.8);
}

.control-sidebar__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.52);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.control-sidebar__badge-icon {
  font-size: 0.95rem;
}

.control-sidebar__power {
  margin-top: 0.5rem;
  width: 100%;
  max-width: 170px;
  border: none;
  border-radius: 999px;
  padding: 0.85rem 1rem;
  background: rgba(52, 47, 41, 0.92);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: transform 0.15s;
}

.control-sidebar__power:hover {
  transform: translateY(-1px);
}

.control-sidebar__power-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  position: relative;
}

.control-sidebar__power-dot::after {
  content: '';
  position: absolute;
  inset: 2px 3px 2px 3px;
  border-radius: inherit;
  background: transparent;
  transition: background 0.15s;
}

.control-sidebar__power-dot--on::after {
  background: currentColor;
}
</style>
