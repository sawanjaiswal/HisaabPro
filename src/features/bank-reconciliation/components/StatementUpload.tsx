/** #147 StatementUpload — pick a bank account, parse a CSV client-side, import. */
import { useRef, useState } from 'react'
import { Upload, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import { useBankAccounts } from '@/features/bank-accounts/useBankAccounts'
import { parseStatementCsv } from '../bank-reconciliation.utils'
import type { ParsedCsvRow } from '../bank-reconciliation.types'

interface Props {
  onImport: (bankAccountId: string, fileName: string, rows: ParsedCsvRow[]) => void
  isImporting: boolean
}

export function StatementUpload({ onImport, isImporting }: Props) {
  const { t } = useLanguage()
  const { items: accounts, status } = useBankAccounts()
  const fileRef = useRef<HTMLInputElement>(null)

  const [accountId, setAccountId] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedCsvRow[]>([])
  const [parseError, setParseError] = useState(false)
  const [parsing, setParsing] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setParseError(false)
    try {
      const text = await file.text()
      const result = parseStatementCsv(text)
      if (result.rows.length === 0) {
        setParseError(true)
        setRows([])
      } else {
        setRows(result.rows)
        setFileName(file.name)
      }
    } catch {
      setParseError(true)
    } finally {
      setParsing(false)
    }
  }

  const canImport = accountId !== '' && rows.length > 0 && !isImporting

  if (status === 'success' && accounts.length === 0) {
    return (
      <Card className="recon-upload">
        <p className="recon-upload__hint">{t.bankReconNoAccounts}</p>
      </Card>
    )
  }

  return (
    <Card className="recon-upload">
      <label className="recon-upload__label" htmlFor="recon-account">
        {t.bankReconSelectAccount}
      </label>
      <select
        id="recon-account"
        className="recon-upload__select"
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
      >
        <option value="">—</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.bankName} ••{a.accountNumber.slice(-4)}
          </option>
        ))}
      </select>

      <p className="recon-upload__csv-hint">{t.bankReconCsvHint}</p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="recon-upload__file-input"
        onChange={handleFile}
      />
      <Button
        variant="secondary"
        onClick={() => fileRef.current?.click()}
        className="recon-upload__choose"
      >
        <Upload size={18} aria-hidden="true" />
        {t.bankReconChooseFile}
      </Button>

      {parsing && <p className="recon-upload__hint">{t.bankReconParsing}</p>}
      {parseError && <p className="recon-upload__error">{t.bankReconParseError}</p>}
      {rows.length > 0 && (
        <p className="recon-upload__ready">
          <FileText size={16} aria-hidden="true" />
          {fileName} — {rows.length} {t.bankReconRowsReady}
        </p>
      )}

      <Button
        variant="primary"
        disabled={!canImport}
        onClick={() => onImport(accountId, fileName, rows)}
        className="recon-upload__submit"
      >
        {isImporting ? t.bankReconImporting : t.bankReconImport}
      </Button>
    </Card>
  )
}
