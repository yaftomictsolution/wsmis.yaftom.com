'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { DayPicker, enUS, faIR, getDateLib } from '@daypicker/persian'
import { useCalendar } from '@/context/CalendarContext'
import { useLanguage } from '@/context/LanguageContext'
import {
  dariShamsiMonths,
  englishShamsiMonths,
  localizedDigits,
  parseApiDate,
  toApiDate,
} from '@/lib/dates'

type DatePickerFieldProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  min?: string
  max?: string
  describedBy?: string
  className?: string
}

const jalaliDateLib = getDateLib()

export function DatePickerField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  min,
  max,
  describedBy,
  className,
}: DatePickerFieldProps) {
  const { calendarSystem, formatDate } = useCalendar()
  const { language, direction, translate } = useLanguage()
  const [open, setOpen] = useState(false)
  const [openCaptionMenu, setOpenCaptionMenu] = useState<'month' | 'year' | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const selected = parseApiDate(value)
  const minDate = parseApiDate(min)
  const maxDate = parseApiDate(max)
  const today = new Date()
  const currentShamsiYear = jalaliDateLib.getYear(today)
  const selectedShamsiYear = selected ? jalaliDateLib.getYear(selected) : currentShamsiYear
  const minShamsiYear = minDate ? jalaliDateLib.getYear(minDate) : currentShamsiYear
  const maxShamsiYear = maxDate ? jalaliDateLib.getYear(maxDate) : currentShamsiYear
  const navigationStart = minDate ?? jalaliDateLib.newDate(
    Math.min(currentShamsiYear - 100, selectedShamsiYear, maxShamsiYear),
    0,
    1,
  )
  const navigationEnd = maxDate ?? jalaliDateLib.newDate(
    Math.max(currentShamsiYear + 20, selectedShamsiYear, minShamsiYear),
    11,
    1,
  )
  const defaultMonth = selected
    ?? (minDate && today < minDate ? minDate : undefined)
    ?? (maxDate && today > maxDate ? maxDate : undefined)
    ?? today
  const [visibleMonth, setVisibleMonth] = useState(defaultMonth)
  const visibleShamsiYear = jalaliDateLib.getYear(visibleMonth)
  const visibleShamsiMonth = jalaliDateLib.getMonth(visibleMonth)
  const navigationStartYear = jalaliDateLib.getYear(navigationStart)
  const navigationStartMonth = jalaliDateLib.getMonth(navigationStart)
  const navigationEndYear = jalaliDateLib.getYear(navigationEnd)
  const navigationEndMonth = jalaliDateLib.getMonth(navigationEnd)
  const monthNames = language === 'fa' ? dariShamsiMonths : englishShamsiMonths
  const availableYears = Array.from(
    { length: navigationEndYear - navigationStartYear + 1 },
    (_, index) => navigationEndYear - index,
  )
  const monthIndex = (year: number, month: number) => year * 12 + month
  const minimumMonthIndex = monthIndex(navigationStartYear, navigationStartMonth)
  const maximumMonthIndex = monthIndex(navigationEndYear, navigationEndMonth)
  const visibleMonthIndex = monthIndex(visibleShamsiYear, visibleShamsiMonth)

  const changeVisibleMonth = (year: number, month: number) => {
    const requestedIndex = Math.max(minimumMonthIndex, Math.min(monthIndex(year, month), maximumMonthIndex))
    const nextYear = Math.floor(requestedIndex / 12)
    const nextMonth = requestedIndex % 12
    setVisibleMonth(jalaliDateLib.newDate(nextYear, nextMonth, 1))
    setOpenCaptionMenu(null)
  }

  useEffect(() => {
    if (!open) {
      setOpenCaptionMenu(null)
      return
    }
    setVisibleMonth(defaultMonth)
    // The selected value and boundaries are the stable inputs for the opening month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, min, max])

  useEffect(() => {
    if (!open) return

    const placePanel = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const panelWidth = Math.min(344, window.innerWidth - 16)
      const left = direction === 'rtl'
        ? Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8))
        : Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
      const spaceBelow = window.innerHeight - rect.bottom
      const panelHeight = panelRef.current?.offsetHeight ?? 420
      const top = spaceBelow >= panelHeight + 8
        ? rect.bottom + 8
        : Math.max(8, Math.min(rect.top - panelHeight - 8, window.innerHeight - panelHeight - 8))
      setPosition({ top, left })
    }

    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    placePanel()
    window.addEventListener('resize', placePanel)
    window.addEventListener('scroll', placePanel, true)
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('resize', placePanel)
      window.removeEventListener('scroll', placePanel, true)
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [direction, open])

  const disabledDays = useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = []
    if (minDate) matchers.push({ before: minDate })
    if (maxDate) matchers.push({ after: maxDate })
    return matchers
  }, [maxDate, minDate])

  if (calendarSystem === 'gregorian') {
    return (
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        aria-describedby={describedBy}
        className={className}
      />
    )
  }

  const calendarPanel = typeof document !== 'undefined' && open ? createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={language === 'fa' ? 'انتخاب تاریخ هجری شمسی' : 'Select Hijri Shamsi date'}
      className="shamsi-date-popover fixed z-[400] max-h-[calc(100vh-16px)] w-[344px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 text-[var(--text-primary)] shadow-2xl"
      style={{ top: position.top, left: position.left }}
      dir={direction}
    >
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-xs font-extrabold text-[var(--text-muted)]">
          {language === 'fa' ? 'تقویم هجری شمسی' : 'Hijri Shamsi Calendar'}
        </p>
        {!required && value ? (
          <button
            type="button"
            className="icon-button h-7 w-7"
            title={translate('Clear')}
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      <div className="mb-3 grid grid-cols-[34px_minmax(0,1fr)_34px] items-center gap-2" onPointerDown={() => setOpenCaptionMenu(null)}>
        <button
          type="button"
          className="icon-button h-[34px] w-[34px] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={translate('Previous month')}
          title={translate('Previous month')}
          disabled={visibleMonthIndex <= minimumMonthIndex}
          onClick={() => changeVisibleMonth(visibleShamsiYear, visibleShamsiMonth - 1)}
        >
          {direction === 'rtl' ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_92px] gap-2" onPointerDown={(event) => event.stopPropagation()}>
          <div className="relative min-w-0">
            <button
              type="button"
              className="flex h-[34px] w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 text-xs font-extrabold text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              aria-haspopup="listbox"
              aria-expanded={openCaptionMenu === 'month'}
              onClick={() => setOpenCaptionMenu((menu) => menu === 'month' ? null : 'month')}
            >
              <span className="truncate">{monthNames[visibleShamsiMonth]}</span>
              <ChevronDown size={14} className="shrink-0" />
            </button>
            {openCaptionMenu === 'month' && (
              <div role="listbox" aria-label={translate('Month')} className="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-52 overflow-y-auto rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1 shadow-xl">
                {monthNames.map((monthName, month) => {
                  const optionIndex = monthIndex(visibleShamsiYear, month)
                  const optionDisabled = optionIndex < minimumMonthIndex || optionIndex > maximumMonthIndex
                  return (
                    <button
                      key={monthName}
                      type="button"
                      role="option"
                      aria-selected={month === visibleShamsiMonth}
                      disabled={optionDisabled}
                      className="flex min-h-9 w-full items-center justify-between gap-2 rounded px-2.5 text-start text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
                      onClick={() => changeVisibleMonth(visibleShamsiYear, month)}
                    >
                      <span>{monthName}</span>
                      {month === visibleShamsiMonth && <Check size={14} className="shrink-0 text-[var(--accent)]" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="relative min-w-0">
            <button
              type="button"
              className="flex h-[34px] w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 text-xs font-extrabold text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              aria-haspopup="listbox"
              aria-expanded={openCaptionMenu === 'year'}
              onClick={() => setOpenCaptionMenu((menu) => menu === 'year' ? null : 'year')}
            >
              <span>{localizedDigits(String(visibleShamsiYear), language)}</span>
              <ChevronDown size={14} className="shrink-0" />
            </button>
            {openCaptionMenu === 'year' && (
              <div role="listbox" aria-label={translate('Year')} className="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-52 overflow-y-auto rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1 shadow-xl">
                {availableYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    role="option"
                    aria-selected={year === visibleShamsiYear}
                    className="flex min-h-9 w-full items-center justify-between gap-2 rounded px-2.5 text-start text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                    onClick={() => changeVisibleMonth(year, visibleShamsiMonth)}
                  >
                    <span>{localizedDigits(String(year), language)}</span>
                    {year === visibleShamsiYear && <Check size={14} className="shrink-0 text-[var(--accent)]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="icon-button h-[34px] w-[34px] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={translate('Next month')}
          title={translate('Next month')}
          disabled={visibleMonthIndex >= maximumMonthIndex}
          onClick={() => changeVisibleMonth(visibleShamsiYear, visibleShamsiMonth + 1)}
        >
          {direction === 'rtl' ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
        </button>
      </div>
      <DayPicker
        mode="single"
        selected={selected}
        month={visibleMonth}
        onMonthChange={setVisibleMonth}
        startMonth={navigationStart}
        endMonth={navigationEnd}
        captionLayout="label"
        hideNavigation
        onSelect={(date) => {
          if (!date) return
          onChange(toApiDate(date))
          setOpen(false)
        }}
        disabled={disabledDays}
        locale={language === 'fa' ? faIR : enUS}
        dir={direction}
        numerals={language === 'fa' ? 'arabext' : 'latn'}
        showOutsideDays
        fixedWeeks
      />
      <p className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-center text-[11px] font-bold text-[var(--text-muted)]">
        {language === 'fa' ? 'تاریخ به میلادی در سیستم ذخیره می‌شود.' : 'Saved securely as a Gregorian system date.'}
      </p>
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${className ?? ''} flex items-center justify-between gap-3 text-start disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
          {value ? formatDate(value, 'long') : (placeholder || (language === 'fa' ? 'تاریخ را انتخاب کنید' : 'Select date'))}
        </span>
        <CalendarDays size={17} className="shrink-0 text-[var(--accent)]" />
      </button>
      {calendarPanel}
    </>
  )
}
