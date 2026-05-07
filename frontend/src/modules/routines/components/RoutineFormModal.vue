<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api, ApiError } from "@/services/api/client";
import { useDashboardStore } from "@/app/stores/dashboard";
import type { Device } from "@/app/stores/dashboard";
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
    color: string;
    icon: RoutineIcon;
};

/* ─── Internal types ─────────────────────────────────────── */

type ApiCreatedRoutine = {
    id?: string;
};
type ApiRoutineDetail = {
    id?: string;
    name?: string;
    actions?: ApiRoutineAction[];
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

const PRESET_COLORS = [
    { label: "Rojo", value: "#e05252" },
    { label: "Azul", value: "#5285e0" },
    { label: "Verde", value: "#52c47d" },
    { label: "Amarillo", value: "#e0bf45" },
    { label: "Morado", value: "#9052e0" },
];

const DEFAULT_COLOR = PRESET_COLORS[0]?.value ?? "#e05252";

const ICONS: RoutineIcon[] = ["bolt", "sun", "moon", "home", "star", "clock"];

/* ─── Store ──────────────────────────────────────────────── */

const store = useDashboardStore();

/* ─── Reactive state ─────────────────────────────────────── */

const routineName = ref(props.routine?.name ?? "");
const selectedColor = ref(props.routine?.color ?? DEFAULT_COLOR);
const selectedIcon = ref<RoutineIcon>(props.routine?.icon ?? "bolt");
const hue = ref(0);

const activeStep = ref<1 | 2 | 3>(
    props.initialStep ?? (props.mode === "edit" ? 3 : 1),
);
const selectedRoomId = ref("all");
const selectedDeviceIds = ref<string[]>([...(props.routine?.deviceIds ?? [])]);

const allDevices = ref<Device[]>([]);
const loadingDevices = ref(true);
const deviceTypesWithActions = ref<DeviceTypeWithActions[]>([]);
const loadingDeviceTypes = ref(true);

const actionsByDevice = ref<Record<string, ActionItem[]>>({});
const validationErrorsByDeviceAction = ref<
    Record<string, ActionRowError[]>
>({});

const submitting = ref(false);
const submitError = ref("");
const attemptedContinue = ref(false);
const routineActionsLoaded = ref(false);
const showActionErrors = ref(false);

/* ─── Computed ───────────────────────────────────────────── */

const rooms = computed(() => store.rooms);

const deviceTypeNameById = computed(() => {
    const map: Record<string, string> = {};
    for (const deviceType of deviceTypesWithActions.value) {
        if (deviceType.id && deviceType.name) {
            map[deviceType.id] = deviceType.name;
        }
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

const actionSchemaMap = computed(() =>
    buildDeviceTypeActionMap(deviceTypesWithActions.value),
);

const filteredDevices = computed(() => {
    if (selectedRoomId.value === "all") return allDevices.value;
    return allDevices.value.filter(
        (d: Device) => d.roomId === selectedRoomId.value,
    );
});

const selectedDevicesInfo = computed(() =>
    selectedDeviceIds.value
        .map((id: string) => allDevices.value.find((d: Device) => d.id === id))
        .filter((d): d is Device => Boolean(d)),
);

const canContinue = computed(() => selectedDeviceIds.value.length > 0);

const nameError = computed(() => {
    if (!attemptedContinue.value) return false;
    return routineName.value.trim() === "";
});

const canSubmit = computed(
    () => routineName.value.trim() !== "" && selectedDeviceIds.value.length > 0,
);

const isStep1 = computed(() => activeStep.value === 1);
const isStep2 = computed(() => activeStep.value === 2);
const isStep3 = computed(() => activeStep.value === 3);

const stepTitle = computed(() => {
    if (activeStep.value === 1) return "Detalles";
    if (activeStep.value === 2) return "Dispositivos";
    return "Acciones";
});

const stepSubtitle = computed(() => {
    if (activeStep.value === 1)
        return "Definí el nombre, color e icono.";
    if (activeStep.value === 2)
        return "Seleccioná los dispositivos de la rutina.";
    return "Configura acciones para cada dispositivo.";
});

function getDeviceTypeName(deviceId: string): string | undefined {
    return deviceTypeNameByDeviceId.value[deviceId];
}

function getActionSchema(
    deviceId: string,
    actionName: string,
): ActionParamSchema[] {
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
            .map((item, itemIndex) => itemIndex === index ? "" : item.actionName)
            .filter((name) => name),
    );

    const excluded = new Set(used);
    for (const usedAction of used) {
        for (const group of EXCLUSIVE_ACTION_GROUPS) {
            if (group.includes(usedAction)) {
                group.forEach((a) => excluded.add(a));
            }
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

function getFieldError(
    deviceId: string,
    index: number,
    field: string,
): string | null {
    const rowErrors = getRowErrors(deviceId, index);
    const found = rowErrors.find((error) => error.field === field);
    return found?.message ?? null;
}

async function loadDeviceTypes(): Promise<DeviceTypeWithActions[]> {
    try {
        const data = await api.get<DeviceTypeWithActions[]>("/devicetypes");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function hydrateActionItem(
    deviceId: string,
    action: ApiRoutineAction,
): ActionItem | null {
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
        if (item) {
            nextActionsByDevice[deviceId].push(item);
        }
    });

    if (nextDeviceIds.length > 0) {
        selectedDeviceIds.value = nextDeviceIds;
    }

    actionsByDevice.value = nextActionsByDevice;
    ensureActionsForSelectedDevices(selectedDeviceIds.value);
    selectedDeviceIds.value.forEach((id) => updateDeviceValidation(id));
}

async function loadRoutineActions(routineId: string): Promise<void> {
    try {
        const detail = await api.get<ApiRoutineDetail>(
            `/routines/${routineId}`,
        );
        if (detail?.name && routineName.value.trim() === "") {
            routineName.value = detail.name;
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

onMounted(async () => {
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

    if (typesResult.status === "fulfilled") {
        deviceTypesWithActions.value = typesResult.value;
    }
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

/* ─── Methods ────────────────────────────────────────────── */

function pickPreset(color: string) {
    selectedColor.value = color;
}

function onNameInput() {
    if (routineName.value.trim() !== "") {
        attemptedContinue.value = false;
    }
}

function onHueInput() {
    selectedColor.value = `hsl(${hue.value}, 65%, 58%)`;
}

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

function continueFromDetails() {
    if (routineName.value.trim() === "") {
        attemptedContinue.value = true;
        return;
    }
    showActionErrors.value = false;
    activeStep.value = 2;
}

function continueFromDevices() {
    if (selectedDeviceIds.value.length === 0) return;
    ensureActionsForSelectedDevices(selectedDeviceIds.value);
    selectedDeviceIds.value.forEach((id) => updateDeviceValidation(id));
    showActionErrors.value = false;
    activeStep.value = 3;
}

function backToDetails() {
    activeStep.value = 1;
}

function backToDevices() {
    showActionErrors.value = false;
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
    if (list.length === 0) {
        list.push(createEmptyActionItem());
    }
    updateDeviceValidation(deviceId);
}

function updateActionName(deviceId: string, index: number, value: string) {
    const list = actionsByDevice.value[deviceId];
    if (!list) return;
    const schema = getActionSchema(deviceId, value);
    list[index] = {
        actionName: value,
        params: buildDefaultParams(schema),
    };
    updateDeviceValidation(deviceId);
}

function coerceParamValue(
    raw: string | number | boolean,
    schema: ActionParamSchema,
): unknown {
    if (schema.type === "boolean") {
        return Boolean(raw);
    }

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
    if (!list) return;
    if (!list[index]) return;
    const params = list[index].params ?? {};
    params[schema.name] = coerceParamValue(raw, schema);
    list[index].params = { ...params };
    updateDeviceValidation(deviceId);
}

async function handleSubmit() {
    if (!canSubmit.value || submitting.value || !routineActionsLoaded.value)
        return;
    submitError.value = "";
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
            submitError.value = "Corregí los errores antes de guardar.";
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

        const body = {
            name: routineName.value.trim(),
            actions,
        };

        if (props.mode === "create") {
            const result = await api.post<ApiCreatedRoutine>("/routines", body);
            const card: RoutineCard = {
                id: result?.id ?? `temp-${Date.now()}`,
                name: body.name,
                deviceIds: selectedDeviceIds.value.slice(),
                actionsCount: actions.length,
                color: selectedColor.value,
                icon: selectedIcon.value,
            };
            emit("created", card);
        } else {
            if (!props.routine) return;
            await api.put<ApiCreatedRoutine>(
                `/routines/${props.routine.id}`,
                body,
            );
            const card: RoutineCard = {
                ...props.routine,
                name: body.name,
                deviceIds: selectedDeviceIds.value.slice(),
                actionsCount: actions.length,
                color: selectedColor.value,
                icon: selectedIcon.value,
            };
            emit("updated", card);
        }
    } catch (e: unknown) {
        if (e instanceof ApiError) {
            const msg = (e.body as { error?: { description?: string } })?.error
                ?.description;
            submitError.value = msg ?? `Error ${e.status}. Intentá de nuevo.`;
        } else {
            submitError.value = "Error inesperado. Intentá de nuevo.";
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
                :aria-label="
                    mode === 'create' ? 'Crear Rutina' : 'Editar Rutina'
                "
            >
                <div class="modal__header">
                    <h2 class="modal__title">
                        {{
                            mode === "create" ? "Crear Rutina" : "Editar Rutina"
                        }}
                    </h2>
                    <button
                        class="modal__close"
                        type="button"
                        :disabled="submitting"
                        aria-label="Cerrar"
                        @click="emit('close')"
                    >
                        ✕
                    </button>
                </div>

                <div v-if="submitError" class="modal__error" role="alert">
                    {{ submitError }}
                </div>

                <div
                    class="modal__body"
                    :class="{ 'modal__body--single': isStep1 || isStep3 }"
                >
                    <div v-if="isStep1" class="panel-left panel-left--full">
                        <div class="field">
                            <input
                                v-model="routineName"
                                type="text"
                                placeholder="Nombre de la Rutina"
                                class="field__input"
                                :class="{ 'field__input--error': nameError }"
                                autocomplete="off"
                                maxlength="64"
                                @input="onNameInput"
                            />
                            <span v-if="nameError" class="field__error-text">
                                Completar un nombre
                            </span>
                            <span class="field__icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path
                                        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </span>
                        </div>

                        <div class="preview">
                            <div
                                class="preview__circle"
                                :style="{ background: selectedColor }"
                            >
                                <svg
                                    class="preview__svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <template v-if="selectedIcon === 'bolt'">
                                        <path
                                            d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                                        />
                                    </template>
                                    <template
                                        v-else-if="selectedIcon === 'sun'"
                                    >
                                        <circle cx="12" cy="12" r="5" />
                                        <path
                                            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                                        />
                                    </template>
                                    <template
                                        v-else-if="selectedIcon === 'moon'"
                                    >
                                        <path
                                            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                                        />
                                    </template>
                                    <template
                                        v-else-if="selectedIcon === 'home'"
                                    >
                                        <path d="M4 12l8-7 8 7" />
                                        <path d="M7 11v7h10v-7" />
                                    </template>
                                    <template
                                        v-else-if="selectedIcon === 'star'"
                                    >
                                        <polygon
                                            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                                        />
                                    </template>
                                    <template
                                        v-else-if="selectedIcon === 'clock'"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 6v6l4 2" />
                                    </template>
                                </svg>
                            </div>
                        </div>

                        <div class="color-section">
                            <p class="section-hint">Color</p>
                            <div class="color-swatches">
                                <button
                                    v-for="c in PRESET_COLORS"
                                    :key="c.value"
                                    type="button"
                                    class="swatch"
                                    :class="{
                                        'swatch--active':
                                            selectedColor === c.value,
                                    }"
                                    :style="{ background: c.value }"
                                    :aria-label="c.label"
                                    @click="pickPreset(c.value)"
                                />
                            </div>
                            <input
                                v-model.number="hue"
                                type="range"
                                min="0"
                                max="360"
                                class="hue-slider"
                                aria-label="Tono personalizado"
                                @input="onHueInput"
                            />
                        </div>

                        <div class="icon-section">
                            <p class="section-hint">Ícono</p>
                            <div class="icon-grid">
                                <button
                                    v-for="ico in ICONS"
                                    :key="ico"
                                    type="button"
                                    class="icon-btn"
                                    :class="{
                                        'icon-btn--active':
                                            selectedIcon === ico,
                                    }"
                                    :aria-label="ico"
                                    @click="selectedIcon = ico"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <template v-if="ico === 'bolt'">
                                            <path
                                                d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                                            />
                                        </template>
                                        <template v-else-if="ico === 'sun'">
                                            <circle cx="12" cy="12" r="5" />
                                            <path
                                                d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                                            />
                                        </template>
                                        <template v-else-if="ico === 'moon'">
                                            <path
                                                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                                            />
                                        </template>
                                        <template v-else-if="ico === 'home'">
                                            <path d="M4 12l8-7 8 7" />
                                            <path d="M7 11v7h10v-7" />
                                        </template>
                                        <template v-else-if="ico === 'star'">
                                            <polygon
                                                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                                            />
                                        </template>
                                        <template v-else-if="ico === 'clock'">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v6l4 2" />
                                        </template>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="panel-left__footer">
                            <button
                                type="button"
                                class="btn-continue"
                                @click="continueFromDetails"
                            >
                                Continuar
                            </button>
                        </div>
                    </div>

                    <template v-else>
                        <div
                            v-if="isStep2"
                            class="panel-left panel-left--summary"
                        >
                            <div class="summary-card">
                                <div
                                    class="summary-card__icon"
                                    :style="{ background: selectedColor }"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="white"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <template v-if="selectedIcon === 'bolt'">
                                            <path
                                                d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                                            />
                                        </template>
                                        <template
                                            v-else-if="selectedIcon === 'sun'"
                                        >
                                            <circle cx="12" cy="12" r="5" />
                                            <path
                                                d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                                            />
                                        </template>
                                        <template
                                            v-else-if="selectedIcon === 'moon'"
                                        >
                                            <path
                                                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                                            />
                                        </template>
                                        <template
                                            v-else-if="selectedIcon === 'home'"
                                        >
                                            <path d="M4 12l8-7 8 7" />
                                            <path d="M7 11v7h10v-7" />
                                        </template>
                                        <template
                                            v-else-if="selectedIcon === 'star'"
                                        >
                                            <polygon
                                                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                                            />
                                        </template>
                                        <template
                                            v-else-if="selectedIcon === 'clock'"
                                        >
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v6l4 2" />
                                        </template>
                                    </svg>
                                </div>
                                <h3 class="summary-card__name">
                                    {{ routineName || "Sin nombre" }}
                                </h3>
                                <p class="summary-card__hint">
                                    Paso 1 completado
                                </p>
                                <button
                                    type="button"
                                    class="btn-back"
                                    @click="backToDetails"
                                >
                                    Editar detalles
                                </button>
                            </div>
                        </div>

                        <div class="panel-right">
                            <div class="stepper">
                                <span class="stepper__label"
                                    >Paso {{ activeStep }} de 3</span
                                >
                                <h3 class="panel-right__title">
                                    {{ stepTitle }}
                                </h3>
                                <p class="panel-right__subtitle">
                                    {{ stepSubtitle }}
                                </p>
                            </div>

                            <template v-if="isStep2">
                                <div class="room-tabs">
                                <button
                                    class="room-tab"
                                    :class="{
                                        'room-tab--active':
                                            selectedRoomId === 'all',
                                    }"
                                    type="button"
                                    @click="selectedRoomId = 'all'"
                                >
                                    Todos
                                </button>
                                <button
                                    v-for="room in rooms"
                                    :key="room.id"
                                    class="room-tab"
                                    :class="{
                                        'room-tab--active':
                                            selectedRoomId === room.id,
                                    }"
                                    type="button"
                                    @click="selectedRoomId = room.id"
                                >
                                    {{ room.name }}
                                </button>
                            </div>

                            <div v-if="loadingDevices" class="device-grid">
                                <div
                                    v-for="i in 6"
                                    :key="i"
                                    class="device-tile device-tile--skeleton"
                                />
                            </div>

                            <div
                                v-else-if="filteredDevices.length === 0"
                                class="empty-devices"
                            >
                                No hay dispositivos en esta habitación.
                            </div>

                            <div v-else class="device-grid">
                                <button
                                    v-for="device in filteredDevices"
                                    :key="device.id"
                                    type="button"
                                    class="device-tile"
                                    :class="{
                                        'device-tile--selected':
                                            isDeviceSelected(device.id),
                                    }"
                                    @click="toggleDevice(device.id)"
                                >
                                    <span
                                        class="device-tile__icon"
                                        aria-hidden="true"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <template
                                                v-if="device.kind === 'vacuum'"
                                            >
                                                <rect
                                                    x="6"
                                                    y="3"
                                                    width="12"
                                                    height="10"
                                                    rx="3"
                                                />
                                                <path d="M12 13v8" />
                                            </template>
                                            <template
                                                v-else-if="
                                                    device.kind === 'speaker'
                                                "
                                            >
                                                <rect
                                                    x="7"
                                                    y="3"
                                                    width="10"
                                                    height="18"
                                                    rx="2"
                                                />
                                                <circle
                                                    cx="12"
                                                    cy="9"
                                                    r="2"
                                                    fill="currentColor"
                                                />
                                                <circle cx="12" cy="15" r="3" />
                                            </template>
                                            <template
                                                v-else-if="
                                                    device.kind === 'tap'
                                                "
                                            >
                                                <path d="M6 8h12" />
                                                <path
                                                    d="M9 8v5a3 3 0 0 0 6 0V8"
                                                />
                                                <circle
                                                    cx="12"
                                                    cy="18"
                                                    r="1"
                                                    fill="currentColor"
                                                />
                                            </template>
                                            <template
                                                v-else-if="
                                                    device.kind === 'blind'
                                                "
                                            >
                                                <rect
                                                    x="6"
                                                    y="4"
                                                    width="12"
                                                    height="16"
                                                    rx="2"
                                                />
                                                <path d="M6 9h12M6 13h12" />
                                            </template>
                                            <template
                                                v-else-if="
                                                    device.kind === 'lamp'
                                                "
                                            >
                                                <path
                                                    d="M8 10a4 4 0 0 1 8 0c0 2-2 3-2 5H10c0-2-2-3-2-5z"
                                                />
                                                <path d="M10 18h4" />
                                            </template>
                                            <template
                                                v-else-if="
                                                    device.kind === 'oven'
                                                "
                                            >
                                                <rect
                                                    x="5"
                                                    y="4"
                                                    width="14"
                                                    height="16"
                                                    rx="2"
                                                />
                                                <rect
                                                    x="8"
                                                    y="9"
                                                    width="8"
                                                    height="6"
                                                    rx="1"
                                                />
                                                <circle
                                                    cx="8"
                                                    cy="6.5"
                                                    r="1"
                                                    fill="currentColor"
                                                />
                                                <circle
                                                    cx="12"
                                                    cy="6.5"
                                                    r="1"
                                                    fill="currentColor"
                                                />
                                            </template>
                                            <template
                                                v-else-if="device.kind === 'ac'"
                                            >
                                                <path
                                                    d="M6 7h12M7 11h10M9 15h6"
                                                />
                                            </template>
                                            <template
                                                v-else-if="
                                                    device.kind === 'door'
                                                "
                                            >
                                                <rect
                                                    x="7"
                                                    y="4"
                                                    width="10"
                                                    height="16"
                                                    rx="2"
                                                />
                                                <circle
                                                    cx="14"
                                                    cy="12"
                                                    r="1"
                                                    fill="currentColor"
                                                />
                                            </template>
                                            <template v-else>
                                                <rect
                                                    x="6"
                                                    y="4"
                                                    width="12"
                                                    height="16"
                                                    rx="2"
                                                />
                                                <path d="M6 10h12" />
                                            </template>
                                        </svg>
                                    </span>
                                    <span class="device-tile__name">{{
                                        device.name
                                    }}</span>
                                    <span
                                        v-if="isDeviceSelected(device.id)"
                                        class="device-tile__check"
                                        aria-hidden="true"
                                        >✓</span
                                    >
                                </button>
                            </div>

                            <div class="panel-right__footer">
                                <button
                                    type="button"
                                    class="btn-continue"
                                    :disabled="!canContinue"
                                    @click="continueFromDevices"
                                >
                                    Continuar a acciones
                                </button>
                            </div>
                            </template>

                            <template v-else>
                                <div class="panel-right__list-header">
                                <h3 class="panel-right__title">
                                    Acciones por dispositivo
                                </h3>
                                <button
                                    type="button"
                                    class="btn-add-device"
                                    @click="backToDevices"
                                >
                                    + Agregar dispositivo
                                </button>
                            </div>

                            <div
                                v-if="selectedDevicesInfo.length === 0"
                                class="empty-devices"
                            >
                                No hay dispositivos seleccionados.
                            </div>

                            <div v-else class="device-action-blocks">
                                <section
                                    v-for="device in selectedDevicesInfo"
                                    :key="device.id"
                                    class="device-action-block"
                                >
                                    <div
                                        class="device-action-block__header"
                                    >
                                        <div>
                                            <h4
                                                class="device-action-block__title"
                                            >
                                                {{ device.name }}
                                            </h4>
                                            <p
                                                class="device-action-block__subtitle"
                                            >
                                                {{
                                                    getDeviceTypeName(device.id) ??
                                                    "Tipo desconocido"
                                                }}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            class="btn-add-action"
                                            @click="addActionRow(device.id)"
                                        >
                                            + Agregar accion
                                        </button>
                                    </div>

                                    <div class="action-rows">
                                        <div
                                            v-for="(action, index) in
                                                actionsByDevice[device.id] ??
                                                    []"
                                            :key="`${device.id}-${index}`"
                                            class="action-row"
                                            :class="{
                                                'action-row--error':
                                                    showActionErrors &&
                                                    getRowErrors(
                                                        device.id,
                                                        index,
                                                    ).length > 0,
                                            }"
                                        >
                                            <div class="action-row__top">
                                                <select
                                                    class="action-row__select"
                                                    :value="action.actionName"
                                                    @change="
                                                        updateActionName(
                                                            device.id,
                                                            index,
                                                            (
                                                                $event.target as HTMLSelectElement
                                                            ).value,
                                                        )
                                                    "
                                                >
                                                    <option value="">
                                                        Selecciona una accion
                                                    </option>
                                                    <option
                                                        v-for="option in buildActionOptionsForRow(
                                                            device.id,
                                                            index,
                                                        )"
                                                        :key="option.actionName"
                                                        :value="
                                                            option.actionName
                                                        "
                                                    >
                                                        {{ option.label }}
                                                    </option>
                                                </select>

                                                <div
                                                    v-if="
                                                        getActionSchema(
                                                            device.id,
                                                            action.actionName,
                                                        ).length > 0
                                                    "
                                                    class="action-row__params-inline"
                                                >
                                                    <div
                                                        v-for="param in getActionSchema(
                                                            device.id,
                                                            action.actionName,
                                                        )"
                                                        :key="param.name"
                                                        class="param-inline"
                                                    >
                                                        <template
                                                            v-if="
                                                                param.enum &&
                                                                param.enum
                                                                    .length
                                                            "
                                                        >
                                                            <select
                                                                class="param-inline__input"
                                                                :value="
                                                                    String(
                                                                        action
                                                                            .params[
                                                                            param
                                                                                .name
                                                                        ] ??
                                                                            '',
                                                                    )
                                                                "
                                                                @change="
                                                                    updateParamValue(
                                                                        device.id,
                                                                        index,
                                                                        param,
                                                                        (
                                                                            $event.target as HTMLSelectElement
                                                                        ).value,
                                                                    )
                                                                "
                                                            >
                                                                <option
                                                                    v-for="
                                                                        option in
                                                                            param.enum
                                                                    "
                                                                    :key="option"
                                                                    :value="
                                                                        option
                                                                    "
                                                                >
                                                                    {{
                                                                        option
                                                                    }}
                                                                </option>
                                                            </select>
                                                        </template>

                                                        <template
                                                            v-else-if="
                                                                param.type ===
                                                                'boolean'
                                                            "
                                                        >
                                                            <select
                                                                class="param-inline__input"
                                                                :value="
                                                                    String(
                                                                        action
                                                                            .params[
                                                                            param
                                                                                .name
                                                                        ] ??
                                                                            false,
                                                                    )
                                                                "
                                                                @change="
                                                                    updateParamValue(
                                                                        device.id,
                                                                        index,
                                                                        param,
                                                                        (
                                                                            $event.target as HTMLSelectElement
                                                                        ).value ===
                                                                            'true',
                                                                    )
                                                                "
                                                            >
                                                                <option
                                                                    value="true"
                                                                >
                                                                    Si
                                                                </option>
                                                                <option
                                                                    value="false"
                                                                >
                                                                    No
                                                                </option>
                                                            </select>
                                                        </template>

                                                        <template
                                                            v-else-if="
                                                                param.type ===
                                                                    'integer' ||
                                                                param.type ===
                                                                    'number'
                                                            "
                                                        >
                                                            <input
                                                                class="param-inline__input"
                                                                type="number"
                                                                inputmode="numeric"
                                                                :min="param.min"
                                                                :max="param.max"
                                                                :step="
                                                                    param.step ??
                                                                    (param.type ===
                                                                    'integer'
                                                                        ? 1
                                                                        : 'any')
                                                                "
                                                                :value="
                                                                    action
                                                                        .params[
                                                                        param
                                                                            .name
                                                                    ] ??
                                                                        ''
                                                                "
                                                                @input="
                                                                    updateParamValue(
                                                                        device.id,
                                                                        index,
                                                                        param,
                                                                        (
                                                                            $event.target as HTMLInputElement
                                                                        ).value,
                                                                    )
                                                                "
                                                            />
                                                        </template>

                                                        <template v-else>
                                                            <input
                                                                class="param-inline__input"
                                                                type="text"
                                                                :value="
                                                                    String(
                                                                        action
                                                                            .params[
                                                                            param
                                                                                .name
                                                                        ] ??
                                                                            '',
                                                                    )
                                                                "
                                                                @input="
                                                                    updateParamValue(
                                                                        device.id,
                                                                        index,
                                                                        param,
                                                                        (
                                                                            $event.target as HTMLInputElement
                                                                        ).value,
                                                                    )
                                                                "
                                                            />
                                                        </template>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    class="action-row__remove"
                                                    @click="
                                                        removeActionRow(
                                                            device.id,
                                                            index,
                                                        )
                                                    "
                                                >
                                                    Eliminar
                                                </button>
                                            </div>

                                            <div
                                                v-if="
                                                    showActionErrors &&
                                                    getRowErrors(
                                                        device.id,
                                                        index,
                                                    ).length > 0
                                                "
                                                class="action-row__errors"
                                            >
                                                <p
                                                    v-for="
                                                        (error, errorIndex) in getRowErrors(
                                                            device.id,
                                                            index,
                                                        )
                                                    "
                                                    :key="
                                                        `${error.field ?? 'row'}-${errorIndex}`
                                                    "
                                                    class="action-row__error"
                                                >
                                                    {{ error.message }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div class="panel-right__footer">
                                <button
                                    type="button"
                                    class="btn-continue"
                                    :disabled="
                                        !canSubmit ||
                                        submitting ||
                                        !routineActionsLoaded ||
                                        loadingDeviceTypes
                                    "
                                    @click="handleSubmit"
                                >
                                    <svg
                                        v-if="submitting"
                                        class="spinner"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-dasharray="60"
                                            stroke-dashoffset="20"
                                        />
                                    </svg>
                                    <span v-else>
                                        {{
                                            mode === "create"
                                                ? "Crear Rutina"
                                                : "Guardar Cambios"
                                        }}
                                    </span>
                                </button>
                            </div>
                            </template>
                    </div>
                    </template>
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
    background: rgba(42, 40, 37, 0.4);
    backdrop-filter: blur(10px);
    padding: 1.5rem;
}

.modal {
    background: #f7f5f0;
    border-radius: 28px;
    width: 100%;
    max-width: 880px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 80px rgba(42, 40, 37, 0.28);
}

.modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 1.75rem 1rem;
    background: #f7f5f0;
    flex-shrink: 0;
}

.modal__title {
    font-size: 1.35rem;
    font-weight: 400;
    color: rgba(52, 47, 41, 0.88);
}

.modal__close {
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

.modal__error {
    margin: 0 1.75rem;
    padding: 0.6rem 1rem;
    background: rgba(180, 60, 60, 0.1);
    border: 1px solid rgba(180, 60, 60, 0.25);
    border-radius: 12px;
    color: #9a2d2d;
    font-size: 0.85rem;
    flex-shrink: 0;
}

.modal__body {
    display: grid;
    grid-template-columns: 260px 1fr;
    overflow: hidden;
    flex: 1;
    min-height: 0;
}

.modal__body--single {
    grid-template-columns: 1fr;
}

.panel-left {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    padding: 1.25rem 1.5rem 1.5rem;
    background: linear-gradient(180deg, #e7dcc0 0%, #e2d4b5 100%);
    overflow-y: auto;
}

.panel-left--full {
    border-radius: 0;
    gap: 0.75rem;
    padding: 1rem 1.25rem 1.25rem;
}

.panel-left--summary {
    gap: 1rem;
}

.panel-left__footer {
    margin-top: auto;
    display: flex;
    justify-content: flex-end;
}

.summary-card {
    background: rgba(255, 255, 255, 0.75);
    border: 1.5px solid rgba(42, 40, 37, 0.12);
    border-radius: 18px;
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    align-items: flex-start;
}

.summary-card__icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    box-shadow: 0 10px 18px rgba(42, 40, 37, 0.18);
}

.summary-card__icon svg {
    width: 24px;
    height: 24px;
}

.summary-card__name {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: rgba(52, 47, 41, 0.9);
}

.summary-card__hint {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(52, 47, 41, 0.55);
}

.field {
    position: relative;
}

.field__input {
    width: 100%;
    height: 46px;
    padding: 0 2.5rem 0 0.9rem;
    background: rgba(255, 255, 255, 0.85);
    border: 1.5px solid rgba(52, 47, 41, 0.15);
    border-radius: 12px;
    font-size: 0.9rem;
    font-family: var(--font-sans);
    color: rgba(52, 47, 41, 0.88);
    outline: none;
}

.field__input--error {
    border-color: #c44;
    background: rgba(200, 68, 68, 0.08);
}

.field__error-text {
    font-size: 0.75rem;
    color: #c44;
    margin-top: 0.35rem;
    display: block;
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
}

.preview__circle {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    display: grid;
    place-items: center;
}

.preview__svg {
    width: 26px;
    height: 26px;
}

.section-hint {
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: rgba(52, 47, 41, 0.42);
    margin-bottom: 0.3rem;
}

.color-swatches {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 0.4rem;
}

.swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
}

.swatch--active {
    border-color: rgba(42, 40, 37, 0.6);
}

.hue-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    border-radius: 5px;
    cursor: pointer;
    background: linear-gradient(
        to right,
        hsl(0, 65%, 58%),
        hsl(30, 65%, 58%),
        hsl(60, 65%, 58%),
        hsl(120, 65%, 58%),
        hsl(180, 65%, 58%),
        hsl(240, 65%, 58%),
        hsl(300, 65%, 58%),
        hsl(360, 65%, 58%)
    );
}

.icon-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(48px, 1fr));
    gap: 0.35rem;
}

.icon-btn {
    width: 100%;
    height: 62px;
    aspect-ratio: 1;
    border-radius: 10px;
    border: 1.5px solid rgba(42, 40, 37, 0.1);
    background: rgba(255, 255, 255, 0.7);
    color: rgba(42, 40, 37, 0.6);
    display: grid;
    place-items: center;
    cursor: pointer;
}

.icon-btn svg {
    width: 16px;
    height: 16px;
}

.icon-btn--active {
    background: rgba(42, 40, 37, 0.9);
    border-color: transparent;
    color: #f7f3e7;
}

.panel-right {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem 1.5rem 1.5rem;
    overflow-y: auto;
    min-height: 0;
    background: #f7f5f0;
}

.stepper {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.stepper__label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(52, 47, 41, 0.4);
}

.panel-right__title {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(52, 47, 41, 0.88);
}

.panel-right__subtitle {
    margin: 0;
    font-size: 0.82rem;
    color: rgba(52, 47, 41, 0.6);
}

.room-tabs {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    background: var(--color-sage);
    border-radius: 999px;
    padding: 0.4rem 0.6rem;
}

.room-tab {
    border: none;
    background: rgba(255, 255, 255, 0.6);
    color: rgba(42, 40, 37, 0.8);
    font-size: 0.82rem;
    font-weight: 600;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    font-family: var(--font-sans);
}

.room-tab--active {
    background: rgba(42, 40, 37, 0.92);
    color: #f7f3e7;
}

.device-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.65rem;
    flex: 1;
}

.device-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    padding: 0.75rem 0.5rem;
    border-radius: 14px;
    border: 1.5px solid rgba(42, 40, 37, 0.1);
    background: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    position: relative;
    font-family: var(--font-sans);
}

.device-tile--selected {
    background: rgba(42, 40, 37, 0.88);
    border-color: transparent;
    color: #f7f3e7;
}

.device-action-blocks {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.device-action-block {
    background: rgba(255, 255, 255, 0.8);
    border: 1.5px solid rgba(42, 40, 37, 0.1);
    border-radius: 16px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
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

.action-row__select {
    min-width: 190px;
    height: 34px;
    padding: 0 0.6rem;
    border-radius: 10px;
    border: 1.5px solid rgba(42, 40, 37, 0.15);
    background: rgba(255, 255, 255, 0.95);
    font-size: 0.85rem;
    font-family: var(--font-sans);
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

.param-inline__label {
    font-size: 0.72rem;
    font-weight: 600;
    color: rgba(52, 47, 41, 0.7);
}

.param-inline__input {
    height: 34px;
    padding: 0 0.5rem;
    border-radius: 10px;
    border: 1.5px solid rgba(42, 40, 37, 0.15);
    background: rgba(255, 255, 255, 0.95);
    font-size: 0.82rem;
    font-family: var(--font-sans);
    min-width: 120px;
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

.action-row__hint-inline {
    font-size: 0.75rem;
    color: rgba(52, 47, 41, 0.55);
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

.device-tile--skeleton {
    background: rgba(42, 40, 37, 0.06);
    border: none;
    height: 90px;
}

.device-tile__icon {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
}

.device-tile__icon svg {
    width: 22px;
    height: 22px;
}

.device-tile__name {
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
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

.panel-right__list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    flex-wrap: wrap;
}

.btn-add-device {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-brown);
    background: none;
    border: 1.5px solid rgba(103, 69, 49, 0.3);
    border-radius: 999px;
    padding: 0.3rem 0.85rem;
    cursor: pointer;
}

.device-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    overflow-y: auto;
}

.device-list__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    background: rgba(244, 244, 244, 0.8);
    border-radius: 12px;
    border: 1px solid rgba(42, 40, 37, 0.07);
}

.device-list__icon {
    width: 32px;
    height: 32px;
    background: rgba(42, 40, 37, 0.08);
    border-radius: 8px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: var(--color-text);
}

.device-list__icon svg {
    width: 18px;
    height: 18px;
}

.device-list__name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    flex: 1;
}

.panel-right__footer {
    margin-top: auto;
    padding-top: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
}

.btn-continue {
    flex: 1;
    height: 48px;
    border-radius: 14px;
    border: none;
    background: var(--color-brown);
    color: #fff;
    font-size: 0.95rem;
    font-weight: 400;
    font-family: var(--font-sans);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-continue:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-back {
    height: 48px;
    padding: 0 1rem;
    border-radius: 14px;
    border: 1.5px solid rgba(42, 40, 37, 0.2);
    background: rgba(255, 255, 255, 0.8);
    color: rgba(42, 40, 37, 0.75);
    font-size: 0.9rem;
    font-weight: 600;
    font-family: var(--font-sans);
    cursor: pointer;
    white-space: nowrap;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.spinner {
    width: 20px;
    height: 20px;
    animation: spin 0.9s linear infinite;
}

@media (max-width: 640px) {
    .modal__body {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
    }

    .panel-left {
        border-right: none;
        border-bottom: 1px solid rgba(42, 40, 37, 0.07);
        padding-bottom: 1rem;
        gap: 0.75rem;
    }

    .preview {
        display: none;
    }

    .device-grid {
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    }
}
</style>
