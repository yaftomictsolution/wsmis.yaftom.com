'use client'

import Link from 'next/link'
import { CalendarClock, GraduationCap, Settings } from 'lucide-react'
import { useTrainingMode } from '@/context/TrainingModeContext'

export function TrainingEnvironmentBanner() {
  const { status, isTraining } = useTrainingMode()

  if (!isTraining) return null

  return (
    <div className="relative z-20 flex min-h-10 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-amber-400/40 bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-sm">
      <span className="inline-flex items-center gap-2 uppercase">
        <GraduationCap size={16} aria-hidden="true" /> Training Environment
      </span>
      <span className="inline-flex items-center gap-2">
        <CalendarClock size={15} aria-hidden="true" /> Business date: {status.effective_date}
      </span>
      {status.can_manage ? (
        <Link href="/dashboard/settings#training-mode" className="inline-flex items-center gap-1.5 underline underline-offset-2">
          <Settings size={14} aria-hidden="true" /> Change date
        </Link>
      ) : null}
    </div>
  )
}
