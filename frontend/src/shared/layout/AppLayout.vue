<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'
import { useDashboardStore } from '@/app/stores/dashboard'
import { useSocketStore } from '@/app/stores/socket'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const socket = useSocketStore()
const router = useRouter()

const navItems = [
  { label: 'Home', to: '/homes', icon: 'home' },
  { label: 'Dispositivos', to: '/devices', icon: 'devices' },
  { label: 'Rutinas', to: '/routines', icon: 'routines' },
  { label: 'Historial', to: '/logs', icon: 'logs' },
]

// Lógica del menú de casas
const isHomeMenuOpen = ref(false)
const homeSelectorRef = ref<HTMLElement | null>(null)

// Lógica del menú de usuario
const isUserMenuOpen = ref(false)
const userChipRef = ref<HTMLElement | null>(null)
const showLogoutConfirm = ref(false)
const loggingOut = ref(false)

function closeMenuOnClickOutside(event: MouseEvent) {
  if (isHomeMenuOpen.value && homeSelectorRef.value && !homeSelectorRef.value.contains(event.target as Node)) {
    isHomeMenuOpen.value = false
  }
  if (isUserMenuOpen.value && userChipRef.value && !userChipRef.value.contains(event.target as Node)) {
    isUserMenuOpen.value = false
  }
}

function navigateToSettings(view?: string) {
  isUserMenuOpen.value = false
  router.push({ path: '/settings', query: view ? { view } : {} })
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showLogoutConfirm.value && !loggingOut.value) {
    showLogoutConfirm.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeMenuOnClickOutside)
  document.addEventListener('keydown', onKeyDown)
  socket.connect()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenuOnClickOutside)
  document.removeEventListener('keydown', onKeyDown)
  socket.disconnect()
})
const activeHomeName = computed(() => {
  const home = dashboard.homes.find(h => h.id === dashboard.activeHomeId)
  return home ? home.name : 'Cargando...'
})

function selectHome(homeId: string) {
  dashboard.activeHomeId = homeId
  isHomeMenuOpen.value = false /* Cerramos el menú tras seleccionar */
}

/* Lógica de usuario */
const displayName = computed(() => auth.user?.name ?? 'Invitado')
const initials = computed(() => {
  const parts = displayName.value.split(' ').filter(Boolean)
  if(parts.length === 0){
    return 'NN'
  }
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase()
})

function requestLogout() {
  isUserMenuOpen.value = false
  showLogoutConfirm.value = true
}

function closeLogoutConfirm() {
  if (!loggingOut.value) {
    showLogoutConfirm.value = false
  }
}

async function confirmLogout() {
  if (loggingOut.value) {
    return
  }

  loggingOut.value = true
  try {
    socket.disconnect()
    await auth.logout()
    showLogoutConfirm.value = false
    router.push({ name: 'login' })
  } finally {
    loggingOut.value = false
  }
}

function onLogoutOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    closeLogoutConfirm()
  }
}

</script>

<template>
  <div class="app-shell">
    <a href="#app-main" class="skip-link">Saltar al contenido principal</a>
    <header class="topbar">
      <div class="brand">
        <img src="@/assets/lamp.webp" alt="NUXU" class="brand__logo" />
        <span class="brand__name">NUXU</span>
      </div>

      <div class="home-selector" ref="homeSelectorRef">
        <button 
          class="home-switch" 
          type="button" 
          aria-label="Cambiar hogar"
          :aria-expanded="isHomeMenuOpen"
          @click="isHomeMenuOpen = !isHomeMenuOpen"
        >
          <span class="home-switch__icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12l8-7 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M7 11v7h10v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="home-switch__label">{{ activeHomeName }}</span>
          <span class="home-switch__chev">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>

        <Transition name="fade-slide">
          <div v-if="isHomeMenuOpen" class="home-dropdown">
            <button
              v-for="home in dashboard.homes" :key="home.id"
              type="button"
              class="home-dropdown__item" :class="{ 'home-dropdown__item--active': home.id === dashboard.activeHomeId }"
              @click="selectHome(home.id)"
              >
              {{ home.name }}
            </button>
          </div>
        </Transition>
      </div>

      <nav class="topbar__nav" aria-label="Navegacion principal">
        <RouterLink
          v-for="item in navItems" :key="item.to" :to="item.to"
          class="nav-pill"
        >
          <span class="nav-pill__icon" aria-hidden="true">
            <svg v-if="item.icon === 'home'" viewBox="0 0 24 24">
              <path d="M4 12l8-7 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M7 11v7h10v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="item.icon === 'devices'" viewBox="0 0 24 24">
              <rect x="5" y="4" width="6" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="2" />
              <rect x="14" y="7" width="5" height="10" rx="1.2" fill="none" stroke="currentColor" stroke-width="2" />
              <circle cx="8" cy="17" r="0.8" fill="currentColor" />
            </svg>
            <svg v-else-if="item.icon === 'routines'" viewBox="0 0 24 24">
              <path d="M7 6h10M7 12h10M7 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              <circle cx="4" cy="6" r="1.5" fill="currentColor" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" />
              <circle cx="4" cy="18" r="1.5" fill="currentColor" />
            </svg>
            <svg v-else viewBox="0 0 24 24">
              <path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="topbar__actions">
        <div class="user-selector" ref="userChipRef">
          <button
            class="user-chip"
            type="button"
            :aria-expanded="isUserMenuOpen"
            aria-label="Abrir menú de usuario"
            @click="isUserMenuOpen = !isUserMenuOpen"
          >
            <span class="user-chip__avatar" aria-hidden="true">{{ initials }}</span>
            <span class="user-chip__name">{{ displayName }}</span>
            <span class="user-chip__chev" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </button>

          <Transition name="fade-slide">
            <div v-if="isUserMenuOpen" class="user-dropdown">
              <button class="user-dropdown__item" type="button" @click="navigateToSettings()">
                <svg class="user-dropdown__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
                Configuración
              </button>
              <button class="user-dropdown__item" type="button" @click="navigateToSettings('hogar')">
                <svg class="user-dropdown__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12l8-7 8 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M7 11v7h10v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Mi hogar
              </button>
            </div>
          </Transition>
        </div>
        <button class="ghost-btn" type="button" @click="requestLogout">Salir</button>
      </div>
    </header>

    <main class="app-main" id="app-main">
      <RouterView />
    </main>

    <Teleport to="body">
      <div v-if="showLogoutConfirm" class="logout-overlay" @click="onLogoutOverlayClick">
        <div class="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div class="logout-modal__header">
            <h2 id="logout-title" class="logout-modal__title">Cerrar sesión</h2>
            <button
              class="logout-modal__close"
              type="button"
              :disabled="loggingOut"
              aria-label="Cerrar"
              @click="closeLogoutConfirm"
            >
              ✕
            </button>
          </div>

          <p class="logout-modal__message">
            ¿Estás seguro de que querés cerrar sesión?
          </p>

          <div class="logout-modal__actions">
            <button
              type="button"
              class="logout-modal__cancel"
              :disabled="loggingOut"
              @click="closeLogoutConfirm"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="logout-modal__confirm"
              :disabled="loggingOut"
              @click="confirmLogout"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at 20% -20%, rgba(255, 255, 255, 0.6), transparent 50%),
    linear-gradient(180deg, rgba(224, 215, 194, 0.92) 0%, rgba(224, 215, 194, 0.75) 45%, rgba(224, 215, 194, 0.92) 100%);
}

.topbar {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 1.5rem;
  padding: 1.1rem 2rem;
  background: rgba(223, 221, 200, 0.85);
  border-bottom: 1px solid rgba(42, 40, 37, 0.08);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  height: 3.5rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.1rem;
  text-decoration: none;
  background-color: #9E9B8E;
  padding: 0.0rem 0.8rem 1.5rem 0.5rem;
  border-radius: 16px 16px 16px 16px;
  flex-shrink: 0;
}

.brand__logo {
  width: 38px;
  height: 65px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.10));
  flex-shrink: 0;
  display: block;
}

.brand__name {
  font-size: 1.3rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--color-text);
  line-height: 1;
  margin-bottom: -1.5rem;
}

.home-selector {
  position: relative;
  display: inline-flex;
}

.home-switch {
  position: relative;
  z-index: 11;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.65rem 0.35rem 0.35rem;
  border-radius: 999px;
  border: 1px solid rgba(42, 40, 37, 0.12);
  background: rgba(255, 255, 255, 0.65);
  color: var(--color-text, rgba(42, 40, 37, 1));
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 8px 16px rgba(42, 40, 37, 0.08);
  cursor: pointer;
  transition: background 0.2s ease;
}

.home-switch:hover {
  background: rgba(255, 255, 255, 0.9);
}

.home-switch__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
}

.home-switch__icon svg {
  width: 20px;
  height: 20px;
}

.home-switch__chev {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  opacity: 0.5;
  transition: transform 0.2s ease;
}

.home-switch__chev svg {
  width: 14px;
  height: 14px;
}

.home-switch[aria-expanded="true"] .home-switch__chev {
  transform: rotate(180deg);
}

.home-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  min-width: 220px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(42, 40, 37, 0.1);
  border-radius: 16px;
  padding: 0.5rem;
  box-shadow: 0 10px 30px rgba(42, 40, 37, 0.15);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  z-index: 12;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

@supports not (backdrop-filter: blur(1px)) {
  .home-dropdown {
    background: rgba(42, 40, 37, 0.72);
  }
}

.home-dropdown__item {
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: none;
  background: transparent;
  text-align: left;
  font-family: inherit;
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(42, 40, 37, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.home-dropdown__item:hover {
  background: rgba(42, 40, 37, 0.05);
}

.home-dropdown__item--active {
  background: rgba(63, 129, 102, 0.15); /* Tu color 'sage' adaptado */
  color: rgba(42, 85, 67, 1);
}

/* Animación del Dropdown */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.topbar__nav {
  display: flex;    /* Alineados horizontalmente */
  align-items: center;
  gap: 0.65rem;
  justify-content: center;
}

.nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.95rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  color: rgba(42, 40, 37, 0.75);
  font-weight: 600;
  font-size: 0.88rem;
  transition: background 0.2s ease, color 0.2s ease;
  border: 1px solid transparent;
}

.nav-pill__icon {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
}

.nav-pill__icon svg {
  width: 18px;
  height: 18px;
}

.nav-pill:hover {
  background: rgba(255, 255, 255, 0.8);
  color: rgba(42, 40, 37, 0.95);
  border-color: rgba(42, 40, 37, 0.1);
}

.nav-pill.router-link-active {
  background: rgba(42, 40, 37, 0.95);
  color: #f7f3e7;
  border-color: rgba(42, 40, 37, 0.15);
}

.topbar__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(42, 40, 37, 0.12);
  background: rgba(255, 255, 255, 0.75);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--color-text, rgba(42, 40, 37, 1));
  box-shadow: 0 6px 16px rgba(42, 40, 37, 0.08);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

.user-selector {
  position: relative;
  display: inline-flex;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.65rem 0.35rem 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(42, 40, 37, 0.12);
  box-shadow: 0 8px 16px rgba(42, 40, 37, 0.08);
  cursor: pointer;
  transition: background 0.2s ease;
  font-family: inherit;
  color: var(--color-text, rgba(42, 40, 37, 1));
}

.user-chip:hover {
  background: rgba(255, 255, 255, 0.9);
}

.user-chip__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(42, 40, 37, 0.85);
  color: #f7f3e7;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  font-weight: 700;
}

.user-chip__name {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.user-chip__chev {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  opacity: 0.5;
  transition: transform 0.2s ease;
}

.user-chip__chev svg {
  width: 14px;
  height: 14px;
}

.user-chip[aria-expanded="true"] .user-chip__chev {
  transform: rotate(180deg);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 200px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(42, 40, 37, 0.1);
  border-radius: 16px;
  padding: 0.5rem;
  box-shadow: 0 10px 30px rgba(42, 40, 37, 0.15);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  z-index: 12;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-dropdown__item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: none;
  background: transparent;
  text-align: left;
  font-family: inherit;
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(42, 40, 37, 0.8);
  cursor: pointer;
  transition: background 0.2s ease;
  width: 100%;
}

.user-dropdown__item:hover {
  background: rgba(42, 40, 37, 0.05);
}

.user-dropdown__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  opacity: 0.7;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.95rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  color: rgba(42, 40, 37, 0.75);
  font-weight: 600;
  font-size: 0.88rem;
  font-family: inherit;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.ghost-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  color: rgba(42, 40, 37, 0.95);
  border-color: rgba(42, 40, 37, 0.1);
}

.logout-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  background: rgba(42, 40, 37, 0.25);
  padding: 1.5rem;
}

@supports not (backdrop-filter: blur(1px)) {
  .logout-overlay {
    background: rgba(42, 40, 37, 0.72);
  }
}

.logout-modal {
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

.logout-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.logout-modal__title {
  font-size: 1.4rem;
  font-weight: 300;
  color: var(--color-text);
}

.logout-modal__close {
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

.logout-modal__close:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.15);
}

.logout-modal__message {
  color: rgba(42, 40, 37, 0.75);
  line-height: 1.4;
}

.logout-modal__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.logout-modal__cancel,
.logout-modal__confirm {
  height: 50px;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.2s, box-shadow 0.2s;
}

.logout-modal__cancel {
  border: 1px solid rgba(42, 40, 37, 0.2);
  color: rgba(42, 40, 37, 0.8);
  background: #fff;
}

.logout-modal__cancel:hover:not(:disabled) {
  background: rgba(42, 40, 37, 0.06);
  transform: translateY(-1px);
}

.logout-modal__confirm {
  border: none;
  color: #fff;
  background: #b54444;
}

.logout-modal__confirm:hover:not(:disabled) {
  background: #992f2f;
  box-shadow: 0 8px 24px rgba(153, 47, 47, 0.2);
  transform: translateY(-1px);
}

.logout-modal__cancel:disabled,
.logout-modal__confirm:disabled,
.logout-modal__close:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-main {
  flex: 1;
  padding: 2rem 2.5rem 3rem;
}

@media (max-width: 1024px) {
  .topbar {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
  }

  .topbar__nav {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .topbar__actions {
    justify-content: flex-end;
  }
}

@media (max-width: 720px) {
  .topbar {
    padding: 1rem 1.25rem;
  }

  .brand {
    height: 3rem;
    padding: 0 0.65rem 1.25rem 0.4rem;
    border-radius: 14px;
  }

  .brand__logo {
    width: 32px;
    height: 56px;
  }

  .brand__name {
    font-size: 1.08rem;
  }

  .home-switch__label {
    display: none;
  }

  .user-chip__name {
    display: none;
  }

  .app-main {
    padding: 1.25rem;
  }
}

.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  background: var(--color-charcoal);
  color: var(--color-white);
  padding: 12px 24px;
  font-size: 0.9rem;
  font-weight: 600;
  z-index: 9999;
  text-decoration: none;
  border-radius: 0 0 8px 0;
}

.skip-link:focus {
  top: 0;
}
</style>
