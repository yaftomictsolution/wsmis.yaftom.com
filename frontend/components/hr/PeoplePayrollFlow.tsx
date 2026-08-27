'use client'

import Link from 'next/link'
import { CalendarCheck2, Check, ContactRound, WalletCards } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { visibleWorkspaceTabs, workspaces } from '@/lib/workspaces'
import { useGetMeQuery } from '@/src/store/waternetApi'

type PeoplePayrollStep = 'employees' | 'attendance' | 'payroll'

const steps = [
  { id: 'employees', label: 'Employee Setup', detail: 'Create employee and salary', path: '/dashboard/hr', icon: ContactRound },
  { id: 'attendance', label: 'Attendance & Leave', detail: 'Complete the pay period', path: '/dashboard/attendance', icon: CalendarCheck2 },
  { id: 'payroll', label: 'Run Payroll', detail: 'Calculate and approve salary', path: '/dashboard/payroll', icon: WalletCards },
] as const

export function PeoplePayrollFlow({ active }: { active: PeoplePayrollStep }) {
  const { translate } = useLanguage()
  const { data: profile } = useGetMeQuery()
  const peopleWorkspace = workspaces.find((workspace) => workspace.id === 'people')
  const accessiblePaths = new Set(peopleWorkspace ? visibleWorkspaceTabs(peopleWorkspace, profile).map((tab) => tab.path) : [])
  const activeIndex = steps.findIndex((step) => step.id === active)

  return (
    <nav aria-label={translate('People and payroll workflow')} className="mb-5 border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-3 sm:px-4">
      <ol className="grid gap-2 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = step.id === active
          const isComplete = index < activeIndex
          const canOpen = accessiblePaths.has(step.path)
          const content = (
            <>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-[var(--accent)] text-white' : isComplete ? 'bg-[var(--mint-soft)] text-[var(--mint)]' : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'}`}>
                {isComplete ? <Check size={16} /> : <Icon size={17} />}
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="block text-xs font-extrabold text-[var(--text-muted)]">{translate('Step')} {index + 1}</span>
                <span className={`block truncate text-sm font-extrabold ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{translate(step.label)}</span>
                <span className="block truncate text-xs font-semibold text-[var(--text-muted)]">{translate(step.detail)}</span>
              </span>
            </>
          )

          return (
            <li key={step.id} className="min-w-0">
              {canOpen ? (
                <Link href={step.path} aria-current={isActive ? 'step' : undefined} className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${isActive ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-transparent hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]'}`}>
                  {content}
                </Link>
              ) : (
                <div className="flex min-h-16 items-center gap-3 rounded-lg px-3 py-2 opacity-45" aria-disabled="true">{content}</div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
