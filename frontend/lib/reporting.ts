export type ReportRangePreset = 'last3months' | 'last6months' | 'lastyear'

export function reportRange(preset: ReportRangePreset) {
  const to = new Date()
  const from = new Date(to)

  if (preset === 'last3months') {
    from.setMonth(from.getMonth() - 3)
  } else if (preset === 'lastyear') {
    from.setFullYear(from.getFullYear() - 1)
  } else {
    from.setMonth(from.getMonth() - 6)
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
