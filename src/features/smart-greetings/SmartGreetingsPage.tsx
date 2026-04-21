/** Smart Greetings — Send festive/business greetings via WhatsApp */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useSmartGreetings } from './useSmartGreetings'
import { TemplateGrid } from './components/TemplateGrid'
import { TemplateEditor } from './components/TemplateEditor'
import { RecipientPicker } from './components/RecipientPicker'
import type { GreetingSendStatus } from './smart-greetings.types'
import './smart-greetings.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function SmartGreetingsPage() {
  const { t } = useLanguage()
  const {
    templates, occasions, selectedTemplate, filterOccasion,
    sendStatus, customMessage, setFilterOccasion, selectTemplate,
    setCustomMessage, sendToParty, setSendStatus, reset,
  } = useSmartGreetings()

  const TITLES: Record<GreetingSendStatus, string> = {
    idle: t.greetingTemplates ?? 'Smart Greetings',
    selecting: t.customizeMessage ?? 'Customize Message',
    sending: t.chooseRecipient ?? 'Choose Recipient',
    done: t.greetingTemplates ?? 'Smart Greetings',
  }

  const handleSelectTemplate = (template: Parameters<typeof selectTemplate>[0]) => {
    selectTemplate(template)
    setSendStatus('selecting')
  }

  const handleBack = () => {
    if (sendStatus === 'sending') setSendStatus('selecting')
    else reset()
  }

  return (
    <AppShell>
      <Header title={TITLES[sendStatus]} backTo="" />
      <PageContainer className="space-y-6">
        {sendStatus === 'idle' && (
          <TemplateGrid
            templates={templates}
            occasions={occasions}
            filterOccasion={filterOccasion}
            onFilterChange={setFilterOccasion}
            onSelect={handleSelectTemplate}
          />
        )}

        {sendStatus === 'selecting' && selectedTemplate && (
          <TemplateEditor
            template={selectedTemplate}
            message={customMessage}
            onMessageChange={setCustomMessage}
            onSendToAll={() => setSendStatus('sending')}
            onBack={handleBack}
          />
        )}

        {sendStatus === 'sending' && (
          <RecipientPicker onSend={sendToParty} onBack={handleBack} />
        )}
      </PageContainer>
    </AppShell>
  )
}
