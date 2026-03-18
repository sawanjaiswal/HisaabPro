/** Template Editor — Customize message before sending */

import { Send } from 'lucide-react'
import type { GreetingTemplate } from '../smart-greetings.types'

interface TemplateEditorProps {
  template: GreetingTemplate
  message: string
  onMessageChange: (message: string) => void
  onSendToAll: () => void
  onBack: () => void
}

export function TemplateEditor({ template, message, onMessageChange, onSendToAll, onBack }: TemplateEditorProps) {
  return (
    <div className="greeting-editor">
      {/* Preview card */}
      <div className="greeting-preview-card" style={{ background: template.gradient }}>
        <span className="greeting-preview-emoji" aria-hidden="true">{template.emoji}</span>
        <span className="greeting-preview-name">{template.name}</span>
      </div>

      {/* Message editor */}
      <div className="greeting-editor-field">
        <label className="greeting-editor-label">Message</label>
        <textarea
          className="greeting-editor-textarea"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={8}
          placeholder="Type your greeting message..."
          aria-label="Greeting message"
        />
        <p className="greeting-editor-hint">
          Use {'{{name}}'} to personalize with the party&apos;s name
        </p>
      </div>

      {/* Actions */}
      <div className="greeting-editor-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg greeting-editor-send"
          onClick={onSendToAll}
        >
          <Send size={18} aria-hidden="true" />
          Choose Recipients
        </button>
        <button type="button" className="btn btn-ghost btn-md" onClick={onBack}>
          Back to Templates
        </button>
      </div>
    </div>
  )
}
