<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useAuthStore } from '@/app/stores/auth'
import { ApiError } from '@/services/api/client'

const router = useRouter()
const route = useRoute()
const dashboard = useDashboardStore()
const auth = useAuthStore()

const activeView = computed(() => route.query.view === 'hogar' ? 'hogar' : 'perfil')
const pageTitle = computed(() => activeView.value === 'hogar' ? 'Mi hogar' : 'Configuración')

//Toast

const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')
const showToast = ref(false)
let toastTimer: ReturnType<typeof setTimeout>

function showToastMsg(msg: string, type: 'success' | 'error' = 'success') {
  toastMessage.value = msg
  toastType.value = type
  showToast.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { showToast.value = false }, 3000)
}

//Helpers

const MEMBER_COLOR_COUNT = 10

function getMemberColorIndex(name: string): number {
  if (!name) return 0
  return name.charCodeAt(0) % MEMBER_COLOR_COUNT
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return '??'
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

//Profile

const profileData = ref({
  name: '',
  email: '',
})
const profileSaving = ref(false)

const originalProfile = ref({ name: '', email: '' })

const hasProfileChanges = computed(() =>
  profileData.value.name !== originalProfile.value.name ||
  profileData.value.email !== originalProfile.value.email
)

const canSaveProfile = computed(() =>
  hasProfileChanges.value && !profileSaving.value
)

function initProfileData() {
  const name = auth.user?.name ?? ''
  const email = auth.user?.email ?? ''
  profileData.value = { name, email }
  originalProfile.value = { name, email }
}

async function saveProfile() {
  if (!canSaveProfile.value) return
  profileSaving.value = true
  try {
    await auth.updateProfile({
      name: profileData.value.name,
      email: profileData.value.email,
    })
    originalProfile.value = { name: profileData.value.name, email: profileData.value.email }
    showToastMsg('Perfil actualizado correctamente')
  } catch (e) {
    showToastMsg('Error al actualizar el perfil', 'error')
    console.error(e)
  } finally {
    profileSaving.value = false
  }
}

function goToRecoverPassword() {
  router.push({ name: 'change-password', query: { email: auth.user?.email ?? '' } })
}

//Home name
const isEditingName = ref(false)
const editingName = ref('')
const savingName = ref(false)
const removingMemberEmail = ref('')

const currentHome = computed(() =>
  dashboard.homes.find(h => h.id === dashboard.activeHomeId)
)

function selectHome(homeId: string) {
  if (homeId === dashboard.activeHomeId) return
  isEditingName.value = false
  dashboard.activeHomeId = homeId
}

function startEditName() {
  editingName.value = currentHome.value?.name ?? ''
  isEditingName.value = true
}

async function saveName() {
  const nextName = editingName.value.trim()
  if (!nextName || !dashboard.activeHomeId) {
    isEditingName.value = false
    return
  }

  savingName.value = true
  try {
    await dashboard.updateHomeName(dashboard.activeHomeId, nextName)
    showToastMsg('Nombre del hogar actualizado')
    isEditingName.value = false
  } catch (e) {
    showToastMsg('No se pudo actualizar el nombre del hogar', 'error')
    console.error(e)
  } finally {
    savingName.value = false
  }
}

function cancelEditName() {
  isEditingName.value = false
}

//Delete home
const showDeleteModal = ref(false)
const deletingHome = ref(false)

function openDeleteModal() { showDeleteModal.value = true }
function closeDeleteModal() { showDeleteModal.value = false }

async function confirmDeleteHome() {
  const homeId = dashboard.activeHomeId
  if (!homeId) return
  deletingHome.value = true
  try {
    await dashboard.deleteHome(homeId)
    showDeleteModal.value = false
    showToastMsg('Hogar eliminado correctamente', 'success')
    await new Promise(resolve => setTimeout(resolve, 1200))
    if (router.currentRoute.value.path !== '/homes') {
      router.push('/homes')
    }
  } catch (e) {
    if (e instanceof ApiError) {
      showToastMsg(`No se pudo eliminar el hogar (${e.status})`, 'error')
    } else {
      showToastMsg('No se pudo eliminar el hogar', 'error')
    }
  } finally {
    deletingHome.value = false
  }
}

//Add member modal
const showAddMemberModal = ref(false)
const addMemberEmail = ref('')
const addMemberLoading = ref(false)
const addMemberError = ref('')
const showLeaveHomeModal = ref(false)

function openAddMemberModal() {
  addMemberEmail.value = ''
  addMemberError.value = ''
  showAddMemberModal.value = true
}

function closeAddMemberModal() { showAddMemberModal.value = false }
function openLeaveHomeModal() { showLeaveHomeModal.value = true }
function closeLeaveHomeModal() { showLeaveHomeModal.value = false }

async function confirmAddMember() {
  if (!addMemberEmail.value.trim() || !dashboard.activeHomeId) return
  addMemberLoading.value = true
  addMemberError.value = ''
  try {
    await dashboard.addMember(dashboard.activeHomeId, addMemberEmail.value.trim())
    closeAddMemberModal()
    showToastMsg('Miembro añadido correctamente')
  } catch (e: any) {
    if (e?.status === 409) addMemberError.value = 'Este usuario ya es miembro'
    else if (e?.status === 404) addMemberError.value = 'Hogar no encontrado'
    else if (e?.status === 400) addMemberError.value = 'Email inválido'
    else addMemberError.value = 'Error al añadir miembro'
  } finally {
    addMemberLoading.value = false
  }
}

async function confirmRemoveMember(email: string) {
  if (!dashboard.activeHomeId) return
  const targetIsSelf = email.toLowerCase() === normalizedUserEmail.value
  if (!isAdmin.value && !targetIsSelf) {
    showToastMsg('Solo podes eliminarte a vos mismo', 'error')
    return
  }
  removingMemberEmail.value = email
  try {
    await dashboard.removeMember(dashboard.activeHomeId, email)
    closeLeaveHomeModal()
    showToastMsg(targetIsSelf ? 'Saliste del hogar' : 'Miembro eliminado')
    if (targetIsSelf) {
      await new Promise(resolve => setTimeout(resolve, 800))
      if (router.currentRoute.value.path !== '/homes') {
        router.push('/homes')
      }
    }
  } catch (e) {
    showToastMsg('No se pudo eliminar el miembro', 'error')
    console.error(e)
  } finally {
    removingMemberEmail.value = ''
  }
}

//New home modal
const showNewHomeModal = ref(false)
const newHomeName = ref('')
const newHomeLoading = ref(false)

function openNewHomeModal() {
  newHomeName.value = ''
  showNewHomeModal.value = true
}

function closeNewHomeModal() { showNewHomeModal.value = false }

async function confirmCreateHome() {
  if (!newHomeName.value.trim()) return
  newHomeLoading.value = true
  try {
    await dashboard.createHome(newHomeName.value.trim())
    closeNewHomeModal()
    showToastMsg('Hogar creado correctamente')
  } catch (e) {
    showToastMsg('No se pudo crear el hogar', 'error')
    console.error(e)
  } finally {
    newHomeLoading.value = false
  }
}

//Display

const normalizedUserEmail = computed(() => auth.user?.email?.toLowerCase() ?? '')
const isAdmin = computed(() => {
  const email = normalizedUserEmail.value
  if (!email) return false
  return !dashboard.members.some(member => member.email.toLowerCase() === email)
})

const visibleMembers = computed(() => {
  const userEmail = auth.user?.email ?? ''
  const userName = auth.user?.name ?? 'Vos'
  const list = dashboard.members.map(member => ({
    ...member,
    isSelf: member.email.toLowerCase() === normalizedUserEmail.value,
    role: 'Miembro',
  }))

  if (userEmail && !list.some(member => member.email.toLowerCase() === normalizedUserEmail.value)) {
    list.unshift({
      id: auth.user?.id ?? userEmail,
      name: userName,
      email: userEmail,
      isSelf: true,
      role: 'Administrador',
    })
  }

  return list
})

function canRemoveMember(email: string): boolean {
  const targetIsSelf = email.toLowerCase() === normalizedUserEmail.value
  return Boolean(dashboard.activeHomeId && (targetIsSelf ? !isAdmin.value : isAdmin.value))
}

//Lifecycle
watch(() => route.query.passwordChanged, (val) => {
  if (val === '1') {
    showToastMsg('Contraseña actualizada correctamente')
    setTimeout(() => {
      router.replace({ name: 'settings', query: { view: route.query.view } })
    }, 100)
  }
}, { immediate: true })

onMounted(async () => {
  initProfileData()
  await dashboard.loadHomes()
  if (dashboard.activeHomeId) {
    await dashboard.loadMembers(dashboard.activeHomeId)
  }
})

watch(() => dashboard.activeHomeId, async (newId) => {
  if (newId) {
    await dashboard.loadMembers(newId)
  }
})
</script>

<template>
  <div class="settings">
    <div v-if="activeView === 'perfil'" class="hogar-view">
      <div class="hogar__header">
        <div>
          <header class="h-panel__header" style="margin-bottom: 0.75rem;">
            <h1 class="h-panel__title">Configuración</h1>
          </header>
        </div>
      </div>

      <div class="hogar__content">
        <section class="h-panel">
          <header class="h-panel__header">
            <h2 class="h-panel__title">Tu perfil</h2>
            <button
              v-if="hasProfileChanges"
              class="h-panel__btn"
              type="button"
              :disabled="profileSaving"
              @click="saveProfile"
            >
              {{ profileSaving ? 'Guardando...' : 'Guardar' }}
            </button>
          </header>

          <div class="profile-fields">
            <div class="form-group">
              <label class="form-label">Nombre de usuario</label>
              <input v-model="profileData.name" class="form-input" type="text" />
              <span class="form-hint">El nombre que se muestra en el sistema</span>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input v-model="profileData.email" class="form-input" type="email" />
              <span class="form-hint">Tu dirección de correo electrónico</span>
            </div>
          </div>
        </section>

        <aside class="h-panel h-panel--actions">
          <header class="h-panel__header">
            <h2 class="h-panel__title">Seguridad</h2>
          </header>
          <div class="action-list">
            <button class="action-card" type="button" @click="goToRecoverPassword">
              <span class="action-card__icon">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.7" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                  <circle cx="12" cy="16" r="1.2" fill="currentColor" />
                </svg>
              </span>
              <div class="action-card__body">
                <span class="action-card__name">Cambiar contraseña</span>
                <span class="action-card__desc">Actualizá tu contraseña de acceso</span>
              </div>
              <span class="action-card__arrow">›</span>
            </button>
          </div>
        </aside>
      </div>
    </div>

    <div v-if="activeView === 'hogar'" class="hogar-view">
      <div class="hogar__header">
        <div>
          <header class="h-panel__header">
            <h1 class="h-panel__title">Mi Hogar</h1>
          </header>
          <div class="home-tabs">
            <button
              v-for="home in dashboard.homes" :key="home.id"
              type="button"
              class="home-tab"
              :class="{ 'home-tab--active': home.id === dashboard.activeHomeId }"
              @click="selectHome(home.id)"
            >{{ home.name }}</button>
            <button class="home-tab home-tab--icon" type="button" aria-label="Nuevo hogar" @click="openNewHomeModal">+</button>
          </div>
        </div>
      </div>

      <div v-if="currentHome" class="hogar__content">
        <section class="h-panel h-panel--info">
          <header class="h-panel__header">
            <h2 class="h-panel__title">{{ currentHome.name }}</h2>
            <button v-if="!isEditingName" class="h-panel__btn" type="button" @click="startEditName">Renombrar</button>
          </header>

          <div v-if="isEditingName" class="name-edit-row">
            <input
              v-model="editingName"
              type="text"
              class="name-edit-input"
              @keyup.enter="saveName"
              @keyup.escape="cancelEditName"
            />
            <button class="name-edit-save" type="button" :disabled="savingName" @click="saveName">
              {{ savingName ? '...' : 'Guardar' }}
            </button>
            <button class="name-edit-cancel" type="button" @click="cancelEditName">Cancelar</button>
          </div>

          <p class="members-section__label">MIEMBROS</p>
          <div class="members-grid">
            <p v-if="visibleMembers.length === 0" class="members-empty-msg">No hay miembros para mostrar.</p>
            <article v-for="member in visibleMembers" :key="member.id" class="member-card">
              <div class="member-card__avatar" :class="`member-avatar--color-${getMemberColorIndex(member.name)}`">
                {{ getInitials(member.name) }}
              </div>
              <div class="member-card__body">
                <h3>{{ member.name }}<span v-if="member.isSelf" class="member-self"> (vos)</span></h3>
                <p>{{ member.email }}</p>
              </div>
              <span class="member-card__role" :class="{ 'member-card__role--admin': member.role === 'Administrador' }">
                {{ member.role }}
              </span>
              <button
                v-if="canRemoveMember(member.email)"
                class="member-card__remove"
                type="button"
                :disabled="removingMemberEmail === member.email"
                @click="member.isSelf ? openLeaveHomeModal() : confirmRemoveMember(member.email)"
              >
                {{ removingMemberEmail === member.email ? '...' : 'Quitar' }}
              </button>
            </article>
          </div>
        </section>

        <aside class="h-panel h-panel--actions">
          <header class="h-panel__header">
            <h2 class="h-panel__title">Acciones</h2>
          </header>
          <div class="action-list">
            <button
              v-if="isAdmin"
              class="action-card"
              type="button"
              :disabled="!dashboard.activeHomeId"
              @click="openAddMemberModal"
            >
              <span class="action-card__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M19 8v6M16 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </span>
              <div class="action-card__body">
                <span class="action-card__name">Añadir miembro</span>
                <span class="action-card__desc">Invitá a alguien a tu hogar</span>
              </div>
            </button>

            <button
              v-if="!isAdmin && auth.user?.email"
              class="action-card action-card--danger"
              type="button"
              @click="openLeaveHomeModal"
            >
              <span class="action-card__icon action-card__icon--danger">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <polyline points="16 17 21 12 16 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <div class="action-card__body">
                <span class="action-card__name">Salir del hogar</span>
                <span class="action-card__desc">Perdés el acceso a este hogar</span>
              </div>
            </button>

            <button
              v-if="isAdmin"
              class="action-card action-card--danger"
              type="button"
              :disabled="!dashboard.activeHomeId"
              @click="openDeleteModal"
            >
              <span class="action-card__icon action-card__icon--danger">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <div class="action-card__body">
                <span class="action-card__name">Eliminar hogar</span>
                <span class="action-card__desc">{{ currentHome.name }} se eliminará permanentemente</span>
              </div>
            </button>

            <p v-if="!isAdmin" class="action-note">
              Solo el administrador puede eliminar el hogar.
            </p>
          </div>
        </aside>
      </div>

      <div v-else class="h-notice">No hay un hogar seleccionado. Creá uno nuevo con el botón +.</div>
    </div>

    <Teleport to="body">
      <div v-if="showAddMemberModal" class="modal-overlay" @click.self="closeAddMemberModal">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-add-title">
          <div class="modal-header">
            <h2 id="modal-add-title" class="modal-title">Añadir miembro</h2>
            <button class="modal-close" type="button" aria-label="Cerrar" @click="closeAddMemberModal">✕</button>
          </div>
          <p class="modal-desc">Ingresá el email de la persona que querés agregar.</p>

          <div class="form-group">
            <label class="form-label">Email</label>
            <input
              v-model="addMemberEmail"
              class="form-input"
              type="email"
              placeholder="usuario@ejemplo.com"
              @keyup.enter="confirmAddMember"
            />
            <span v-if="addMemberError" class="form-error">{{ addMemberError }}</span>
          </div>

          <div class="modal-actions">
            <button class="cancel-btn cancel-btn--gray" type="button" @click="closeAddMemberModal">Cancelar</button>
            <button
              class="save-btn"
              type="button"
              :disabled="!addMemberEmail.trim() || addMemberLoading"
              @click="confirmAddMember"
            >
              {{ addMemberLoading ? 'Añadiendo...' : 'Añadir' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showLeaveHomeModal" class="modal-overlay" @click.self="closeLeaveHomeModal">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-leave-title">
          <div class="modal-header">
            <h2 id="modal-leave-title" class="modal-title">Salir del hogar</h2>
            <button class="modal-close" type="button" aria-label="Cerrar" @click="closeLeaveHomeModal">✕</button>
          </div>
          <p class="modal-desc">Si te vas, vas a perder el acceso a este hogar.</p>

          <div class="modal-actions">
            <button class="cancel-btn cancel-btn--gray" type="button" @click="closeLeaveHomeModal">Cancelar</button>
            <button
              class="danger-btn danger-btn--confirm"
              type="button"
              :disabled="removingMemberEmail === auth.user?.email"
              @click="confirmRemoveMember(auth.user?.email ?? '')"
            >
              {{ removingMemberEmail === auth.user?.email ? 'Saliendo...' : 'Salir' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
        <div class="modal-content modal-content--danger" role="dialog" aria-modal="true" aria-labelledby="modal-delete-title">
          <div class="modal-header">
            <h2 id="modal-delete-title" class="modal-title">Eliminar "{{ currentHome?.name }}"</h2>
            <button class="modal-close" type="button" aria-label="Cerrar" @click="closeDeleteModal">✕</button>
          </div>
          <p class="modal-desc">Esta acción es permanente e irreversible.</p>

          <div class="delete-warning">
            <p class="delete-warning__title">¿Qué se va a perder?</p>
            <ul class="delete-warning__list">
              <li>Dispositivos vinculados</li>
              <li>Rutinas y automatizaciones</li>
              <li>Acceso de los {{ visibleMembers.length }} miembros</li>
              <li>Historial de actividad</li>
            </ul>
          </div>

          <div class="modal-actions">
            <button class="cancel-btn cancel-btn--gray" type="button" @click="closeDeleteModal">Cancelar</button>
            <button class="danger-btn danger-btn--confirm" type="button" :disabled="deletingHome" @click="confirmDeleteHome">
              {{ deletingHome ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showNewHomeModal" class="modal-overlay" @click.self="closeNewHomeModal">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-home-title">
          <div class="modal-header">
            <h2 id="modal-home-title" class="modal-title">Nuevo hogar</h2>
            <button class="modal-close" type="button" aria-label="Cerrar" @click="closeNewHomeModal">✕</button>
          </div>
          <p class="modal-desc">Ingresá el nombre para tu nuevo hogar.</p>

          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input
              v-model="newHomeName"
              class="form-input"
              type="text"
              placeholder="Mi Casa"
              @keyup.enter="confirmCreateHome"
            />
          </div>

          <div class="modal-actions">
            <button class="cancel-btn cancel-btn--gray" type="button" @click="closeNewHomeModal">Cancelar</button>
            <button
              class="save-btn"
              type="button"
              :disabled="!newHomeName.trim() || newHomeLoading"
              @click="confirmCreateHome"
            >
              {{ newHomeLoading ? 'Creando...' : 'Crear' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showToast" class="toast" :class="`toast--${toastType}`">
        {{ toastMessage }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.settings {
  min-height: calc(100vh - 80px);
  margin: -2rem -2.5rem -3rem;
  padding: 2rem 2.5rem;
}

.settings__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
}

.settings__title {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--color-text);
}

.settings__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  max-width: 640px;
  margin: 0 auto;
}

.settings__column {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(42, 40, 37, 0.5);
  margin-bottom: 0.75rem;
}

.section-label--danger {
  color: #8a2d2d;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-section .section-label {
  margin-bottom: 0.25rem;
}

.card {
  background: #fdf8f3;
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 4px 12px rgba(42, 40, 37, 0.06);
}

.home-switch-card {
  border-radius: 999px;
  background: rgba(42, 40, 37, 0.08);
  padding: 0.35rem;
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.05);
}

.home-picker {
  display: flex;
  gap: 0.55rem;
  overflow-x: auto;
  padding: 0;
  border-radius: 999px;
  background: transparent;
  scrollbar-width: none;
}

.home-picker::-webkit-scrollbar {
  display: none;
}

.home-picker__item {
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  background: rgba(255, 255, 255, 0.72);
  color: rgba(42, 40, 37, 0.74);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.home-picker__item:hover {
  background: rgba(255, 255, 255, 0.95);
  color: rgba(42, 40, 37, 0.95);
}

.home-picker__item--active {
  background: rgba(42, 40, 37, 0.95);
  color: #f7f3e7;
  box-shadow: 0 8px 18px rgba(42, 40, 37, 0.16);
}

.selected-home-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  border-radius: 12px;
  background:
    radial-gradient(circle at 100% 0%, rgba(45, 106, 79, 0.11), transparent 34%),
    rgba(253, 248, 243, 0.82);
  box-shadow:
    0 14px 34px rgba(42, 40, 37, 0.08),
    inset 0 0 0 1px rgba(42, 40, 37, 0.06);
}

.selected-home-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.selected-home-panel__header .section-label {
  margin: 0 0 0.25rem;
}

.selected-home-panel__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.28rem;
  color: var(--color-text);
}

.selected-home-panel__grid {
  display: grid;
  gap: 1.25rem;
}

.selected-home-panel__block {
  border-radius: 10px;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
}

.home-name-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(42, 40, 37, 0.6);
  margin: 0 0 0.5rem;
}

.home-name-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.home-name-display {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.home-name-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(42, 40, 37, 0.15);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  outline: none;
}

.home-name-input:focus {
  border-color: #2d6a4f;
}

.edit-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(42, 40, 37, 0.1);
  background: rgba(255, 255, 255, 0.8);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: rgba(42, 40, 37, 0.7);
  transition: all 0.2s ease;
}

.edit-btn:hover {
  background: #fff;
  border-color: rgba(42, 40, 37, 0.2);
}

.edit-btn svg {
  width: 16px;
  height: 16px;
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
}

.save-btn,
.cancel-btn {
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  margin-top: 0.5rem;
  margin-right: 0.5rem;
}

.save-btn {
  background: #2d6a4f;
  color: #fff;
}

.save-btn:disabled {
  background: rgba(45, 106, 79, 0.5);
  cursor: not-allowed;
}

.cancel-btn {
  background: rgba(42, 40, 37, 0.1);
  color: rgba(42, 40, 37, 0.8);
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(42, 40, 37, 0.08);
}

.members-empty,
.members-permission-note {
  margin: 0;
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.78rem;
  line-height: 1.45;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.member-avatar--color-0 { background-color: #2d6a4f; }
.member-avatar--color-1 { background-color: #8b4513; }
.member-avatar--color-2 { background-color: #4a4a8a; }
.member-avatar--color-3 { background-color: #8b0000; }
.member-avatar--color-4 { background-color: #2f4f4f; }
.member-avatar--color-5 { background-color: #8b008b; }
.member-avatar--color-6 { background-color: #006400; }
.member-avatar--color-7 { background-color: #b8860b; }
.member-avatar--color-8 { background-color: #483d8b; }
.member-avatar--color-9 { background-color: #556b2f; }

.member-info {
  flex: 1;
  min-width: 0;
}

.member-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.member-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-self {
  color: rgba(42, 40, 37, 0.5);
  font-weight: 500;
}

.member-role {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 0.18rem 0.48rem;
  background: rgba(42, 40, 37, 0.08);
  color: rgba(42, 40, 37, 0.62);
  font-size: 0.68rem;
  font-weight: 700;
}

.member-role--admin {
  background: rgba(45, 106, 79, 0.12);
  color: #2d6a4f;
}

.member-email {
  font-size: 0.75rem;
  color: rgba(42, 40, 37, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-remove-btn {
  flex-shrink: 0;
  border: 1px solid rgba(138, 45, 45, 0.25);
  border-radius: 999px;
  background: rgba(138, 45, 45, 0.05);
  color: #8a2d2d;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.35rem 0.65rem;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.member-remove-btn:hover:not(:disabled) {
  background: rgba(138, 45, 45, 0.11);
  border-color: rgba(138, 45, 45, 0.42);
}

.member-remove-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.add-member-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px dashed rgba(42, 40, 37, 0.15);
  background: transparent;
  color: rgba(42, 40, 37, 0.7);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-member-btn:hover {
  border-color: #2d6a4f;
  color: #2d6a4f;
  background: rgba(45, 106, 79, 0.05);
}

.add-member-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.add-member-btn svg {
  width: 18px;
  height: 18px;
}

.form-group {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(42, 40, 37, 0.8);
  margin-bottom: 0.4rem;
}

.form-input {
  width: 100%;
  padding: 0.65rem 0.8rem;
  background: #fffcf5;
  border: 1px solid rgba(42, 40, 37, 0.15);
  border-radius: 10px;
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #2d6a4f;
}

.form-hint {
  display: block;
  font-size: 0.7rem;
  color: rgba(42, 40, 37, 0.5);
  margin-top: 0.35rem;
}

.form-error {
  display: block;
  font-size: 0.7rem;
  color: #8a2d2d;
  margin-top: 0.35rem;
}

.profile-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-actions {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(42, 40, 37, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.profile-actions .save-btn {
  width: 100%;
  padding: 0.7rem;
  border-radius: 10px;
  border: none;
  background: #2d6a4f;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0;
}

.profile-actions .save-btn:disabled {
  background: rgba(45, 106, 79, 0.5);
  cursor: not-allowed;
}

.change-password-btn {
  width: 100%;
  padding: 0.7rem;
  border-radius: 10px;
  border: 1px solid rgba(45, 106, 79, 0.35);
  background: rgba(45, 106, 79, 0.08);
  color: #2d6a4f;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.change-password-btn:hover {
  background: rgba(45, 106, 79, 0.14);
  border-color: rgba(45, 106, 79, 0.55);
}

.change-password-btn svg {
  width: 24px;
  height: 24px;
}

.create-home-row {
  display: flex;
  justify-content: flex-end;
}

.create-home-btn--primary {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0 1.35rem;
  height: 50px;
  border-radius: 12px;
  border: none;
  background: var(--color-brown, #674531);
  color: #fff;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 8px 20px rgba(103, 69, 49, 0.22);
}

.create-home-btn--primary:hover {
  background: #7a5240;
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(103, 69, 49, 0.28);
}

.create-home-btn__icon {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
}

.create-home-btn__icon svg {
  width: 20px;
  height: 20px;
}

.create-home-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px dashed rgba(45, 106, 79, 0.26);
  background: rgba(253, 248, 243, 0.68);
}

.create-home-card__title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.create-home-card__desc {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: rgba(42, 40, 37, 0.62);
}

.danger-note {
  font-size: 0.8rem;
  color: rgba(42, 40, 37, 0.6);
  margin: 0;
}

.danger-section {
  display: grid;
  gap: 0.9rem;
  padding: 1.25rem;
  border: 1px solid rgba(138, 45, 45, 0.18);
  border-radius: 12px;
  background: rgba(138, 45, 45, 0.04);
}

.danger-section .section-label {
  margin-bottom: 0.35rem;
}

.danger-section__title {
  margin: 0 0 0.35rem;
  color: #8a2d2d;
  font-size: 1rem;
  font-weight: 700;
}

.danger-section__desc {
  margin: 0;
  color: rgba(42, 40, 37, 0.62);
  font-size: 0.82rem;
  line-height: 1.45;
}

.danger-btn {
  padding: 0.6rem 1rem;
  border-radius: 8px;
  border: 1px solid #8a2d2d;
  background: transparent;
  color: #8a2d2d;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.danger-btn:hover {
  background: #8a2d2d;
  color: #fff;
}

.danger-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.danger-btn--secondary {
  border-color: rgba(138, 45, 45, 0.32);
  background: #fff;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(42, 40, 37, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1.5rem;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

@supports not (backdrop-filter: blur(1px)) {
  .modal-overlay {
    background: rgba(42, 40, 37, 0.72);
  }
}

.modal-content {
  background: #fff;
  border-radius: 24px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 32px 64px rgba(42, 40, 37, 0.22);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.modal-close {
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
  flex-shrink: 0;
  transition: background 0.15s;
}

.modal-close:hover {
  background: rgba(42, 40, 37, 0.15);
}

.modal-title {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  font-weight: 300;
  margin-bottom: 0;
  color: var(--color-text);
}

.modal-content--danger .modal-title {
  color: #8a2d2d;
}

.modal-desc {
  font-size: 0.88rem;
  color: rgba(42, 40, 37, 0.65);
  margin: 0;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0;
}

.modal-actions .save-btn,
.modal-actions .cancel-btn,
.modal-actions .danger-btn,
.cancel-btn--gray {
  margin: 0;
  height: 50px;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--font-sans, inherit);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.2s, box-shadow 0.2s;
}

.modal-actions .save-btn {
  border: none;
  background: var(--color-brown, #674531);
  color: #fff;
}

.modal-actions .save-btn:hover:not(:disabled) {
  background: #7a5240;
  box-shadow: 0 8px 24px rgba(122, 82, 64, 0.2);
  transform: translateY(-1px);
}

.modal-actions .save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-actions .cancel-btn,
.cancel-btn--gray {
  border: 1px solid rgba(42, 40, 37, 0.2);
  color: rgba(42, 40, 37, 0.8);
  background: #fff;
}

.modal-actions .cancel-btn:hover:not(:disabled),
.cancel-btn--gray:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.06);
  transform: translateY(-1px);
}

.cancel-btn--gray {
  border-radius: 999px;
}

.danger-btn--confirm {
  border: none;
  background: #b54444;
  color: #fff;
}

.danger-btn--confirm:hover:not(:disabled) {
  background: #992f2f;
  box-shadow: 0 8px 24px rgba(153, 47, 47, 0.2);
  transform: translateY(-1px);
}

.modal-actions .cancel-btn:disabled,
.modal-actions .save-btn:disabled,
.cancel-btn--gray:disabled,
.danger-btn--confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 12px;
  padding: 1rem;
}

.delete-warning__title {
  font-weight: 700;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  color: #856404;
}

.delete-warning__list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: #856404;
}

.delete-warning__list li {
  margin-bottom: 0.25rem;
}

.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.85rem;
  z-index: 200;
  animation: toast-in 0.3s ease;
}

.toast--success {
  background: #2d6a4f;
  box-shadow: 0 4px 15px rgba(45, 106, 79, 0.3);
}

.toast--error {
  background: #8a2d2d;
  box-shadow: 0 4px 15px rgba(138, 45, 45, 0.3);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (max-width: 768px) {
  .settings {
    padding: 1.5rem;
  }

  .settings__header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .settings__grid {
    max-width: 100%;
  }

  .selected-home-panel,
  .danger-section {
    padding: 1rem;
  }

  .home-name-input-wrapper,
  .edit-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .edit-actions .save-btn,
  .edit-actions .cancel-btn {
    width: 100%;
    margin: 0;
  }

  .member-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .member-info {
    flex-basis: calc(100% - 52px);
  }

  .member-title-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
  }

  .member-remove-btn {
    margin-left: 52px;
  }
}

/* ── Hogar view (HomesPage-style layout) ── */

.hogar-view {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.hogar__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.home-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.6rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  background: #9e9b8e;
  border-radius: 999px;
  padding: 0.45rem 0.7rem;
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.08);
  scrollbar-width: none;
}

.home-tabs::-webkit-scrollbar { display: none; }

.home-tab {
  border: none;
  background: rgba(255, 255, 255, 0.65);
  color: rgba(42, 40, 37, 0.8);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  font-family: inherit;
}

.home-tab:hover { background: rgba(255, 255, 255, 0.85); color: rgba(42, 40, 37, 0.95); }
.home-tab--active { background: rgba(42, 40, 37, 0.95); color: #f7f3e7; }

.home-tab--icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  line-height: 1;
}

.hogar__content {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 0.9fr);
  gap: 1.8rem;
}

.h-panel {
  background: rgba(244, 244, 244, 0.7);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 20px 40px rgba(42, 40, 37, 0.08);
}

.h-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
}

.h-panel__title {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  font-weight: 600;
}

.h-panel__btn {
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

.h-panel__btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

.name-edit-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 1.2rem;
  padding: 0.6rem 0.85rem;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  border: 1.5px solid var(--color-sage, #bebea6);
}

.name-edit-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  outline: none;
  color: var(--color-text);
  min-width: 0;
}

.name-edit-save {
  flex-shrink: 0;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  background: var(--color-brown, #674531);
  color: #fff;
  transition: background 0.2s ease;
}

.name-edit-save:disabled { opacity: 0.5; cursor: not-allowed; }

.name-edit-cancel {
  flex-shrink: 0;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  background: rgba(42, 40, 37, 0.1);
  color: rgba(42, 40, 37, 0.8);
}

.members-section__label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(42, 40, 37, 0.5);
  margin-bottom: 0.75rem;
}

.members-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.members-empty-msg {
  color: rgba(42, 40, 37, 0.55);
  font-size: 0.85rem;
}

.member-card {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 16px;
  padding: 0.9rem;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 0.75rem;
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
}

.member-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.member-card__body { min-width: 0; }

.member-card__body h3 {
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.2rem;
}

.member-card__body p {
  font-size: 0.78rem;
  color: rgba(42, 40, 37, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-card__role {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 0.18rem 0.48rem;
  background: rgba(42, 40, 37, 0.08);
  color: rgba(42, 40, 37, 0.62);
  font-size: 0.68rem;
  font-weight: 700;
}

.member-card__role--admin {
  background: rgba(45, 106, 79, 0.12);
  color: #2d6a4f;
}

.member-card__remove {
  flex-shrink: 0;
  border: 1px solid rgba(138, 45, 45, 0.25);
  border-radius: 999px;
  background: rgba(138, 45, 45, 0.05);
  color: #8a2d2d;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.3rem 0.6rem;
  transition: background 0.2s ease;
}

.member-card__remove:hover:not(:disabled) { background: rgba(138, 45, 45, 0.11); }
.member-card__remove:disabled { opacity: 0.6; cursor: not-allowed; }

.action-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-card {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 16px;
  padding: 0.9rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.8rem;
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.06);
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  width: 100%;
  transition: transform 0.15s, box-shadow 0.15s;
}

.action-card:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(42, 40, 37, 0.12);
}

.action-card--danger {
  background: rgba(138, 45, 45, 0.05);
  box-shadow: inset 0 0 0 1px rgba(138, 45, 45, 0.1);
}

.action-card--danger:hover:not(:disabled) {
  box-shadow: 0 8px 24px rgba(138, 45, 45, 0.1);
}

.action-card:disabled { opacity: 0.5; cursor: not-allowed; }

.action-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(190, 190, 166, 0.45);
  color: rgba(42, 40, 37, 0.85);
  flex-shrink: 0;
}

.action-card__icon--danger {
  background: rgba(138, 45, 45, 0.08);
  color: #8a2d2d;
}

.action-card__icon svg { width: 22px; height: 22px; }

.action-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.action-card__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(42, 40, 37, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-card--danger .action-card__name { color: #8a2d2d; }

.action-card__desc {
  font-size: 0.78rem;
  color: rgba(42, 40, 37, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-card--danger .action-card__desc { color: rgba(138, 45, 45, 0.65); }

.action-card__arrow {
  font-size: 1.2rem;
  color: rgba(42, 40, 37, 0.55);
}

.action-card--danger .action-card__arrow { color: rgba(138, 45, 45, 0.55); }

.action-note {
  font-size: 0.78rem;
  color: rgba(42, 40, 37, 0.55);
  padding: 0 0.25rem;
}

.h-notice {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 16px;
  padding: 0.8rem 1rem;
  font-weight: 600;
  color: rgba(42, 40, 37, 0.7);
  box-shadow: inset 0 0 0 1px rgba(42, 40, 37, 0.08);
}

@media (max-width: 1024px) {
  .hogar__content { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .h-panel { padding: 1.1rem; }
  .member-card { grid-template-columns: auto 1fr auto; }
  .member-card__role { display: none; }
  .name-edit-row { flex-wrap: wrap; }
  .name-edit-save, .name-edit-cancel { flex: 1; text-align: center; }
}
</style>
