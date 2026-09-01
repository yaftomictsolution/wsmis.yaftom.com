'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  DatabaseZap,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { useLanguage } from '@/context/LanguageContext'
import {
  waternetApi,
  useAcquireOfflineLeaseMutation,
  useAdvanceSyncRunMutation,
  useGetSyncConflictsQuery,
  useGetSyncStatusQuery,
  useRepairCloudSyncQueueMutation,
  useReleaseOfflineLeaseMutation,
  useResolveSyncConflictMutation,
  useStartSyncRunMutation,
  type SyncConflict,
  type SyncRunProgress,
} from '@/src/store/waternetApi'
import type { AppDispatch } from '@/src/store/store'

type ConfirmAction =
  | { type: 'acquire' }
  | { type: 'release' }
  | { type: 'resolve'; conflict: SyncConflict; resolution: 'use_remote' | 'keep_local' }

const errorMessage = (error: unknown) => {
  const apiError = error as { data?: { message?: string; errors?: Record<string, string[]> }; message?: string }
  const validation = apiError?.data?.errors ? Object.values(apiError.data.errors).flat()[0] : undefined
  return validation || apiError?.data?.message || apiError?.message || 'Synchronization failed.'
}

const waitForPaint = () => new Promise((resolve) => window.setTimeout(resolve, 120))

export function SyncCenter({ canView, canManage = false }: { canView: boolean; canManage?: boolean }) {
  const dispatch = useDispatch<AppDispatch>()
  const { language } = useLanguage()
  const fa = language === 'fa'
  const [open, setOpen] = useState(false)
  const [online, setOnline] = useState(true)
  const [run, setRun] = useState<SyncRunProgress | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const { data: status, error: statusError, isLoading: statusLoading, refetch } = useGetSyncStatusQuery(undefined, {
    skip: !canView,
    pollingInterval: open ? 5000 : 30000,
    refetchOnReconnect: true,
  })
  const { data: conflicts = [], refetch: refetchConflicts } = useGetSyncConflictsQuery(undefined, {
    skip: !canView || !open || !status?.enabled,
  })
  const [startSync, startState] = useStartSyncRunMutation()
  const [advanceSync] = useAdvanceSyncRunMutation()
  const [repairCloudQueue, repairCloudQueueState] = useRepairCloudSyncQueueMutation()
  const [resolveConflict] = useResolveSyncConflictMutation()
  const [acquireLease] = useAcquireOfflineLeaseMutation()
  const [releaseLease] = useReleaseOfflineLeaseMutation()

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const activeRun = run ?? (status?.latest_run?.status === 'running' ? status.latest_run : null)
  const syncReady = Boolean(status?.enabled)
  const busy = syncReady && (startState.isLoading || repairCloudQueueState.isLoading || run?.status === 'running')
  const resumable = !run && activeRun?.status === 'running'
  const attention = (status?.pending_changes ?? 0) + (status?.open_conflicts ?? 0)
  const healthy = status?.mode === 'cloud'
    ? attention === 0 && !status.last_error
    : Boolean(status?.last_sync_at && attention === 0 && !status.last_error)
  const stageLabels = useMemo<Record<string, string>>(() => fa ? {
    prepare: 'بررسی اتصال امن',
    detect: 'یافتن تغییرات محلی',
    push: 'فرستادن تغییرات به سرور',
    pull: 'دریافت تغییرات آنلاین',
    verify: 'بررسی یکسان بودن معلومات',
    complete: 'تکمیل شد',
  } : {
    prepare: 'Checking secure connection',
    detect: 'Finding local changes',
    push: 'Sending changes to cloud',
    pull: 'Downloading online changes',
    verify: 'Verifying both databases',
    complete: 'Complete',
  }, [fa])

  if (!canView) return null

  if (!status || !syncReady) {
    const message = statusError
      ? errorMessage(statusError)
      : statusLoading
        ? (fa ? 'در حال بررسی تنظیمات همگام‌سازی...' : 'Checking synchronization setup...')
        : (fa
            ? 'همگام‌سازی هنوز در فایل تنظیمات فعال نشده است. در بک‌اند مقدار SYNC_ENABLED=true را تنظیم کنید.'
            : 'Synchronization is not enabled yet. Set SYNC_ENABLED=true in the backend environment.')

    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="icon-button relative"
          title={fa ? 'همگام‌سازی معلومات' : 'Data synchronization'}
          aria-label={fa ? 'همگام‌سازی معلومات' : 'Data synchronization'}
        >
          <CloudOff size={17} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--gold)] ring-2 ring-[var(--bg-surface)]" />
        </button>

        <Modal isOpen={open} onClose={() => setOpen(false)} title={fa ? 'مرکز همگام‌سازی' : 'Synchronization Center'} size="sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-soft)] p-4">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[var(--gold)]" />
              <div>
                <p className="font-black text-[var(--text-primary)]">{fa ? 'همگام‌سازی آماده نیست' : 'Synchronization is not ready'}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{message}</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              {fa
                ? 'آیکن همیشه برای مدیران نمایش داده می‌شود تا وضعیت تنظیمات واضح باشد.'
                : 'The icon stays visible for managers and admins so setup status is clear.'}
            </p>
          </div>
        </Modal>
      </>
    )
  }

  const runSynchronization = async (existingRun?: SyncRunProgress | null): Promise<SyncRunProgress> => {
    setError('')
    try {
      let nextRun = existingRun ?? await startSync().unwrap()
      setRun(nextRun)
      while (nextRun.status === 'running') {
        await waitForPaint()
        nextRun = await advanceSync(nextRun.run_uuid).unwrap()
        setRun(nextRun)
      }
      await Promise.all([refetch(), refetchConflicts()])
      if (nextRun.status === 'completed' || nextRun.status === 'completed_with_warnings') {
        dispatch(waternetApi.util.invalidateTags([
          'Dashboard', 'Customers', 'CustomerDetail', 'Invoices', 'Payments', 'Accounting',
          'AccountingAccounts', 'Meters', 'MeterAssignments', 'MeterReadings', 'InventoryItems',
          'InventoryRequests', 'InventoryIssues', 'Warehouses', 'Employees', 'Attendance',
          'LeaveRequests', 'Payroll', 'FinancialReports', 'Sync',
        ]))
      }
      if (nextRun.status === 'failed') {
        throw new Error(nextRun.error || 'Synchronization failed.')
      }

      return nextRun
    } catch (syncError) {
      setError(errorMessage(syncError))
      await refetch()
      throw syncError
    }
  }

  const repairCloudStatus = async () => {
    setError('')
    setNotice('')
    try {
      const result = await repairCloudQueue().unwrap()
      setNotice(result.message)
      await refetch()
    } catch (repairError) {
      setError(errorMessage(repairError))
      await refetch()
    }
  }

  const confirm = async () => {
    if (!confirmAction) return
    if (confirmAction.type === 'acquire') {
      await runSynchronization(resumable ? activeRun : null)
      const refreshed = await refetch()
      if ((refreshed.data?.open_conflicts ?? 0) > 0 || (refreshed.data?.pending_changes ?? 0) > 0) {
        throw new Error('Resolve synchronization conflicts before starting offline work.')
      }
      await acquireLease({}).unwrap()
    } else if (confirmAction.type === 'release') {
      await runSynchronization(resumable ? activeRun : null)
      const refreshed = await refetch()
      if ((refreshed.data?.open_conflicts ?? 0) > 0 || (refreshed.data?.pending_changes ?? 0) > 0) {
        throw new Error('Resolve synchronization conflicts before returning to online work.')
      }
      await releaseLease().unwrap()
    } else {
      await resolveConflict({
        conflictUuid: confirmAction.conflict.conflict_uuid,
        resolution: confirmAction.resolution,
      }).unwrap()
    }
    await Promise.all([refetch(), refetchConflicts()])
    setConfirmAction(null)
  }

  const confirmText = confirmAction?.type === 'acquire'
    ? {
        title: fa ? 'شروع کار آفلاین' : 'Start Offline Work',
        message: fa
          ? 'ویرایش در وب‌سایت آنلاین موقتاً قفل می‌شود و کمپیوتر محلی اجازه ثبت معلومات را می‌گیرد.'
          : 'The online website will become read-only while this local computer records offline work.',
        label: fa ? 'شروع کار آفلاین' : 'Start Offline Work',
      }
    : confirmAction?.type === 'release'
      ? {
          title: fa ? 'بازگشت به حالت آنلاین' : 'Return To Online Work',
          message: fa
            ? 'این کار تنها پس از همگام‌سازی کامل و رفع تمام اختلاف‌ها انجام می‌شود.'
            : 'The system will synchronize local changes first, verify both databases, and then return control to the online website.',
          label: fa ? 'همگام‌سازی و بازگشت آنلاین' : 'Sync & Return Online',
        }
      : {
          title: fa ? 'رفع اختلاف معلومات' : 'Resolve Data Conflict',
          message: confirmAction?.resolution === 'use_remote'
            ? (fa ? 'نسخه آنلاین جای نسخه محلی را می‌گیرد. این تصمیم قابل برگشت نیست.' : 'The online version will replace the local version. This decision cannot be undone.')
            : (fa ? 'نسخه محلی نگه‌داشته شده و در همگام‌سازی بعدی به سرور فرستاده می‌شود.' : 'The local version will be kept and sent to the cloud during the next sync.'),
          label: confirmAction?.resolution === 'use_remote'
            ? (fa ? 'استفاده از نسخه آنلاین' : 'Use Online Version')
            : (fa ? 'نگهداری نسخه محلی' : 'Keep Local Version'),
        }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="icon-button relative"
        title={fa ? 'همگام‌سازی معلومات' : 'Data synchronization'}
        aria-label={fa ? 'همگام‌سازی معلومات' : 'Data synchronization'}
      >
        {online ? <Cloud size={17} /> : <CloudOff size={17} />}
        {attention > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[10px] font-black text-white">
            {attention > 9 ? '9+' : attention}
          </span>
        ) : healthy ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--mint)] ring-2 ring-[var(--bg-surface)]" />
        ) : null}
      </button>

      <Modal isOpen={open} onClose={busy ? () => undefined : () => setOpen(false)} title={fa ? 'مرکز همگام‌سازی' : 'Synchronization Center'} size="lg">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-subtle)] p-3">
              <div className="flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                {online ? <Wifi size={16} className="text-[var(--mint)]" /> : <WifiOff size={16} className="text-[var(--coral)]" />}
                {online ? (fa ? 'اینترنت وصل است' : 'Internet connected') : (fa ? 'حالت آفلاین' : 'Working offline')}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{status.mode === 'local' ? (fa ? 'کمپیوتر محلی' : 'Local computer') : (fa ? 'سرور آنلاین' : 'Cloud server')}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] p-3">
              <div className="flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                <DatabaseZap size={16} className="text-[var(--accent)]" />
                {fa ? `${status.pending_changes} تغییر در انتظار` : `${status.pending_changes} pending changes`}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : (fa ? 'هنوز همگام نشده' : 'Never synchronized')}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] p-3">
              <div className="flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                {status.open_conflicts > 0 ? <AlertTriangle size={16} className="text-[var(--gold)]" /> : <CheckCircle2 size={16} className="text-[var(--mint)]" />}
                {fa ? `${status.open_conflicts} اختلاف` : `${status.open_conflicts} conflicts`}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{status.open_conflicts ? (fa ? 'نیاز به تصمیم مدیر' : 'Administrator decision required') : (fa ? 'اختلافی وجود ندارد' : 'No unresolved conflicts')}</p>
            </div>
          </div>

          {activeRun ? (
            <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black text-[var(--text-primary)]">
                <span>{stageLabels[activeRun.stage] ?? activeRun.stage}</span>
                <span>{activeRun.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out" style={{ width: `${activeRun.progress}%` }} />
              </div>
              {activeRun.status === 'failed' ? <p className="mt-3 text-sm font-bold text-[var(--coral)]">{activeRun.error}</p> : null}
              {activeRun.warnings?.map((warning) => <p key={warning} className="mt-2 text-xs font-bold text-[var(--gold)]">{warning}</p>)}
            </div>
          ) : null}

          {error || status.last_error ? (
            <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {error || status.last_error}
            </div>
          ) : null}

          {notice ? (
            <div role="status" className="rounded-lg border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-4 py-3 text-sm font-bold text-[var(--mint)]">
              {notice}
            </div>
          ) : null}

          {status.mode === 'local' ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!online || busy || !canManage} onClick={() => void runSynchronization(resumable ? activeRun : null).catch(() => undefined)} className="primary-action gap-2 disabled:cursor-not-allowed disabled:opacity-50">
                <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
                {busy
                  ? (fa ? 'در حال همگام‌سازی...' : 'Synchronizing...')
                  : resumable
                    ? (fa ? 'ادامه همگام‌سازی' : 'Resume Sync')
                    : (fa ? 'همگام‌سازی اکنون' : 'Sync Now')}
              </button>
              {status.writer_mode === 'cloud' ? (
                <button type="button" disabled={!online || busy || !canManage} onClick={() => setConfirmAction({ type: 'acquire' })} className="secondary-action gap-2 disabled:opacity-50">
                  <ShieldCheck size={16} /> {fa ? 'شروع کار آفلاین' : 'Start Offline Work'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!online || busy || !canManage || status.open_conflicts > 0}
                  title={status.open_conflicts > 0 ? (fa ? 'ابتدا اختلاف‌های همگام‌سازی را حل کنید.' : 'Resolve synchronization conflicts first.') : undefined}
                  onClick={() => setConfirmAction({ type: 'release' })}
                  className="secondary-action gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Cloud size={16} /> {fa ? 'همگام‌سازی و بازگشت آنلاین' : 'Sync & Return Online'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <ShieldCheck size={18} className={status.writer_mode === 'local' ? 'text-[var(--gold)]' : 'text-[var(--mint)]'} />
              {status.writer_mode === 'local'
                ? (fa ? 'کمپیوتر دفتر در حال کار آفلاین است؛ ویرایش آنلاین موقتاً قفل است.' : 'The office computer is working offline; online editing is temporarily locked.')
                : (fa ? 'ویرایش آنلاین فعال است.' : 'Online editing is active.')}
              </div>
              {status.pending_changes > 0 && canManage ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-soft)] px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-[var(--text-primary)]">{fa ? 'اصلاح وضعیت همگام‌سازی' : 'Fix Sync Status'}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {fa ? 'این تغییرات در صف قدیمی سرور است و اطلاعات اصلی سیستم را تغییر نمی‌دهد.' : 'This is a stale cloud queue notice. Fixing it does not change business records.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void repairCloudStatus()}
                    className="secondary-action gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={repairCloudQueueState.isLoading ? 'animate-spin' : ''} />
                    {repairCloudQueueState.isLoading
                      ? (fa ? 'در حال اصلاح...' : 'Fixing...')
                      : (fa ? 'اصلاح اکنون' : 'Fix Now')}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {conflicts.length > 0 ? (
            <div className="border-t border-[var(--border-subtle)] pt-4">
              <h3 className="mb-3 text-sm font-black text-[var(--text-primary)]">{fa ? 'اختلاف‌های نیازمند بررسی' : 'Conflicts Requiring Review'}</h3>
              <div className="space-y-2">
                {conflicts.map((conflict) => (
                  <div key={conflict.conflict_uuid} className="rounded-lg border border-[var(--gold)]/30 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[var(--text-primary)]">{conflict.table_name.replaceAll('_', ' ')}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{conflict.reason}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setConfirmAction({ type: 'resolve', conflict, resolution: 'keep_local' })} className="secondary-action px-3 py-1.5 text-xs">
                          {fa ? 'نسخه محلی' : 'Keep Local'}
                        </button>
                        <button type="button" onClick={() => setConfirmAction({ type: 'resolve', conflict, resolution: 'use_remote' })} className="secondary-action px-3 py-1.5 text-xs">
                          {fa ? 'نسخه آنلاین' : 'Use Online'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirm}
        title={confirmText.title}
        message={confirmText.message}
        confirmLabel={confirmText.label}
        loadingLabel={fa ? 'در حال اجرا...' : 'Processing...'}
        kind={confirmAction?.type === 'resolve' && confirmAction.resolution === 'use_remote' ? 'danger' : 'primary'}
      />
    </>
  )
}
