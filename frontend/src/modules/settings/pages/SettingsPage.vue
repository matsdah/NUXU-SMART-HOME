<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useAuthStore } from '@/app/stores/auth'
import { ApiError } from '@/services/api/client'

const router = useRouter()
const dashboard = useDashboardStore()
const auth = useAuthStore()

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

const MEMBER_COLORS = [
  '#2d6a4f', '#8b4513', '#4a4a8a', '#8b0000', '#2f4f4f',
  '#8b008b', '#006400', '#b8860b', '#483d8b', '#556b2f',
]

function getMemberColor(name: string): string {
  return MEMBER_COLORS[name.charCodeAt(0) % MEMBER_COLORS.length] ?? '#2d6a4f'
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

const currentHome = computed(() =>
  dashboard.homes.find(h => h.id === dashboard.activeHomeId)
)

function startEditName() {
  editingName.value = currentHome.value?.name ?? ''
  isEditingName.value = true
}

async function saveName() {
  if (editingName.value.trim() && dashboard.activeHomeId) {
    savingName.value = true
    await dashboard.updateHomeName(dashboard.activeHomeId, editingName.value.trim())
    savingName.value = false
  }
  isEditingName.value = false
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

function openAddMemberModal() {
  addMemberEmail.value = ''
  addMemberError.value = ''
  showAddMemberModal.value = true
}

function closeAddMemberModal() { showAddMemberModal.value = false }

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
  try {
    await dashboard.removeMember(dashboard.activeHomeId, email)
    showToastMsg('Miembro eliminado')
  } catch (e) {
    console.error(e)
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
    console.error(e)
  } finally {
    newHomeLoading.value = false
  }
}

//Display

const displayName = computed(() => auth.user?.name ?? 'Invitado')
const initials = computed(() => getInitials(displayName.value))

//Lifecycle 
onMounted(async () => {
  initProfileData()
  if (dashboard.homes.length === 0) {
    await dashboard.loadDashboard()
  }
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
      <h1 class="settings__title">Configuración</h1>
    </header>

    <div class="settings__grid">
      <div class="settings__column settings__column--profile">
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

      <div class="settings__column settings__column--home">
        <section class="config-section">
          <p class="section-label">TU HOGAR</p>

          <div class="card">
            <label class="home-name-label">Nombre del hogar</label>
            <div class="home-name-input-wrapper">
              <input
                v-if="isEditingName"
                v-model="editingName"
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
        </section>

        <button class="create-home-btn" type="button" @click="openNewHomeModal">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          Crear Nuevo Hogar
        </button>

        <section class="config-section">
          <p class="section-label">MIEMBROS DEL HOGAR</p>

          <div class="card">
            <div class="members-list">
              <article
                v-for="member in dashboard.members"
                :key="member.id"
                class="member-row"
              >
                <div
                  class="member-avatar"
                  :style="{ backgroundColor: getMemberColor(member.name) }"
                >
                  {{ getInitials(member.name) }}
                </div>
                <div class="member-info">
                  <h3 class="member-name">{{ member.name }}</h3>
                  <p class="member-email">{{ member.email }}</p>
                </div>
                <button
                  class="remove-member-btn"
                  type="button"
                  :aria-label="`Eliminar a ${member.name}`"
                  :title="`Eliminar a ${member.name}`"
                  @click="confirmRemoveMember(member.email)"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </article>
            </div>

            <button class="add-member-btn" type="button" @click="openAddMemberModal">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              Añadir Miembro
            </button>
          </div>
        </section>

        <section class="config-section config-section--danger">
          <p class="section-label">ZONA DE PELIGRO</p>

          <div class="card danger-card">
            <h2 class="danger-title">Eliminar Hogar</h2>
            <p class="danger-desc">
              Al eliminar este hogar, se borrarán todas las habitaciones, dispositivos y rutinas asociadas. Esta acción no se puede deshacer.
            </p>
            <button class="danger-btn" type="button" :disabled="!dashboard.activeHomeId" @click="openDeleteModal">
              Eliminar Hogar
            </button>
          </div>
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

      <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
        <div class="modal-content modal-content--danger" role="dialog" aria-modal="true" aria-labelledby="modal-delete-title">
          <h2 id="modal-delete-title" class="modal-title">Eliminar "{{ currentHome?.name }}"</h2>
          <p class="modal-desc">Esta acción es permanente e irreversible.</p>

          <div class="delete-warning">
            <p class="delete-warning__title">¿Qué se va a perder?</p>
            <ul class="delete-warning__list">
              <li>Dispositivos vinculados</li>
              <li>Rutinas y automatizaciones</li>
              <li>Acceso de los {{ dashboard.members.length }} miembros</li>
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
}

.settings__title {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-text);
}

.settings__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
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

.home-name-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(42, 40, 37, 0.6);
  margin-bottom: 0.5rem;
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

.member-info {
  flex: 1;
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

.member-email {
  font-size: 0.75rem;
  color: rgba(42, 40, 37, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.add-member-btn svg {
  width: 18px;
  height: 18px;
}

.remove-member-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(42, 40, 37, 0.08);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: rgba(42, 40, 37, 0.5);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.remove-member-btn:hover {
  background: rgba(138, 45, 45, 0.15);
  color: #8a2d2d;
}

.remove-member-btn svg {
  width: 14px;
  height: 14px;
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

.create-home-btn:hover {
  border-color: #2d6a4f;
  color: #2d6a4f;
  background: rgba(45, 106, 79, 0.05);
}

.create-home-btn svg {
  width: 18px;
  height: 18px;
}

.config-section--danger .section-label {
  color: #8a2d2d;
}

.danger-card {
  background: #eeebe5;
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 4px 12px rgba(42, 40, 37, 0.06);
  border: 1px solid rgba(138, 45, 45, 0.15);
}

.danger-title {
  font-size: 1rem;
  font-weight: 700;
  color: #8a2d2d;
  margin-bottom: 0.5rem;
}

.danger-desc {
  font-size: 0.8rem;
  color: rgba(42, 40, 37, 0.6);
  margin-bottom: 1rem;
  line-height: 1.4;
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

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(42, 40, 37, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
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
    grid-template-columns: 1fr;
  }
}
</style>
