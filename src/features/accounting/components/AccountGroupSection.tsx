/** AccountGroupSection — One type section (e.g. Assets) with its accounts */

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { formatPaise } from '../accounting.utils'
import { ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_BG } from '../accounting.constants'
import type { LedgerAccount, AccountType } from '../accounting.types'

interface AccountGroupSectionProps {
  type: AccountType
  label: string
  accounts: LedgerAccount[]
  groupBalance: number
}

export function AccountGroupSection({
  type,
  label,
  accounts,
  groupBalance,
}: AccountGroupSectionProps) {
  const [open, setOpen] = useState(true)

  if (accounts.length === 0) return null

  const color = ACCOUNT_TYPE_COLORS[type]
  const bg = ACCOUNT_TYPE_BG[type]

  return (
    <section className="acc-group" aria-label={label}>
      <button
        type="button"
        className="acc-group-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${label} section, ${accounts.length} accounts`}
        style={{ borderLeftColor: color }}
      >
        <div className="acc-group-title">
          <span className="acc-group-dot" style={{ background: color }} aria-hidden="true" />
          <span className="acc-group-name">{label}</span>
          <span className="acc-group-count">{accounts.length}</span>
        </div>
        <div className="acc-group-right">
          <span className="acc-group-balance">{formatPaise(Math.abs(groupBalance))}</span>
          {open
            ? <ChevronDown size={16} aria-hidden="true" />
            : <ChevronRight size={16} aria-hidden="true" />
          }
        </div>
      </button>

      {open && (
        <ul className="acc-list" role="list">
          {accounts.map((account) => (
            <li key={account.id} className="acc-row">
              <div className="acc-row-left">
                <span
                  className="acc-code-badge"
                  style={{ color, background: bg }}
                >
                  {account.code}
                </span>
                <div className="acc-row-info">
                  <span className="acc-row-name">{account.name}</span>
                  {account.subType && (
                    <span className="acc-row-sub">{account.subType}</span>
                  )}
                </div>
              </div>
              <span
                className="acc-row-balance"
                style={{ color: account.balance < 0 ? 'var(--color-error-600)' : 'var(--color-gray-800)' }}
              >
                {formatPaise(Math.abs(account.balance))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
