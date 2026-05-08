<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiError } from "@/services/api/client";
import {
    fetchDeviceLogs,
    fetchDeviceTypes,
    fetchDevices,
    fetchLogsForDevice,
} from "../services/logs";
import type {
    ApiDevice,
    ApiDeviceType,
    DeviceLog,
    DeviceLogRow,
} from "../types";
import {
    getActionLabel,
    getAllowedActionsForType,
    initializeAllowedActionsOnce,
} from "@/app/constants/actionLabels";

const PAGE_SIZE = 100;

const logs = ref<DeviceLogRow[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const loadingAll = ref(false);
const loadedDuringAll = ref(0);
const pageError = ref("");
const canLoadMore = ref(true);
const lastUpdatedAt = ref<Date | null>(null);

const deviceNameById = ref<Record<string, string>>({});
const deviceTypeById = ref<Record<string, string>>({});
const allDeviceTypeNames = ref<string[]>([]);

const selectedDeviceId = ref("all");
const selectedDeviceType = ref("all");
const selectedAction = ref("all");
const dateFrom = ref("");
const dateTo = ref("");

const hasActiveFilters = computed(
    () =>
        selectedDeviceId.value !== "all" ||
        selectedDeviceType.value !== "all" ||
        selectedAction.value !== "all" ||
        dateFrom.value !== "" ||
        dateTo.value !== "",
);

const totalLoadedActions = computed(() => logs.value.length);

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
});

function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    return dateFormatter.format(date);
}

function stringifyValue(value: unknown): string {
    if (value === undefined) return "-";
    if (value === null) return "null";
    if (typeof value === "string") return value.length > 0 ? value : '""';
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function normalizeSuccess(value: unknown): boolean | null {
    if (typeof value === "boolean") {
        return value;
    }
    return null;
}

function mapLog(log: DeviceLog): DeviceLogRow {
    const deviceName =
        deviceNameById.value[log.deviceId] ?? "Dispositivo desconocido";
    const deviceType = deviceTypeById.value[log.deviceId] ?? "Sin tipo";

    return {
        id: log.id,
        timestamp: log.timestamp,
        deviceId: log.deviceId,
        deviceName,
        deviceType,
        actionName: log.actionName,
        paramsText: stringifyValue(log.params),
        resultText: stringifyValue(log.result),
        success: normalizeSuccess(log.result),
    };
}

async function loadDeviceIndex(): Promise<void> {
    const [devicesResult, typesResult] = await Promise.allSettled([
        fetchDevices(),
        fetchDeviceTypes(),
    ]);

    const devices: ApiDevice[] =
        devicesResult.status === "fulfilled" &&
        Array.isArray(devicesResult.value)
            ? devicesResult.value
            : [];

    const deviceTypes: ApiDeviceType[] =
        typesResult.status === "fulfilled" && Array.isArray(typesResult.value)
            ? typesResult.value
            : [];

    const typeNameByTypeId = Object.fromEntries(
        deviceTypes
            .filter((type) => type.id && type.name)
            .map((type) => [type.id, type.name.trim()]),
    ) as Record<string, string>;

    const nameEntries = devices.map((device) => {
        const label =
            device.name?.trim() || `Dispositivo ${device.id.slice(0, 6)}`;
        return [device.id, label] as const;
    });

    const typeEntries = devices.map((device) => {
        const typeId = device.type?.id;
        const typeLabel =
            (typeId ? typeNameByTypeId[typeId] : undefined) ||
            device.type?.name?.trim() ||
            "Sin tipo";
        return [device.id, typeLabel] as const;
    });

    deviceNameById.value = Object.fromEntries(nameEntries);
    deviceTypeById.value = Object.fromEntries(typeEntries);

    const typeNames = deviceTypes
        .map((type) => type.name?.trim())
        .filter((name): name is string => Boolean(name));

    initializeAllowedActionsOnce(deviceTypes);

    allDeviceTypeNames.value = Array.from(new Set(typeNames)).sort((a, b) =>
        a.localeCompare(b, "es"),
    );
}

function fetchLogsPage(offset: number): Promise<DeviceLog[]> {
    if (selectedDeviceId.value !== "all") {
        return fetchLogsForDevice(selectedDeviceId.value, PAGE_SIZE, offset);
    }

    return fetchDeviceLogs(PAGE_SIZE, offset);
}

async function loadInitialLogs(): Promise<void> {
    loading.value = true;
    pageError.value = "";

    try {
        await loadDeviceIndex();
        const page = await fetchLogsPage(0);

        logs.value = page.map(mapLog);
        canLoadMore.value = page.length === PAGE_SIZE;
        lastUpdatedAt.value = new Date();
    } catch (err) {
        if (err instanceof ApiError) {
            pageError.value = `Error ${err.status} al cargar el historial.`;
        } else {
            pageError.value = "No se pudo cargar el historial en este momento.";
        }

        logs.value = [];
        canLoadMore.value = false;
    } finally {
        loading.value = false;
    }
}

async function loadMoreLogs(): Promise<void> {
    if (!canLoadMore.value || loadingMore.value) {
        return;
    }

    loadingMore.value = true;
    pageError.value = "";

    try {
        const page = await fetchLogsPage(logs.value.length);
        logs.value = [...logs.value, ...page.map(mapLog)];
        canLoadMore.value = page.length === PAGE_SIZE;
        lastUpdatedAt.value = new Date();
    } catch (err) {
        if (err instanceof ApiError) {
            pageError.value = `Error ${err.status} al cargar más acciones.`;
        } else {
            pageError.value = "No se pudo cargar más acciones.";
        }
    } finally {
        loadingMore.value = false;
    }
}

async function loadAllLogs(): Promise<void> {
    if (!canLoadMore.value || loadingMore.value || loadingAll.value) {
        return;
    }

    loadingAll.value = true;
    loadedDuringAll.value = 0;
    let safety = 0;

    try {
        while (canLoadMore.value && safety < 300) {
            const prevLength = logs.value.length;
            await loadMoreLogs();
            const added = logs.value.length - prevLength;
            if (added <= 0) break;

            loadedDuringAll.value += added;
            safety += 1;
        }
    } finally {
        loadingAll.value = false;
    }
}

function statusLabel(item: DeviceLogRow): string {
    if (item.success === true) return "OK";
    if (item.success === false) return "Error";
    return "Info";
}

function toRangeDate(dateIso: string, endOfDay: boolean): Date | null {
    if (!dateIso) return null;

    const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
    const date = new Date(`${dateIso}${suffix}`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

const deviceOptions = computed(() => {
    const entries = Object.entries(deviceNameById.value);
    entries.sort(([, a], [, b]) => a.localeCompare(b, "es"));
    return entries.map(([id, name]) => ({ id, name }));
});

const deviceTypeOptions = computed(() => {
    const set = new Set<string>(allDeviceTypeNames.value);
    for (const item of logs.value) {
        set.add(item.deviceType);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
});

const canSelectAction = computed(() => selectedDeviceType.value !== "all");

const actionOptions = computed(() => {
    if (!canSelectAction.value) {
        return [];
    }

    const baseActions = getAllowedActionsForType(selectedDeviceType.value);

    return Array.from(new Set(baseActions))
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((actionName) => ({
            actionName,
            label: getActionLabel(selectedDeviceType.value, actionName),
        }));
});

const hasInvalidDateRange = computed(() => {
    if (!dateFrom.value || !dateTo.value) {
        return false;
    }

    return (
        new Date(`${dateFrom.value}T00:00:00.000`) >
        new Date(`${dateTo.value}T23:59:59.999`)
    );
});

const filteredLogs = computed(() => {
    if (hasInvalidDateRange.value) {
        return [];
    }

    const fromDate = toRangeDate(dateFrom.value, false);
    const toDate = toRangeDate(dateTo.value, true);

    return logs.value.filter((item) => {
        if (
            selectedDeviceId.value !== "all" &&
            item.deviceId !== selectedDeviceId.value
        ) {
            return false;
        }

        if (
            selectedDeviceType.value !== "all" &&
            item.deviceType !== selectedDeviceType.value
        ) {
            return false;
        }

        if (
            selectedAction.value !== "all" &&
            item.actionName !== selectedAction.value
        ) {
            return false;
        }

        const itemDate = new Date(item.timestamp);
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;

        return true;
    });
});

const totalActions = computed(() => filteredLogs.value.length);

const summaryText = computed(
    () =>
        `Mostrando ${totalActions.value} resultados (de ${totalLoadedActions.value} cargados)`,
);

function clearFilters(): void {
    const hadServerDeviceFilter = selectedDeviceId.value !== "all";

    selectedDeviceId.value = "all";
    selectedDeviceType.value = "all";
    selectedAction.value = "all";
    dateFrom.value = "";
    dateTo.value = "";

    if (hadServerDeviceFilter) {
        void loadInitialLogs();
    }
}

function onDeviceChange(): void {
    void loadInitialLogs();
}

function onDeviceTypeChange(): void {
    selectedAction.value = "all";
}

onMounted(() => {
    void loadInitialLogs();
});
</script>

<template>
    <section class="logs-page">
        <header class="logs-page__header">
            <div>
                <h2 class="panel__title">Historial</h2>
            </div>

            <button
                type="button"
                class="refresh-btn"
                :disabled="loading || loadingMore || loadingAll"
                @click="loadInitialLogs"
            >
                Actualizar
            </button>
        </header>

        <section class="logs-summary" aria-live="polite">
            <p>{{ summaryText }}</p>
            <p>
                Última actualización:
                <strong>{{
                    lastUpdatedAt
                        ? formatTimestamp(lastUpdatedAt.toISOString())
                        : "-"
                }}</strong>
            </p>
        </section>

        <section class="filters" aria-label="Filtros de historial">
            <div class="filters__field">
                <label for="filter-device">Dispositivo</label>
                <select
                    id="filter-device"
                    v-model="selectedDeviceId"
                    @change="onDeviceChange"
                >
                    <option value="all">Todos</option>
                    <option
                        v-for="device in deviceOptions"
                        :key="device.id"
                        :value="device.id"
                    >
                        {{ device.name }}
                    </option>
                </select>
            </div>

            <div class="filters__field">
                <label for="filter-type">Tipo</label>
                <select
                    id="filter-type"
                    v-model="selectedDeviceType"
                    @change="onDeviceTypeChange"
                >
                    <option value="all">Todos</option>
                    <option
                        v-for="type in deviceTypeOptions"
                        :key="type"
                        :value="type"
                    >
                        {{ type }}
                    </option>
                </select>
            </div>

            <div class="filters__field">
                <label for="filter-action">Acción</label>
                <select
                    id="filter-action"
                    v-model="selectedAction"
                    :disabled="!canSelectAction"
                >
                    <option value="all">
                        {{
                            canSelectAction
                                ? "Todas"
                                : "Seleccioná un tipo primero"
                        }}
                    </option>
                    <option
                        v-for="action in actionOptions"
                        :key="action.actionName"
                        :value="action.actionName"
                    >
                        {{ action.label }}
                    </option>
                </select>
            </div>

            <div class="filters__field">
                <label for="filter-from">Desde</label>
                <input id="filter-from" v-model="dateFrom" type="date" />
            </div>

            <div class="filters__field">
                <label for="filter-to">Hasta</label>
                <input id="filter-to" v-model="dateTo" type="date" />
            </div>

            <div class="filters__actions">
                <button
                    type="button"
                    class="clear-filters-btn"
                    :disabled="!hasActiveFilters"
                    @click="clearFilters"
                >
                    Limpiar filtros
                </button>
            </div>
        </section>

        <p v-if="hasInvalidDateRange" class="date-range-error" role="alert">
            El rango de fechas es inválido: "Desde" no puede ser posterior a
            "Hasta".
        </p>

        <div
            v-if="pageError && !loading"
            class="notice notice--error"
            role="alert"
        >
            {{ pageError }}
            <button
                type="button"
                class="notice__retry"
                @click="loadInitialLogs"
            >
                Reintentar
            </button>
        </div>

        <div
            v-if="loading"
            class="logs-list"
            aria-busy="true"
            aria-live="polite"
        >
            <article
                v-for="i in 6"
                :key="i"
                class="log-card log-card--skeleton"
            >
                <div class="skeleton-line skeleton-line--title" />
                <div class="skeleton-line" />
                <div class="skeleton-line skeleton-line--short" />
            </article>
        </div>

        <div v-else-if="logs.length === 0" class="empty-state">
            <div class="empty-state__icon" aria-hidden="true">🕒</div>
            <h2>No hay acciones registradas</h2>
            <p>
                Todavía no se encontraron eventos para mostrar en el historial.
            </p>
        </div>

        <div v-else-if="filteredLogs.length === 0" class="empty-state">
            <div class="empty-state__icon" aria-hidden="true">🔎</div>
            <h2>Sin resultados para los filtros seleccionados</h2>
            <p>Probá limpiar filtros o ampliar el rango de fechas.</p>
            <button
                type="button"
                class="clear-filters-btn"
                :disabled="!hasActiveFilters"
                @click="clearFilters"
            >
                Limpiar filtros
            </button>
        </div>

        <div v-else class="logs-table-wrap">
            <table class="logs-table">
                <thead>
                    <tr>
                        <th>Dispositivo</th>
                        <th>Tipo</th>
                        <th>Acción</th>
                        <th>Fecha y hora</th>
                        <th>Parámetros</th>
                        <th>Resultado</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in filteredLogs" :key="item.id">
                        <td class="cell-device" :title="item.deviceName">
                            {{ item.deviceName }}
                        </td>
                        <td class="cell-type" :title="item.deviceType">
                            {{ item.deviceType }}
                        </td>
                        <td :title="item.actionName">
                            <strong>{{
                                getActionLabel(item.deviceType, item.actionName)
                            }}</strong>
                            <span class="cell-muted"
                                >({{ item.actionName }})</span
                            >
                        </td>
                        <td>{{ formatTimestamp(item.timestamp) }}</td>
                        <td class="cell-truncate" :title="item.paramsText">
                            {{ item.paramsText }}
                        </td>
                        <td class="cell-truncate" :title="item.resultText">
                            {{ item.resultText }}
                        </td>
                        <td>
                            <span
                                class="status-pill"
                                :class="`status-pill--${statusLabel(item).toLowerCase()}`"
                            >
                                {{ statusLabel(item) }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="logs-list__footer">
                <button
                    type="button"
                    class="load-more-btn"
                    :disabled="!canLoadMore || loadingMore || loadingAll"
                    @click="loadMoreLogs"
                >
                    {{ loadingMore ? "Cargando..." : "Cargar más" }}
                </button>
                <button
                    type="button"
                    class="load-more-btn"
                    :disabled="!canLoadMore || loadingMore || loadingAll"
                    @click="loadAllLogs"
                >
                    {{
                        loadingAll
                            ? `Cargando todo... (+${loadedDuringAll} nuevas)`
                            : "Cargar todo"
                    }}
                </button>
            </div>
        </div>
    </section>
</template>

<style scoped>
.logs-page {
    width: 100%;
    padding: 0;
    display: grid;
    gap: 1rem;
}

.logs-page__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
}

.section-label {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(42, 40, 37, 0.65);
    margin: 0;
}

.section-title {
    margin: 0.15rem 0 0.3rem;
    font-size: 1.35rem;
    color: rgba(42, 40, 37, 0.95);
}

.section-subtitle {
    margin: 0;
    color: rgba(42, 40, 37, 0.72);
}

.refresh-btn,
.load-more-btn,
.notice__retry,
.clear-filters-btn {
    border: 1px solid rgba(42, 40, 37, 0.2);
    background: rgba(255, 255, 255, 0.8);
    color: rgba(42, 40, 37, 0.9);
    padding: 0.45rem 0.95rem;
    font-weight: 600;
    cursor: pointer;
}

.refresh-btn,
.load-more-btn,
.notice__retry {
    border-radius: 999px;
}

.clear-filters-btn {
    border-radius: 10px;
    padding: 0.45rem 0.75rem;
}

.refresh-btn:disabled,
.load-more-btn:disabled,
.clear-filters-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.logs-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.8rem 1rem;
    border-radius: 14px;
    border: 1px solid rgba(42, 40, 37, 0.08);
    background: rgba(255, 255, 255, 0.5);
}

.logs-summary p {
    margin: 0;
    color: rgba(42, 40, 37, 0.84);
}

.filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.7rem 0.9rem;
    border: 1px solid rgba(42, 40, 37, 0.1);
    border-radius: 14px;
    padding: 0.8rem 0.95rem;
    background: rgba(255, 255, 255, 0.45);
}

.filters__field {
    display: grid;
    gap: 0.25rem;
}

.filters__field label {
    font-size: 0.78rem;
    font-weight: 600;
    color: rgba(42, 40, 37, 0.72);
}

.filters__field select,
.filters__field input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid rgba(42, 40, 37, 0.2);
    background: rgba(255, 255, 255, 0.88);
    color: rgba(42, 40, 37, 0.95);
    padding: 0.45rem 0.6rem;
    font: inherit;
}

.filters__field select:focus,
.filters__field input:focus {
    outline: 2px solid rgba(66, 105, 187, 0.35);
    outline-offset: 1px;
    border-color: rgba(66, 105, 187, 0.45);
}

.filters__actions {
    display: flex;
    align-items: end;
}

.date-range-error {
    margin: -0.25rem 0 0;
    color: #7a2323;
    font-size: 0.85rem;
    font-weight: 600;
}

.notice {
    border-radius: 14px;
    padding: 0.8rem 0.95rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
}

.notice--error {
    background: rgba(199, 71, 71, 0.14);
    border: 1px solid rgba(199, 71, 71, 0.35);
    color: #6e1f1f;
}

.logs-list {
    display: grid;
    gap: 0.8rem;
}

.log-card {
    border: 1px solid rgba(42, 40, 37, 0.1);
    background: rgba(255, 255, 255, 0.74);
    border-radius: 16px;
    padding: 0.75rem 0.85rem;
}

.logs-table-wrap {
    border: 1px solid rgba(42, 40, 37, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.82);
    overflow: hidden;
}

.logs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
}

.logs-table thead th {
    text-align: left;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(42, 40, 37, 0.68);
    background: rgba(42, 40, 37, 0.06);
    border-bottom: 1px solid rgba(42, 40, 37, 0.12);
    padding: 0.5rem 0.65rem;
}

.logs-table tbody td {
    padding: 0.5rem 0.65rem;
    border-bottom: 1px solid rgba(42, 40, 37, 0.08);
    color: rgba(42, 40, 37, 0.9);
    vertical-align: middle;
}

.logs-table tbody tr:last-child td {
    border-bottom: none;
}

.cell-device {
    max-width: 170px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
}

.cell-type {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cell-truncate {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cell-muted {
    margin-left: 0.25rem;
    font-size: 0.82rem;
    color: rgba(42, 40, 37, 0.62);
}

.status-pill {
    display: inline-block;
    white-space: nowrap;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 999px;
    padding: 0.22rem 0.5rem;
}

.status-pill--ok {
    background: rgba(62, 148, 99, 0.2);
    color: rgba(34, 93, 58, 1);
}

.status-pill--error {
    background: rgba(199, 71, 71, 0.2);
    color: rgba(110, 31, 31, 1);
}

.status-pill--info {
    background: rgba(66, 105, 187, 0.2);
    color: rgba(33, 59, 116, 1);
}

.logs-list__footer {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    padding-top: 0.6rem;
}

.logs-list__footer .load-more-btn {
    border-radius: 10px;
}

.empty-state {
    text-align: center;
    border: 1px dashed rgba(42, 40, 37, 0.25);
    background: rgba(255, 255, 255, 0.5);
    border-radius: 16px;
    padding: 1.4rem 1rem;
}

.empty-state h2 {
    margin: 0.4rem 0 0.25rem;
    font-size: 1.1rem;
}

.empty-state p {
    margin: 0;
    color: rgba(42, 40, 37, 0.72);
}

.empty-state__icon {
    font-size: 1.6rem;
}

.log-card--skeleton {
    animation: pulse 1.2s ease-in-out infinite alternate;
}

.skeleton-line {
    height: 0.75rem;
    border-radius: 999px;
    background: rgba(42, 40, 37, 0.12);
    margin-bottom: 0.5rem;
}

.skeleton-line--title {
    width: 55%;
    height: 0.9rem;
}

.skeleton-line--short {
    width: 35%;
    margin-bottom: 0;
}

@keyframes pulse {
    from {
        opacity: 0.55;
    }
    to {
        opacity: 1;
    }
}

@media (max-width: 980px) {
    .logs-table-wrap {
        overflow-x: auto;
    }

    .logs-table {
        min-width: 980px;
    }
}

@media (max-width: 680px) {
    .logs-page__header {
        flex-direction: column;
        align-items: stretch;
    }

    .refresh-btn,
    .clear-filters-btn {
        width: fit-content;
    }

    .filters {
        grid-template-columns: 1fr;
    }

    .filters__actions {
        align-items: stretch;
    }
}
</style>
