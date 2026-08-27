'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingLabel?: string
}

export function LoadingButton({
  loading = false,
  loadingLabel = 'Saving...',
  children,
  className = 'primary-action',
  disabled,
  ...props
}: LoadingButtonProps) {
  const { translate } = useLanguage()

  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      className={`relative ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      <span className={`inline-flex items-center justify-center gap-2 ${loading ? 'invisible' : ''}`}>
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2 px-3">
          <LoaderCircle className="shrink-0 animate-spin" size={17} aria-hidden="true" />
          <span>{translate(loadingLabel)}</span>
        </span>
      ) : null}
    </button>
  )
}

interface AsyncIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onAction: () => Promise<unknown>
  onError?: (error: unknown) => void
  children: ReactNode
}

export function AsyncIconButton({
  onAction,
  onError,
  children,
  className = 'icon-button h-8 w-8',
  disabled,
  ...props
}: AsyncIconButtonProps) {
  const [loading, setLoading] = useState(false)

  const execute = async () => {
    if (loading) return
    setLoading(true)
    try {
      await onAction()
    } catch (error) {
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      {...props}
      type="button"
      className={className}
      disabled={disabled || loading}
      aria-busy={loading}
      onClick={() => void execute()}
    >
      {loading ? <LoaderCircle className="animate-spin" size={14} aria-hidden="true" /> : children}
    </button>
  )
}
