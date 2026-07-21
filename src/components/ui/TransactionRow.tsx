/**
 * TransactionRow — shared ledger/transaction row primitive (Emerald Hero skin v2).
 * Date block · direction-tinted icon square · title + reference · signed amount.
 * Reusable across party ledger, invoice, and payment detail lists.
 */

import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { formatPaise } from '@/lib/format'
import './transaction-row.css'

/** 'debit' = money owed / sale (balance ↑, coral). 'credit' = payment received (balance ↓, green). */
export type TransactionDirection = 'debit' | 'credit'

export interface TransactionRowProps {
  /** ISO date string (YYYY-MM-DD) — the day/month block is derived from it. */
  date: string
  direction: TransactionDirection
  /** Primary line, e.g. the voucher particulars ("Sale Invoice"). */
  title: string
  /** Secondary line under the title, e.g. voucher number ("INV-1056"). */
  reference?: string
  /** Amount in PAISE. Credit renders green with a leading minus; debit renders plain. */
  amountPaise: number
  /**
   * Optional status pill on the meta line beside the reference (ledger rows
   * carry the invoice's state — Overdue / Pending / Paid). Label is
   * already-translated; the caller picks the variant so this stays
   * domain-agnostic.
   */
  status?: { label: string; variant: BadgeVariant }
  /** Optional right-aligned subtitle under the amount (e.g. payment mode). */
  subtitle?: string
  /** When provided the row is a button and shows a chevron affordance. */
  onClick?: () => void
}

function dayPart(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : String(d.getDate()).padStart(2, '0')
}

function monthPart(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(d)
}

export function TransactionRow({
  date,
  direction,
  title,
  reference,
  amountPaise,
  status,
  subtitle,
  onClick,
}: TransactionRowProps) {
  const isCredit = direction === 'credit'
  const Arrow = isCredit ? ArrowDown : ArrowUp
  const interactive = typeof onClick === 'function'

  const body = (
    <>
      <div className="txn-row__date">
        <span className="txn-row__day">{dayPart(date)}</span>
        <span className="txn-row__mon">{monthPart(date)}</span>
      </div>

      <span className={`txn-row__icon txn-row__icon--${direction}`} aria-hidden="true">
        <Arrow className="w-4 h-4" />
      </span>

      <div className="txn-row__main">
        <p className="txn-row__title">{title}</p>
        {(reference || status) && (
          <div className="txn-row__meta">
            {reference && <span className="txn-row__ref">{reference}</span>}
            {status && (
              <Badge variant={status.variant} className="txn-row__status">
                {status.label}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="txn-row__amount-wrap">
        <span
          className="txn-row__amount tabular-nums"
          style={{ color: isCredit ? 'var(--color-success-600)' : 'var(--text-primary)' }}
        >
          {isCredit ? '−' : ''}
          {formatPaise(amountPaise)}
        </span>
        {subtitle && <span className="txn-row__sub">{subtitle}</span>}
      </div>

      {interactive && <ChevronRight className="w-4 h-4 txn-row__chevron" aria-hidden="true" />}
    </>
  )

  if (interactive) {
    return (
      <button type="button" className="txn-row txn-row--interactive" onClick={onClick}>
        {body}
      </button>
    )
  }

  return <div className="txn-row">{body}</div>
}
