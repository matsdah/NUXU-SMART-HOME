import { api } from '@/services/api/client'
import type { DeviceLog } from '../types'

export function fetchDeviceLogs(limit: number, offset: number): Promise<DeviceLog[]> {
  return api.get<DeviceLog[]>(`/devices/logs/limit/${limit}/offset/${offset}`)
}

export function fetchLogsForDevice(
  deviceId: string,
  limit: number,
  offset: number,
): Promise<DeviceLog[]> {
  return api.get<DeviceLog[]>(`/devices/${deviceId}/logs/limit/${limit}/offset/${offset}`)
}
