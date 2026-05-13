/** useReminderRules — list + CRUD (TanStack Query) */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { listReminderRules, getReminderRule } from '../marketing.service'
import { createReminderRule, updateReminderRule, deleteReminderRule, toggleReminderRule } from '../marketing-crud.service'
import type { CreateReminderRulePayload } from '../marketing.types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const reminderKeys = {
  all:    () => ['marketing', 'reminder-rules'] as const,
  list:   (enabled?: boolean) => ['marketing', 'reminder-rules', 'list', enabled] as const,
  detail: (id: string) => ['marketing', 'reminder-rules', 'detail', id] as const,
}

// ─── useReminderRuleList ──────────────────────────────────────────────────────

export function useReminderRuleList(enabled?: boolean) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: reminderKeys.list(enabled),
    queryFn: ({ signal }) => listReminderRules(enabled, null, signal),
    staleTime: 60_000,
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: reminderKeys.all() })
  }, [queryClient])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { rules: query.data?.data ?? [], status, error: query.error, refresh }
}

// ─── useReminderRuleDetail ────────────────────────────────────────────────────

export function useReminderRuleDetail(id: string) {
  const query = useQuery({
    queryKey: reminderKeys.detail(id),
    queryFn: ({ signal }) => getReminderRule(id, signal),
    enabled: !!id,
  })

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { rule: query.data ?? null, status, error: query.error }
}

// ─── useCreateReminderRule ────────────────────────────────────────────────────

export function useCreateReminderRule() {
  const toast = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateReminderRulePayload) => createReminderRule(payload),
    onSuccess: () => {
      toast.success('Reminder rule saved.')
      void queryClient.invalidateQueries({ queryKey: reminderKeys.all() })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Could not save rule. Please try again.'
      toast.error(msg)
    },
  })
}

// ─── useUpdateReminderRule ────────────────────────────────────────────────────

export function useUpdateReminderRule(id: string, name: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Partial<CreateReminderRulePayload>) => updateReminderRule(id, name, payload),
    onSuccess: () => {
      toast.success('Reminder rule saved.')
      void queryClient.invalidateQueries({ queryKey: reminderKeys.all() })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Could not save rule. Please try again.'
      toast.error(msg)
    },
  })
}

// ─── useDeleteReminderRule ────────────────────────────────────────────────────

export function useDeleteReminderRule() {
  const toast = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => deleteReminderRule(id, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderKeys.all() })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Could not delete rule.'
      toast.error(msg)
    },
  })
}

// ─── useToggleReminderRule ────────────────────────────────────────────────────

export function useToggleReminderRule() {
  const toast = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => toggleReminderRule(id, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderKeys.all() })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Could not update rule.'
      toast.error(msg)
    },
  })
}
