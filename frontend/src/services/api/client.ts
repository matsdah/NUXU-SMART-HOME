export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const TOKEN_KEY = 'auth_token'

const BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim()
const API_KEY = import.meta.env.VITE_API_KEY?.trim()

if (!BASE_URL) {
  throw new Error('Missing VITE_API_BASE_URL. Define it in frontend/.env (or .env.local).')
}

if (!API_KEY) {
  throw new Error('Missing VITE_API_KEY. Define it in frontend/.env (or .env.local).')
}

const normalizedBaseUrl = BASE_URL.replace(/\/+$/, '')

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBaseUrl}${normalizedPath}`
}

function parseResponseBody(rawBody: string, contentType: string): unknown {
  if (!rawBody.trim()) {
    return undefined
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody)
  }

  return rawBody
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-KEY': API_KEY,
  }

  if(token){
    headers['Authorization'] = `Bearer ${token}`
  }

  const init: RequestInit = { method, headers }

  if(body !== undefined){
    init.body = JSON.stringify(body)
  }

  const response = await fetch(buildUrl(path), init)
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()

  if(!response.ok){
    const rawErrorBody = await response.text()
    let errorBody: unknown = null
    if (rawErrorBody) {
      try {
        errorBody = parseResponseBody(rawErrorBody, contentType)
      } catch {
        errorBody = rawErrorBody
      }
    }

    throw new ApiError(response.status, `${method} ${path} → ${response.status}`, errorBody)
  }

  const rawBody = await response.text()
  const parsedBody = parseResponseBody(rawBody, contentType)
  return parsedBody as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}
