import { io, type Socket } from 'socket.io-client'
import { TOKEN_KEY } from '@/services/api/client'

const WS_URL  = import.meta.env.VITE_WS_URL?.trim()  as string | undefined
const API_KEY = import.meta.env.VITE_API_KEY?.trim() as string | undefined

if (!WS_URL) {
  console.warn('[Socket.IO] VITE_WS_URL no definida — eventos en tiempo real deshabilitados.')
}

type Listener<T = unknown> = (data: T) => void

// Mapeo de nombres de eventos del servidor → nombres internos del socket store
const EVENT_MAP: Record<string, string> = {
  deviceEvent:   'device.event',
  deviceCreated: 'device.created',
  deviceUpdated: 'device.updated',
  deviceDeleted: 'device.deleted',
  homeShared:    'home.shared',
  homeUnshared:  'home.unshared',
}

class SocketManager {
  private socket:    Socket | null = null
  private listeners = new Map<string, Set<Listener>>()

  connect(): void {
    if (!WS_URL) return
    if (this.socket?.connected) return

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    this.socket = io(WS_URL, {
      auth:       { token, apiKey: API_KEY },
      transports: ['polling'],
    })

    this.socket.on('connect', () => {
      this.emit('ws:connected', null)
    })

    this.socket.on('disconnect', () => {
      this.emit('ws:disconnected', null)
    })

    for (const [serverEvent, internalEvent] of Object.entries(EVENT_MAP)) {
      this.socket.on(serverEvent, (data: unknown) => {
        this.emit(internalEvent, data)
      })
    }
  }

  disconnect(): void {
    this.socket?.disconnect()
    this.socket = null
  }

  on<T>(event: string, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener as Listener)
    return () => this.listeners.get(event)?.delete(listener as Listener)
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(fn => fn(data))
  }
}

export const socketManager = new SocketManager()
