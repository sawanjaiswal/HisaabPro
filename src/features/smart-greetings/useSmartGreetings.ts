/** Smart Greetings — Hook for template selection and sending */

import { useState, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/useToast'
import { GREETING_TEMPLATES, OCCASION_LABELS } from './smart-greetings.constants'
import { personalizeMessage, buildWhatsAppLink } from './smart-greetings.utils'
import type { GreetingTemplate, GreetingOccasion, GreetingSendStatus } from './smart-greetings.types'

interface PartyRecipient {
  id: string
  name: string
  phone?: string
}

export function useSmartGreetings() {
  const toast = useToast()
  const [selectedTemplate, setSelectedTemplate] = useState<GreetingTemplate | null>(null)
  const [filterOccasion, setFilterOccasion] = useState<GreetingOccasion | null>(null)
  const [sendStatus, setSendStatus] = useState<GreetingSendStatus>('idle')
  const [customMessage, setCustomMessage] = useState('')

  const filteredTemplates = useMemo(() => {
    if (!filterOccasion) return GREETING_TEMPLATES
    return GREETING_TEMPLATES.filter((t) => t.occasion === filterOccasion)
  }, [filterOccasion])

  const occasions = useMemo(() => {
    const unique = [...new Set(GREETING_TEMPLATES.map((t) => t.occasion))]
    return unique.map((o) => ({ id: o, label: OCCASION_LABELS[o] }))
  }, [])

  const selectTemplate = useCallback((template: GreetingTemplate) => {
    setSelectedTemplate(template)
    setCustomMessage(template.message)
  }, [])

  const sendToParty = useCallback((party: PartyRecipient) => {
    if (!party.phone) {
      toast.error(`${party.name} has no phone number`)
      return
    }

    const message = personalizeMessage(customMessage || selectedTemplate?.message || '', party.name)
    const link = buildWhatsAppLink(party.phone, message)
    window.open(link, '_blank')
    toast.success(`Opening WhatsApp for ${party.name}`)
  }, [selectedTemplate, customMessage, toast])

  const reset = useCallback(() => {
    setSelectedTemplate(null)
    setCustomMessage('')
    setSendStatus('idle')
  }, [])

  return {
    templates: filteredTemplates,
    occasions,
    selectedTemplate,
    filterOccasion,
    sendStatus,
    customMessage,
    setFilterOccasion,
    selectTemplate,
    setCustomMessage,
    sendToParty,
    setSendStatus,
    reset,
  }
}

export type { PartyRecipient }
