'use client'

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import {
  CALENDAR_STORAGE_KEY,
  GREGORIAN_SECONDARY_STORAGE_KEY,
  formatDateTimeValue,
  formatDateValue,
  normalizeCalendarSystem,
  type CalendarSystem,
  type DateDisplayStyle,
} from '@/lib/dates'

type CalendarContextValue = {
  calendarSystem: CalendarSystem
  showGregorianSecondary: boolean
  setCalendarSystem: (calendar: CalendarSystem) => void
  setShowGregorianSecondary: (show: boolean) => void
  formatDate: (value?: string | null, style?: DateDisplayStyle, empty?: string) => string
  formatDateTime: (value?: string | null, empty?: string) => string
  gregorianDate: (value?: string | null, empty?: string) => string
}

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined)
const calendarChangeEvent = 'wsmis-calendar-change'

const getStoredSnapshot = () => {
  const calendar = normalizeCalendarSystem(window.localStorage.getItem(CALENDAR_STORAGE_KEY))
  const secondary = window.localStorage.getItem(GREGORIAN_SECONDARY_STORAGE_KEY) === 'true'
  return `${calendar}:${secondary ? '1' : '0'}`
}

const getServerSnapshot = () => 'shamsi:0'

const subscribe = (notify: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null
      || event.key === CALENDAR_STORAGE_KEY
      || event.key === GREGORIAN_SECONDARY_STORAGE_KEY
    ) notify()
  }
  const onCalendarChange = () => notify()

  window.addEventListener('storage', onStorage)
  window.addEventListener(calendarChangeEvent, onCalendarChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(calendarChangeEvent, onCalendarChange)
  }
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getStoredSnapshot, getServerSnapshot)
  const [storedCalendar, secondaryFlag] = snapshot.split(':')
  const calendarSystem = normalizeCalendarSystem(storedCalendar)
  const showGregorianSecondary = secondaryFlag === '1'
  const { language } = useLanguage()

  const setCalendarSystem = useCallback((calendar: CalendarSystem) => {
    window.localStorage.setItem(CALENDAR_STORAGE_KEY, calendar)
    window.dispatchEvent(new Event(calendarChangeEvent))
  }, [])

  const setShowGregorianSecondary = useCallback((show: boolean) => {
    window.localStorage.setItem(GREGORIAN_SECONDARY_STORAGE_KEY, String(show))
    window.dispatchEvent(new Event(calendarChangeEvent))
  }, [])

  const value = useMemo<CalendarContextValue>(() => ({
    calendarSystem,
    showGregorianSecondary,
    setCalendarSystem,
    setShowGregorianSecondary,
    formatDate: (date, style = 'numeric', empty = '-') => formatDateValue(date, {
      calendar: calendarSystem,
      language,
      style,
      empty,
    }),
    formatDateTime: (date, empty = '-') => formatDateTimeValue(date, {
      calendar: calendarSystem,
      language,
      empty,
    }),
    gregorianDate: (date, empty = '-') => formatDateValue(date, {
      calendar: 'gregorian',
      language,
      empty,
    }),
  }), [calendarSystem, language, setCalendarSystem, setShowGregorianSecondary, showGregorianSecondary])

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (!context) throw new Error('useCalendar must be used within CalendarProvider')
  return context
}

