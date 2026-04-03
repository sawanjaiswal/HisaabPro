/** Invoice Templates -- Template editor form hook
 *
 * Mirrors useProductForm.ts pattern. Manages all form state for the 6-tab
 * template editor: name, base template, config sections, and print settings.
 * Supports both create mode (initial = null) and edit mode (initial = InvoiceTemplate).
 *
 * PRD: invoice-templates-PLAN.md
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { createTemplate, updateTemplate } from './template.service'
import { buildDefaultConfig, buildDefaultPrintSettings, validateTemplateName } from './template.utils'
import type {
  InvoiceTemplate,
  TemplateFormData,
  TemplateConfig,
  TemplateColumnsConfig,
  TemplateFieldsConfig,
  PrintSettings,
  CustomizationTab,
  BaseTemplate,
} from './template.types'

// --- Return type ---

export interface UseTemplateFormReturn {
  form: TemplateFormData
  errors: Record<string, string>
  isSubmitting: boolean
  activeTab: CustomizationTab
  setActiveTab: (tab: CustomizationTab) => void
  updateName: (name: string) => void
  updateConfig: <K extends keyof TemplateConfig>(section: K, value: TemplateConfig[K]) => void
  updatePrintSetting: <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => void
  toggleColumn: (key: keyof TemplateColumnsConfig) => void
  toggleField: (key: keyof TemplateFieldsConfig) => void
  validate: () => boolean
  handleSubmit: () => Promise<void>
  handleReset: () => void
}

// --- Initial state builder ---

function buildInitialForm(template: InvoiceTemplate | null, base: BaseTemplate): TemplateFormData {
  if (template !== null) {
    return {
      name:          template.name,
      baseTemplate:  template.baseTemplate,
      config:        template.config,
      printSettings: template.printSettings,
    }
  }
  return {
    name:          '',
    baseTemplate:  base,
    config:        buildDefaultConfig(base),
    printSettings: buildDefaultPrintSettings(base),
  }
}

// --- Hook ---

interface UseTemplateFormOptions {
  /** Existing template for edit mode. Pass null for create mode. */
  template?: InvoiceTemplate | null
  /** Base template to use when creating a new template. Default: 'A4_CLASSIC'. */
  defaultBase?: BaseTemplate
}

export function useTemplateForm({
  template = null,
  defaultBase = 'A4_CLASSIC',
}: UseTemplateFormOptions = {}): UseTemplateFormReturn {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<TemplateFormData>(() =>
    buildInitialForm(template, defaultBase),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<CustomizationTab>('layout')

  // --- Field updaters ---

  const updateName = useCallback((name: string) => {
    setForm((prev) => ({ ...prev, name }))
    setErrors((prev) => {
      if (!prev.name) return prev
      const next = { ...prev }
      delete next.name
      return next
    })
  }, [])

  const updateConfig = useCallback(<K extends keyof TemplateConfig>(
    section: K,
    value: TemplateConfig[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      config: { ...prev.config, [section]: value },
    }))
  }, [])

  const updatePrintSetting = useCallback(<K extends keyof PrintSettings>(
    key: K,
    value: PrintSettings[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      printSettings: { ...prev.printSettings, [key]: value },
    }))
  }, [])

  /** Toggle a single column's visibility while keeping its label intact. */
  const toggleColumn = useCallback((key: keyof TemplateColumnsConfig) => {
    setForm((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        columns: {
          ...prev.config.columns,
          [key]: {
            ...prev.config.columns[key],
            visible: !prev.config.columns[key].visible,
          },
        },
      },
    }))
  }, [])

  /** Toggle a single field's visibility flag. */
  const toggleField = useCallback((key: keyof TemplateFieldsConfig) => {
    setForm((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        fields: {
          ...prev.config.fields,
          [key]: !prev.config.fields[key],
        },
      },
    }))
  }, [])

  // --- Validation ---

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}

    const nameError = validateTemplateName(form.name)
    if (nameError !== null) {
      next.name = nameError
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form.name])

  // --- Submit ---

  const mutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      if (template !== null) {
        return updateTemplate(template.id, data)
      }
      return createTemplate(data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates.all() })
      toast.success(`${form.name} ${template !== null ? 'updated' : 'created'}`)
      navigate(ROUTES.SETTINGS + '/templates')
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to save template. Please try again.'
      toast.error(message)
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    if (mutation.isPending) return
    await mutation.mutateAsync(form)
  }, [form, mutation, validate])

  // --- Reset ---

  /** Reset config and print settings to the base-template defaults. Name is preserved. */
  const handleReset = useCallback(() => {
    const base = form.baseTemplate
    setForm((prev) => ({
      ...prev,
      config:        buildDefaultConfig(base),
      printSettings: buildDefaultPrintSettings(base),
    }))
    setErrors({})
  }, [form.baseTemplate])

  // --- Return ---

  return {
    form,
    errors,
    isSubmitting: mutation.isPending,
    activeTab,
    setActiveTab,
    updateName,
    updateConfig,
    updatePrintSetting,
    toggleColumn,
    toggleField,
    validate,
    handleSubmit,
    handleReset,
  }
}
