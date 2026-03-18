/** Smart Greetings — Pure utility functions */

import { WHATSAPP_URL } from './smart-greetings.constants'

/** Replace {{name}} placeholder with actual party name */
export function personalizeMessage(template: string, partyName: string): string {
  return template.replace(/\{\{name\}\}/g, partyName)
}

/** Build WhatsApp deep link for sending a message */
export function buildWhatsAppLink(phone: string, message: string): string {
  // Normalize to international format
  const normalized = phone.startsWith('+') ? phone.replace(/[^0-9]/g, '') : `91${phone.replace(/[^0-9]/g, '')}`
  return `${WHATSAPP_URL}/${normalized}?text=${encodeURIComponent(message)}`
}

/** Group templates by occasion for display */
export function groupByOccasion<T extends { occasion: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const group = map.get(item.occasion) ?? []
    group.push(item)
    map.set(item.occasion, group)
  }
  return map
}
