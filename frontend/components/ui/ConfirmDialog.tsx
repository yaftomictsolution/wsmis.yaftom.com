'use client'

import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { LoadingButton } from './AsyncButton'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose?: () => void
  onCancel?: () => void
  onConfirm: () => Promise<unknown> | unknown
  title: string
  message: string
  confirmLabel?: string
  loadingLabel?: string
  kind?: 'danger' | 'approval' | 'primary'
}

function messageFromError(error: unknown): string {
  const apiError = error as { data?: { message?: string; errors?: Record<string, string[]> }; message?: string }
  const validationMessage = apiError?.data?.errors ? Object.values(apiError.data.errors).flat()[0] : undefined

  return validationMessage || apiError?.data?.message || apiError?.message || 'Unable to complete this action.'
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  loadingLabel = 'Processing...',
  kind = 'danger',
}: ConfirmDialogProps) {
  const { t, translate } = useLanguage()
  const close = onClose ?? onCancel ?? (() => undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const approval = kind === 'approval'
  const Icon = approval ? ShieldCheck : AlertTriangle
  const toneClasses = approval
    ? 'bg-[var(--mint-soft)] text-[var(--mint)]'
    : kind === 'danger'
      ? 'bg-[var(--coral-soft)] text-[var(--coral)]'
      : 'bg-[var(--accent-soft)] text-[var(--accent)]'
  const confirmClasses = approval
    ? 'primary-action flex-1'
    : kind === 'danger'
      ? 'flex-1 rounded-lg bg-[var(--coral)] px-4 py-2 font-bold text-white transition-colors hover:opacity-90'
      : 'primary-action flex-1'

  useEffect(() => {
    if (!isOpen) {
      setLoading(false)
      setError('')
    }
  }, [isOpen])

  const confirm = async () => {
    setLoading(true)
    setError('')
    try {
      await onConfirm()
      close()
    } catch (actionError) {
      setError(messageFromError(actionError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => undefined : close} title={translate(title)} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon size={24} />
        </div>
        <p className="mb-5 text-[var(--text-secondary)]">{translate(message)}</p>
        {error ? <p role="alert" className="mb-5 w-full rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-3 py-2 text-sm font-bold text-[var(--coral)]">{translate(error)}</p> : null}
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="secondary-action flex-1"
          >
            {t('cancel')}
          </button>
          <LoadingButton
            onClick={() => void confirm()}
            loading={loading}
            loadingLabel={loadingLabel}
            className={confirmClasses}
          >
            {translate(confirmLabel)}
          </LoadingButton>
        </div>
      </div>
    </Modal>
  )
}
