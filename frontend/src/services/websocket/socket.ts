import { TOKEN_KEY } from '@/services/api/client'

const WS_URL = import.meta.env.VITE_WS_URL?.trim() as string | undefined
const API_KEY = import.meta.env.VITE_API_KEY?.trim() as string | undefined

if (!WS_URL) {
  console.warn('[WS] VITE_WS_URL no definida — WebSocket deshabilitado.')
}

type Listener<T = unknown> = (data: T) => void

const BASE_DELAY_MS  = 1_000
const MAX_DELAY_MS   = 30_000
const MAX_JITTER_MS  = 500

class SocketManager {
  private ws:              WebSocket | null = null
  private listeners        = new Map<string, Set<Listener>>()
  private reconnectTimer:  ReturnType<typeof setTimeout> | null = null
  private attempt          = 0
  private shouldReconnect  = false

  connect(): void {
    if (!WS_URL) return
    if (this.ws?.readyState === WebSocket.OPEN ||
        this.ws?.readyState === WebSocket.CONNECTING) return

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    const url = new URL(WS_URL)
    url.searchParams.set('token', token)
    if (API_KEY) url.searchParams.set('apiKey', API_KEY)

    this.shouldReconnect = true
    this.ws = new WebSocket(url.toString())

    this.ws.onopen = () => {
      this.attempt = 0
      this.emit('ws:connected', null)
    }

    this.ws.onmessage = (raw) => {
      try {
        const msg = JSON.parse(raw.data as string) as Record<string, unknown>
        // Soporta tanto { event, data } como { type, data }
        const name = (msg['event'] ?? msg['type']) as string | undefined
        if (name) this.emit(name, msg['data'] ?? msg)
      } catch {
        // Ignorar mensajes mal formados
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      this.emit('ws:disconnected', null)
      if (this.shouldReconnect) this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.clearReconnectTimer()
    this.ws?.close()
    this.ws = null
    this.attempt = 0
  }

  on<T>(event: string, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener as Listener)
    return () => this.listeners.get(event)?.delete(listener as Listener)
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(fn => fn(data))
  }

  private scheduleReconnect(): void {
    const jitter = Math.random() * MAX_JITTER_MS
    const delay  = Math.min(BASE_DELAY_MS * 2 ** this.attempt, MAX_DELAY_MS) + jitter
    this.attempt++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

export const socketManager = new SocketManager()
