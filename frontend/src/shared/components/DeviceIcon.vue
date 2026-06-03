<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceKind } from '@/app/stores/dashboard'
import { getDeviceIcon } from '@/shared/utils/device-icons'

const props = defineProps<{
  kind: DeviceKind
}>()

const iconHtml = computed(() => getDeviceIcon(props.kind))
</script>

<template>
  <span aria-hidden="true" v-html="iconHtml" />
</template>

<style scoped>
span {
  display: contents;
}
</style>
