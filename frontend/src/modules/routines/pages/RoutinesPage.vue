<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api, ApiError } from "@/services/api/client";
import { useDashboardStore } from "@/app/stores/dashboard";
import RoutineFormModal from "../components/RoutineFormModal.vue";
import type {
    RoutineCard,
    RoutineIcon,
} from "../components/RoutineFormModal.vue";

/* ─── Local API type ─────────────────────────────────────── */

type ApiRoutineRaw = {
    id: string;
    name: string;
    actions?: ApiRoutineAction[];
};

type ApiRoutineAction = {
    device?: { id?: string };
};

/* ─── localStorage metadata (color + icon) ───────────────── */

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

/* ─── Toast system ───────────────────────────────────────── */

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

/* ─── Page state ─────────────────────────────────────────── */

const routines = ref<RoutineCard[]>([]);
const loading = ref(true);
const pageError = ref("");

// Execute state
const runningId = ref<string | null>(null);

// Modal state
const showFormModal = ref(false);
const formMode = ref<"create" | "edit">("create");
const editingCard = ref<RoutineCard | undefined>(undefined);
const formInitialStep = ref<1 | 2 | 3>(1);

// Delete confirm state
const showDeleteModal = ref(false);
const pendingDelete = ref<RoutineCard | null>(null);
const deletingRoutine = ref(false);

/* ─── Load routines ──────────────────────────────────────── */

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

/* ─── Execute routine ────────────────────────────────────── */

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

/* ─── Create / Edit modal ────────────────────────────────── */

function openCreateModal() {
    formMode.value = "create";
    editingCard.value = undefined;
    formInitialStep.value = 1;
    showFormModal.value = true;
}

function openEditModal(card: RoutineCard) {
    formMode.value = "edit";
    editingCard.value = card;
    formInitialStep.value = 3;
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

/* ─── Delete routine ─────────────────────────────────────── */

function requestDelete(card: RoutineCard) {
    pendingDelete.value = card;
    showDeleteModal.value = true;
}

function cancelDelete() {
    if (deletingRoutine.value) return;
    pendingDelete.value = null;
    showDeleteModal.value = false;
}

async function confirmDelete() {
    if (!pendingDelete.value) return;
    deletingRoutine.value = true;
    const target = pendingDelete.value;

    try {
        await api.delete(`/routines/${target.id}`);
        deleteRoutineMeta(target.id);
        routines.value = routines.value.filter((r) => r.id !== target.id);
        dashboardStore.invalidateRoutines();
        showDeleteModal.value = false;
        pendingDelete.value = null;
        showToast(`"${target.name}" eliminada.`, "success");
    } catch (e: unknown) {
        const apiError = e instanceof ApiError ? e : null;
        const msg = apiError
            ? `Error ${apiError.status} al eliminar la rutina.`
            : "No se pudo eliminar la rutina.";
        showToast(msg, "error");
    } finally {
        deletingRoutine.value = false;
    }
}
</script>

<template>
    <section class="routines-page">

        <!-- Header (matches DevicesPage / HomesPage header structure) -->
        <div class="routines-page__header">
            <div>
                <header class="panel__header">
                    <h2 class="panel__title">Rutinas</h2>
                </header>
            </div>
        </div>

        <!-- Notices -->
        <div v-if="pageError" class="notice notice--error" role="alert">{{ pageError }}</div>
        <div v-else-if="loading" class="notice">Cargando rutinas...</div>

        <!-- Main panel -->
        <section v-else class="panel">
            <header class="panel__header">
                <h2 class="panel__title">Mis rutinas</h2>
                <button type="button" class="panel__btn" @click="openCreateModal">+ Nueva rutina</button>
            </header>

            <!-- Routine list -->
            <div class="routine-list">
                <button type="button" class="routine-card routine-card--new" @click="openCreateModal">
                    <span class="routine-card__plus">+</span>
                    <span>Nueva rutina</span>
                </button>
                <article
                    v-for="card in routines"
                    :key="card.id"
                    class="routine-card"
                >
                <!-- Colored icon circle -->
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

                <!-- Body -->
                <div class="routine-card__body">
                    <h3 class="routine-card__name">{{ card.name }}</h3>
                    <p class="routine-card__meta-line">
                        <span class="routine-card__meta-item">
                            Rutina manual
                        </span>
                        <span class="routine-card__meta-dot">•</span>
                        <span class="routine-card__meta-item">
                            Acciones: {{ card.actionsCount }}
                        </span>
                        <span class="routine-card__meta-dot">•</span>
                        <span class="routine-card__meta-item">
                            {{ card.deviceIds.length }}
                            {{
                                card.deviceIds.length === 1
                                    ? "dispositivo"
                                    : "dispositivos"
                            }}
                        </span>
                    </p>
                </div>

                <!-- Actions -->
                <div class="routine-card__actions">
                    <!-- Run button -->
                    <button
                        type="button"
                        class="action-btn action-btn--run"
                        :disabled="runningId !== null"
                        :aria-label="`Ejecutar ${card.name}`"
                        @click="executeRoutine(card.id)"
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
                        <span>Ejecutar</span>
                    </button>

                    <!-- Edit button -->
                    <button
                        type="button"
                        class="action-btn"
                        :aria-label="`Editar ${card.name}`"
                        @click="openEditModal(card)"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path
                                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                            />
                            <path
                                d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                            />
                        </svg>
                        <span>Editar</span>
                    </button>

                    <!-- Delete button -->
                    <button
                        type="button"
                        class="action-btn action-btn--danger"
                        :aria-label="`Eliminar ${card.name}`"
                        @click="requestDelete(card)"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <polyline points="3 6 5 6 21 6" />
                            <path
                                d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                            />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                        <span>Eliminar</span>
                    </button>
                </div>
            </article>
            </div>
        </section>

        <!-- ── Create / Edit modal ──────────────────────────── -->
        <RoutineFormModal
            v-if="showFormModal"
            :mode="formMode"
            :routine="editingCard"
            :initial-step="formInitialStep"
            @close="showFormModal = false"
            @created="onRoutineCreated"
            @updated="onRoutineUpdated"
        />

        <!-- ── Delete confirmation modal ────────────────────── -->
        <Teleport v-if="showDeleteModal && pendingDelete" to="body">
            <div class="del-overlay" @click.self="cancelDelete">
                <div class="del-modal" role="dialog" aria-modal="true">
                    <div class="del-modal__header">
                        <h2 class="del-modal__title">Eliminar rutina</h2>
                        <button
                            type="button"
                            class="del-modal__close"
                            :disabled="deletingRoutine"
                            aria-label="Cerrar"
                            @click="cancelDelete"
                        >
                            ✕
                        </button>
                    </div>
                    <p class="del-modal__msg">
                        ¿Estás seguro de que querés eliminar
                        <strong>"{{ pendingDelete.name }}"</strong>? Esta acción
                        no se puede deshacer.
                    </p>
                    <div class="del-modal__actions">
                        <button
                            type="button"
                            class="del-btn del-btn--cancel"
                            :disabled="deletingRoutine"
                            @click="cancelDelete"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            class="del-btn del-btn--confirm"
                            :disabled="deletingRoutine"
                            @click="confirmDelete"
                        >
                            <svg
                                v-if="deletingRoutine"
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
                            <span v-else>Eliminar</span>
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- ── Toast stack ───────────────────────────────────── -->
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
/* ─── Page layout ────────────────────────────────────────── */
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

/* ─── Panel (matches DevicesPage) ───────────────────────── */
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

.panel__btn {
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

.panel__btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

/* ─── Notices ────────────────────────────────────────────── */
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

/* ─── Routine list & cards ───────────────────────────────── */
.routine-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.routine-card--new {
    border: none;
    justify-content: center;
    background: rgba(42, 40, 37, 0.07);
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: rgba(42, 40, 37, 0.8);
    cursor: pointer;
}

.routine-card__plus {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.65);
    display: grid;
    place-items: center;
    font-size: 1.1rem;
    line-height: 1;
    color: rgba(42, 40, 37, 0.8);
    flex-shrink: 0;
}

.routine-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: rgba(244, 244, 244, 0.75);
    border-radius: 20px;
    border: 1px solid rgba(42, 40, 37, 0.07);
    box-shadow: 0 4px 14px rgba(42, 40, 37, 0.05);
    transition:
        box-shadow 0.2s,
        transform 0.2s;
    flex-wrap: wrap;
}

.routine-card:hover {
    box-shadow: 0 8px 24px rgba(42, 40, 37, 0.1);
    transform: translateY(-1px);
}

/* Icon circle */
.routine-card__icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(42, 40, 37, 0.15);
}

.routine-card__icon svg {
    width: 22px;
    height: 22px;
}

/* Body */
.routine-card__body {
    flex: 1;
    min-width: 0;
}

.routine-card__name {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.routine-card__meta-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 0.2rem;
}

.routine-card__meta-item {
    white-space: nowrap;
}

.routine-card__meta-dot {
    color: rgba(42, 40, 37, 0.35);
}

/* Action buttons */
.routine-card__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    flex-wrap: wrap;
}

.action-btn {
    height: 40px;
    padding: 0 0.9rem;
    border-radius: 999px;
    border: 1px solid rgba(42, 40, 37, 0.12);
    background: rgba(255, 255, 255, 0.9);
    color: rgba(42, 40, 37, 0.75);
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s;
}

.action-btn svg {
    width: 16px;
    height: 16px;
}

.action-btn:hover:not(:disabled) {
    background: rgba(42, 40, 37, 0.08);
    color: var(--color-text);
}

.action-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.action-btn--run {
    background: rgba(42, 40, 37, 0.88);
    color: #f7f3e7;
    border-color: transparent;
}

.action-btn--run:hover:not(:disabled) {
    background: rgba(42, 40, 37, 1);
    color: #f7f3e7;
}

.action-btn--danger:hover:not(:disabled) {
    background: rgba(180, 60, 60, 0.1);
    border-color: rgba(180, 60, 60, 0.25);
    color: #9a2d2d;
}

/* ─── Delete confirmation modal ──────────────────────────── */
.del-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(42, 40, 37, 0.35);
    backdrop-filter: blur(10px);
    padding: 1.5rem;
}

.del-modal {
    background: #fff;
    border-radius: 24px;
    padding: 2rem;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 32px 64px rgba(42, 40, 37, 0.22);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.del-modal__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
}

.del-modal__title {
    font-size: 1.35rem;
    font-weight: 300;
    color: var(--color-text);
}

.del-modal__close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(42, 40, 37, 0.08);
    color: rgba(42, 40, 37, 0.7);
    font-size: 0.9rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background 0.15s;
}

.del-modal__close:hover:not(:disabled) {
    background: rgba(42, 40, 37, 0.15);
}
.del-modal__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.del-modal__msg {
    color: rgba(42, 40, 37, 0.75);
    line-height: 1.5;
    font-size: 0.9rem;
}

.del-modal__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
}

.del-btn {
    height: 48px;
    border-radius: 12px;
    font-size: 0.92rem;
    font-weight: 600;
    font-family: var(--font-sans);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.2s;
}

.del-btn--cancel {
    border: 1px solid rgba(42, 40, 37, 0.18);
    color: rgba(42, 40, 37, 0.8);
    background: #fff;
}

.del-btn--cancel:hover:not(:disabled) {
    background: rgba(42, 40, 37, 0.05);
}

.del-btn--confirm {
    border: none;
    color: #fff;
    background: #b54444;
}

.del-btn--confirm:hover:not(:disabled) {
    background: #992f2f;
}

.del-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

/* ─── Toast notifications ────────────────────────────────── */
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

/* Toast transitions */
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

/* ─── Spinner ────────────────────────────────────────────── */
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

/* ─── Responsive ─────────────────────────────────────────── */
@media (max-width: 600px) {
    .routine-card {
        padding: 0.85rem 1rem;
    }

    .routine-card__icon {
        width: 40px;
        height: 40px;
    }

    .action-btn {
        width: 32px;
        height: 32px;
    }

    .action-btn svg {
        width: 14px;
        height: 14px;
    }
}
</style>
