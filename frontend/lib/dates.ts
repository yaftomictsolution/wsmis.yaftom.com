export type CalendarSystem = 'shamsi' | 'gregorian'
export type DateDisplayStyle = 'numeric' | 'long' | 'month'

export const KABUL_TIME_ZONE = 'Asia/Kabul'
export const CALENDAR_STORAGE_KEY = 'wsmis-calendar-system'
export const GREGORIAN_SECONDARY_STORAGE_KEY = 'wsmis-show-gregorian-secondary'

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

export const dariShamsiMonths = [
  'حمل',
  'ثور',
  'جوزا',
  'سرطان',
  'اسد',
  'سنبله',
  'میزان',
  'عقرب',
  'قوس',
  'جدی',
  'دلو',
  'حوت',
] as const

export const englishShamsiMonths = [
  'Hamal',
  'Sawr',
  'Jawza',
  'Saratan',
  'Asad',
  'Sunbula',
  'Mizan',
  'Aqrab',
  'Qaws',
  'Jadi',
  'Dalwa',
  'Hoot',
] as const

export function normalizeCalendarSystem(value: unknown): CalendarSystem {
  return value === 'gregorian' ? 'gregorian' : 'shamsi'
}

export function apiDateValue(value?: string | null): string {
  return value ? value.slice(0, 10) : ''
}

export function parseApiDate(value?: string | null): Date | undefined {
  if (!value) return undefined

  const dateOnly = apiDateValue(value)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly)
  if (!match) return undefined

  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function toApiDate(date?: Date): string {
  if (!date || Number.isNaN(date.getTime())) return ''

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function localizedDigits(value: string, language: 'en' | 'fa'): string {
  if (language !== 'fa') return value
  return value.replace(/\d/g, (digit) => persianDigits[Number(digit)])
}

export function getShamsiParts(value?: string | null): { year: string; month: string; day: string } | null {
  const date = parseApiDate(value)
  if (!date) return null

  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: KABUL_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return null

  return {
    year,
    month: month.padStart(2, '0'),
    day: day.padStart(2, '0'),
  }
}

export function formatDateValue(
  value?: string | null,
  options: {
    calendar?: CalendarSystem
    language?: 'en' | 'fa'
    style?: DateDisplayStyle
    empty?: string
  } = {},
): string {
  const {
    calendar = 'shamsi',
    language = 'en',
    style = 'numeric',
    empty = '-',
  } = options
  const normalized = apiDateValue(value)
  if (!normalized) return empty

  if (calendar === 'gregorian') {
    if (style === 'long' || style === 'month') {
      const date = parseApiDate(normalized)
      if (!date) return normalized
      return new Intl.DateTimeFormat(language === 'fa' ? 'fa-AF-u-nu-arabext' : 'en-GB', {
        timeZone: KABUL_TIME_ZONE,
        year: 'numeric',
        month: 'long',
        ...(style === 'long' ? { day: 'numeric' as const } : {}),
      }).format(date)
    }
    return localizedDigits(normalized, language)
  }

  const parts = getShamsiParts(normalized)
  if (!parts) return normalized

  if (style === 'month') {
    const monthIndex = Number(parts.month) - 1
    const monthName = language === 'fa'
      ? dariShamsiMonths[monthIndex]
      : englishShamsiMonths[monthIndex]
    return localizedDigits(`${monthName} ${parts.year}`, language)
  }

  if (style === 'long') {
    const monthIndex = Number(parts.month) - 1
    const monthName = language === 'fa'
      ? dariShamsiMonths[monthIndex]
      : englishShamsiMonths[monthIndex]
    const formatted = language === 'fa'
      ? `${parts.day} ${monthName} ${parts.year}`
      : `${monthName} ${Number(parts.day)}, ${parts.year}`
    return localizedDigits(formatted, language)
  }

  return localizedDigits(`${parts.year}/${parts.month}/${parts.day}`, language)
}

export function calendarMonthBounds(
  value: string,
  calendar: CalendarSystem = 'shamsi',
): { period_start: string; period_end: string } {
  const selected = parseApiDate(value)
  if (!selected) return { period_start: '', period_end: '' }

  if (calendar === 'gregorian') {
    return {
      period_start: toApiDate(new Date(selected.getFullYear(), selected.getMonth(), 1, 12)),
      period_end: toApiDate(new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 12)),
    }
  }

  const target = getShamsiParts(value)
  if (!target) return { period_start: '', period_end: '' }
  const sameMonth = (date: Date) => {
    const parts = getShamsiParts(toApiDate(date))
    return parts?.year === target.year && parts.month === target.month
  }

  const start = new Date(selected)
  for (let index = 0; index < 32; index += 1) {
    const previous = new Date(start)
    previous.setDate(previous.getDate() - 1)
    if (!sameMonth(previous)) break
    start.setTime(previous.getTime())
  }

  const end = new Date(selected)
  for (let index = 0; index < 32; index += 1) {
    const next = new Date(end)
    next.setDate(next.getDate() + 1)
    if (!sameMonth(next)) break
    end.setTime(next.getTime())
  }

  return { period_start: toApiDate(start), period_end: toApiDate(end) }
}

export function formatDateTimeValue(
  value?: string | null,
  options: { calendar?: CalendarSystem; language?: 'en' | 'fa'; empty?: string } = {},
): string {
  if (!value) return options.empty ?? '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const datePart = formatDateValue(value, options)
  const timePart = new Intl.DateTimeFormat(options.language === 'fa' ? 'fa-AF-u-nu-arabext' : 'en-GB', {
    timeZone: KABUL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return `${datePart} ${timePart}`
}
