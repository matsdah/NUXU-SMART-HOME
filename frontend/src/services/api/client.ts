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

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const API_KEY = import.meta.env.VITE_API_KEY

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

  const response = await fetch(`${BASE_URL}${path}`, init)

  if(!response.ok){
    let errorBody: unknown = null

    try{
      errorBody = await response.json()
    }catch{
      // ?
    }

    throw new ApiError(response.status, `${method} ${path} → ${response.status}`, errorBody)
  }

  if(response.status === 204){
    return undefined as T
  }
  
  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}
