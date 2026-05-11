<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, watch } from "vue";
import { api, ApiError } from "@/services/api/client";
import { useDashboardStore } from "@/app/stores/dashboard";
import { useSocketStore } from "@/app/stores/socket";
import { useEditMode } from "@/app/composables/useEditMode";
import { useToast } from "@/shared/composables/useToast";
import { useDragReorder } from "@/shared/composables/useDragReorder";
import RoutineIcon from "@/shared/components/RoutineIcon.vue";
import RoutineFormModal from "../components/RoutineFormModal.vue";
import EditEntityModal from "@/app/components/EditEntityModal.vue";
import DeleteEntityConfirmModal from "@/app/components/DeleteEntityConfirmModal.vue";
import type {
    RoutineCard,
    RoutineIcon as RoutineIconType,
} from "../components/RoutineFormModal.vue";

type ApiRoutineRaw = {
    id: string;
    name: string;
    actions?: ApiRoutineAction[];
    metadata?: Record<string, unknown>;
};

type ApiRoutineAction = {
    device?: { id?: string };
};

const { showToast, showPersistentToast, hidePersistentToast } = useToast();

const dashboardStore = useDashboardStore();
const socketStore = useSocketStore();
const ADMIN_HINT = 'Modo edición activo: arrastrá las rutinas para ordenarlas, o tocá una para renombrarla o eliminarla.'
const { isEditMode, toggleEditMode: _toggleEditMode } = useEditMode();
function toggleEditMode() {
  _toggleEditMode()
  if (isEditMode.value) {
    showPersistentToast(ADMIN_HINT)
  } else {
    hidePersistentToast(ADMIN_HINT)
  }
}

onBeforeUnmount(() => {
  hidePersistentToast(ADMIN_HINT)
})

const routines = ref<RoutineCard[]>([]);
const loading = ref(true);

const runningId = ref<string | null>(null);

/* Scheduled execution tracking */
const scheduleCheckInterval = ref<ReturnType<typeof setInterval> | null>(null);
const lastExecutedMinute = ref<Map<string, string>>(new Map());

function getCurrentMinuteKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
}

function shouldExecuteRoutine(card: RoutineCard): boolean {
    if (!card.isScheduled || !card.isScheduleEnabled) return false;
    if (!card.scheduleTime || !card.scheduleFrequency) return false;

    const now = new Date();
    const currentDay = now.getDay();
    const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (card.scheduleTime !== currentHM) return false;

    switch (card.scheduleFrequency) {
        case 'once':
            break;
        case 'daily':
            break;
        case 'weekly':
            if (!card.scheduleDaysOfWeek?.includes(currentDay)) return false;
            break;
        default:
            return false;
    }

    const minuteKey = getCurrentMinuteKey();
    const lastKey = lastExecutedMinute.value.get(card.id);
    if (lastKey === minuteKey) return false;

    return true;
}

async function executeScheduledRoutine(card: RoutineCard) {
    try {
        await api.patch(`/routines/${card.id}/execute`, {});
        lastExecutedMinute.value.set(card.id, getCurrentMinuteKey());
        showToast(`Rutina "${card.name}" ejecutada automáticamente.`, 'success');
    } catch {
        /* Silently fail auto-execution to avoid spamming toasts */
    }
}

function checkScheduledRoutines() {
    for (const card of routines.value) {
        if (shouldExecuteRoutine(card)) {
            void executeScheduledRoutine(card);
        }
    }
}

function startScheduleChecker() {
    if (scheduleCheckInterval.value) return;
    checkScheduledRoutines();
    scheduleCheckInterval.value = setInterval(checkScheduledRoutines, 15000);
}

function stopScheduleChecker() {
    if (scheduleCheckInterval.value) {
        clearInterval(scheduleCheckInterval.value);
        scheduleCheckInterval.value = null;
    }
}

const showFormModal = ref(false);
const formMode = ref<"create" | "edit">("create");
const editingCard = ref<RoutineCard | undefined>(undefined);
const formInitialStep = ref<1 | 2>(1);

const showEditEntityModal = ref(false);
const pendingEditRoutine = ref<{ id: string; name: string } | null>(null);
const editingRoutine = ref(false);

const showDeleteConfirm = ref(false);
const pendingDelete = ref<{ id: string; name: string } | null>(null);
const deletingRoutine = ref(false);

const { draggingId, dragOverId, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd } = useDragReorder(routines, {
  canDrag: () => isEditMode.value,
  onReorder: async (orderedIds) => {
    const updates: Promise<void>[] = []
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      if (!id) continue
      const routine = routines.value.find(r => r.id === id)
      if (routine && routine.displayOrder !== i) {
        routine.displayOrder = i
        updates.push(dashboardStore.updateRoutineDisplayOrder(id, i))
      }
    }
    if (updates.length > 0) {
      try {
        await Promise.all(updates)
        dashboardStore.invalidateRoutines()
      } catch (e) {
        showToast('No se pudo guardar el orden de las rutinas.', 'error')
      }
    }
  },
})

async function loadRoutines() {
    if (!dashboardStore.activeHomeId) {
        routines.value = []
        return
    }

    loading.value = true;

    try {
        const [allRoutines, homeDevices] = await Promise.all([
            api.get<ApiRoutineRaw[]>("/routines"),
            /* Traemos todos los dispositivos del hogar activo, no solo los de la
               habitación activa (dashboardStore.devices se limita a una room). */
            dashboardStore.fetchHomeDevices(dashboardStore.activeHomeId),
        ])

        const activeDeviceIds = new Set(homeDevices.map(d => d.id))

        const homeRoutines = allRoutines.filter(r =>
            (r.actions ?? []).some(a => a.device?.id && activeDeviceIds.has(a.device.id))
        )

        routines.value = homeRoutines.map((r: ApiRoutineRaw) => {
            const deviceIds = (r.actions ?? [])
                .map((a: ApiRoutineAction) => a.device?.id)
                .filter(
                    (id: string | undefined): id is string =>
                        typeof id === "string",
                );

            return {
                id: r.id,
                name: r.name,
                deviceIds,
                actionsCount: r.actions?.length ?? 0,
                icon: (r.metadata?.icon as RoutineIconType) || "bolt",
                displayOrder: typeof r.metadata?.displayOrder === 'number' ? r.metadata.displayOrder : undefined,
                isScheduled: (r.metadata?.scheduleMode as string) === 'scheduled' || Boolean(r.metadata?.schedule),
                isScheduleEnabled: (r.metadata?.scheduleMode as string) === 'scheduled' && (r.metadata?.scheduleEnabled !== false),
            };
        }).sort((a, b) => {
            const aOrder = a.displayOrder ?? Infinity
            const bOrder = b.displayOrder ?? Infinity
            return aOrder - bOrder
        });
    } catch (e: unknown) {
        const apiError = e instanceof ApiError ? e : null;
        const msg = apiError
            ? `Error ${apiError.status} al cargar las rutinas.`
            : "Error inesperado al cargar las rutinas.";
        showToast(msg, "error");
    } finally {
        loading.value = false;
    }
}

onMounted(async () => {
    /* Primero aseguramos que los hogares y dispositivos estén cargados
       (imitando el patrón de useHomesDashboard en Homes/DevicesPage).
       Si ya se cargaron al visitar otra pestaña, loadDashboard() es no-op
       gracias a su flag dashboardLoaded. */
    await dashboardStore.loadDashboard()
    await loadRoutines()
});

watch(() => socketStore.deviceListVersion, () => {
    void loadRoutines();
});

/* Al cambiar de hogar, recargamos las rutinas para que coincidan
   con los dispositivos del nuevo hogar. */
watch(() => dashboardStore.activeHomeId, () => {
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
    routines.value.push(card);
    dashboardStore.invalidateRoutines();
    showFormModal.value = false;
    showToast(`"${card.name}" creada.`, "success");
}

function onRoutineUpdated(card: RoutineCard) {
    const idx = routines.value.findIndex((r) => r.id === card.id);
    if (idx >= 0) {
        const existingOrder = routines.value[idx]!.displayOrder;
        routines.value[idx] = { ...card, displayOrder: existingOrder };
    }
    dashboardStore.invalidateRoutines();
    showFormModal.value = false;
    showToast(`"${card.name}" actualizada.`, "success");
}

function onRoutineCardClick(card: RoutineCard) {
    if (isEditMode.value) {
        requestRoutineEdition(card)
    } else {
        formMode.value = "edit"
        editingCard.value = card
        formInitialStep.value = 2
        showFormModal.value = true
    }
}

function requestRoutineEdition(card: RoutineCard) {
    if (editingRoutine.value) return
    pendingEditRoutine.value = { id: card.id, name: card.name }
    showEditEntityModal.value = true
}

function closeEditEntityModal() {
    if (editingRoutine.value) return
    showEditEntityModal.value = false
    pendingEditRoutine.value = null
}

async function confirmRoutineEdition(payload: { name: string }) {
    if (!pendingEditRoutine.value) return

    editingRoutine.value = true
    try {
        /* El backend PUT /routines/{id} espera el objeto completo;
           si solo mandamos { name } puede sobrescribir actions como [].
           Traemos la rutina actual para preservar sus acciones. */
        const existing = await api.get<ApiRoutineRaw>(`/routines/${pendingEditRoutine.value.id}`)
        await api.put(`/routines/${pendingEditRoutine.value.id}`, {
            name: payload.name,
            actions: existing.actions ?? [],
            metadata: existing.metadata ?? {},
        })
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
        showToast(msg, "error")
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

async function toggleRoutineSchedule(id: string) {
    const idx = routines.value.findIndex((r) => r.id === id)
    if (idx < 0) return
    const routine = routines.value[idx]!
    if (!routine.isScheduled) return

    try {
        const existing = await api.get<ApiRoutineRaw>(`/routines/${id}`)
        const nextEnabled = !routine.isScheduleEnabled
        await api.put(`/routines/${id}`, {
            name: existing.name,
            actions: existing.actions ?? [],
            metadata: {
                ...existing.metadata,
                scheduleEnabled: nextEnabled,
            },
        })
        routines.value[idx] = { ...routine, isScheduleEnabled: nextEnabled }
        showToast(nextEnabled ? 'Programación activada.' : 'Programación pausada.', 'success')
    } catch (e: unknown) {
        const apiError = e instanceof ApiError ? e : null
        const msg = apiError
            ? `Error ${apiError.status} al cambiar el estado.`
            : 'No se pudo cambiar el estado de la programación.'
        showToast(msg, 'error')
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

        <div v-if="loading" class="notice">Cargando rutinas...</div>

        <section v-else class="panel">
            <header class="panel__header">
                <h2 class="panel__title">Mis rutinas</h2>
                <button
                    type="button"
                    class="panel__edit-toggle"
                    :class="{ 'panel__edit-toggle--active': isEditMode }"
                    @click="toggleEditMode"
                >
                    {{ isEditMode ? 'Salir de Modo edición' : 'Modo edición' }}
                </button>
            </header>

            <div class="routine-grid">
                <button
                    class="device-card device-card--new"
                    :class="{ 'device-card--new--editing': isEditMode }"
                    type="button"
                    aria-label="Agregar rutina"
                    :disabled="isEditMode"
                    @click="openCreateModal"
                >
                    <span class="device-card__plus">+</span>
                    <span>Nueva</span>
                </button>

                <article
                    v-for="card in routines"
                    :key="card.id"
                    class="routine-card"
                    :class="{
                        'routine-card--edit-mode': isEditMode,
                        'routine-card--dragging': draggingId === card.id,
                        'routine-card--drag-over': dragOverId === card.id,
                        'routine-card--scheduled': card.isScheduled && card.isScheduleEnabled,
                        'routine-card--scheduled-paused': card.isScheduled && !card.isScheduleEnabled,
                    }"
                    :draggable="isEditMode"
                    @dragstart="onDragStart(card.id)"
                    @dragover="onDragOver($event, card.id)"
                    @dragleave="onDragLeave"
                    @drop="onDrop($event, card.id)"
                    @dragend="onDragEnd"
                    @click="onRoutineCardClick(card)"
                >
                    <div
                        class="routine-card__icon"
                        aria-hidden="true"
                    >
                        <RoutineIcon :icon="card.icon" />
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
                        v-if="!card.isScheduled"
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
                    <button
                        v-else
                        type="button"
                        class="routine-card__run"
                        :class="{
                            'routine-card__run--scheduled-on': card.isScheduleEnabled,
                            'routine-card__run--scheduled-off': !card.isScheduleEnabled,
                        }"
                        :aria-label="card.isScheduleEnabled ? 'Pausar programación' : 'Activar programación'"
                        :disabled="isEditMode"
                        @click.stop="toggleRoutineSchedule(card.id)"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
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

.notice {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 16px;
    padding: 0.8rem 1rem;
    font-weight: 600;
    color: rgba(42, 40, 37, 0.7);
    box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.08);
}

.routine-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
}

.device-card--new {
    border: none;
    align-items: center;
    justify-content: center;
    background: rgba(42, 40, 37, 0.07);
    min-height: 160px;
    padding: 1rem;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: rgba(42, 40, 37, 0.8);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-radius: 18px;
    transition: transform 0.15s, box-shadow 0.15s;

}

.device-card--new--editing {
    background: transparent !important;
}

.device-card--new:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
}

.device-card__plus {
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

.device-card--new:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}
.routine-card--new {
    border-radius: 18px;
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
    transition: transform 0.15s, box-shadow 0.15s;    
    gap: 0.75rem;
}
.routine-card--new:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

.routine-card {
    background: rgba(255, 255, 255, 0.82);
    border-radius: 18px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
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
    background: rgba(190, 190, 166, 0.45);
    color: rgba(42, 40, 37, 0.8);
}

.routine-card__icon svg {
    width: 22px;
    height: 22px;
}

.routine-card--dragging {
    opacity: 0.5;
}

.routine-card--drag-over {
    box-shadow: inset 0 0 0 2px var(--color-sage), 0 0 0 1px rgba(42, 40, 37, 0.3);
}

.routine-card__body {
    flex: 1;
    min-width: 0;
    padding-right: 3.5rem;
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
    bottom: 2rem;
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

/* Scheduled routine — match device on/off colours */
.routine-card--scheduled {
    background: rgba(190, 190, 166, 0.6);
    box-shadow: inset 0 0 0 1px rgba(158, 155, 142, 0.3);
}

.routine-card--scheduled:hover {
    background: rgba(190, 190, 166, 0.75);
}

.routine-card--scheduled-paused {
    background: rgba(255, 255, 255, 0.82);
    box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
}

.routine-card--scheduled-paused:hover {
    background: rgba(255, 255, 255, 0.95);
}

/* Schedule toggle — match device switch */
.routine-card__run--scheduled-on {
    background: rgba(63, 129, 102, 0.65);
    color: #fff;
}

.routine-card__run--scheduled-on:hover:not(:disabled) {
    background: rgba(63, 129, 102, 0.85);
}

.routine-card__run--scheduled-off {
    background: rgba(42, 40, 37, 0.18);
    color: rgba(42, 40, 37, 0.6);
}

.routine-card__run--scheduled-off:hover:not(:disabled) {
    background: rgba(42, 40, 37, 0.3);
}

.routine-card--scheduled:hover {
    background: rgba(224, 220, 194, 0.9);
}

.routine-card--scheduled-paused {
    background: rgba(200, 198, 188, 0.55);
    box-shadow: inset 0 0 0 1px rgba(158, 155, 142, 0.25);
}

.routine-card--scheduled-paused:hover {
    background: rgba(200, 198, 188, 0.7);
}

/* Schedule toggle: ON = dark active, OFF = muted inactive */
.routine-card__run--scheduled-on {
    background: rgba(42, 40, 37, 0.88);
    color: #f7f3e7;
}

.routine-card__run--scheduled-on:hover:not(:disabled) {
    background: rgba(42, 40, 37, 1);
    transform: scale(1.05);
}

.routine-card__run--scheduled-off {
    background: rgba(158, 155, 142, 0.55);
    color: rgba(42, 40, 37, 0.7);
}

.routine-card__run--scheduled-off:hover:not(:disabled) {
    background: rgba(158, 155, 142, 0.75);
    transform: scale(1.05);
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