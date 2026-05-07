export interface DeviceLog {
  id: string;
  timestamp: string;
  deviceId: string;
  actionName: string;
  params?: unknown;
  result?: unknown;
}

export interface ApiDeviceType {
  id: string;
  name: string;
  powerUsage?: number;
  actions?: Array<{
    name: string;
    params?: Array<{ name: string; type: string }>;
  }>;
}

export interface ApiDevice {
  id: string;
  name?: string;
  type?: {
    id?: string;
    name?: string;
  };
  room?: {
    id?: string;
    name?: string;
  } | null;
}

export interface DeviceLogRow {
  id: string;
  timestamp: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  actionName: string;
  paramsText: string;
  resultText: string;
  success: boolean | null;
}
