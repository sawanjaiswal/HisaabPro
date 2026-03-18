/** Smart Greetings — Templates and constants */

import type { GreetingTemplate, GreetingOccasion } from './smart-greetings.types'

export const OCCASION_LABELS: Record<GreetingOccasion, string> = {
  DIWALI: 'Diwali',
  HOLI: 'Holi',
  EID: 'Eid',
  CHRISTMAS: 'Christmas',
  NEW_YEAR: 'New Year',
  INDEPENDENCE_DAY: 'Independence Day',
  REPUBLIC_DAY: 'Republic Day',
  RAKSHA_BANDHAN: 'Raksha Bandhan',
  GANESH_CHATURTHI: 'Ganesh Chaturthi',
  NAVRATRI: 'Navratri',
  MAKAR_SANKRANTI: 'Makar Sankranti',
  BIRTHDAY: 'Birthday',
  THANK_YOU: 'Thank You',
  BUSINESS: 'Business',
}

export const GREETING_TEMPLATES: GreetingTemplate[] = [
  // Diwali
  {
    id: 'diwali-1',
    name: 'Diwali Wishes',
    occasion: 'DIWALI',
    message: 'Dear {{name}},\n\nWishing you and your family a very Happy Diwali! May this festival of lights bring prosperity, joy, and success to your business.\n\nWarm regards',
    gradient: 'linear-gradient(135deg, #ff9a56, #ff6b35)',
    emoji: '🪔',
  },
  {
    id: 'diwali-2',
    name: 'Diwali Prosperity',
    occasion: 'DIWALI',
    message: 'Happy Diwali, {{name}}!\n\nMay the light of Diwali illuminate your path to success and prosperity. Thank you for being a valued partner.\n\nShubh Deepawali!',
    gradient: 'linear-gradient(135deg, #ffd700, #ff8c00)',
    emoji: '✨',
  },

  // Holi
  {
    id: 'holi-1',
    name: 'Holi Colors',
    occasion: 'HOLI',
    message: 'Happy Holi, {{name}}!\n\nMay your life be as colorful as the festival of Holi. Wishing you joy, good health, and continued success.\n\nBest wishes',
    gradient: 'linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77)',
    emoji: '🎨',
  },

  // Eid
  {
    id: 'eid-1',
    name: 'Eid Mubarak',
    occasion: 'EID',
    message: 'Eid Mubarak, {{name}}!\n\nWishing you and your family peace, happiness, and prosperity on this blessed occasion.\n\nWarm regards',
    gradient: 'linear-gradient(135deg, #2d6a4f, #40916c)',
    emoji: '🌙',
  },

  // New Year
  {
    id: 'newyear-1',
    name: 'Happy New Year',
    occasion: 'NEW_YEAR',
    message: 'Happy New Year, {{name}}!\n\nWishing you a year filled with success, growth, and prosperity. Looking forward to another wonderful year of partnership.\n\nCheers!',
    gradient: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
    emoji: '🎉',
  },

  // Independence Day
  {
    id: 'independence-1',
    name: 'Independence Day',
    occasion: 'INDEPENDENCE_DAY',
    message: 'Happy Independence Day, {{name}}!\n\nJai Hind! Wishing you success and prosperity. Let us celebrate the spirit of freedom and entrepreneurship together.\n\nVande Mataram',
    gradient: 'linear-gradient(135deg, #ff9933, #ffffff, #138808)',
    emoji: '🇮🇳',
  },

  // Christmas
  {
    id: 'christmas-1',
    name: 'Merry Christmas',
    occasion: 'CHRISTMAS',
    message: 'Merry Christmas, {{name}}!\n\nWishing you joy, peace, and prosperity this holiday season. Thank you for your valued partnership.\n\nHappy Holidays!',
    gradient: 'linear-gradient(135deg, #c62828, #2e7d32)',
    emoji: '🎄',
  },

  // Business
  {
    id: 'thankyou-1',
    name: 'Thank You',
    occasion: 'THANK_YOU',
    message: 'Dear {{name}},\n\nThank you for your continued trust in our business. We truly value our partnership and look forward to serving you better.\n\nWarm regards',
    gradient: 'linear-gradient(135deg, #1b6369, #2d9da0)',
    emoji: '🙏',
  },
  {
    id: 'business-1',
    name: 'New Collection',
    occasion: 'BUSINESS',
    message: 'Dear {{name}},\n\nWe are excited to inform you about our latest collection/stock. Visit us to explore amazing deals!\n\nRegards',
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
    emoji: '🆕',
  },
  {
    id: 'business-2',
    name: 'Payment Reminder (Friendly)',
    occasion: 'BUSINESS',
    message: 'Dear {{name}},\n\nThis is a friendly reminder about your pending payment. We would appreciate it if you could settle the outstanding amount at your earliest convenience.\n\nThank you for your cooperation.',
    gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
    emoji: '💰',
  },

  // Navratri
  {
    id: 'navratri-1',
    name: 'Navratri Wishes',
    occasion: 'NAVRATRI',
    message: 'Happy Navratri, {{name}}!\n\nMay Goddess Durga bless you with strength, wisdom, and prosperity. Wishing you nine nights of devotion and celebration.\n\nJai Mata Di!',
    gradient: 'linear-gradient(135deg, #e74c3c, #f39c12)',
    emoji: '🙏',
  },

  // Ganesh Chaturthi
  {
    id: 'ganesh-1',
    name: 'Ganesh Chaturthi',
    occasion: 'GANESH_CHATURTHI',
    message: 'Happy Ganesh Chaturthi, {{name}}!\n\nMay Lord Ganesha remove all obstacles and bring success to your business. Ganpati Bappa Morya!\n\nBest wishes',
    gradient: 'linear-gradient(135deg, #ff6b35, #f7dc6f)',
    emoji: '🙏',
  },
]

/** WhatsApp URL scheme for sending messages */
export const WHATSAPP_URL = 'https://wa.me'
