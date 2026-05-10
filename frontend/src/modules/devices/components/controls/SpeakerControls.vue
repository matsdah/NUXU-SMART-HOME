<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api, ApiError } from '@/services/api/client'
import ControlSidebar from '../shared/ControlSidebar.vue'
import TemperatureControl from '../shared/TemperatureControl.vue'
import type { PillOption } from '../shared/PillButtons.vue'
import PillButtons from '../shared/PillButtons.vue'
import { useToast } from '@/shared/composables/useToast'
import '@/shared/styles/control-panel.css'

const props = defineProps<{ deviceId: string; deviceName?: string }>()
const emit = defineEmits<{ powerToggled: [isOn: boolean] }>()

type PlaybackStatus = 'playing' | 'paused' | 'stopped'

const GENRES: PillOption[] = [
  { value: 'classical',  label: 'Clásica'  },
  { value: 'country',  label: 'Country'  },
  { value: 'dance',    label: 'Dance'    },
  { value: 'latina',   label: 'Latina'   },
  { value: 'pop',      label: 'Pop'      },
  { value: 'rock',     label: 'Rock'     },
]

const STATUS_LABEL: Record<PlaybackStatus, string> = {
  playing: 'Reproduciendo',
  paused:  'Pausado',
  stopped: 'Detenido',
}

type PlaylistSong = { title?: string; name?: string; artist?: string; duration?: number }

const playbackStatus = ref<PlaybackStatus>('stopped')
const volume         = ref(5)
const genre          = ref('pop')
const songTitle      = ref('')
const songArtist     = ref('')

const playlist       = ref<PlaylistSong[]>([])
const showPlaylist   = ref(false)
const playlistLoading = ref(false)

const loading        = ref(true)
const actionPending  = ref(false)

const { showToast } = useToast()

const isPlaying = computed(() => playbackStatus.value === 'playing')
const isPaused  = computed(() => playbackStatus.value === 'paused')
const isActive  = computed(() => isPlaying.value || isPaused.value)

function parseStatus(s: unknown): PlaybackStatus {
  if (s === 'playing') return 'playing'
  if (s === 'paused')  return 'paused'
  return 'stopped'
}

async function fetchState() {
  const raw = await api.get<Record<string, unknown>>(`/devices/${props.deviceId}/state`)
  playbackStatus.value = parseStatus(raw.status)
  volume.value  = Number(raw.volume ?? volume.value)
  genre.value   = normalizeGenre(raw.genre ?? genre.value)
  const song = raw.song as Record<string, unknown> | string | undefined
  if (typeof song === 'string') {
    songTitle.value = song
  } else if (song && typeof song === 'object') {
    songTitle.value  = String(song.title ?? song.name ?? '')
    songArtist.value = String(song.artist ?? '')
  }
}

onMounted(async () => {
  try { await fetchState() } catch { /* valores por defecto */ }
  finally { loading.value = false }
})

function handleError(e: unknown) {
  if (e instanceof ApiError) {
    const msg = (e.body as { error?: { description?: string } })?.error?.description
    showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, 'error')
  } else {
    showToast('Error inesperado. Intentá de nuevo.', 'error')
  }
}

function normalizeGenre(raw: unknown): string {
  const value = String(raw ?? '').trim().toLowerCase()
  if (!value) return genre.value
  if (value === 'clasica') return 'classical'
  return value
}

async function doAction(action: string, body: Record<string, unknown> = {}, toast?: string) {
  if (actionPending.value) return
  actionPending.value = true
  try {
    await api.patch(`/devices/${props.deviceId}/${action}`, body)
    await fetchState()
    emit('powerToggled', playbackStatus.value === 'playing' || playbackStatus.value === 'paused')
    if (toast) showToast(toast, 'success')
  } catch (e) {
    handleError(e)
  } finally {
    actionPending.value = false
  }
}

async function onVolumeChange(val: number) {
  volume.value = val
  await doAction('setVolume', { volume: val }, `Volumen: ${val}`)
}

async function onGenreChange(val: string) {
  genre.value = val
  showPlaylist.value = false
  playlist.value = []
  await doAction('setGenre', { genre: val }, `Género: ${GENRES.find(g => g.value === val)?.label ?? val}`)
}

async function fetchPlaylist() {
  if (playlistLoading.value) return
  playlistLoading.value = true
  try {
    const raw = await api.patch<{ result?: unknown }>(`/devices/${props.deviceId}/getPlaylist`, {})
    const payload = raw?.result ?? raw
    const record = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : null
    const items = Array.isArray(payload)
      ? payload
      : (record?.songs as PlaylistSong[] | undefined) ?? []
    playlist.value = Array.isArray(items) ? items : []
    showPlaylist.value = true
  } catch (e) {
    handleError(e)
  } finally {
    playlistLoading.value = false
  }
}

function formatDuration(secs?: number): string {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div v-if="loading" class="cp-loading">Cargando...</div>

  <div v-else class="cp-shell">
    <section class="cp-card">
      <ControlSidebar
        :title="props.deviceName || 'Parlante'"
        room-label="AMBIENTE"
        :temperature="volume"
        unit="vol"
        badge-icon="♪"
        :badge-label="`${GENRES.find(g => g.value === genre)?.label ?? genre} · ${STATUS_LABEL[playbackStatus]}`"
        :is-on="isActive"
        :show-power-button="false"
      />

      <div class="cp-controls cp-controls--scrollable">

        <section class="cp-section">
          <p class="cp-label">Reproducción</p>
          <div class="spk-playback-row">
            <button
              type="button"
              class="spk-media-btn"
              :disabled="actionPending || !isActive"
              aria-label="Canción anterior"
              @click="doAction('previousSong', {}, 'Canción anterior')"
            >⏮</button>

            <button
              type="button"
              class="spk-media-btn spk-media-btn--primary"
              :disabled="actionPending"
              :aria-label="isPlaying ? 'Pausar' : 'Reproducir'"
              @click="doAction(isPlaying ? 'pause' : 'play', {}, isPlaying ? 'Pausado' : 'Reproduciendo')"
            >{{ isPlaying ? '⏸' : '▶' }}</button>


            <button
              type="button"
              class="spk-media-btn"
              :disabled="actionPending || !isActive"
              aria-label="Siguiente canción"
              @click="doAction('nextSong', {}, 'Siguiente canción')"
            >⏭</button>

            <button
              type="button"
              class="spk-media-btn spk-media-btn--stop"
              :disabled="actionPending || !isActive"
              aria-label="Detener"
              @click="doAction('stop', {}, 'Detenido')"
            >⏹</button>
          </div>
        </section>

        <section class="cp-section">
          <p class="cp-label">Volumen</p>
          <div :class="{ 'cp-controls--disabled': actionPending }">
            <TemperatureControl
              :model-value="volume"
              :min="0"
              :max="10"
              unit=""
              :step="1"
              label="volumen"
              editable
              @update:model-value="onVolumeChange"
            />
          </div>
        </section>

        <section class="cp-section">
          <p class="cp-label">Género</p>
          <div :class="{ 'cp-controls--disabled': actionPending }">
            <PillButtons
              :model-value="genre"
              :options="GENRES"
              size="small"
              @update:model-value="(v: string) => onGenreChange(v)"
            />
          </div>
        </section>

        <section class="cp-section">
          <button
            type="button"
            class="spk-playlist-btn"
            :disabled="playlistLoading"
            @click="showPlaylist ? showPlaylist = false : fetchPlaylist()"
          >
            {{ playlistLoading ? 'Cargando...' : showPlaylist ? 'Ocultar lista' : 'Ver lista de reproducción' }}
          </button>

          <ul v-if="showPlaylist && playlist.length" class="spk-playlist">
            <li v-for="(song, i) in playlist" :key="i" class="spk-playlist-item">
              <span class="spk-playlist-title">{{ song.title ?? song.name ?? `Canción ${i + 1}` }}</span>
              <span v-if="song.duration" class="spk-playlist-duration">{{ formatDuration(song.duration) }}</span>
            </li>
          </ul>
          <p v-else-if="showPlaylist && !playlist.length" class="spk-hint">Lista vacía</p>
        </section>

      </div>
    </section>
  </div>
</template>

<style scoped>
.spk-hint {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(52, 47, 41, 0.45);
}

/* Playback buttons */

.spk-playback-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
}

.spk-media-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(52, 47, 41, 0.1);
  color: rgba(52, 47, 41, 0.85);
  font-size: 1rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.15s, transform 0.15s;
  flex-shrink: 0;
}

.spk-media-btn:hover:not(:disabled) {
  background: rgba(52, 47, 41, 0.18);
  transform: translateY(-1px);
}

.spk-media-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.spk-media-btn--primary {
  width: 54px;
  height: 54px;
  font-size: 1.2rem;
  background: rgba(52, 47, 41, 0.88);
  color: #fff;
  box-shadow: 0 4px 14px rgba(52, 47, 41, 0.22);
}

.spk-media-btn--primary:hover:not(:disabled) {
  background: rgba(52, 47, 41, 1);
}

.spk-media-btn--stop {
  color: rgba(160, 48, 48, 0.8);
}

/* Playlist */
.spk-playlist-btn {
  width: 100%;
  height: 40px;
  border-radius: 999px;
  background: rgba(52, 47, 41, 0.08);
  border: none;
  color: rgba(52, 47, 41, 0.75);
  font-size: 0.85rem;
  font-weight: 700;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s, opacity 0.15s;
}

.spk-playlist-btn:hover:not(:disabled) {
  background: rgba(52, 47, 41, 0.13);
  box-shadow: 0 8px 24px rgba(52, 47, 41, 0.12);
  transform: translateY(-1px);
}

.spk-playlist-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spk-playlist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 200px;
  overflow-y: auto;
}

.spk-playlist-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.65);
  font-size: 0.82rem;
}

.spk-playlist-title {
  color: rgba(52, 47, 41, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spk-playlist-duration {
  color: rgba(52, 47, 41, 0.45);
  font-size: 0.75rem;
  flex-shrink: 0;
  margin-left: 0.5rem;
}
</style>
