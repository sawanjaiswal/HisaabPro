/** Audit #5 — Google Drive backup card: 4 UI states + consent + actions. */

import { Text } from '@/components/ui/Text'
import { useState } from 'react'
import { Cloud, CloudOff, ShieldCheck, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import { useDriveBackup } from './useDriveBackup'

export function DriveBackupCard() {
  const { t } = useLanguage()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const {
    status,
    data,
    refetch,
    connect,
    isConnecting,
    runBackup,
    isBackingUp,
    disconnect,
    isDisconnecting,
  } = useDriveBackup()

  if (status === 'pending') {
    return (
      <Card className="space-y-3">
        <Skeleton width="50%" height="1.5rem" />
        <Skeleton width="75%" height="1rem" />
        <Skeleton width="100%" height="2.75rem" />
      </Card>
    )
  }

  if (status === 'error') {
    return <ErrorState message={t.backupStatusError} onRetry={() => void refetch()} />
  }

  // Server reports the feature is not configured on this deployment.
  if (data && !data.configured) {
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <CloudOff className="w-5 h-5" style={{ color: 'var(--color-gray-400)' }} />
          <Text className="text-base font-medium">{t.backupTitle}</Text>
        </div>
        <Text className="text-sm" style={{ color: 'var(--color-gray-500)' }}>
          {t.backupUnavailable}
        </Text>
      </Card>
    )
  }

  const connected = data?.connected === true
  const lastBackup = data?.lastBackupAt
    ? new Date(data.lastBackupAt).toLocaleString('en-IN')
    : null

  return (
    <>
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5" style={{ color: 'var(--color-primary-500)' }} />
            <Text className="text-base font-medium">{t.backupTitle}</Text>
          </div>
          {connected && <Badge variant="paid">{t.backupConnectedBadge}</Badge>}
        </div>

        <Text className="text-sm" style={{ color: 'var(--color-gray-500)' }}>
          {t.backupConsent}
        </Text>

        {connected ? (
          <div className="space-y-3">
            <div className="text-sm" style={{ color: 'var(--color-gray-600)' }}>
              <Text className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-primary-500)' }} />
                {data?.email}
              </Text>
              <Text className="mt-1 tabular-nums">
                {lastBackup ? `${t.backupLastRun}: ${lastBackup}` : t.backupNeverRun}
              </Text>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="primary"
                onClick={runBackup}
                loading={isBackingUp}
                className="min-h-11 sm:flex-1"
              >
                <RefreshCw className="w-4 h-4" />
                {t.backupNow}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(true)}
                disabled={isDisconnecting}
                className="min-h-11"
              >
                {t.backupDisconnect}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={connect}
            loading={isConnecting}
            className="min-h-11 w-full"
          >
            <Cloud className="w-4 h-4" />
            {t.backupConnect}
          </Button>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          disconnect()
        }}
        title={t.backupDisconnectTitle}
        description={t.backupDisconnectConfirm}
        confirmLabel={t.backupDisconnect}
        isLoading={isDisconnecting}
      />
    </>
  )
}
