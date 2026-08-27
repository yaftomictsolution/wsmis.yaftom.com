'use client'

import type { ReactNode } from 'react'
import { useLanguage } from '@/context/LanguageContext'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  const { t, translate } = useLanguage()

  return (
    <div className="page-header flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-normal text-[var(--text-secondary)]">{t('workspace')}</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-normal">{translate(title)}</h1>
        {subtitle && <p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">{translate(subtitle)}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-3">{children}</div>}
    </div>
  )
}
