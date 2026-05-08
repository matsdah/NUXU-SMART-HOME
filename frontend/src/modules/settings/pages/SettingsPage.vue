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
  router.push('/recover')
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
    <header class="settings__header">
      <h1 class="settings__title">{{ pageTitle }}</h1>
    </header>

    <div class="settings__grid">
      <div v-if="activeView === 'perfil'" class="settings__column settings__column--profile">
        <section class="config-section">
          <p class="section-label">TU PERFIL</p>

          <div class="card">
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

            <div class="profile-actions">
              <button
                class="save-btn"
                type="button"
                :disabled="!canSaveProfile"
                @click="saveProfile"
              >
                {{ profileSaving ? 'Guardando...' : 'Guardar' }}
              </button>
              <button class="change-password-btn" type="button" @click="goToRecoverPassword">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.4 7.4A8 8 0 0 1 18.6 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M18.6 8V5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M18.6 8h-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M17.6 16.6A8 8 0 0 1 5.4 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M5.4 16v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M5.4 16h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  <rect x="9" y="11" width="6" height="6" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.7" />
                  <path d="M10.8 11V9.8a1.2 1.2 0 1 1 2.4 0V11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                </svg>
                <span>Cambiar Contraseña</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div v-if="activeView === 'hogar'" class="settings__column settings__column--home">
        <button class="create-home-btn create-home-btn--top" type="button" @click="openNewHomeModal">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          Crear hogar
        </button>

        <section class="config-section">
          <p id="home-picker-label" class="section-label">HOGAR ACTIVO</p>
          <div class="home-switch-card">
            <div class="home-picker" role="group" aria-labelledby="home-picker-label">
              <button
                v-for="home in dashboard.homes"
                :key="home.id"
                class="home-picker__item"
                :class="{ 'home-picker__item--active': home.id === dashboard.activeHomeId }"
                type="button"
                @click="selectHome(home.id)"
              >
                {{ home.name }}
              </button>
            </div>
          </div>
        </section>

        <section class="selected-home-panel">
          <div class="selected-home-panel__header">
            <div>
              <p class="section-label">HOGAR SELECCIONADO</p>
              <h2 class="selected-home-panel__title">{{ currentHome?.name ?? 'Sin hogar seleccionado' }}</h2>
            </div>
          </div>

          <div class="selected-home-panel__grid">
            <div class="selected-home-panel__block selected-home-panel__block--name">
              <label class="home-name-label">Nombre</label>
              <div class="home-name-input-wrapper">
                <input
                  v-if="isEditingName"
                  v-model="editingName"
                  type="text"
                  class="home-name-input"
                  @keyup.enter="saveName"
                  @keyup.escape="cancelEditName"
                />
                <span v-else class="home-name-display">{{ currentHome?.name }}</span>
                <button
                  v-if="!isEditingName"
                  class="edit-btn"
                  type="button"
                  aria-label="Editar nombre"
                  @click="startEditName"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <div v-else class="edit-actions">
                  <button class="save-btn" type="button" :disabled="savingName" @click="saveName">
                    {{ savingName ? 'Guardando...' : 'Guardar' }}
                  </button>
                  <button class="cancel-btn" type="button" @click="cancelEditName">Cancelar</button>
                </div>
              </div>
            </div>

            <div class="selected-home-panel__block selected-home-panel__block--members">
              <p class="home-name-label">Miembros</p>

              <div class="members-list">
                <p v-if="visibleMembers.length === 0" class="members-empty">
                  No hay miembros para mostrar.
                </p>
                <article
                  v-for="member in visibleMembers"
                  :key="member.id"
                  class="member-row"
                >
                  <div
                    class="member-avatar"
                    :class="`member-avatar--color-${getMemberColorIndex(member.name)}`"
                  >
                    {{ getInitials(member.name) }}
                  </div>
                  <div class="member-info">
                    <div class="member-title-row">
                      <h3 class="member-name">
                        {{ member.name }}
                        <span v-if="member.isSelf" class="member-self">(vos)</span>
                      </h3>
                      <span class="member-role" :class="{ 'member-role--admin': member.role === 'Administrador' }">
                        {{ member.role }}
                      </span>
                    </div>
                    <p class="member-email">{{ member.email }}</p>
                  </div>
                  <button
                    v-if="canRemoveMember(member.email)"
                    class="member-remove-btn"
                    type="button"
                    :disabled="removingMemberEmail === member.email"
                    @click="member.isSelf ? openLeaveHomeModal() : confirmRemoveMember(member.email)"
                  >
                    {{ removingMemberEmail === member.email ? 'Quitando...' : 'Quitar' }}
                  </button>
                </article>
              </div>

              <button
                v-if="isAdmin"
                class="add-member-btn"
                type="button"
                :disabled="!dashboard.activeHomeId"
                @click="openAddMemberModal"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                Añadir miembro
              </button>
              <p v-else class="members-permission-note">
                Solo el administrador puede añadir o quitar otros miembros.
              </p>
            </div>
          </div>

          <section class="danger-section">
            <div>
              <p class="section-label section-label--danger">ZONA DE PELIGRO</p>
              <h2 class="danger-section__title">Acciones irreversibles</h2>
              <p class="danger-section__desc">
                Estas acciones aplican a {{ currentHome?.name ?? 'este hogar' }}.
              </p>
            </div>

            <button
              v-if="!isAdmin && auth.user?.email"
              class="danger-btn danger-btn--secondary"
              type="button"
              @click="openLeaveHomeModal"
            >
              Salir del hogar
            </button>

            <button
              v-if="isAdmin"
              class="danger-btn"
              type="button"
              :disabled="!dashboard.activeHomeId"
              @click="openDeleteModal"
            >
              Eliminar {{ currentHome?.name ?? 'hogar' }}
            </button>
            <p v-else class="danger-note">
              Solo el administrador puede eliminar el hogar.
            </p>
          </section>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showAddMemberModal" class="modal-overlay" @click.self="closeAddMemberModal">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-add-title">
          <h2 id="modal-add-title" class="modal-title">Añadir Miembro</h2>
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
          <h2 id="modal-leave-title" class="modal-title">Salir del hogar</h2>
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
          <h2 id="modal-delete-title" class="modal-title">Eliminar "{{ currentHome?.name }}"</h2>
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
          <h2 id="modal-home-title" class="modal-title">Nuevo Hogar</h2>
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
  padding: 1rem 2.5rem;
  background: var(--color-bg);
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
  font-size: 1.6rem;
  font-weight: 700;
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

.create-home-btn {
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

.create-home-btn--top {
  background: rgba(45, 106, 79, 0.1);
  border-color: rgba(45, 106, 79, 0.35);
  color: #2d6a4f;
  border-style: solid;
  border-radius: 999px;
  padding: 0.8rem 1rem;
}

.create-home-btn:hover {
  border-color: #2d6a4f;
  color: #2d6a4f;
  background: rgba(45, 106, 79, 0.05);
}

.create-home-btn svg {
  width: 18px;
  height: 18px;
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
  background: rgba(42, 40, 37, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

@supports not (backdrop-filter: blur(1px)) {
  .modal-overlay {
    background: rgba(42, 40, 37, 0.72);
  }
}

.modal-content {
  background: #fff;
  border-radius: 20px;
  padding: 1.75rem;
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(42, 40, 37, 0.25);
}

.modal-title {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
  color: var(--color-text);
}

.modal-content--danger .modal-title {
  color: #8a2d2d;
}

.modal-desc {
  font-size: 0.9rem;
  color: rgba(42, 40, 37, 0.7);
  margin-bottom: 1.25rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.modal-actions .save-btn,
.modal-actions .cancel-btn,
.modal-actions .danger-btn {
  margin: 0;
}

.cancel-btn--gray {
  background: rgba(42, 40, 37, 0.1);
  color: rgba(42, 40, 37, 0.8);
}

.danger-btn--confirm {
  background: #8a2d2d;
  color: #fff;
  border-color: #8a2d2d;
}

.danger-btn--confirm:hover {
  background: #a33;
  border-color: #a33;
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
</style>
