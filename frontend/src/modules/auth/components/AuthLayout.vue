<script setup lang="ts">
</script>

<template>
  <div class="auth-layout">
    <img src="@/assets/forma1.png" class="deco deco-left" alt="" aria-hidden="true" />
    <img src="@/assets/forma2.png" class="deco deco-right" alt="" aria-hidden="true" />
    <img src="@/assets/forma3.png" class="deco deco-top-right" alt="" aria-hidden="true" />
    <img src="@/assets/forma4.png" class="deco deco-bottom-left" alt="" aria-hidden="true" />
    <img src="@/assets/forma5.png" class="deco deco-bottom-center" alt="" aria-hidden="true" />
    <img src="@/assets/forma6.png" class="deco deco-bottom-right" alt="" aria-hidden="true" />

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
  background-color: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: hidden;
  overflow-y: auto;
  font-family: var(--font-sans);
  padding: 6.5rem 1.25rem 2rem;
}

.deco {
  position: fixed;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
  z-index: 1;
}

.deco-left {
  left: 0;
  top: 50%;
  width: auto;
  height: clamp(22rem, 55vh, 42rem);
  transform: translateY(-63%);
}

.deco-right {
  right: 0;
  top: 50%;
  width: clamp(6.5rem, 25vh, 10rem);
  height: auto;
  transform: translateY(-65%);
}

.deco-top-right {
  right: 0;
  top: 0;
  width: auto;
  height: clamp(7rem, 25vh, 12rem);
}

.deco-bottom-left {
  left: 1rem;
  bottom: 0;
  width: auto;
  height: clamp(8rem, 28vh, 17rem);
}

.deco-bottom-center {
  left: 50%;
  bottom: 0;
  width: auto;
  height: clamp(4rem, 18vh, 7rem);
  transform: translateX(-50%);
}

.deco-bottom-right {
  right: 0;
  bottom: 0;
  width: auto;
  height: clamp(10rem, 35vh, 22rem);
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

  .deco-left {
    left: -7.5rem;
    height: min(24rem, 58vh);
    opacity: 0.78;
  }

  .deco-right {
    right: -4rem;
    top: 35%;
    width: 7rem;
    opacity: 0.78;
  }

  .deco-top-right {
    right: -13rem;
    height: 6.5rem;
    opacity: 0.82;
  }

  .deco-bottom-left {
    left: -3.5rem;
    height: 8.5rem;
    opacity: 0.82;
  }

  .deco-bottom-center {
    height: 4rem;
    opacity: 0.8;
  }

  .deco-bottom-right {
    right: -4.5rem;
    height: 11rem;
    opacity: 0.82;
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
