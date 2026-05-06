export interface DeviceLog {
  id: string
  timestamp: string
  deviceId: string
  actionName: string
  params: unknown[]
  result: unknown
}
