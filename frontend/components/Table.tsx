'use client'

import { type ReactNode } from 'react'
import { useLanguage } from '@/context/LanguageContext'

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

interface TableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  emptyMessage?: string
  className?: string
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data available',
  className = '',
}: TableProps<T>) {
  const { translate } = useLanguage()

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[600px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 ${col.className ?? ''}`}
              >
                {translate(col.header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                {translate(emptyMessage)}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[keyField])}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                {columns.map((col) => {
                  const value = row[col.key as keyof T]
                  return (
                    <td
                      key={String(col.key)}
                      className={`px-4 py-3 text-slate-600 dark:text-slate-400 ${col.className ?? ''}`}
                    >
                      {col.render ? col.render(row) : String(value ?? '—')}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
