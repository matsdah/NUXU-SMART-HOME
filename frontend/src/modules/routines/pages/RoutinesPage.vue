<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { api, ApiError } from "@/services/api/client";
import { useDashboardStore } from "@/app/stores/dashboard";
import { useSocketStore } from "@/app/stores/socket";
import { useEditMode } from "@/app/composables/useEditMode";
import RoutineFormModal from "../components/RoutineFormModal.vue";
import EditEntityModal from "@/app/components/EditEntityModal.vue";
import DeleteEntityConfirmModal from "@/app/components/DeleteEntityConfirmModal.vue";
import type {
    RoutineCard,
    RoutineIcon,
} from "../components/RoutineFormModal.vue";

type ApiRoutineRaw = {
    id: string;
    name: string;
    actions?: ApiRoutineAction[];
};

type ApiRoutineAction = {
    device?: { id?: string };
};

const META_KEY = "nuxu_routine_meta";
type RoutineMeta = { color: string; icon: RoutineIcon };
type RoutineMetaMap = Record<string, RoutineMeta>;

const FALLBACK_COLORS = ["#e05252", "#5285e0", "#52c47d", "#e0bf45", "#9052e0"];

function loadMetaMap(): RoutineMetaMap {
    try {
        return JSON.parse(localStorage.getItem(META_KEY) ?? "{}");
    } catch {
        return {};
    }
}

function saveRoutineMeta(id: string, meta: RoutineMeta) {
    const map = loadMetaMap();
    map[id] = meta;
    localStorage.setItem(META_KEY, JSON.stringify(map));
}

function deleteRoutineMeta(id: string) {
    const map = loadMetaMap();
    delete map[id];
    localStorage.setItem(META_KEY, JSON.stringify(map));
}

type Toast = { id: number; message: string; type: "success" | "error" };
const toasts = ref<Toast[]>([]);
let _toastId = 0;

function showToast(message: string, type: "success" | "error") {
    const id = ++_toastId;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3500);
}

const dashboardStore = useDashboardStore();
const socketStore = useSocketStore();
const { isEditMode, toggleEditMode } = useEditMode();

const routines = ref<RoutineCard[]>([]);
const loading = ref(true);
const pageError = ref("");

const runningId = ref<string | null>(null);

const showFormModal = ref(false);
const formMode = ref<"create" | "edit">("create");
const editingCard = ref<RoutineCard | undefined>(undefined);
const formInitialStep = ref<1 | 2 | 3>(1);

const showEditEntityModal = ref(false);
const pendingEditRoutine = ref<{ id: string; name: string } | null>(null);
const editingRoutine = ref(false);
const editRoutineError = ref("");

const showDeleteConfirm = ref(false);
const pendingDelete = ref<{ id: string; name: string } | null>(null);
const deletingRoutine = ref(false);

async function loadRoutines() {
    loading.value = true;
    pageError.value = "";

    try {
        const data = await api.get<ApiRoutineRaw[]>("/routines");
        const metaMap = loadMetaMap();

        routines.value = data.map((r: ApiRoutineRaw, idx: number) => {
            const deviceIds = (r.actions ?? [])
                .map((a: ApiRoutineAction) => a.device?.id)
                .filter(
                    (id: string | undefined): id is string =>
                        typeof id === "string",
                );

            const fallbackColor =
                FALLBACK_COLORS[idx % FALLBACK_COLORS.length] ?? "#e05252";
            const meta: RoutineMeta = {
                color: metaMap[r.id]?.color ?? fallbackColor,
                icon: metaMap[r.id]?.icon ?? ("bolt" as RoutineIcon),
            };

            return {
                id: r.id,
                name: r.name,
                deviceIds,
                actionsCount: r.actions?.length ?? 0,
                color: meta.color,
                icon: meta.icon,
            };
        });
    } catch (e: unknown) {
        const apiError = e instanceof ApiError ? e : null;
        pageError.value = apiError
            ? `Error ${apiError.status} al cargar las rutinas.`
            : "Error inesperado al cargar las rutinas.";
    } finally {
        loading.value = false;
    }
}

onMounted(loadRoutines);

watch(() => socketStore.deviceListVersion, () => {
    void loadRoutines();
});

async function executeRoutine(id: string) {
    if (runningId.value) return;
    runningId.value = id;
    try {
        await api.patch(`/routines/${id}/execute`, {});
        showToast("Rutina ejecutada correctamente.", "success");
    } catch (e: unknown) {
        const apiError = e instanceof ApiError ? e : null;
        const msg = apiError
            ? `Error ${apiError.status} al ejecutar la rutina.`
            : "No se pudo ejecutar la rutina.";
        showToast(msg, "error");
    } finally {
        runningId.value = null;
    }
}

function openCreateModal() {
    formMode.value = "create";
    editingCard.value = undefined;
    formInitialStep.value = 1;
    showFormModal.value = true;
}

function onRoutineCreated(card: RoutineCard) {
    saveRoutineMeta(card.id, { color: card.color, icon: card.icon });
    routines.value.unshift(card);
    dashboardStore.invalidateRoutines();
    showFormModal.value = false;
    showToast(`"${card.name}" creada.`, "success");
}

function onRoutineUpdated(card: RoutineCard) {
    saveRoutineMeta(card.id, { color: card.color, icon: card.icon });
    const idx = routines.value.findIndex((r) => r.id === card.id);
    if (idx >= 0) routines.value[idx] = card;
    dashboardStore.invalidateRoutines();
    showFormModal.value = false;
    showToast(`"${card.name}" actualizada.`, "success");
}

function onRoutineCardClick(card: RoutineCard) {
    if (isEditMode.value) {
        requestRoutineEdition(card)
    } else {
        executeRoutine(card.id)
    }
}

function requestRoutineEdition(card: RoutineCard) {
    if (editingRoutine.value) return
    editRoutineError.value = ""
    pendingEditRoutine.value = { id: card.id, name: card.name }
    showEditEntityModal.value = true
}

function closeEditEntityModal() {
    if (editingRoutine.value) return
    showEditEntityModal.value = false
    pendingEditRoutine.value = null
    editRoutineError.value = ""
}

async function confirmRoutineEdition(payload: { name: string }) {
    if (!pendingEditRoutine.value) return

    editingRoutine.value = true
    editRoutineError.value = ""
    try {
        await api.put(`/routines/${pendingEditRoutine.value.id}`, { name: payload.name })
        const idx = routines.value.findIndex(r => r.id === pendingEditRoutine.value?.id)
        if (idx >= 0 && routines.value[idx]) {
            routines.value[idx]!.name = payload.name  
        }
        dashboardStore.invalidateRoutines()
        showEditEntityModal.value = false
        pendingEditRoutine.value = null
        showToast("Rutina actualizada.", "success")
    } catch (e: unknown) {
        const apiError = e instanceof ApiError ? e : null
        const msg = apiError
            ? `Error ${apiError.status} al actualizar la rutina.`
            : "No se pudo actualizar la rutina."
        editRoutineError.value = msg
    } finally {
        editingRoutine.value = false
    }
}

function requestRoutineDeletion() {
    if (!pendingEditRoutine.value || deletingRoutine.value || editingRoutine.value) return
    showEditEntityModal.value = false
    pendingDelete.value = { id: pendingEditRoutine.value.id, name: pendingEditRoutine.value.name }
    showDeleteConfirm.value = true
    pendingEditRoutine.value = null
}

function closeDeleteConfirm() {
    if (deletingRoutine.value) return
    showDeleteConfirm.value = false
    pendingDelete.value = null
}

async function confirmDeletion() {
    if (!pendingDelete.value) return

    deletingRoutine.value = true
    const target = pendingDelete.value

    try {
        await api.delete(`/routines/${target.id}`)
        deleteRoutineMeta(target.id)
        routines.value = routines.value.filter((r) => r.id !== target.id)
        dashboardStore.invalidateRoutines()
        showDeleteConfirm.value = false
        pendingDelete.value = null
        showToast(`"${target.name}" eliminada.`, "success")
    } catch (e: unknown) {
        const apiError = e instanceof ApiError ? e : null
        const msg = apiError
            ? `Error ${apiError.status} al eliminar la rutina.`
            : "No se pudo eliminar la rutina."
        showToast(msg, "error")
    } finally {
        deletingRoutine.value = false
    }
}
</script>

<template>
    <section class="routines-page">

        <div class="routines-page__header">
            <div>
                <header class="panel__header">
                    <h2 class="panel__title">Rutinas</h2>
                </header>
            </div>
        </div>

        <div v-if="pageError" class="notice notice--error" role="alert">{{ pageError }}</div>
        <div v-else-if="loading" class="notice">Cargando rutinas...</div>

        <section v-else class="panel">
            <header class="panel__header">
                <h2 class="panel__title">Mis rutinas</h2>
                <button
                    type="button"
                    class="panel__edit-toggle"
                    :class="{ 'panel__edit-toggle--active': isEditMode }"
                    @click="toggleEditMode"
                >
                    {{ isEditMode ? 'Salir edición' : 'Modo edición' }}
                </button>
            </header>

            <p v-if="isEditMode" class="panel__edit-hint">
                Modo edición activo: tocá una rutina para editarla o eliminarla.
            </p>

            <div class="routine-grid">
                <button
                    class="routine-card routine-card--new"
                    :class="{ 'routine-card--new--editing': isEditMode }"
                    type="button"
                    aria-label="Agregar rutina"
                    :disabled="isEditMode"
                    @click="openCreateModal"
                >
                    <span class="routine-card__plus">+</span>
                    <span>Nueva</span>
                </button>

                <article
                    v-for="card in routines"
                    :key="card.id"
                    class="routine-card"
                    :class="{ 'routine-card--edit-mode': isEditMode }"
                    @click="onRoutineCardClick(card)"
                >
                    <div
                        class="routine-card__icon"
                        :style="{ background: card.color }"
                        aria-hidden="true"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <template v-if="card.icon === 'bolt'">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </template>
                            <template v-else-if="card.icon === 'sun'">
                                <circle cx="12" cy="12" r="5" />
                                <path
                                    d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                                />
                            </template>
                            <template v-else-if="card.icon === 'moon'">
                                <path
                                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                                />
                            </template>
                            <template v-else-if="card.icon === 'home'">
                                <path d="M4 12l8-7 8 7" />
                                <path d="M7 11v7h10v-7" />
                            </template>
                            <template v-else-if="card.icon === 'star'">
                                <polygon
                                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                                />
                            </template>
                            <template v-else-if="card.icon === 'clock'">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                            </template>
                        </svg>
                    </div>

                    <div class="routine-card__body">
                        <h3 class="routine-card__name">{{ card.name }}</h3>
                        <p class="routine-card__meta-line">
                            <span class="routine-card__meta-item">
                                {{ card.actionsCount }} acción{{ card.actionsCount !== 1 ? 'es' : '' }}
                            </span>
                            <span class="routine-card__meta-dot">•</span>
                            <span class="routine-card__meta-item">
                                {{ card.deviceIds.length }}
                                dispositivo{{ card.deviceIds.length !== 1 ? 's' : '' }}
                            </span>
                        </p>
                    </div>

                    <button
                        type="button"
                        class="routine-card__run"
                        :disabled="runningId !== null || isEditMode"
                        :aria-label="`Ejecutar ${card.name}`"
                        @click.stop="executeRoutine(card.id)"
                    >
                        <svg
                            v-if="runningId === card.id"
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
                        <svg
                            v-else
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </button>
                </article>
            </div>
        </section>

        <RoutineFormModal
            v-if="showFormModal"
            :mode="formMode"
            :routine="editingCard"
            :initial-step="formInitialStep"
            @close="showFormModal = false"
            @created="onRoutineCreated"
            @updated="onRoutineUpdated"
        />

        <EditEntityModal
            v-if="showEditEntityModal && pendingEditRoutine"
            :entity-name="pendingEditRoutine.name"
            entity-type="routine"
            :loading="editingRoutine"
            :error="editRoutineError"
            @close="closeEditEntityModal"
            @updated="confirmRoutineEdition"
            @delete="requestRoutineDeletion"
        />

        <DeleteEntityConfirmModal
            v-if="showDeleteConfirm && pendingDelete"
            :entity-name="pendingDelete.name"
            entity-type="routine"
            :loading="deletingRoutine"
            @close="closeDeleteConfirm"
            @confirm="confirmDeletion"
        />

        <Teleport to="body">
            <TransitionGroup name="toast" tag="div" class="toast-stack">
                <div
                    v-for="t in toasts"
                    :key="t.id"
                    class="toast"
                    :class="
                        t.type === 'success' ? 'toast--success' : 'toast--error'
                    "
                    role="status"
                >
                    <span class="toast__dot" aria-hidden="true" />
                    {{ t.message }}
                </div>
            </TransitionGroup>
        </Teleport>
    </section>
</template>

<style scoped>
.routines-page {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
}

.routines-page__header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
}

.panel {
    background: rgba(244, 244, 244, 0.7);
    border-radius: 24px;
    padding: 1.5rem;
    box-shadow: 0 20px 40px rgba(42, 40, 37, 0.08);
}

.panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.2rem;
}

.routines-page__header .panel__header {
    margin-bottom: 0;
}

.panel__title {
    font-family: var(--font-serif);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--color-text);
}

.panel__edit-toggle {
    border: none;
    background: rgba(255, 255, 255, 0.7);
    color: rgba(42, 40, 37, 0.85);
    border-radius: 999px;
    padding: 0.4rem 0.9rem;
    font-size: 0.8rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
}

.panel__edit-toggle:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

.panel__edit-toggle--active {
    background: rgba(42, 40, 37, 0.95);
    color: #f7f3e7;
    box-shadow: 0 0 0 1px rgba(42, 40, 37, 0.45);
}

.panel__edit-hint {
    margin: -0.4rem 0 1rem;
    padding: 0.55rem 0.8rem;
    border-radius: 10px;
    background: rgba(42, 40, 37, 0.95);
    color: #f7f3e7;
    font-size: 0.8rem;
    font-weight: 600;
}

.notice {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 16px;
    padding: 0.8rem 1rem;
    font-weight: 600;
    color: rgba(42, 40, 37, 0.7);
    box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.08);
}

.notice--error {
    background: rgba(180, 60, 60, 0.12);
    border: 1px solid rgba(180, 60, 60, 0.22);
    border-radius: 16px;
    padding: 0.8rem 1rem;
    color: #8a2d2d;
    font-weight: 600;
    font-size: 0.9rem;
    box-shadow: none;
}

.routine-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
}

.routine-card--new {
    border: none;
    justify-content: center;
    align-items: center;
    min-height: 160px;
    padding: 1rem;
    background: rgba(42, 40, 37, 0.07);
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: rgba(42, 40, 37, 0.8);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.routine-card--new--editing {
    background: transparent !important;
}

.routine-card--new:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
}

.routine-card__plus {
    width: 40px;
    height: 40px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.65);
    display: grid;
    place-items: center;
    font-size: 1.3rem;
    line-height: 1;
    color: rgba(42, 40, 37, 0.8);
    flex-shrink: 0;
}

.routine-card {
    background: rgba(255, 255, 255, 0.82);
    border-radius: 18px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
    min-height: 180px;
    box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    position: relative;
}

.routine-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

.routine-card--edit-mode {
    box-shadow:
        inset 0 0 0 2px rgba(42, 40, 37, 0.95),
        0 0 0 1px rgba(42, 40, 37, 0.3);
    background: rgba(255, 255, 255, 0.4);
}

.routine-card__icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
}

.routine-card__icon svg {
    width: 22px;
    height: 22px;
}

.routine-card__body {
    flex: 1;
    min-width: 0;
}

.routine-card__name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0 0 0.4rem 0;
}

.routine-card__meta-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0;
}

.routine-card__meta-item {
    white-space: nowrap;
}

.routine-card__meta-dot {
    color: rgba(42, 40, 37, 0.35);
}

.routine-card__run {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: rgba(42, 40, 37, 0.88);
    color: #f7f3e7;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 0.18s;
    flex-shrink: 0;
}

.routine-card__run svg {
    width: 16px;
    height: 16px;
}

.routine-card__run:hover:not(:disabled) {
    background: rgba(42, 40, 37, 1);
    transform: scale(1.05);
}

.routine-card__run:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.toast-stack {
    position: fixed;
    bottom: 1.75rem;
    right: 1.75rem;
    z-index: 400;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
}

.toast {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.7rem 1.1rem;
    border-radius: 14px;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(42, 40, 37, 0.18);
    pointer-events: auto;
    backdrop-filter: blur(8px);
}

.toast--success {
    background: rgba(255, 255, 255, 0.95);
    color: #2a4d3a;
    border: 1px solid rgba(82, 196, 125, 0.35);
}

.toast--error {
    background: rgba(255, 255, 255, 0.95);
    color: #7a1f1f;
    border: 1px solid rgba(180, 60, 60, 0.3);
}

.toast__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.toast--success .toast__dot {
    background: #52c47d;
}
.toast--error .toast__dot {
    background: #e05252;
}

.toast-enter-active,
.toast-leave-active {
    transition: all 0.3s ease;
}
.toast-enter-from {
    opacity: 0;
    transform: translateX(24px);
}
.toast-leave-to {
    opacity: 0;
    transform: translateX(24px);
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
.spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.9s linear infinite;
}

@media (max-width: 600px) {
    .routine-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }

    .routine-card {
        min-height: 160px;
        padding: 1rem;
    }

    .routine-card__icon {
        width: 40px;
        height: 40px;
    }
}
</style>