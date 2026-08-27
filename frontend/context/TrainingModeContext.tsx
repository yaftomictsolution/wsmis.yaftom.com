'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useGetTrainingModeQuery, type TrainingModeStatus } from '@/src/store/waternetApi'

const localDate = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000

  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

type TrainingModeContextValue = {
  status: TrainingModeStatus
  businessDate: string
  isTraining: boolean
}

const fallbackStatus = (): TrainingModeStatus => ({
  environment: 'production',
  enabled: false,
  business_date: null,
  effective_date: localDate(),
  real_date: localDate(),
  can_manage: false,
  reset_confirmation: 'RESET TRAINING DATA',
})

const TrainingModeContext = createContext<TrainingModeContextValue | null>(null)

export function TrainingModeProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useGetTrainingModeQuery()

  if (isLoading && !data) {
    return (
      <div className="app-shell dashboard-main flex h-screen w-full items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--accent-soft)] ring-1 ring-[var(--border-subtle)]" />
      </div>
    )
  }

  const status = data ?? fallbackStatus()

  return (
    <TrainingModeContext.Provider value={{
      status,
      businessDate: status.effective_date,
      isTraining: status.environment === 'training',
    }}>
      {children}
    </TrainingModeContext.Provider>
  )
}

export function useTrainingMode() {
  const context = useContext(TrainingModeContext)
  if (!context) {
    throw new Error('useTrainingMode must be used inside TrainingModeProvider')
  }

  return context
}

export function latestCompletedMonthFor(businessDate: string): string {
  const [year, month] = businessDate.split('-').map(Number)
  const previous = new Date(Date.UTC(year, month - 2, 1))

  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`
}
