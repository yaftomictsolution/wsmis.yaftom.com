'use client'

import { Card } from './Card'
import { useLanguage } from '@/context/LanguageContext'

interface StatsCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: React.ReactNode
}

export function StatsCard({ title, value, change, changeType = 'neutral', icon }: StatsCardProps) {
  const { translate } = useLanguage()
  const changeColors = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-slate-600 dark:text-slate-400',
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{translate(title)}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
          {change !== undefined && (
            <p className={`mt-1 text-sm ${changeColors[changeType]}`}>{translate(change)}</p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">{icon}</div>
        )}
      </div>
    </Card>
  )
}
