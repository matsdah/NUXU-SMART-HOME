<script setup lang="ts">
</script>

<template>
  <div class="auth-layout">
    <RouterLink to="/" class="logo" aria-label="Ir al inicio">
      <img src="@/assets/lamp.webp" alt="Lámpara NUXU" class="logo__lamp" />
      <span class="logo__name">NUXU</span>
    </RouterLink>

    <main class="auth-card">
      <slot />
    </main>

  </div>
</template>

<style scoped>

.auth-layout {
  position: fixed;
  inset: 0;
  background-image: url('@/assets/image.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: hidden;
  overflow-y: auto;
  font-family: var(--font-sans);
  padding: 6.5rem 1.25rem 2rem;
}

.logo {
  position: absolute;
  top: 0.8rem;
  left: 2rem;
  height: 3.5rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.1rem;
  text-decoration: none;
  z-index: 10;
  background-color: #9E9B8E;
  padding: 0.0rem 0.8rem 1.5rem 0.5rem;
  border-radius: 16px 16px 16px 16px;
}

.logo__lamp {
  width: 38px;
  height: 65px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.10));
  flex-shrink: 0;
  display: block;
}

.logo__name {
  font-size: 1.3rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--color-text);
  line-height: 1;
  margin-bottom: -1.5rem;
}

.auth-card {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: min(360px, 90vw);
  background: rgba(255, 255, 255, 0.55);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 24px;
  padding: 2rem 2rem 1.75rem;
}

@supports not (backdrop-filter: blur(1px)) {
  .auth-card {
    background: rgba(255, 255, 255, 0.92);
  }
}

@media (max-width: 760px) {
  .auth-layout {
    align-items: flex-start;
    padding: 5.25rem 1rem 1.5rem;
  }

  .logo {
    top: 0.6rem;
    left: 1rem;
    height: 3rem;
    padding: 0 0.65rem 1.25rem 0.4rem;
    border-radius: 14px;
  }

  .logo__lamp {
    width: 32px;
    height: 56px;
  }

  .logo__name {
    font-size: 1.08rem;
  }

  .auth-card {
    width: min(100%, 360px);
    padding: 1.5rem 1.25rem;
  }
}

@media (max-width: 420px) {
  .auth-layout {
    padding-inline: 0.85rem;
  }

  .auth-card {
    border-radius: 20px;
  }
}
</style>
