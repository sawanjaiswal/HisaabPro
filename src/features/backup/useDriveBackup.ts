/** Audit #5 — Drive backup hook: status query + connect/backup/disconnect mutations. */

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import {
  fetchDriveStatus,
  fetchConnectUrl,
  backupNow,
  disconnectDrive,
} from './backup.service'
import {
  DRIVE_QUERY_KEY,
  CALLBACK_CONNECTED_PARAM,
  CALLBACK_ERROR_PARAM,
} from './backup.constants'

export function useDriveBackup() {
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()

  const { data, status, refetch } = useQuery({
    queryKey: DRIVE_QUERY_KEY,
    queryFn: fetchDriveStatus,
  })

  // Surface the OAuth callback outcome (?connected=1 / ?error=1) then clean the URL.
  useEffect(() => {
    if (params.get(CALLBACK_CONNECTED_PARAM)) {
      toast.success(t.backupConnected)
      void queryClient.invalidateQueries({ queryKey: DRIVE_QUERY_KEY })
      params.delete(CALLBACK_CONNECTED_PARAM)
      setParams(params, { replace: true })
    } else if (params.get(CALLBACK_ERROR_PARAM)) {
      toast.error(t.backupConnectFailed)
      params.delete(CALLBACK_ERROR_PARAM)
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const connect = useMutation({
    mutationFn: fetchConnectUrl,
    onSuccess: (res) => {
      // Full-page navigation to Google's consent screen.
      window.location.href = res.authUrl
    },
    onError: () => toast.error(t.backupConnectFailed),
  })

  const runBackup = useMutation({
    mutationFn: backupNow,
    onSuccess: () => {
      toast.success(t.backupUploaded)
      void queryClient.invalidateQueries({ queryKey: DRIVE_QUERY_KEY })
    },
    onError: () => toast.error(t.backupUploadFailed),
  })

  const disconnect = useMutation({
    mutationFn: disconnectDrive,
    onSuccess: () => {
      toast.success(t.backupDisconnected)
      void queryClient.invalidateQueries({ queryKey: DRIVE_QUERY_KEY })
    },
    onError: () => toast.error(t.backupDisconnectFailed),
  })

  return {
    status,
    refetch,
    data,
    connect: () => connect.mutate(),
    isConnecting: connect.isPending,
    runBackup: () => runBackup.mutate(),
    isBackingUp: runBackup.isPending,
    disconnect: () => disconnect.mutate(),
    isDisconnecting: disconnect.isPending,
  }
}
