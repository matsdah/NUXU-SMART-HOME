interface CloseEntry {
  closesAt: number
  timer: ReturnType<typeof setTimeout>
}

const entries = new Map<string, CloseEntry>()

export function persistClose(deviceId: string, closesAt: number, timer: ReturnType<typeof setTimeout>) {
  cancelClose(deviceId)
  entries.set(deviceId, { closesAt, timer })
}

export function cancelClose(deviceId: string) {
  const entry = entries.get(deviceId)
  if (entry) {
    clearTimeout(entry.timer)
    entries.delete(deviceId)
  }
}

export function getRemainingMs(deviceId: string): number {
  const entry = entries.get(deviceId)
  return entry ? Math.max(0, entry.closesAt - Date.now()) : 0
}
