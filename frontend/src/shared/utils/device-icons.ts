/**
 * Mapas de iconos SVG para cada tipo de dispositivo.
 * Centraliza los SVG para evitar duplicación entre HomesPage y DevicesPage.
 */
import { h } from 'vue'
import type { DeviceKind } from '@/app/stores/dashboard'

type SvgVNode = ReturnType<typeof h>

/**
 * Devuelve un VNode SVG para el tipo de dispositivo indicado.
 * Usa `h()` para crear elementos virtuales de Vue sin necesidad de
 * componentes .vue individuales.
 */
export function getDeviceIcon(kind: DeviceKind): SvgVNode {
  const svgProps = { viewBox: '0 0 24 24', 'aria-hidden': 'true' }

  const iconMap: Record<DeviceKind, () => SvgVNode> = {
    vacuum: () =>
      h('svg', svgProps, [
        h('rect', { x: 6, y: 3, width: 12, height: 10, rx: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('path', { d: 'M12 13v8', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
      ]),
    speaker: () =>
      h('svg', svgProps, [
        h('rect', { x: 7, y: 3, width: 10, height: 18, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('circle', { cx: 12, cy: 9, r: 2, fill: 'currentColor' }),
        h('circle', { cx: 12, cy: 15, r: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
      ]),
    tap: () =>
      h('svg', svgProps, [
        h('path', { d: 'M6 8h12', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
        h('path', { d: 'M9 8v5a3 3 0 0 0 6 0V8', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
        h('circle', { cx: 12, cy: 18, r: 1, fill: 'currentColor' }),
      ]),
    blind: () =>
      h('svg', svgProps, [
        h('rect', { x: 6, y: 4, width: 12, height: 16, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('path', { d: 'M6 9h12', stroke: 'currentColor', 'stroke-width': 2 }),
        h('path', { d: 'M6 13h12', stroke: 'currentColor', 'stroke-width': 2 }),
      ]),
    lamp: () =>
      h('svg', svgProps, [
        h('path', { d: 'M8 10a4 4 0 0 1 8 0c0 2-2 3-2 5H10c0-2-2-3-2-5z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('path', { d: 'M10 18h4', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
      ]),
    oven: () =>
      h('svg', svgProps, [
        h('rect', { x: 5, y: 4, width: 14, height: 16, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('rect', { x: 8, y: 9, width: 8, height: 6, rx: 1, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('circle', { cx: 8, cy: 6.5, r: 1, fill: 'currentColor' }),
        h('circle', { cx: 12, cy: 6.5, r: 1, fill: 'currentColor' }),
      ]),
    ac: () =>
      h('svg', svgProps, [
        h('path', { d: 'M6 7h12', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
        h('path', { d: 'M7 11h10', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
        h('path', { d: 'M9 15h6', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
      ]),
    door: () =>
      h('svg', svgProps, [
        h('rect', { x: 7, y: 4, width: 10, height: 16, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('circle', { cx: 14, cy: 12, r: 1, fill: 'currentColor' }),
      ]),
    alarm: () =>
      h('svg', svgProps, [
        h('rect', { x: 7, y: 4, width: 10, height: 16, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('path', { d: 'M12 4v2', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
        h('path', { d: 'M12 18v2', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
      ]),
    fridge: () =>
      h('svg', svgProps, [
        h('rect', { x: 6, y: 4, width: 12, height: 16, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('path', { d: 'M6 10h12', stroke: 'currentColor', 'stroke-width': 2 }),
      ]),
    other: () =>
      h('svg', svgProps, [
        h('rect', { x: 6, y: 4, width: 12, height: 16, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        h('path', { d: 'M6 10h12', stroke: 'currentColor', 'stroke-width': 2 }),
      ]),
  }

  return (iconMap[kind] ?? iconMap.other)()
}
