/** Smart Greetings — Type definitions */

export interface GreetingTemplate {
  id: string
  name: string
  occasion: GreetingOccasion
  /** Template message with {{name}} placeholder for personalization */
  message: string
  /** Background color gradient for preview card */
  gradient: string
  /** Emoji to display */
  emoji: string
}

export type GreetingOccasion =
  | 'DIWALI'
  | 'HOLI'
  | 'EID'
  | 'CHRISTMAS'
  | 'NEW_YEAR'
  | 'INDEPENDENCE_DAY'
  | 'REPUBLIC_DAY'
  | 'RAKSHA_BANDHAN'
  | 'GANESH_CHATURTHI'
  | 'NAVRATRI'
  | 'MAKAR_SANKRANTI'
  | 'BIRTHDAY'
  | 'THANK_YOU'
  | 'BUSINESS'

export type GreetingSendStatus = 'idle' | 'selecting' | 'sending' | 'done'
