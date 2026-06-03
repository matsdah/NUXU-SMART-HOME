export interface User {
  id: string
  email: string
  name: string
  isVerified: boolean
  createdAt: string
  metadata: Record<string, unknown>
}

export interface LoginResponse {
  user: User
  token: string
}
