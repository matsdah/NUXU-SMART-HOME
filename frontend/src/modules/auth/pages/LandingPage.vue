<template>
  <div class="landing">

    <!-- Gradiente que sigue el cursor -->
    <div class="mouse-gradient" :style="mouseStyle"></div>

    <!-- Ripples al hacer click -->
    <div
      v-for="r in ripples"
      :key="r.id"
      class="ripple"
      :style="{ left: `${r.x}px`, top: `${r.y}px` }"
    ></div>

    <!-- Partículas flotantes -->
    <div class="particle" style="top:25%;left:15%;animation-delay:0.5s" aria-hidden="true"></div>
    <div class="particle" style="top:60%;left:85%;animation-delay:1s"   aria-hidden="true"></div>
    <div class="particle" style="top:40%;left:10%;animation-delay:1.5s" aria-hidden="true"></div>
    <div class="particle" style="top:75%;left:90%;animation-delay:2s"   aria-hidden="true"></div>

    <!-- Blobs decorativos -->
    <div class="blob blob--sage-r"      aria-hidden="true"></div>
    <div class="blob blob--charcoal-tr" aria-hidden="true"></div>
    <div class="blob blob--brown-tr"    aria-hidden="true"></div>
   

    <div class="blob blob--sage-l"      aria-hidden="true"></div>
    <div class="blob blob--charcoal-bl" aria-hidden="true"></div>
    <div class="blob blob--brown-bl"    aria-hidden="true"></div>
    <div class="blob blob--sand-bl"     aria-hidden="true"></div>

    <!-- Contenido principal -->
    <div class="landing__inner">
      <img
        src="@/assets/lamp.webp"
        alt="Lámpara NUXU"
        class="landing__lamp"
      />
      <h1 class="landing__title">
        <span class="word-animate" style="animation-delay:700ms">¡Bienvenido</span>
        <span class="word-animate" style="animation-delay:900ms">a</span>
        <span class="word-animate" style="animation-delay:1100ms"><strong>NUXU</strong>!</span>
      </h1>
    </div>

    <!-- Botón flecha -->
    <button
      class="landing__cta"
      @click="goToLogin"
      aria-label="Continuar al inicio de sesión"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M4 11h14M13 5l6 6-6 6" stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const mouse = reactive({ x: 0, y: 0, active: false })

const mouseStyle = computed(() => ({
  left: `${mouse.x}px`,
  top: `${mouse.y}px`,
  opacity: mouse.active ? 1 : 0,
}))

interface Ripple { id: number; x: number; y: number }
const ripples = ref<Ripple[]>([])

function onMouseMove(e: MouseEvent) {
  mouse.x = e.clientX
  mouse.y = e.clientY
  mouse.active = true
}

function onMouseLeave() {
  mouse.active = false
}

function onClick(e: MouseEvent) {
  const r: Ripple = { id: Date.now(), x: e.clientX, y: e.clientY }
  ripples.value.push(r)
  setTimeout(() => {
    ripples.value = ripples.value.filter(x => x.id !== r.id)
  }, 1000)
}

function goToLogin() {
  router.push('/login')
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseleave', onMouseLeave)
  document.addEventListener('click', onClick)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseleave', onMouseLeave)
  document.removeEventListener('click', onClick)
})
</script>

<style scoped>
/* ── Layout base ───────────────────────────────────────── */
.landing {
  position: relative;
  width: 100%;
  height: 100vh;
  min-height: 600px;
  background-color: var(--color-bg);
  overflow: hidden;
  font-family: var(--font-sans);
}

/* ── Mouse gradient ────────────────────────────────────── */
.mouse-gradient {
  position: fixed;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(190, 190, 166, 0.07),
    rgba(158, 155, 142, 0.05),
    transparent 70%
  );
  transform: translate(-50%, -50%);
  pointer-events: none;
  will-change: left, top, opacity;
  transition: left 70ms linear, top 70ms linear, opacity 300ms ease-out;
  filter: blur(24px);
  z-index: 5;
}

/* ── Ripple ────────────────────────────────────────────── */
.ripple {
  position: fixed;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(158, 155, 142, 0.55);
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: ripple-out 1s ease-out forwards;
  z-index: 9999;
}

/* ── Partículas ────────────────────────────────────────── */
.particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: #BEBEA6;
  border-radius: 50%;
  opacity: 0;
  animation: float 4s ease-in-out infinite;
  pointer-events: none;
  z-index: 2;
}

/* ── Blobs ─────────────────────────────────────────────── */
.blob {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 2;
}

/* Superior derecha */
.blob--charcoal-tr {
  width: 18vw; height: 18vw;
  background-color: var(--color-charcoal);
  top: -12vw; right: 18vw;
}

.blob--brown-tr {
  width: 11vw; height: 11vw;
  background-color: var(--color-brown);
  top: -2vw; right: -2vw;
}

.blob--sage-r {
  width: 30vw; height: 30vw;
  background-color: var(--color-sage);
  top: -10vw; right: -2vw;
}

.blob--cream-br {
  width: 10vw; height: 10vw;
  background-color: var(--color-cream);
  bottom: 10vw; right: 10vw;
}

/* Inferior izquierda */
.blob--sage-l {
  width: 16vw; height: 16vw;
  background-color: var(--color-sage);
  bottom: 22vh; left: -5vw;
}

.blob--charcoal-bl {
  width: 26vw; height: 26vw;
  background-color: var(--color-charcoal);
  bottom: -10vw; left: -8vw;
}

.blob--brown-bl {
  width: 20vw; height: 20vw;
  background-color: var(--color-brown);
  bottom: -6vw; left: 14vw;
}

.blob--sand-bl {
  width: 10vw; height: 10vw;
  background-color: #CFCDB4;
  bottom: -1vw; left: 26vw;
}

/* ── Contenedor central ────────────────────────────────── */
.landing__inner {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Lámpara — cuelga desde arriba ────────────────────── */
.landing__lamp {
  width: clamp(150px, 14vw, 220px);
  height: 62vh;
  flex-shrink: 0;
  object-fit: contain;
  object-position: top center;
  filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.10));
}

/* ── Título ────────────────────────────────────────────── */
.landing__title {
  display: flex;
  align-items: center;
  gap: 0.3em;
  flex-wrap: wrap;
  justify-content: center;
  margin: -2rem 0 0;
  font-size: clamp(1.5rem, 10vw, 2.9rem);
  font-weight: 300;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.landing__title strong {
  font-weight: 700;
}

/* ── Botón CTA ─────────────────────────────────────────── */
.landing__cta {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  width: 56px;
  height: 56px;
  background-color: var(--color-sage);
  border: none;
  border-radius: var(--radius-btn);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  transition: background-color 0.2s ease, transform 0.15s ease;
}

.landing__cta:hover {
  background-color: var(--color-sage-dark);
  transform: translateX(3px);
}

.landing__cta:focus-visible {
  outline: 2px solid var(--color-charcoal);
  outline-offset: 3px;
}

/* ── Animación de palabras ─────────────────────────────── */
.word-animate {
  display: inline-block;
  opacity: 0;
  animation: word-appear 0.8s ease-out forwards;
}

.word-animate:hover {
  text-shadow: 0 0 20px rgba(158, 155, 142, 0.45);
}

/* ── Keyframes ─────────────────────────────────────────── */
@keyframes word-appear {
  0%   { opacity: 0; transform: translateY(24px) scale(0.88); filter: blur(8px); }
  55%  { opacity: 0.8; transform: translateY(8px) scale(0.96); filter: blur(2px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

@keyframes ripple-out {
  0%   { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(8); }
}

@keyframes float {
  0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
  25%       { transform: translateY(-10px) translateX(5px); opacity: 0.5; }
  50%       { transform: translateY(-5px) translateX(-3px); opacity: 0.3; }
  75%       { transform: translateY(-15px) translateX(7px); opacity: 0.6; }
}
</style>
