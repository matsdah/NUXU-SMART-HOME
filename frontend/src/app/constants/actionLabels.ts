export type ActionMap = Record<string, string>;

export type ApiDeviceTypeLike = {
  name?: string;
  actions?: Array<{ name?: string }>;
};

// Etiquetas globales para mostrar en UI (independientes del tipo)
export const DEFAULT_ACTION_LABELS: ActionMap = {
  turnOn: "Encender",
  turnOff: "Apagar",
  setTemperature: "Ajustar temperatura",
  setMode: "Cambiar modo",
  setVerticalSwing: "Oscilación vertical",
  setHorizontalSwing: "Oscilación horizontal",
  setFanSpeed: "Velocidad del ventilador",
  setBrightness: "Ajustar brillo",
  setColor: "Cambiar color",
  lock: "Bloquear",
  unlock: "Desbloquear",
  play: "Reproducir",
  pause: "Pausar",
  stop: "Detener",
  resume: "Reanudar",
  nextSong: "Siguiente canción",
  previousSong: "Canción anterior",
  setVolume: "Ajustar volumen",
  open: "Abrir",
  close: "Cerrar",
  setLevel: "Ajustar nivel",
  start: "Iniciar",
  dock: "Volver a base",
  setHeat: "Ajustar calor",
  setGrill: "Ajustar grill",
  setConvection: "Ajustar convección",
  setFreezerTemperature: "Ajustar temperatura congelador",
  dispense: "Dispensar",
  armStay: "Activar modo stay",
  armAway: "Activar modo away",
  disarm: "Desactivar",
  setGenre: "Seleccionar género",
  setLocation: "Cambiar ubicacion",
  changeSecurityCode: "Cambiar codigo",
  getPlaylist: "Obtener playlist",
};

export const EXCLUSIVE_ACTION_GROUPS: string[][] = [
    ["turnOn", "turnOff"],
    ["open", "close"],
    ["lock", "unlock"],
    ["up", "down"],
    ["armStay", "armAway", "disarm"],
    ["play", "pause", "resume", "stop"],
];
const STORAGE_KEY = "nuxu.actionsAllowedByType.v2";

let actionsAllowedByType: Record<string, string[]> = {};

function normalizeTypeName(typeName: string): string {
  return typeName.trim().toLowerCase();
}

function uniqueSorted(list: string[]): string[] {
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "es"));
}

function saveCache(map: Record<string, string[]>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore cache errors
  }
}

function loadCache(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, string[]> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      const cleaned = value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      );
      result[normalizeTypeName(key)] = uniqueSorted(cleaned);
    }

    return result;
  } catch {
    return {};
  }
}

actionsAllowedByType = loadCache();

export function initializeAllowedActionsOnce(
  deviceTypes: ApiDeviceTypeLike[],
): void {
  if (Object.keys(actionsAllowedByType).length > 0) {
    return;
  }

  const generated: Record<string, string[]> = {};

  for (const type of deviceTypes) {
    if (!type.name) continue;
    const typeName = normalizeTypeName(type.name);
    const actions = (type.actions ?? [])
      .map((action) => action.name?.trim())
      .filter((name): name is string => Boolean(name));

    generated[typeName] = uniqueSorted(actions);
  }

  actionsAllowedByType = generated;
  saveCache(generated);
}

export function getActionLabel(
  _deviceTypeName: string | undefined,
  actionName: string,
): string {
  if (DEFAULT_ACTION_LABELS[actionName])
    return DEFAULT_ACTION_LABELS[actionName];
  return actionName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}

export function getAllowedActionsForType(
  deviceTypeName: string | undefined,
): string[] {
  if (!deviceTypeName) return listAllActions();
  const key = normalizeTypeName(deviceTypeName);
  if (actionsAllowedByType[key]) {
    return actionsAllowedByType[key];
  }
  return listAllActions();
}

export function listAllActions(): string[] {
  const set = new Set<string>(Object.keys(DEFAULT_ACTION_LABELS));
  for (const list of Object.values(actionsAllowedByType)) {
    list.forEach((action) => set.add(action));
  }
  return uniqueSorted(Array.from(set));
}
