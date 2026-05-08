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
onMounted(() => {
  document.addEventListener('click', closeMenuOnClickOutside)
  socket.connect()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenuOnClickOutside)
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

async function handleLogout() {
  socket.disconnect()
  await auth.logout()
  router.push({ name: 'login' })
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
        <button class="icon-btn" type="button" aria-label="Notificaciones">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 17h12l-1-2v-4a5 5 0 0 0-10 0v4l-1 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            <path d="M9.5 17a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
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
        <button class="ghost-btn" type="button" @click="handleLogout">Salir</button>
      </div>
    </header>

    <main class="app-main" id="app-main">
      <RouterView />
    </main>
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
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.brand__logo {
  width: 36px;
  height: 40px;
  object-fit: contain;
}

.brand__name {
  font-size: 0.95rem;
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
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(42, 40, 37, 0.15);
  background: transparent;
  font-weight: 600;
  cursor: pointer;
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

  .brand__name {
    display: none;
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