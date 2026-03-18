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

const TITLES: Record<GreetingSendStatus, string> = {
  idle: 'Smart Greetings',
  selecting: 'Customize Message',
  sending: 'Choose Recipient',
  done: 'Smart Greetings',
}

export default function SmartGreetingsPage() {
  const {
    templates, occasions, selectedTemplate, filterOccasion,
    sendStatus, customMessage, setFilterOccasion, selectTemplate,
    setCustomMessage, sendToParty, setSendStatus, reset,
  } = useSmartGreetings()

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
      <PageContainer>
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
