import vacuumSvg from '@/assets/icons_devices/vacuum.svg?raw'
import speakerSvg from '@/assets/icons_devices/speaker.svg?raw'
import tapSvg from '@/assets/icons_devices/tap.svg?raw'
import blindSvg from '@/assets/icons_devices/blind.svg?raw'
import lampSvg from '@/assets/icons_devices/lamp.svg?raw'
import ovenSvg from '@/assets/icons_devices/oven.svg?raw'
import acSvg from '@/assets/icons_devices/ac.svg?raw'
import doorSvg from '@/assets/icons_devices/door.svg?raw'
import alarmSvg from '@/assets/icons_devices/alarm.svg?raw'
import fridgeSvg from '@/assets/icons_devices/fridge.svg?raw'
import otherSvg from '@/assets/icons_devices/other.svg?raw'
import type { DeviceKind } from '@/app/stores/dashboard'

const iconMap: Record<DeviceKind, string> = {
  vacuum: vacuumSvg,
  speaker: speakerSvg,
  tap: tapSvg,
  blind: blindSvg,
  lamp: lampSvg,
  oven: ovenSvg,
  ac: acSvg,
  door: doorSvg,
  alarm: alarmSvg,
  fridge: fridgeSvg,
  other: otherSvg,
}

export function getDeviceIcon(kind: DeviceKind): string {
  return iconMap[kind] ?? iconMap.other
}
