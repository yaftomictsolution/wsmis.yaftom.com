'use client'

import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useLanguage } from '@/context/LanguageContext'

export const money = (value: string | number | undefined | null) => `AFN ${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
export const dateValue = (value?: string) => (value ? value.slice(0, 10) : '-')
export const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000

  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}
export const latestCompletedMonth = () => {
  const date = new Date()
  const previousMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1)

  return `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`
}
export const monthBounds = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()

  return { period_start: `${month}-01`, period_end: `${month}-${String(lastDay).padStart(2, '0')}` }
}

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } }).data
    const validationMessage = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
    return validationMessage || data?.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

const statusColors: Record<string, 'emerald' | 'amber' | 'blue' | 'red' | 'slate' | 'purple'> = {
  draft: 'slate',
  pending: 'amber',
  pending_review: 'amber',
  pending_approval: 'blue',
  approved: 'emerald',
  closed: 'emerald',
  paid: 'emerald',
  partially_paid: 'purple',
  rejected: 'red',
  missing: 'red',
  cancelled: 'slate',
  active: 'emerald',
  inactive: 'slate',
}

export function FinanceStatus({ value }: { value: string }) {
  const { translate } = useLanguage()
  return <Badge color={statusColors[value] ?? 'slate'}>{translate(value.replaceAll('_', ' '))}</Badge>
}

export function FinanceMetric({ label, value, hint, icon: Icon, tone = 'text-[var(--accent)]' }: {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: string
}) {
  const { translate } = useLanguage()
  return (
    <div className="stat-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted)]">{translate(label)}</p>
          <p className="mt-2 break-words text-xl font-extrabold text-[var(--text-primary)]">{value}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
          <Icon className={`h-5 w-5 ${tone}`} />
        </span>
      </div>
      {hint ? <p className="mt-2 text-xs font-bold text-[var(--text-muted)]">{translate(hint)}</p> : null}
    </div>
  )
}

export function InlineError({ message }: { message?: string }) {
  const { translate } = useLanguage()
  if (!message) return null
  return <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{translate(message)}</div>
}

export const hasRole = (roles: string[] | undefined, allowed: string[]) => Boolean(roles?.some((role) => allowed.includes(role)))
