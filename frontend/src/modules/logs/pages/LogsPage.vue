<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/app/stores/dashboard'
import { ApiError } from '@/services/api/client'
import type { Device } from '@/app/stores/dashboard'
import { fetchDeviceLogs, fetchLogsForDevice } from '../services/logs'
import type { DeviceLog } from '../types'

const PAGE_SIZE = 20

const store = useDashboardStore()
const { homes } = storeToRefs(store)

const logs = ref<DeviceLog[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const hasMore = ref(true)
const offset = ref(0)
const selectedDeviceId = ref('')
const deviceMap = ref<Map<string, Device>>(new Map())
const loadingDevices = ref(false)

const allDevices = computed<Device[]>(() => {
  return Array.from(deviceMap.value.values()).sort((a, b) => a.name.localeCompare(b.name))
})

const totalLoaded = computed(() => logs.value.length)

function deviceName(deviceId: string): string {
  return deviceMap.value.get(deviceId)?.name ?? 'Dispositivo eliminado'
}

function deviceRoom(deviceId: string): string {
  const device = deviceMap.value.get(deviceId)
  if (!device) return ''
  const room = store.rooms.find(r => r.id === device.roomId)
  return room?.name ?? ''
}

const ACTION_LABELS: Record<string, string> = {
  turnOn: 'Encendido',
  turnOff: 'Apagado',
  setBrightness: 'Cambio de brillo',
  setColor: 'Cambio de color',
  setTemperature: 'Cambio de temperatura',
  setMode: 'Cambio de modo',
  setVolume: 'Cambio de volumen',
  setVerticalSwing: 'Oscilación vertical',
  setHorizontalSwing: 'Oscilación horizontal',
  setFanSpeed: 'Velocidad del ventilador',
  setLevel: 'Cambio de nivel',
  open: 'Abrir',
  close: 'Cerrar',
  lock: 'Bloquear',
  unlock: 'Desbloquear',
  play: 'Reproducir',
  pause: 'Pausar',
  stop: 'Detener',
  nextSong: 'Canción siguiente',
  previousSong: 'Canción anterior',
  start: 'Iniciar',
  dock: 'Volver a base',
}

function actionLabel(actionName: string): string {
  return ACTION_LABELS[actionName] ?? actionName
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Hoy, ${time}`
  if (isYesterday) return `Ayer, ${time}`
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) + `, ${time}`
}

function formatDetail(log: DeviceLog): string {
  const parts: string[] = []
  if (log.params && log.params.length > 0) {
    parts.push(log.params.map(formatValue).join(', '))
  }
  if (log.result !== undefined && log.result !== null && log.result !== true) {
    if (typeof log.result === 'object') {
      parts.push(`Resultado: ${JSON.stringify(log.result)}`)
    } else if (log.result !== false) {
      parts.push(`Resultado: ${String(log.result)}`)
    }
  }
  return parts.join(' • ')
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function actionIcon(actionName: string): string {
  if (actionName === 'turnOn') return 'on'
  if (actionName === 'turnOff') return 'off'
  if (actionName.startsWith('set')) return 'set'
  if (['play', 'start', 'open', 'unlock'].includes(actionName)) return 'on'
  if (['pause', 'stop', 'close', 'lock', 'dock'].includes(actionName)) return 'off'
  return 'set'
}

async function loadDeviceMap() {
  loadingDevices.value = true
  try {
    await store.loadDashboard()
    const map = new Map<string, Device>()
    for (const home of homes.value) {
      try {
        const homeDevices = await store.fetchHomeDevices(home.id)
        for (const device of homeDevices) {
          map.set(device.id, device)
        }
      } catch {
        /* skip homes the user can't read */
      }
    }
    deviceMap.value = map
  } finally {
    loadingDevices.value = false
  }
}

async function loadInitial() {
  loading.value = true
  error.value = ''
  offset.value = 0
  logs.value = []
  hasMore.value = true
  try {
    const page = await fetchPage(0)
    logs.value = page
    offset.value = page.length
    hasMore.value = page.length === PAGE_SIZE
  } catch (e) {
    error.value = describeError(e)
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  error.value = ''
  try {
    const page = await fetchPage(offset.value)
    logs.value = logs.value.concat(page)
    offset.value += page.length
    hasMore.value = page.length === PAGE_SIZE
  } catch (e) {
    error.value = describeError(e)
  } finally {
    loadingMore.value = false
  }
}

function fetchPage(off: number): Promise<DeviceLog[]> {
  if (selectedDeviceId.value) {
    return fetchLogsForDevice(selectedDeviceId.value, PAGE_SIZE, off)
  }
  return fetchDeviceLogs(PAGE_SIZE, off)
}

function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: { description?: string } } | undefined
    return body?.error?.description ?? `Error ${e.status}. Intentá de nuevo.`
  }
  return 'No se pudo cargar el historial. Intentá de nuevo.'
}

function onDeviceFilterChange(event: Event) {
  const target = event.target as HTMLSelectElement
  selectedDeviceId.value = target.value
  void loadInitial()
}

function refresh() {
  void loadInitial()
}

onMounted(async () => {
  await loadDeviceMap()
  await loadInitial()
})
</script>

<template>
  <section class="logs-page">
    <header class="logs-page__header">
      <div>
        <p class="section-label">Historial</p>
        <h1 class="logs-page__title">Acciones realizadas</h1>
      </div>
      <div class="logs-page__controls">
        <label class="logs-page__filter">
          <span class="logs-page__filter-label">Dispositivo</span>
          <select
            class="logs-page__filter-select"
            :value="selectedDeviceId"
            :disabled="loadingDevices"
            @change="onDeviceFilterChange"
          >
            <option value="">Todos los dispositivos</option>
            <option v-for="device in allDevices" :key="device.id" :value="device.id">
              {{ device.name }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="logs-page__refresh"
          :disabled="loading || loadingMore"
          @click="refresh"
        >
          Refrescar
        </button>
      </div>
    </header>

    <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>

    <div v-if="loading" class="notice">Cargando historial...</div>

    <div v-else-if="logs.length === 0" class="logs-empty">
      <p class="logs-empty__title">Sin actividad registrada</p>
      <p class="logs-empty__hint">
        Cuando uses tus dispositivos, las acciones aparecerán acá.
      </p>
    </div>

    <ul v-else class="log-list">
      <li v-for="log in logs" :key="log.id" class="log-item">
        <span
          class="log-item__icon"
          :class="`log-item__icon--${actionIcon(log.actionName)}`"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <path
              v-if="actionIcon(log.actionName) === 'on'"
              d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0 1 19 12a7 7 0 1 1-12.59-4.41L5 6.17A9 9 0 1 0 21 12a8.94 8.94 0 0 0-3.17-6.83z"
            />
            <path
              v-else-if="actionIcon(log.actionName) === 'off'"
              d="M19 13H5v-2h14v2z"
            />
            <path
              v-else
              d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
            />
          </svg>
        </span>

        <div class="log-item__main">
          <p class="log-item__action">{{ actionLabel(log.actionName) }}</p>
          <p class="log-item__device">
            <span class="log-item__device-name">{{ deviceName(log.deviceId) }}</span>
            <span v-if="deviceRoom(log.deviceId)" class="log-item__device-room">
              · {{ deviceRoom(log.deviceId) }}
            </span>
          </p>
          <p v-if="formatDetail(log)" class="log-item__detail">{{ formatDetail(log) }}</p>
        </div>

        <time class="log-item__time" :datetime="log.timestamp">
          {{ formatTimestamp(log.timestamp) }}
        </time>
      </li>
    </ul>

    <div v-if="!loading && hasMore && logs.length > 0" class="logs-page__more">
      <button
        type="button"
        class="logs-page__more-button"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? 'Cargando...' : 'Cargar más' }}
      </button>
    </div>

    <p v-if="!loading && !hasMore && logs.length > 0" class="logs-page__end">
      Mostrando {{ totalLoaded }} acciones · No hay más entradas.
    </p>
  </section>
</template>

<style scoped>
.logs-page {
  padding: 32px 48px 64px;
  max-width: 1200px;
  margin: 0 auto;
  color: var(--color-text);
}

.logs-page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.section-label {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.logs-page__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 600;
  color: var(--color-charcoal);
}

.logs-page__controls {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.logs-page__filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.logs-page__filter-label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.logs-page__filter-select {
  appearance: none;
  background: var(--color-white);
  border: 1px solid var(--color-sage);
  border-radius: var(--radius-btn);
  padding: 10px 16px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text);
  min-width: 220px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.logs-page__filter-select:hover:not(:disabled),
.logs-page__filter-select:focus-visible {
  border-color: var(--color-brown);
  outline: none;
}

.logs-page__filter-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logs-page__refresh {
  background: var(--color-brown);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-btn);
  padding: 10px 20px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.logs-page__refresh:hover:not(:disabled) {
  opacity: 0.9;
}

.logs-page__refresh:active:not(:disabled) {
  transform: translateY(1px);
}

.logs-page__refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notice {
  background: var(--color-cream);
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 14px;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

.notice--error {
  background: #f4d5cc;
  color: #783424;
}

.logs-empty {
  background: var(--color-cream);
  border-radius: 16px;
  padding: 64px 32px;
  text-align: center;
}

.logs-empty__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-charcoal);
}

.logs-empty__hint {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-muted);
}

.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item {
  background: var(--color-white);
  border-radius: 16px;
  padding: 16px 24px;
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 16px;
  align-items: center;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.log-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(42, 40, 37, 0.06);
}

.log-item__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-cream);
  color: var(--color-brown);
}

.log-item__icon svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.log-item__icon--on {
  background: var(--color-sage);
  color: var(--color-charcoal);
}

.log-item__icon--off {
  background: var(--color-sage-dark);
  color: var(--color-white);
}

.log-item__main {
  min-width: 0;
}

.log-item__action {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-charcoal);
}

.log-item__device {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.log-item__device-name {
  color: var(--color-text);
  font-weight: 500;
}

.log-item__device-room {
  color: var(--color-text-muted);
}

.log-item__detail {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
}

.log-item__time {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  align-self: flex-start;
  padding-top: 2px;
}

.logs-page__more {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.logs-page__more-button {
  background: transparent;
  color: var(--color-brown);
  border: 1px solid var(--color-brown);
  border-radius: var(--radius-btn);
  padding: 10px 32px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.logs-page__more-button:hover:not(:disabled) {
  background: var(--color-brown);
  color: var(--color-white);
}

.logs-page__more-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logs-page__end {
  text-align: center;
  margin-top: 24px;
  font-size: 12px;
  color: var(--color-text-muted);
}

@media (max-width: 1400px) {
  .logs-page {
    padding: 24px 32px 48px;
  }
}
</style>
