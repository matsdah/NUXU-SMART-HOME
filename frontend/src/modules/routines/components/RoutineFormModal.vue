<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { api, ApiError } from "@/services/api/client";
import { useDashboardStore, labelForTypeId } from "@/app/stores/dashboard";
import { useToast } from "@/shared/composables/useToast";
import type { Device, DeviceKind } from "@/app/stores/dashboard";
import DeviceIcon from "@/shared/components/DeviceIcon.vue";
import RoutineIcon from "@/shared/components/RoutineIcon.vue";
import RoutineScheduleStep, { type RoutineScheduleConfig } from "./RoutineScheduleStep.vue";
import EditEntityModal from "@/app/components/EditEntityModal.vue";
import DeleteEntityConfirmModal from "@/app/components/DeleteEntityConfirmModal.vue";
import type { RoutineIcon as RoutineIconType } from "../components/RoutineFormModal.vue";
import {
    getActionLabel,
    getAllowedActionsForType,
    initializeAllowedActionsOnce,
    EXCLUSIVE_ACTION_GROUPS,
} from "@/app/constants/actionLabels";
import {
    buildDefaultParams,
    buildDeviceTypeActionMap,
    getParamSchemaForAction,
    mapParamsFromApi,
    mapParamsToArray,
    validateActionsForDevice,
    validateRoutineActions,
    getParamValueLabel,
    type ActionItem,
    type ActionParamSchema,
    type ActionRowError,
    type DeviceTypeWithActions,
} from "../utils/routineActions";

/* ─── Exported types ─────────────────────────────────────── */

export type RoutineIcon = "bolt" | "sun" | "moon" | "home" | "star" | "clock";

export type RoutineCard = {
    id: string;
    name: string;
    deviceIds: string[];
    actionsCount: number;
    icon: RoutineIcon;
    displayOrder?: number;
    isScheduled?: boolean;
    isScheduleEnabled?: boolean;
    scheduleTime?: string;
    scheduleFrequency?: string;
    scheduleDaysOfWeek?: number[];
};

/* ─── Internal types ─────────────────────────────────────── */

type ApiCreatedRoutine = { id?: string };
type ApiRoutineDetail = {
    id?: string;
    name?: string;
    actions?: ApiRoutineAction[];
    schedule?: {
        time?: string;
        frequency?: string;
        daysOfWeek?: number[];
    };
    metadata?: Record<string, unknown>;
};
type ApiRoutineAction = {
    device?: { id?: string };
    actionName?: string;
    params?: unknown[] | Record<string, unknown>;
};

/* ─── Props & Emits ──────────────────────────────────────── */

const props = defineProps<{
    mode: "create" | "edit";
    routine?: RoutineCard;
    initialStep?: 1 | 2 | 3;
}>();

const emit = defineEmits<{
    close: [];
    created: [routine: RoutineCard];
    updated: [routine: RoutineCard];
}>();

/* ─── Constants ──────────────────────────────────────────── */

const ICONS: RoutineIcon[] = ["bolt", "sun", "moon", "home", "star", "clock"];

const PRESET_COLORS = [
  { label: 'Blanco cálido', value: '#FFD580' },
  { label: 'Blanco frío',   value: '#E8F4FF' },
  { label: 'Rojo',           value: '#FF4D4D' },
  { label: 'Verde',          value: '#4DFF91' },
  { label: 'Azul',           value: '#4D9FFF' },
  { label: 'Violeta',        value: '#A64DFF' },
];

/* ─── Store ──────────────────────────────────────────────── */

const store = useDashboardStore();
const { showToast } = useToast();

/* ─── Reactive state ─────────────────────────────────────── */

const routineName = ref(props.routine?.name ?? "");
const selectedIcon = ref<RoutineIcon>(props.routine?.icon ?? "bolt");
const existingMetadata = ref<Record<string, unknown>>({});

const scheduleConfig = ref<RoutineScheduleConfig>({
    enabled: false,
    time: "08:00",
    frequency: "daily",
    daysOfWeek: [1, 2, 3, 4, 5],
});

// Step 1 = details + devices, Step 2 = actions, Step 3 = schedule
const activeStep = ref<1 | 2 | 3>(
    props.initialStep ?? (props.mode === "edit" ? 2 : 1),
);
const selectedRoomId = ref("all");
const selectedDeviceIds = ref<string[]>([...(props.routine?.deviceIds ?? [])]);

const allDevices = ref<Device[]>([]);
const loadingDevices = ref(true);
const deviceTypesWithActions = ref<DeviceTypeWithActions[]>([]);
const loadingDeviceTypes = ref(true);

const actionsByDevice = ref<Record<string, ActionItem[]>>({});
const validationErrorsByDeviceAction = ref<Record<string, ActionRowError[]>>({});

const submitting = ref(false);
const routineActionsLoaded = ref(false);
const showActionErrors = ref(false);
const openDropdowns = ref<Set<string>>(new Set());

function dropdownKey(deviceId: string, index: number): string {
    return `${deviceId}--${index}`;
}

function isDropdownOpen(key: string): boolean {
    return openDropdowns.value.has(key);
}

function toggleDropdown(key: string) {
    const next = new Set(openDropdowns.value);
    if (next.has(key)) {
        next.delete(key);
    } else {
        next.clear();
        next.add(key);
    }
    openDropdowns.value = next;
}

function closeAllDropdowns() {
    openDropdowns.value = new Set();
}

function getSelectedActionLabel(deviceId: string, index: number): string {
    const actions = actionsByDevice.value[deviceId] ?? [];
    const action = actions[index];
    if (!action || !action.actionName) return "";
    return getActionLabel(getDeviceTypeName(deviceId), action.actionName);
}

/* ─── Computed ───────────────────────────────────────────── */

const rooms = computed(() => store.rooms);

const deviceTypeNameById = computed(() => {
    const map: Record<string, string> = {};
    for (const deviceType of deviceTypesWithActions.value) {
        if (deviceType.id && deviceType.name) map[deviceType.id] = deviceType.name;
    }
    return map;
});

const deviceTypeNameByDeviceId = computed(() => {
    const map: Record<string, string> = {};
    for (const device of allDevices.value) {
        if (!device.typeId) continue;
        const typeName = deviceTypeNameById.value[device.typeId];
        if (typeName) map[device.id] = typeName;
    }
    return map;
});

const deviceTypeDisplayNameByDeviceId = computed(() => {
    const map: Record<string, string> = {};
    for (const device of allDevices.value) {
        if (!device.typeId) continue;
        map[device.id] = labelForTypeId(device.typeId);
    }
    return map;
});

const actionSchemaMap = computed(() =>
    buildDeviceTypeActionMap(deviceTypesWithActions.value),
);

const filteredDevices = computed(() => {
    if (selectedRoomId.value === "all") return allDevices.value;
    return allDevices.value.filter((d: Device) => d.roomId === selectedRoomId.value);
});

const selectedDevicesInfo = computed(() =>
    selectedDeviceIds.value
        .map((id: string) => allDevices.value.find((d: Device) => d.id === id))
        .filter((d): d is Device => Boolean(d)),
);

const isStep1 = computed(() => activeStep.value === 1);
const isStep2 = computed(() => activeStep.value === 2);
const isStep3 = computed(() => activeStep.value === 3);

// Step 1 requires both a name and at least one device selected
const canContinueStep1 = computed(
    () => routineName.value.trim() !== "" && selectedDeviceIds.value.length > 0,
);

// Step 2 requires at least one valid action per selected device
const canContinueStep2 = computed(() => {
    if (selectedDeviceIds.value.length === 0) return false;
    return selectedDeviceIds.value.every((deviceId) => {
        const actions = actionsByDevice.value[deviceId] ?? [];
        return actions.some((a) => a.actionName);
    });
});

const canSubmit = computed(
    () => routineName.value.trim() !== "" && selectedDeviceIds.value.length > 0,
);

const stepTitle = computed(() => {
    if (isStep1.value) return "Dispositivos";
    if (isStep2.value) return "Acciones";
    return "Programación";
});

const stepSubtitle = computed(() => {
    if (isStep1.value) return "Seleccioná los dispositivos de la rutina.";
    if (isStep2.value) return "Configurá las acciones para cada dispositivo.";
    return "Definí el horario y la frecuencia de ejecución.";
});

/* ─── Helpers ────────────────────────────────────────────── */

function getDeviceTypeName(deviceId: string): string | undefined {
    return deviceTypeNameByDeviceId.value[deviceId];
}

function getDeviceTypeDisplayName(deviceId: string): string {
    return deviceTypeDisplayNameByDeviceId.value[deviceId] ?? "Tipo desconocido";
}

function getActionSchema(deviceId: string, actionName: string): ActionParamSchema[] {
    return getParamSchemaForAction(
        getDeviceTypeName(deviceId),
        actionName,
        actionSchemaMap.value,
    );
}

function buildActionOptions(deviceId: string) {
    const typeName = getDeviceTypeName(deviceId);
    return getAllowedActionsForType(typeName).map((actionName) => ({
        actionName,
        label: getActionLabel(typeName, actionName),
    }));
}

function buildActionOptionsForRow(deviceId: string, index: number) {
    const options = buildActionOptions(deviceId);
    const list = actionsByDevice.value[deviceId] ?? [];
    const current = list[index]?.actionName;
    const used = new Set(
        list
            .map((item, itemIndex) => (itemIndex === index ? "" : item.actionName))
            .filter((name) => name),
    );
    const excluded = new Set(used);
    for (const usedAction of used) {
        for (const group of EXCLUSIVE_ACTION_GROUPS) {
            if (group.includes(usedAction)) group.forEach((a) => excluded.add(a));
        }
    }
    return options.filter(
        (option) => !excluded.has(option.actionName) || option.actionName === current,
    );
}

function createEmptyActionItem(): ActionItem {
    return { actionName: "", params: {} };
}

function ensureDeviceActionList(deviceId: string): void {
    if (!actionsByDevice.value[deviceId]) {
        actionsByDevice.value[deviceId] = [createEmptyActionItem()];
    }
}

function clearDeviceActions(deviceId: string): void {
    delete actionsByDevice.value[deviceId];
    delete validationErrorsByDeviceAction.value[deviceId];
}

function ensureActionsForSelectedDevices(deviceIds: string[]): void {
    deviceIds.forEach((id) => ensureDeviceActionList(id));
}

function getDeviceKind(deviceId: string): DeviceKind | undefined {
    return allDevices.value.find((d: Device) => d.id === deviceId)?.kind;
}

function getInputPlaceholder(paramName: string): string | undefined {
    if (paramName === "securityCode") return "Ingresa el codigo";
    return undefined;
}

function getRoomName(roomId: string): string {
    const room = rooms.value.find((r) => r.id === roomId);
    return room ? room.name : "";
}

function updateDeviceValidation(deviceId: string): void {
    const actions = actionsByDevice.value[deviceId] ?? [];
    const errors = validateActionsForDevice(
        actions,
        (actionName) => getActionSchema(deviceId, actionName),
        { disallowDuplicateActions: true },
    );
    if (errors.length > 0) {
        validationErrorsByDeviceAction.value[deviceId] = errors;
    } else {
        delete validationErrorsByDeviceAction.value[deviceId];
    }
}

function getRowErrors(deviceId: string, index: number): ActionRowError[] {
    return (validationErrorsByDeviceAction.value[deviceId] ?? []).filter(
        (error) => error.index === index,
    );
}

async function loadDeviceTypes(): Promise<DeviceTypeWithActions[]> {
    try {
        const data = await api.get<DeviceTypeWithActions[]>("/devicetypes");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function hydrateActionItem(deviceId: string, action: ApiRoutineAction): ActionItem | null {
    if (!action.actionName) return null;
    const schema = getActionSchema(deviceId, action.actionName);
    const params = mapParamsFromApi(action.params, schema);
    return { actionName: action.actionName, params };
}

function applyRoutineActions(actions: ApiRoutineAction[]): void {
    const nextActionsByDevice: Record<string, ActionItem[]> = {};
    const nextDeviceIds: string[] = [];
    actions.forEach((action) => {
        const deviceId = action.device?.id;
        if (!deviceId) return;
        if (!nextActionsByDevice[deviceId]) {
            nextActionsByDevice[deviceId] = [];
            nextDeviceIds.push(deviceId);
        }
        const item = hydrateActionItem(deviceId, action);
        if (item) nextActionsByDevice[deviceId].push(item);
    });
    if (nextDeviceIds.length > 0) selectedDeviceIds.value = nextDeviceIds;
    actionsByDevice.value = nextActionsByDevice;
    ensureActionsForSelectedDevices(selectedDeviceIds.value);
    selectedDeviceIds.value.forEach((id) => updateDeviceValidation(id));
}

async function loadRoutineActions(routineId: string): Promise<void> {
    try {
        const detail = await api.get<ApiRoutineDetail>(`/routines/${routineId}`);
        if (detail?.name && routineName.value.trim() === "") routineName.value = detail.name;
        if (detail?.metadata) {
            existingMetadata.value = detail.metadata;
            const metaIcon = detail.metadata.icon as RoutineIconType | undefined;
            if (metaIcon && ICONS.includes(metaIcon)) {
                selectedIcon.value = metaIcon;
            }
        }
        if (detail?.schedule) {
            const sched = detail.schedule;
            scheduleConfig.value = {
                enabled: true,
                time: sched.time ?? "08:00",
                frequency: (sched.frequency as RoutineScheduleConfig['frequency']) ?? "daily",
                daysOfWeek: Array.isArray(sched.daysOfWeek) ? sched.daysOfWeek : [1, 2, 3, 4, 5],
            };
        } else {
            scheduleConfig.value = {
                enabled: false,
                time: "08:00",
                frequency: "daily",
                daysOfWeek: [1, 2, 3, 4, 5],
            };
        }
        if (Array.isArray(detail?.actions)) {
            applyRoutineActions(detail.actions);
        } else {
            ensureActionsForSelectedDevices(selectedDeviceIds.value);
        }
    } catch {
        ensureActionsForSelectedDevices(selectedDeviceIds.value);
    } finally {
        routineActionsLoaded.value = true;
    }
}

/* ─── Lifecycle ──────────────────────────────────────────── */

function onDocClick() {
    closeAllDropdowns();
}

onMounted(async () => {
    document.addEventListener("click", onDocClick);
    const [devicesResult, typesResult] = await Promise.allSettled([
        store.fetchHomeDevices(store.activeHomeId),
        loadDeviceTypes(),
    ]);
    if (devicesResult.status === "fulfilled") {
        allDevices.value = devicesResult.value;
    } else {
        allDevices.value = store.devices.slice();
    }
    loadingDevices.value = false;
    if (typesResult.status === "fulfilled") deviceTypesWithActions.value = typesResult.value;
    initializeAllowedActionsOnce(deviceTypesWithActions.value);
    loadingDeviceTypes.value = false;

    if (props.mode === "edit" && props.routine?.id) {
        await loadRoutineActions(props.routine.id);
    } else {
        ensureActionsForSelectedDevices(selectedDeviceIds.value);
        selectedDeviceIds.value.forEach((id) => updateDeviceValidation(id));
        routineActionsLoaded.value = true;
    }
});

onBeforeUnmount(() => {
    document.removeEventListener("click", onDocClick);
});

/* ─── Methods ────────────────────────────────────────────── */

function toggleDevice(id: string) {
    const idx = selectedDeviceIds.value.indexOf(id);
    if (idx >= 0) {
        selectedDeviceIds.value.splice(idx, 1);
        clearDeviceActions(id);
    } else {
        selectedDeviceIds.value.push(id);
        ensureDeviceActionList(id);
        updateDeviceValidation(id);
    }
}

function continueToActions() {
    if (routineName.value.trim() === "") {
        showToast("Completá un nombre para la rutina.", "error");
        return;
    }
    if (selectedDeviceIds.value.length === 0) return;
    ensureActionsForSelectedDevices(selectedDeviceIds.value);
    selectedDeviceIds.value.forEach((id) => updateDeviceValidation(id));
    showActionErrors.value = false;
    activeStep.value = 2;
}

function backToStep1() {
    showActionErrors.value = false;
    activeStep.value = 1;
}

function continueToSchedule() {
    showActionErrors.value = true;
    const errorsByDevice = validateRoutineActions(
        selectedDeviceIds.value,
        actionsByDevice.value,
        (deviceId, actionName) => getActionSchema(deviceId, actionName),
        { disallowDuplicateActions: true },
    );
    validationErrorsByDeviceAction.value = errorsByDevice;
    if (Object.keys(errorsByDevice).length > 0) {
        showToast("Corregí los errores antes de continuar.", "error");
        return;
    }
    activeStep.value = 3;
}

function backToStep2() {
    activeStep.value = 2;
}

function isDeviceSelected(id: string) {
    return selectedDeviceIds.value.includes(id);
}

function addActionRow(deviceId: string) {
    ensureDeviceActionList(deviceId);
    const list = actionsByDevice.value[deviceId];
    if (!list) return;
    list.push(createEmptyActionItem());
    updateDeviceValidation(deviceId);
}

function removeActionRow(deviceId: string, index: number) {
    const list = actionsByDevice.value[deviceId];
    if (!list) return;
    list.splice(index, 1);
    if (list.length === 0) list.push(createEmptyActionItem());
    updateDeviceValidation(deviceId);
}

function updateActionName(deviceId: string, index: number, value: string) {
    const list = actionsByDevice.value[deviceId];
    if (!list) return;
    const schema = getActionSchema(deviceId, value);
    list[index] = { actionName: value, params: buildDefaultParams(schema) };
    updateDeviceValidation(deviceId);
}

function coerceParamValue(
    raw: string | number | boolean,
    schema: ActionParamSchema,
): unknown {
    if (schema.type === "boolean") return Boolean(raw);
    if (schema.type === "integer") {
        if (raw === "") return "";
        const parsed = Number.parseInt(String(raw), 10);
        return Number.isNaN(parsed) ? "" : parsed;
    }
    if (schema.type === "number") {
        if (raw === "") return "";
        const parsed = Number(String(raw));
        return Number.isNaN(parsed) ? "" : parsed;
    }
    return raw;
}

function updateParamValue(
    deviceId: string,
    index: number,
    schema: ActionParamSchema,
    raw: string | number | boolean,
) {
    const list = actionsByDevice.value[deviceId];
    if (!list || !list[index]) return;
    const params = list[index].params ?? {};
    params[schema.name] = coerceParamValue(raw, schema);
    list[index].params = { ...params };
    updateDeviceValidation(deviceId);
}

async function handleSubmit() {
    if (!canSubmit.value || submitting.value || !routineActionsLoaded.value) return;
    submitting.value = true;
    showActionErrors.value = true;
    try {
        const errorsByDevice = validateRoutineActions(
            selectedDeviceIds.value,
            actionsByDevice.value,
            (deviceId, actionName) => getActionSchema(deviceId, actionName),
            { disallowDuplicateActions: true },
        );
        validationErrorsByDeviceAction.value = errorsByDevice;
        if (Object.keys(errorsByDevice).length > 0) {
            showToast("Corregí los errores antes de guardar.", "error");
            return;
        }
        const actions = selectedDeviceIds.value.flatMap((deviceId) => {
            const list = actionsByDevice.value[deviceId] ?? [];
            return list
                .filter((item) => item.actionName)
                .map((item) => {
                    const schema = getActionSchema(deviceId, item.actionName);
                    return {
                        device: { id: deviceId },
                        actionName: item.actionName,
                        params: mapParamsToArray(item.params, schema),
                    };
                });
        });
        const isScheduled = scheduleConfig.value.enabled;
        const schedule = isScheduled
            ? {
                time: scheduleConfig.value.time,
                frequency: scheduleConfig.value.frequency,
                daysOfWeek: scheduleConfig.value.frequency === 'weekly' ? scheduleConfig.value.daysOfWeek : undefined,
            }
            : undefined;
        const metadata = {
            ...existingMetadata.value,
            icon: selectedIcon.value,
            scheduleMode: isScheduled ? 'scheduled' : 'manual',
            scheduleEnabled: isScheduled,
        };
        const body: Record<string, unknown> = { name: routineName.value.trim(), actions, metadata };
        if (schedule) body.schedule = schedule;
        if (props.mode === "create") {
            const result = await api.post<ApiCreatedRoutine>("/routines", body);
            const card: RoutineCard = {
                id: result?.id ?? `temp-${Date.now()}`,
                name: routineName.value.trim(),
                deviceIds: selectedDeviceIds.value.slice(),
                actionsCount: actions.length,
                icon: selectedIcon.value,
                isScheduled: isScheduled,
                isScheduleEnabled: isScheduled,
            };
            emit("created", card);
        } else {
            if (!props.routine) return;
            await api.put<ApiCreatedRoutine>(`/routines/${props.routine.id}`, body);
            const card: RoutineCard = {
                ...props.routine,
                name: routineName.value.trim(),
                deviceIds: selectedDeviceIds.value.slice(),
                actionsCount: actions.length,
                icon: selectedIcon.value,
                displayOrder: props.routine.displayOrder,
                isScheduled: isScheduled,
                isScheduleEnabled: isScheduled,
            };
            emit("updated", card);
        }
    } catch (e: unknown) {
        if (e instanceof ApiError) {
            const msg = (e.body as { error?: { description?: string } })?.error?.description;
            showToast(msg ?? `Error ${e.status}. Intentá de nuevo.`, "error");
        } else {
            showToast("Error inesperado. Intentá de nuevo.", "error");
        }
    } finally {
        submitting.value = false;
    }
}

function onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !submitting.value) emit("close");
}
</script>

<template>
    <Teleport to="body">
        <div class="overlay" @click="onOverlayClick">
            <div
                class="modal"
                role="dialog"
                :aria-label="mode === 'create' ? 'Crear Rutina' : 'Editar Rutina'"
            >
                <!-- ── Close button (floating) ── -->
                <button
                    class="modal__close"
                    type="button"
                    :disabled="submitting"
                    aria-label="Cerrar"
                    @click="emit('close')"
                >✕</button>

                <!-- ── Body: always two-column ── -->
                <div class="modal__body">

                    <!-- ══ LEFT PANEL ══ -->
                    <div class="panel-left">

                        <!-- Step 1: name + icon editor -->
                        <div v-if="isStep1" class="step1-body">
                            <div class="form-group" style="width: 100%; max-width: 260px;">
                                <div class="field" style="width: 100%;">
                                    <input
                                        v-model="routineName"
                                        type="text"
                                        class="field__input"
                                        autocomplete="off"
                                        maxlength="25"
                                        aria-label="Nombre de la rutina"
                                        placeholder="Nombre de la Rutina"
                                    />
                                    <span class="field__icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <path
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                                fill="currentColor"
                                            />
                                        </svg>
                                    </span>
                                </div>
                            </div>

                            <p style="font-size: 0.82rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(52, 47, 41, 0.42); margin: 0; text-align: center;">Rutina</p>
                            <div class="preview" style="margin-top: 1rem;">
                                <div class="preview__circle">
                                    <svg class="preview__svg" viewBox="0 0 24 24" fill="none" stroke="rgba(42, 40, 37, 0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <template v-if="selectedIcon === 'bolt'"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></template>
                                        <template v-else-if="selectedIcon === 'sun'"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></template>
                                        <template v-else-if="selectedIcon === 'moon'"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></template>
                                        <template v-else-if="selectedIcon === 'home'"><path d="M4 12l8-7 8 7" /><path d="M7 11v7h10v-7" /></template>
                                        <template v-else-if="selectedIcon === 'star'"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></template>
                                        <template v-else-if="selectedIcon === 'clock'"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></template>
                                    </svg>
                                </div>
                            </div>

                            <div class="form-group">
                                <div class="icon-grid">
                                    <button
                                        v-for="ico in ICONS"
                                        :key="ico"
                                        type="button"
                                        class="icon-btn"
                                        :class="{ 'icon-btn--active': selectedIcon === ico }"
                                        :aria-label="ico"
                                        @click="selectedIcon = ico"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <template v-if="ico === 'bolt'"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></template>
                                            <template v-else-if="ico === 'sun'"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></template>
                                            <template v-else-if="ico === 'moon'"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></template>
                                            <template v-else-if="ico === 'home'"><path d="M4 12l8-7 8 7" /><path d="M7 11v7h10v-7" /></template>
                                            <template v-else-if="ico === 'star'"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></template>
                                            <template v-else-if="ico === 'clock'"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></template>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Step 2 & 3: summary card (like AC modal left panel) -->
                        <div v-else class="summary-body">
                            <p style="font-size: 0.82rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(52, 47, 41, 0.42); margin: 0; text-align: center;">Rutina</p>
                            <div class="summary-center">
                                <div class="summary-circle">
                                    <svg class="summary-svg" viewBox="0 0 24 24" fill="none" stroke="rgba(42, 40, 37, 0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <template v-if="selectedIcon === 'bolt'"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></template>
                                        <template v-else-if="selectedIcon === 'sun'"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></template>
                                        <template v-else-if="selectedIcon === 'moon'"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></template>
                                        <template v-else-if="selectedIcon === 'home'"><path d="M4 12l8-7 8 7" /><path d="M7 11v7h10v-7" /></template>
                                        <template v-else-if="selectedIcon === 'star'"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></template>
                                        <template v-else-if="selectedIcon === 'clock'"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></template>
                                    </svg>
                                </div>
                                <p class="summary-name">{{ routineName || "Rutina" }}</p>
                                <p class="summary-devices">
                                    {{ selectedDeviceIds.length }}
                                    dispositivo{{ selectedDeviceIds.length !== 1 ? "s" : "" }}
                                </p>
                            </div>

                        </div>

                    </div>

                    <!-- ══ RIGHT PANEL ══ -->
                    <div class="panel-right">

                        <!-- Step header -->
                        <div v-if="!isStep3" class="stepper">
                            <h3 class="panel-right__title">{{ stepTitle }}</h3>
                            <p class="panel-right__subtitle">{{ stepSubtitle }}</p>
                        </div>

                        <!-- ── Step 1: device selection ── -->
                        <template v-if="isStep1">
                            <div class="room-tabs">
                                <button
                                    class="room-tab"
                                    :class="{ 'room-tab--active': selectedRoomId === 'all' }"
                                    type="button"
                                    @click="selectedRoomId = 'all'"
                                >Todos</button>
                                <button
                                    v-for="room in rooms"
                                    :key="room.id"
                                    class="room-tab"
                                    :class="{ 'room-tab--active': selectedRoomId === room.id }"
                                    type="button"
                                    @click="selectedRoomId = room.id"
                                >{{ room.name }}</button>
                            </div>

                            <div class="device-panel">
                                <div v-if="loadingDevices" class="device-grid">
                                    <div v-for="i in 6" :key="i" class="device-tile device-tile--skeleton" />
                                </div>

                                <div v-else-if="filteredDevices.length === 0" class="empty-devices">
                                    No hay dispositivos en esta habitación.
                                </div>

                                <div v-else class="device-grid">
                                    <button
                                        v-for="device in filteredDevices"
                                        :key="device.id"
                                        type="button"
                                        class="device-tile"
                                        :class="{ 'device-tile--selected': isDeviceSelected(device.id) }"
                                        @click="toggleDevice(device.id)"
                                    >
                                        <span class="device-tile__icon" aria-hidden="true">
                                            <DeviceIcon :kind="device.kind" />
                                        </span>
                                        <span class="device-tile__name">{{ device.name }}</span>
                                    </button>
                                </div>
                            </div>
                            <div class="panel-right__footer">
                                <button
                                    type="button"
                                    class="btn-continue"
                                    :disabled="!canContinueStep1"
                                    @click="continueToActions"
                                >
                                    Continuar a acciones
                                </button>
                            </div>
                        </template>

                        <!-- ── Step 2: actions per device ── -->
                        <template v-if="isStep2">
                            <div v-if="selectedDevicesInfo.length === 0" class="empty-devices">
                                No hay dispositivos seleccionados.
                            </div>

                            <div v-else class="device-action-blocks">
                                <section
                                    v-for="device in selectedDevicesInfo"
                                    :key="device.id"
                                    class="device-action-block"
                                >
                                    <div class="device-action-block__header">
                                        <div>
                                            <h4 class="device-action-block__title">{{ device.name }}</h4>
                                            <p class="device-action-block__subtitle">
                                                {{ getDeviceTypeDisplayName(device.id) }}
                                            </p>
                                        </div>
                                        <button type="button" class="btn-add-action" @click="addActionRow(device.id)">
                                            + Agregar accion
                                        </button>
                                    </div>

                                    <div class="action-rows">
                                        <div
                                            v-for="(action, index) in actionsByDevice[device.id] ?? []"
                                            :key="`${device.id}-${index}`"
                                            class="action-row"
                                            :class="{ 'action-row--error': showActionErrors && getRowErrors(device.id, index).length > 0 }"
                                        >
                                            <div class="action-row__top">
                                                <div class="custom-select" :data-key="dropdownKey(device.id, index)" @click.stop>
                                                    <button
                                                        type="button"
                                                        class="custom-select__trigger"
                                                        :aria-expanded="isDropdownOpen(dropdownKey(device.id, index))"
                                                        @click="toggleDropdown(dropdownKey(device.id, index))"
                                                    >
                                                        <span
                                                            class="custom-select__label"
                                                            :class="{ 'custom-select__label--placeholder': !action.actionName }"
                                                        >
                                                            {{ getSelectedActionLabel(device.id, index) || 'Selecciona una accion' }}
                                                        </span>
                                                        <span class="custom-select__chev" aria-hidden="true">
                                                            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                                        </span>
                                                    </button>
                                                    <Transition name="fade-slide">
                                                        <div v-if="isDropdownOpen(dropdownKey(device.id, index))" class="custom-select__dropdown">
                                                            <button
                                                                v-for="option in buildActionOptionsForRow(device.id, index)"
                                                                :key="option.actionName"
                                                                type="button"
                                                                class="custom-select__item"
                                                                :class="{ 'custom-select__item--active': option.actionName === action.actionName }"
                                                                @click="updateActionName(device.id, index, option.actionName); closeAllDropdowns()"
                                                            >
                                                                {{ option.label }}
                                                            </button>
                                                        </div>
                                                    </Transition>
                                                </div>

                                                <div
                                                    v-if="getActionSchema(device.id, action.actionName).length > 0"
                                                    class="action-row__params-inline"
                                                >
                                                    <div
                                                        v-for="param in getActionSchema(device.id, action.actionName)"
                                                        :key="param.name"
                                                        class="param-inline"
                                                    >
                                                        <template v-if="param.enum && param.enum.length">
                                                            <div class="custom-select" :data-key="dropdownKey(device.id, index) + '-' + param.name" @click.stop>
                                                                <button
                                                                    type="button"
                                                                    class="custom-select__trigger"
                                                                    :aria-expanded="isDropdownOpen(dropdownKey(device.id, index) + '-' + param.name)"
                                                                    @click="toggleDropdown(dropdownKey(device.id, index) + '-' + param.name)"
                                                                >
                                                                    <span class="custom-select__label">
                                                                        {{ getParamValueLabel(param.name, String(action.params[param.name] ?? '')) || param.label || param.name }}
                                                                    </span>
                                                                    <span class="custom-select__chev" aria-hidden="true">
                                                                        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                                                    </span>
                                                                </button>
                                                                <Transition name="fade-slide">
                                                                    <div v-if="isDropdownOpen(dropdownKey(device.id, index) + '-' + param.name)" class="custom-select__dropdown">
                                                                        <button
                                                                            v-for="option in param.enum" :key="option"
                                                                            type="button"
                                                                            class="custom-select__item"
                                                                            :class="{ 'custom-select__item--active': String(action.params[param.name] ?? '') === option }"
                                                                            @click="updateParamValue(device.id, index, param, option); closeAllDropdowns()"
                                                                        >
                                                                             {{ getParamValueLabel(param.name, option) }}
                                                                        </button>
                                                                    </div>
                                                                </Transition>
                                                            </div>
                                                        </template>
                                                        <template v-else-if="param.type === 'boolean'">
                                                            <div class="custom-select" :data-key="dropdownKey(device.id, index) + '-' + param.name" @click.stop>
                                                                <button
                                                                    type="button"
                                                                    class="custom-select__trigger"
                                                                    :aria-expanded="isDropdownOpen(dropdownKey(device.id, index) + '-' + param.name)"
                                                                    @click="toggleDropdown(dropdownKey(device.id, index) + '-' + param.name)"
                                                                >
                                                                    <span class="custom-select__label">
                                                                        {{ action.params[param.name] ? 'Si' : 'No' }}
                                                                    </span>
                                                                    <span class="custom-select__chev" aria-hidden="true">
                                                                        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                                                    </span>
                                                                </button>
                                                                <Transition name="fade-slide">
                                                                    <div v-if="isDropdownOpen(dropdownKey(device.id, index) + '-' + param.name)" class="custom-select__dropdown">
                                                                        <button type="button" class="custom-select__item" :class="{ 'custom-select__item--active': action.params[param.name] === true }" @click="updateParamValue(device.id, index, param, true); closeAllDropdowns()">Si</button>
                                                                        <button type="button" class="custom-select__item" :class="{ 'custom-select__item--active': action.params[param.name] === false }" @click="updateParamValue(device.id, index, param, false); closeAllDropdowns()">No</button>
                                                                    </div>
                                                                </Transition>
                                                            </div>
                                                        </template>
                                                        <template v-else-if="param.type === 'integer' || param.type === 'number'">
                                                            <input
                                                                class="param-inline__input"
                                                                type="number"
                                                                inputmode="numeric"
                                                                :aria-label="'Valor para ' + (param.label || param.name)"
                                                                :min="param.min"
                                                                :max="param.max"
                                                                :step="param.step ?? (param.type === 'integer' ? 1 : 'any')"
                                                                :value="action.params[param.name] ?? ''"
                                                                @input="updateParamValue(device.id, index, param, ($event.target as HTMLInputElement).value)"
                                                            />
                                                        </template>
                                                        <template v-else-if="param.name === 'securityCode'">
                                                            <input
                                                                class="param-inline__input"
                                                                type="text"
                                                                inputmode="numeric"
                                                                :aria-label="'Código de seguridad'"
                                                                placeholder="Ingresa el codigo"
                                                                :value="String(action.params[param.name] ?? '')"
                                                                @input="updateParamValue(device.id, index, param, ($event.target as HTMLInputElement).value)"
                                                            />
                                                        </template>
                                                        <template v-else-if="param.name === 'roomId'">
                                                            <div class="custom-select" :data-key="dropdownKey(device.id, index) + '-' + param.name" @click.stop>
                                                                <button
                                                                    type="button"
                                                                    class="custom-select__trigger"
                                                                    :aria-expanded="isDropdownOpen(dropdownKey(device.id, index) + '-' + param.name)"
                                                                    @click="toggleDropdown(dropdownKey(device.id, index) + '-' + param.name)"
                                                                >
                                                                    <span
                                                                        class="custom-select__label"
                                                                        :class="{ 'custom-select__label--placeholder': !action.params[param.name] }"
                                                                    >
                                                                        {{ getRoomName(String(action.params[param.name] ?? '')) || 'Selecciona una habitacion' }}
                                                                    </span>
                                                                    <span class="custom-select__chev" aria-hidden="true">
                                                                        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                                                    </span>
                                                                </button>
                                                                <Transition name="fade-slide">
                                                                    <div v-if="isDropdownOpen(dropdownKey(device.id, index) + '-' + param.name)" class="custom-select__dropdown">
                                                                        <button type="button" class="custom-select__item" :class="{ 'custom-select__item--active': !action.params[param.name] }" @click="updateParamValue(device.id, index, param, ''); closeAllDropdowns()">Selecciona una habitacion</button>
                                                                        <button v-for="room in rooms" :key="room.id" type="button" class="custom-select__item" :class="{ 'custom-select__item--active': action.params[param.name] === room.id }" @click="updateParamValue(device.id, index, param, room.id); closeAllDropdowns()">{{ room.name }}</button>
                                                                    </div>
                                                                </Transition>
                                                            </div>
                                                        </template>
                                                        <template v-else-if="param.name === 'color' && getDeviceKind(device.id) === 'lamp'">
                                                            <div class="color-picker-inline">
                                                                <!-- [html-validate-disable-next no-inline-style: color is a runtime hex value that cannot be expressed as a CSS class] -->
                                                                <button
                                                                    v-for="preset in PRESET_COLORS"
                                                                    :key="preset.value"
                                                                    class="color-swatch-sm"
                                                                    :class="{ 'color-swatch-sm--active': action.params[param.name] === preset.value }"
                                                                    :style="{ background: preset.value }"
                                                                    :aria-label="preset.label"
                                                                    type="button"
                                                                    @click="updateParamValue(device.id, index, param, preset.value)"
                                                                />
                                                            </div>
                                                        </template>
                                                        <template v-else-if="param.name === 'oldSecurityCode' || param.name === 'newSecurityCode'">
                                                            <input
                                                                class="param-inline__input"
                                                                type="text"
                                                                inputmode="numeric"
                                                                :aria-label="param.label || param.name"
                                                                :placeholder="param.name === 'oldSecurityCode' ? 'Codigo viejo' : 'Codigo nuevo'"
                                                                :value="String(action.params[param.name] ?? '')"
                                                                @input="updateParamValue(device.id, index, param, ($event.target as HTMLInputElement).value)"
                                                            />
                                                        </template>
                                                         <template v-else>
                                                            <input
                                                                class="param-inline__input"
                                                                type="text"
                                                                :aria-label="'Valor para ' + (param.label || param.name)"
                                                                :maxlength="param.maxLength"
                                                                :value="String(action.params[param.name] ?? '')"
                                                                @input="updateParamValue(device.id, index, param, ($event.target as HTMLInputElement).value)"
                                                            />
                                                        </template>
                                                    </div>
                                                </div>

                                                <button
                                                    v-if="(actionsByDevice[device.id] ?? []).length > 1"
                                                    type="button"
                                                    class="action-row__remove"
                                                    @click="removeActionRow(device.id, index)"
                                                >Eliminar</button>
                                            </div>

                                            <div
                                                v-if="showActionErrors && getRowErrors(device.id, index).length > 0"
                                                class="action-row__errors"
                                            >
                                                <p
                                                    v-for="(error, errorIndex) in getRowErrors(device.id, index)"
                                                    :key="`${error.field ?? 'row'}-${errorIndex}`"
                                                    class="action-row__error"
                                                >{{ error.message }}</p>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div class="panel-right__footer">
                                <button
                                    type="button"
                                    class="btn-back"
                                    :disabled="submitting"
                                    @click="backToStep1"
                                >Volver</button>
                                <button
                                    type="button"
                                    class="btn-continue"
                                    :disabled="!canContinueStep2 || submitting || !routineActionsLoaded || loadingDeviceTypes"
                                    @click="continueToSchedule"
                                >
                                    Continuar a programación
                                </button>
                            </div>
                        </template>

                        <!-- ── Step 3: schedule ── -->
                        <template v-if="isStep3">
                            <RoutineScheduleStep v-model="scheduleConfig" />

                            <div class="panel-right__footer">
                                <button
                                    type="button"
                                    class="btn-back"
                                    :disabled="submitting"
                                    @click="backToStep2"
                                >Volver</button>
                                <button
                                    type="button"
                                    class="btn-continue"
                                    :disabled="!canSubmit || submitting || !routineActionsLoaded"
                                    @click="handleSubmit"
                                >
                                    <svg v-if="submitting" class="spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="60" stroke-dashoffset="20" />
                                    </svg>
                                    <span v-else>{{ mode === "create" ? "Crear Rutina" : "Guardar Cambios" }}</span>
                                </button>
                            </div>
                        </template>

                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    padding: 1.5rem;
}

.modal {
    background: #f7f5f0;
    border-radius: 28px;
    width: 100%;
    max-width: 880px;
    height: 82vh;
    max-height: 680px;
    min-height: 480px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 80px rgba(42, 40, 37, 0.28);
    position: relative;
}

.modal__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: rgba(42, 40, 37, 0.08);
    color: rgba(42, 40, 37, 0.7);
    font-size: 0.9rem;
    cursor: pointer;
    display: grid;
    place-items: center;
}

.modal__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Always two-column */
.modal__body {
    display: grid;
    grid-template-columns: 260px 1fr;
    overflow: hidden;
    flex: 1;
    min-height: 0;
}
.field__label {
    font-size: 0.82rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(52, 47, 41, 0.42);
    margin: 0;
    text-align: center;
    width: 100%;
    max-width: 200px;
}

/* ── Left panel ── */
.panel-left {
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #e7dcc0 0%, #e2d4b5 100%);
    overflow-y: auto;
}

/* Step 1: editor centered */
.step1-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    padding: 2rem 1.5rem;
    width: 100%;
}

.form-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 0.6rem;
}

.field {
    position: relative;
    display: flex;
    justify-content: center;
    width: 100%;
}

.field__input {
    width: 100%;
    max-width: 260px;
    height: 40px;
    padding: 0 2rem 0 1rem;
    text-align: center;
    background: rgba(255, 255, 255, 0.85);
    border: 1.5px solid rgba(52, 47, 41, 0.15);
    border-radius: 12px;
    font-size: 0.85rem;
    font-family: var(--font-sans);
    color: rgba(52, 47, 41, 0.88);
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.field__icon {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: rgba(52, 47, 41, 0.42);
}

.preview {
    display: flex;
    justify-content: center;
    align-items: center;
}

.preview__circle {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(190, 190, 166, 0.45);
}

.preview__svg {
    width: 32px;
    height: 32px;
}

.section-hint {
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: rgba(52, 47, 41, 0.42);
    margin-bottom: 0.3rem;
    text-align: center;
}

.icon-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

.icon-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.55rem;
    width: 100%;
    max-width: 200px;
}

.icon-btn {
    width: 100%;
    height: 56px;
    border-radius: 14px;
    border: 1.5px solid rgba(42, 40, 37, 0.1);
    background: rgba(255, 255, 255, 0.7);
    color: rgba(42, 40, 37, 0.6);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.icon-btn svg {
    width: 22px;
    height: 22px;
}

.icon-btn--active {
    background: rgba(42, 40, 37, 0.9);
    border-color: transparent;
    color: #f7f3e7;
}

/* Step 2: summary (like AC modal left panel) */
.summary-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    padding: 2.5rem 1.25rem 2rem;
    text-align: center;
}

.summary-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
}

.summary-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(52, 47, 41, 0.4);
    margin: 0;
}

.summary-circle {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(190, 190, 166, 0.45);
}

.summary-svg {
    width: 32px;
    height: 32px;
}

.summary-name {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: rgba(52, 47, 41, 0.92);
    width: 100%;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
    padding: 0 0.5rem;
}

.summary-devices {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(52, 47, 41, 0.55);
    background: rgba(42, 40, 37, 0.08);
    padding: 0.3rem 0.85rem;
    border-radius: 999px;
}

/* ── Right panel ── */
.panel-right {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 2.6rem 2.2rem 2.2rem;    
    overflow-y: auto;
    min-height: 0;
    background: #f7f5f0;
}

.stepper {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex-shrink: 0;
    font-family: var(--font-sans);
}

.stepper__top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.stepper__label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(52, 47, 41, 0.4);
}

.panel-right__title {
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(52, 47, 41, 0.42);
    margin: 0;
    font-family: var(--font-sans);
}

.panel-right__subtitle {
    margin: 0;
    font-size: 0.82rem;
    color: rgba(52, 47, 41, 0.42);
    font-family: var(--font-sans);
}

.room-tabs {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    background: rgba(128, 120, 103, 0.52);
    border-radius: 999px;
    padding: 0.28rem;
    flex-shrink: 0;
}

.room-tabs::-webkit-scrollbar {
    display: none;
}

.room-tab {
    border: none;
    background: transparent;
    color: rgba(52, 47, 41, 0.95);
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.55rem 1rem;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
    font-family: var(--font-sans);
    transition: background 0.15s, color 0.15s, transform 0.15s;
}

.room-tab:hover {
    transform: translateY(-1px);
}

.room-tab--active {
    background: rgba(52, 47, 41, 0.92);
    color: #fff;
    box-shadow: 0 8px 18px rgba(52, 47, 41, 0.18);
}

.device-panel {
    background: rgba(244, 244, 244, 0.7);
    border-radius: 24px;
    padding: 1.2rem;
    box-shadow: 0 20px 40px rgba(42, 40, 37, 0.08);
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.device-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.65rem;
    align-content: start;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
}

.device-tile {
    color: rgba(42, 40, 37, 0.85);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.75rem 0.5rem;
    border-radius: 14px;
    border: 1.5px solid rgba(42, 40, 37, 0.1);
    background: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    position: relative;
    font-family: var(--font-sans);
}

.device-tile:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

.device-tile--selected {
    
    background: rgba(0, 0, 0, 0.8);
    border-color: transparent;
    color: #f7f3e7;
}

.device-tile--skeleton {
    background: rgba(42, 40, 37, 0.06);
    border: none;
    height: 90px;
}

.device-tile__icon {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
}

.device-tile__icon svg {
    width: 14px;
    height: 14px;
}

.device-tile__name {
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.device-tile__check {
    position: absolute;
    top: 0.35rem;
    right: 0.45rem;
    font-size: 0.7rem;
    opacity: 0.85;
}

.empty-devices {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    text-align: center;
    padding: 2rem 0;
}

/* Actions */
.device-action-blocks {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}

.device-action-block {
    background: rgba(255, 255, 255, 0.8);
    border: 1.5px solid rgba(42, 40, 37, 0.1);
    border-radius: 16px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    flex-shrink: 0;
}

.device-action-block__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
}

.device-action-block__title {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 600;
    color: rgba(52, 47, 41, 0.92);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}

.device-action-block__subtitle {
    margin: 0.15rem 0 0;
    font-size: 0.75rem;
    color: rgba(52, 47, 41, 0.55);
}

.btn-add-action {
    border: none;
    background: rgba(42, 40, 37, 0.1);
    color: rgba(42, 40, 37, 0.85);
    padding: 0.45rem 0.75rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
}

.action-rows {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.action-row {
    border: 1.5px solid rgba(42, 40, 37, 0.1);
    border-radius: 14px;
    padding: 0.7rem 0.75rem;
    background: #fff;
}

.action-row--error {
    border-color: rgba(200, 68, 68, 0.7);
    background: rgba(200, 68, 68, 0.08);
}

.action-row__top {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
}

.action-row__params-inline {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
}

.param-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.param-inline__input {
    height: 54px;
    padding: 0 0.75rem;
    border-radius: 12px;
    border: 1.5px solid var(--color-sage);
    background: rgba(255, 255, 255, 0.6);
    color: var(--color-text);
    font-weight: 400;
    font-size: 0.95rem;
    font-family: var(--font-sans);
    min-width: 70px;
    max-width: 110px;
    transition: border-color 0.2s, background 0.2s;
    line-height: 1.4;
}

.param-inline__input:hover {
    border-color: var(--color-brown);
}

.param-inline__input:focus {
    outline: none;
    border-color: var(--color-brown);
}

.custom-select {
    position: relative;
    min-width: 110px;
    max-width: 170px;
}

.action-row__top > .custom-select {
    min-width: 180px;
    max-width: 220px;
}

.custom-select__trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    height: 54px;
    padding: 0 1rem;
    border-radius: 12px;
    border: 1.5px solid var(--color-sage);
    background: rgba(255, 255, 255, 0.6);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.95rem;
    font-weight: 400;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
}

.custom-select__trigger:hover,
.custom-select__trigger[aria-expanded="true"] {
    border-color: var(--color-brown);
}

.custom-select__label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.custom-select__label--placeholder {
    color: var(--color-text-muted, rgba(52, 47, 41, 0.5));
    font-weight: 400;
}

.custom-select__chev {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    opacity: 0.5;
    transition: transform 0.2s ease;
}

.custom-select__chev svg {
    width: 14px;
    height: 14px;
}

.custom-select__trigger[aria-expanded="true"] .custom-select__chev {
    transform: rotate(180deg);
}

.custom-select__dropdown {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;
    z-index: 20;
    background: #fff;
    border: 1px solid rgba(42, 40, 37, 0.12);
    border-radius: 12px;
    padding: 0.4rem;
    box-shadow: 0 12px 32px rgba(42, 40, 37, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    max-height: 240px;
    overflow-y: auto;
}

.custom-select__item {
    width: 100%;
    text-align: left;
    padding: 0.55rem 0.75rem;
    border: none;
    background: transparent;
    border-radius: 8px;
    font: inherit;
    color: var(--color-text);
    cursor: pointer;
    transition: background 0.15s;
}

.custom-select__item:hover {
    background: rgba(42, 40, 37, 0.06);
}

.custom-select__item--active {
    background: rgba(42, 40, 37, 0.1);
    font-weight: 500;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

.color-picker-inline {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
}

.color-swatch-sm {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: 0 0 0 1.5px rgba(42, 40, 37, 0.18);
    transition: transform 0.15s, box-shadow 0.15s;
}

.color-swatch-sm:hover {
    transform: scale(1.15);
}

.color-swatch-sm--active {
    border-color: rgba(52, 47, 41, 0.7);
    box-shadow: 0 0 0 2px rgba(52, 47, 41, 0.15);
}

.action-row__remove {
    border: none;
    background: rgba(200, 68, 68, 0.12);
    color: #b33939;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
    margin-left: auto;
}

.action-row__errors {
    margin-top: 0.45rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.action-row__error {
    margin: 0;
    font-size: 0.74rem;
    color: #c44;
}

/* Footer */
.panel-right__footer {
    margin-top: auto;
    padding-top: 0.75rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
}

.btn-back {
    width: 100%;
    max-width: 120px;
    height: 46px;
    border-radius: 999px;
    border: none;
    background: rgba(52, 47, 41, 0.12);
    color: rgba(52, 47, 41, 0.88);
    font-size: 0.9rem;
    font-weight: 700;
    font-family: var(--font-sans);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.btn-back:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-back:hover:not(:disabled) {
    background: rgba(52, 47, 41, 0.2);
}

.btn-continue {
    width: 100%;
    max-width: 240px;
    height: 46px;
    border-radius: 999px;
    border: none;
    background: rgba(52, 47, 41, 0.88);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 700;
    font-family: var(--font-sans);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.btn-continue:hover:not(:disabled) {
    background: rgba(52, 47, 41, 1);
    box-shadow: 0 8px 24px rgba(52, 47, 41, 0.18);
    transform: translateY(-1px);
}

.btn-continue:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.spinner {
    width: 20px;
    height: 20px;
    animation: spin 0.9s linear infinite;
}
</style>