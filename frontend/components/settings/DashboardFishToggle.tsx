'use client'

import { Fish, FishOff } from 'lucide-react'

import { useDashboardEffects } from '@/context/DashboardEffectsContext'
import { useLanguage } from '@/context/LanguageContext'

export function DashboardFishToggle() {
  const { fishVisible, toggleFishVisibility } = useDashboardEffects()
  const { translate } = useLanguage()
  const Icon = fishVisible ? Fish : FishOff
  const actionLabel = fishVisible ? 'Hide dashboard fish' : 'Show dashboard fish'

  return (
    <button
      type="button"
      onClick={toggleFishVisibility}
      className="inline-flex shrink-0 items-center gap-2 text-sm font-extrabold text-[var(--text-secondary)]"
      aria-label={translate(actionLabel)}
      aria-pressed={fishVisible}
      title={translate(actionLabel)}
    >
      <Icon className="h-4 w-4 text-[var(--accent)]" />
      <span>{translate(fishVisible ? 'Shown' : 'Hidden')}</span>
      <span
        className={`relative h-7 w-12 rounded-full border transition-colors ${
          fishVisible
            ? 'border-[var(--accent)] bg-[var(--accent)]'
            : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]'
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            fishVisible ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  )
}
