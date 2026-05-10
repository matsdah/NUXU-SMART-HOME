type TranslationEntry = {
  match: (msg: string) => string | null
}

const ENTRIES: TranslationEntry[] = [
  {
    match: (msg) => {
      const m = msg.match(/password.*must be at least (\d+)/i)
      return m ? `La contraseña debe tener al menos ${m[1]} caracteres` : null
    },
  },
  {
    match: (msg) => {
      const m = msg.match(/name.*must be at least (\d+)/i)
      return m ? `El nombre debe tener al menos ${m[1]} caracteres` : null
    },
  },
  {
    match: (msg) => {
      const m = msg.match(/"password".*length must be at least (\d+)/i)
      return m ? `La contraseña debe tener al menos ${m[1]} caracteres` : null
    },
  },
  {
    match: (msg) => {
      const m = msg.match(/"name".*length must be at least (\d+)/i)
      return m ? `El nombre debe tener al menos ${m[1]} caracteres` : null
    },
  },
  {
    match: (msg) =>
      /email.*must be a valid email/i.test(msg) ? 'El email no es válido' : null,
  },
  {
    match: (msg) =>
      /"email".*must be a valid email/i.test(msg) ? 'El email no es válido' : null,
  },
  {
    match: (msg) =>
      /email.*is not allowed to be empty/i.test(msg) ? 'El email es obligatorio' : null,
  },
  {
    match: (msg) =>
      /"email".*is not allowed to be empty/i.test(msg) ? 'El email es obligatorio' : null,
  },
  {
    match: (msg) =>
      /password.*is not allowed to be empty/i.test(msg) ? 'La contraseña es obligatoria' : null,
  },
  {
    match: (msg) =>
      /"password".*is not allowed to be empty/i.test(msg) ? 'La contraseña es obligatoria' : null,
  },
  {
    match: (msg) =>
      /name.*is not allowed to be empty/i.test(msg) ? 'El nombre es obligatorio' : null,
  },
  {
    match: (msg) =>
      /"name".*is not allowed to be empty/i.test(msg) ? 'El nombre es obligatorio' : null,
  },
  {
    match: (msg) =>
      /currentPassword.*is not allowed to be empty/i.test(msg) ? 'La contraseña actual es obligatoria' : null,
  },
  {
    match: (msg) =>
      /newPassword.*is not allowed to be empty/i.test(msg) ? 'La nueva contraseña es obligatoria' : null,
  },
  {
    match: (msg) =>
      /oldPassword.*is not allowed to be empty/i.test(msg) ? 'La contraseña actual es obligatoria' : null,
  },
  {
    match: (msg) =>
      /code.*is not allowed to be empty/i.test(msg) ? 'El código es obligatorio' : null,
  },
  {
    match: (msg) =>
      /"code".*is not allowed to be empty/i.test(msg) ? 'El código es obligatorio' : null,
  },
  {
    match: (msg) =>
      /confirmPassword.*is not allowed to be empty/i.test(msg) ? 'Confirmar contraseña es obligatorio' : null,
  },
  {
    match: (msg) =>
      /password.*(too short|not long enough)/i.test(msg) ? 'La contraseña es muy corta' : null,
  },
  {
    match: (msg) =>
      /email.*not found/i.test(msg) ? 'No existe una cuenta con ese email' : null,
  },
  {
    match: (msg) =>
      /user.*not found/i.test(msg) ? 'Usuario no encontrado' : null,
  },
  {
    match: (msg) =>
      /email.*already (exists|taken|registered)/i.test(msg) ? 'Este email ya tiene una cuenta' : null,
  },
  {
    match: (msg) =>
      /code.*(invalid|incorrect|wrong)/i.test(msg) ? 'El código es incorrecto' : null,
  },
  {
    match: (msg) =>
      /"code".*(invalid|incorrect|wrong)/i.test(msg) ? 'El código es incorrecto' : null,
  },
  {
    match: (msg) =>
      /code.*expired/i.test(msg) ? 'El código expiró. Pedí uno nuevo' : null,
  },
  {
    match: (msg) =>
      /account.*already verified/i.test(msg) ? 'La cuenta ya fue verificada' : null,
  },
  {
    match: (msg) =>
      /not verified/i.test(msg) ? 'La cuenta todavía no fue verificada. Revisá tu email' : null,
  },
  {
    match: (msg) =>
      /(invalid|incorrect).*(password|credentials|login)/i.test(msg) ? 'Usuario o contraseña incorrectos' : null,
  },
  {
    match: (msg) =>
      /token.*(invalid|expired|missing)/i.test(msg) ? 'La sesión expiró. Iniciá sesión de nuevo' : null,
  },
]

function tryTranslate(raw: string): string | null {
  for (const entry of ENTRIES) {
    const result = entry.match(raw)
    if (result !== null) return result
  }
  return null
}

const GENERIC_PATTERN = /is not allowed to be empty|must be at least|must be a valid|must be one of|is required/i

export function translateAuthError(message: string): string {
  if (!message) return 'Error inesperado. Intentá de nuevo.'

  const translated = tryTranslate(message)
  if (translated) return translated

  if (GENERIC_PATTERN.test(message)) {
    return 'Error de validación. Revisá los datos ingresados.'
  }

  return message
}
