import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim()
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim()
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim()

function getEmailJsConfig() {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error('No se pudo enviar el mail de verificación.')
  }

  return { serviceId: SERVICE_ID, templateId: TEMPLATE_ID, publicKey: PUBLIC_KEY }
}

// Genera un código numérico de 6 dígitos
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Envía el código al email indicado usando EmailJS
export async function sendVerificationEmail(toEmail: string, code: string): Promise<void> {
  const config = getEmailJsConfig()

  await emailjs.send(
    config.serviceId,
    config.templateId,
    { to_email: toEmail, verification_code: code },
    { publicKey: config.publicKey },
  )
}
