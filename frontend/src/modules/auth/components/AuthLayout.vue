<script setup lang="ts">
</script>

<template>
  <div class="auth-layout">

    <img src="@/assets/forma1.png" class="deco-left"          alt="" aria-hidden="true" />
    <img src="@/assets/forma2.png" class="deco-right"         alt="" aria-hidden="true" />
    <img src="@/assets/forma3.png" class="deco-top-right"     alt="" aria-hidden="true" />
    <img src="@/assets/forma4.png" class="deco-bottom-left"   alt="" aria-hidden="true" />
    <img src="@/assets/forma5.png" class="deco-bottom-center" alt="" aria-hidden="true" />
    <img src="@/assets/forma6.png" class="deco-bottom-right"  alt="" aria-hidden="true" />

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
  position: relative;
  width: 100%;
  min-height: 100vh;
  background-color: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--font-sans);
}

/* — Decoraciones — */
.deco-left {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-63%);
  height: 55vh;
  width: auto;
  pointer-events: none;
  z-index: 1;
}

.deco-right {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-65%);
  width: 25vh;
  height: auto;
  pointer-events: none;
  z-index: 1;
}

.deco-top-right {
  position: absolute;
  right: 0;
  top: 0;
  height: 25vh;
  width: auto;
  pointer-events: none;
  z-index: 1;
}

.deco-bottom-left {
  position: absolute;
  left: 1rem;
  bottom: 0;
  height: 28vh;
  width: auto;
  pointer-events: none;
  z-index: 1;
}

.deco-bottom-center {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  height: 18vh;
  width: auto;
  pointer-events: none;
  z-index: 1;
}

.deco-bottom-right {
  position: absolute;
  right: 0;
  bottom: 0;
  height: 35vh;
  width: auto;
  pointer-events: none;
  z-index: 1;
}

/* — Logo — */
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
  object-fit: left;
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

/* — Card compartida — */
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
</style>
