<script setup lang="ts">
// RF3 — forgot password + RF4 change password
// Flow: POST /users/forgot-password (email) → POST /users/reset-password (code + new password)
// TODO (step 6): implement multi-step form
</script>

<template>
  <div class="auth-page">
    <div class="auth-form">
      <h1>Recover password</h1>
      <p>Enter your email to receive a recovery code, then reset your password.</p>
      <p class="note">Full implementation: RF3–RF4 (step 6).</p>
      <RouterLink to="/login">Back to sign in</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 360px;
  padding: 2rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.auth-form h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.note {
  font-size: 0.85rem;
  color: #888;
}

a {
  font-size: 0.9rem;
  color: #1a1a2e;
}
</style>
