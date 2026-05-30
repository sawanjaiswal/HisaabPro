/** Template Editor — Customize message before sending */

import { Send } from 'lucide-react'
import type { GreetingTemplate } from '../smart-greetings.types'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

interface TemplateEditorProps {
  template: GreetingTemplate
  message: string
  onMessageChange: (message: string) => void
  onSendToAll: () => void
  onBack: () => void
}

export function TemplateEditor({ template, message, onMessageChange, onSendToAll, onBack }: TemplateEditorProps) {
  const { t } = useLanguage()
  return (
    <div className="greeting-editor">
      {/* Preview card */}
      <div className="greeting-preview-card" style={{ background: template.gradient }}>
        <span className="greeting-preview-emoji" aria-hidden="true">{template.emoji}</span>
        <span className="greeting-preview-name">{template.name}</span>
      </div>

      {/* Message editor */}
      <div className="greeting-editor-field">
        <label className="greeting-editor-label">{t.message}</label>
        <Textarea
          className="greeting-editor-textarea"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={8}
          placeholder={t.message}
          aria-label="Greeting message"
        />
        <p className="greeting-editor-hint">
          {t.useNamePersonalize}
        </p>
      </div>

      {/* Actions */}
      <div className="greeting-editor-actions">
        <Button
          type="button"
          variant="primary" size="lg" className="greeting-editor-send"
          onClick={onSendToAll}
        >
          <Send size={18} aria-hidden="true" />
          Choose Recipients
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onBack}>
          Back to Templates
        </Button>
      </div>
    </div>
  )
}
