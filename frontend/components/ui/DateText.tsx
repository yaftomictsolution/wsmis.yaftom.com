'use client'

import { useCalendar } from '@/context/CalendarContext'
import type { DateDisplayStyle } from '@/lib/dates'

export function DateText({
  value,
  style = 'numeric',
  empty = '-',
  secondary,
  className,
}: {
  value?: string | null
  style?: DateDisplayStyle
  empty?: string
  secondary?: boolean
  className?: string
}) {
  const { calendarSystem, showGregorianSecondary, formatDate, gregorianDate } = useCalendar()
  const showSecondary = calendarSystem === 'shamsi' && (secondary ?? showGregorianSecondary) && Boolean(value)

  return (
    <span className={className} dir="auto">
      <span>{formatDate(value, style, empty)}</span>
      {showSecondary ? (
        <span className="ms-1.5 whitespace-nowrap text-[0.78em] text-[var(--text-muted)]">
          ({gregorianDate(value)})
        </span>
      ) : null}
    </span>
  )
}

