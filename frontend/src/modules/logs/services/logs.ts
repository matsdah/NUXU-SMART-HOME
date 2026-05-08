import { api } from "@/services/api/client";
import type { ApiDevice, ApiDeviceType, DeviceLog } from "../types";

export function fetchDeviceLogs(
  limit: number,
  offset: number,
): Promise<DeviceLog[]> {
  return api.get<DeviceLog[]>(`/devices/logs/limit/${limit}/offset/${offset}`);
}

export function fetchLogsForDevice(
  deviceId: string,
  limit: number,
  offset: number,
): Promise<DeviceLog[]> {
  return api.get<DeviceLog[]>(
    `/devices/${deviceId}/logs/limit/${limit}/offset/${offset}`,
  );
}

export function fetchDevices(): Promise<ApiDevice[]> {
  return api.get<ApiDevice[]>("/devices");
}

export function fetchDeviceTypes(): Promise<ApiDeviceType[]> {
  return api.get<ApiDeviceType[]>("/devicetypes");
}
