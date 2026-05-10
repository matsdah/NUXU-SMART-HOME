/**
 * Funciones auxiliares extraídas de dashboard.ts para mejorar
 * la separación de responsabilidades y facilitar tests unitarios.
 */

/**
 * Espera una cantidad de milisegundos.
 * Útil para reintentos con backoff.
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Verifica si un valor es un objeto (no null, no array).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Normaliza un nombre de tipo a minúsculas sin espacios.
 */
export function normalizeTypeName(typeName?: string): string {
  return typeName?.trim().toLowerCase() ?? ''
}

/**
 * Determina si un error de API es "recuperable" (podemos intentar
 * con un payload alternativo, ej. objeto vs. array posicional).
 */
export function isRecoverableActionError(err: unknown): boolean {
  return err instanceof Error && 'status' in err
    && typeof (err as { status: unknown }).status === 'number'
    && [400, 404, 405, 422].includes((err as { status: number }).status)
}

/**
 * Provee el string de estado traducido para un tipo de dispositivo
 * según si está encendido o apagado.
 */
export function statusForKind(kind: string, isOn: boolean): string {
  const map: Record<string, [string, string]> = {
    door: ['Abierto', 'Cerrado'],
    tap: ['Abierto', 'Cerrado'],
    blind: ['Abierto', 'Cerrado'],
    speaker: ['Reproduciendo', 'Detenido'],
    vacuum: ['Activo', 'Inactivo'],
    alarm: ['Activada', 'Desactivada'],
    ac: ['Encendido', 'Apagado'],
    oven: ['Encendido', 'Apagado'],
    lamp: ['Encendido', 'Apagado'],
    fridge: ['Encendido', 'Encendido'],
  }
  return map[kind]?.[isOn ? 0 : 1] ?? (isOn ? 'Encendido' : 'Apagado')
}
