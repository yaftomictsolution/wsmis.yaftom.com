'use client'

import { Fragment, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Edit2, Trash2, Eye, ChevronLeft, ChevronRight, Search, Plus, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { Skeleton } from '@/components/ui/Skeleton'

export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => ReactNode
  sortable?: boolean
}

interface DataTableProps<T extends { id: string | number }> {
  columns: Column<T>[]
  data: T[]
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  onView?: (item: T) => void
  renderActions?: (item: T) => ReactNode
  viewLabel?: string
  searchable?: boolean
  searchKeys?: (keyof T)[]
  loading?: boolean
  isLoading?: boolean
  skeletonRows?: number
  summaryColumnCount?: number
  newestFirst?: boolean
  emptyMessage?: string
  renderExpandedRow?: (item: T) => ReactNode
  serverPagination?: {
    currentPage: number
    lastPage: number
    perPage: number
    total: number
    onPageChange: (page: number) => void
  }
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  onEdit,
  onDelete,
  onView,
  renderActions,
  viewLabel = 'View',
  searchable = true,
  searchKeys,
  loading = false,
  isLoading,
  skeletonRows = 6,
  summaryColumnCount = 5,
  newestFirst = true,
  emptyMessage,
  renderExpandedRow,
  serverPagination,
}: DataTableProps<T>) {
  const { t, translate } = useLanguage()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set())
  const itemsPerPage = 10
  const tableLoading = isLoading ?? loading
  const visibleColumns = columns.slice(0, summaryColumnCount)
  const detailColumns = columns.slice(summaryColumnCount)
  const hasDetailColumns = detailColumns.length > 0
  const hasExpandableRows = hasDetailColumns || Boolean(renderExpandedRow)
  const hasActions = Boolean(onEdit || onDelete || onView || renderActions)
  const rowSpanColumns = visibleColumns.length + (hasExpandableRows ? 1 : 0) + (hasActions ? 1 : 0)

  const toggleRow = (id: string | number) => {
    setExpandedRows((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const orderedData = useMemo(() => {
    if (!newestFirst) return data

    return [...data].sort((left, right) => {
      const leftId = Number(left.id)
      const rightId = Number(right.id)
      if (Number.isFinite(leftId) && Number.isFinite(rightId)) return rightId - leftId

      return String(right.id).localeCompare(String(left.id), undefined, { numeric: true })
    })
  }, [data, newestFirst])

  const filteredData = orderedData.filter((item) => {
    if (serverPagination) return true
    if (!searchTerm || !searchKeys) return true
    return searchKeys.some((key) =>
      String(item[key]).toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const totalPages = serverPagination?.lastPage ?? Math.ceil(filteredData.length / itemsPerPage)
  const pageCount = Math.max(1, totalPages)
  const displayPage = Math.min(serverPagination?.currentPage ?? currentPage, pageCount)
  const paginatedData = serverPagination
    ? filteredData
    : filteredData.slice(
        (displayPage - 1) * itemsPerPage,
        displayPage * itemsPerPage
      )
  const displayedTotal = serverPagination?.total ?? filteredData.length
  const displayedPerPage = serverPagination?.perPage ?? itemsPerPage
  const displayedFrom = displayedTotal === 0 ? 0 : (displayPage - 1) * displayedPerPage + 1
  const displayedTo = Math.min(displayPage * displayedPerPage, displayedTotal)

  const changePage = (page: number) => {
    const nextPage = Math.min(Math.max(1, page), pageCount)
    if (serverPagination) serverPagination.onPageChange(nextPage)
    else setCurrentPage(nextPage)
  }

  return (
    <div className="elegant-panel overflow-hidden">
      {searchable && (
        <div className="p-4 border-b elegant-divider">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              disabled={tableLoading}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="field-control py-2 ps-10 pe-4 text-sm disabled:cursor-wait disabled:opacity-70"
            />
          </div>
        </div>
      )}
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-start text-sm">
          <thead className="bg-[var(--bg-elevated)] text-[var(--text-muted)] uppercase tracking-[0.14em] text-xs font-extrabold">
            <tr>
              {hasExpandableRows && <th className="w-14 px-3 py-4" aria-label={translate('Details')} />}
              {visibleColumns.map((col, idx) => (
                <th key={idx} className="px-4 py-4 text-center">
                  {translate(col.label)}
                </th>
              ))}
              {hasActions && <th className="w-32 px-4 py-4 text-right">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {tableLoading ? (
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {hasExpandableRows && (
                    <td className="px-3 py-4">
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </td>
                  )}
                  {visibleColumns.map((column, columnIndex) => (
                    <td key={`${String(column.key)}-${columnIndex}`} className="px-4 py-4">
                      <Skeleton className={`${columnIndex === 0 ? 'h-5 w-36' : 'h-4 w-24'} max-w-full`} />
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <>
                {paginatedData.map((item) => {
                  const isExpanded = expandedRows.has(item.id)

                  return (
                    <Fragment key={String(item.id)}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        layout
                        className={`group transition-colors ${isExpanded ? 'bg-[var(--bg-elevated)]' : 'hover:bg-[var(--bg-elevated)]'}`}
                      >
                        {hasExpandableRows && (
                          <td className="px-3 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => toggleRow(item.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                              title={isExpanded ? translate('Hide Details') : translate('Show Details')}
                              aria-label={isExpanded ? translate('Hide Details') : translate('Show Details')}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <Minus size={16} /> : <Plus size={16} />}
                            </button>
                          </td>
                        )}
                        {visibleColumns.map((col, idx) => (
                          <td key={idx} className="min-w-0 break-words px-4 py-4 align-top text-center text-[var(--text-secondary)]">
                            {col.render ? col.render(item) : String(item[col.key as keyof T] ?? '-')}
                          </td>
                        ))}
                        {hasActions && (
                          <td className="px-4 py-4 text-right align-top">
                            <div className="flex flex-wrap items-center justify-end gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                              {onView && (
                               <button
                                 type="button"
                                onClick={() => onView(item)}
                                className="p-1.5 text-[var(--accent)] hover:bg-[var(--accent-soft)] rounded-lg transition-colors"
                                title={translate(viewLabel)}
                                aria-label={translate(viewLabel)}
                               >
                                <Eye size={16} />
                               </button>
                              )}
                              {renderActions?.(item)}
                              {onEdit && (
                               <button
                                 type="button"
                                onClick={() => onEdit(item)}
                                className="p-1.5 text-[var(--gold)] hover:bg-[var(--gold-soft)] rounded-lg transition-colors"
                                title={translate('Edit')}
                                aria-label={translate('Edit')}
                               >
                                <Edit2 size={16} />
                               </button>
                              )}
                              {onDelete && (
                                <button
                                  type="button"
                                  onClick={() => onDelete(item)}
                                  className="p-1.5 text-[var(--coral)] hover:bg-[var(--coral-soft)] rounded-lg transition-colors"
                                  title={translate('Delete')}
                                  aria-label={translate('Delete')}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </motion.tr>
                      {hasExpandableRows && (
                        <tr className="bg-[var(--bg-surface)]">
                          <td colSpan={rowSpanColumns} className="p-0">
                            <motion.div
                              initial={false}
                              animate={{
                                height: isExpanded ? 'auto' : 0,
                                opacity: isExpanded ? 1 : 0,
                              }}
                              transition={{
                                height: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                                opacity: { duration: isExpanded ? 0.22 : 0.12, delay: isExpanded ? 0.06 : 0 },
                              }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4">
                                <div className="relative overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[0_14px_36px_rgba(0,0,0,0.08)]">
                                  <div className="absolute inset-y-0 start-0 w-1 bg-[var(--accent)]" aria-hidden />
                                  <div className="flex justify-end border-b px-4 py-3 elegant-divider">
                                    <button
                                      type="button"
                                      onClick={() => toggleRow(item.id)}
                                      className="ghost-action min-h-0 px-2 py-1 text-xs"
                                    >
                                      <Minus size={14} />
                                      {translate('Hide Details')}
                                    </button>
                                  </div>
                                  {renderExpandedRow ? (
                                    <div className="p-4">{isExpanded ? renderExpandedRow(item) : null}</div>
                                  ) : (
                                    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                                      {detailColumns.map((col, idx) => (
                                        <motion.div
                                          key={`${String(col.key)}-${idx}`}
                                          initial={false}
                                          animate={{ y: isExpanded ? 0 : -4, opacity: isExpanded ? 1 : 0 }}
                                          transition={{ duration: 0.24, delay: isExpanded ? Math.min(idx * 0.025, 0.12) : 0 }}
                                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-[0_8px_22px_rgba(0,0,0,0.04)]"
                                        >
                                          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                            {translate(col.label)}
                                          </p>
                                          <div className="mt-2 min-w-0 break-words text-sm font-bold text-[var(--text-secondary)]">
                                            {col.render ? col.render(item) : String(item[col.key as keyof T] ?? '-')}
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </>
            )}
            {!tableLoading && paginatedData.length === 0 && (
              <tr>
                <td colSpan={rowSpanColumns} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                  {emptyMessage ? translate(emptyMessage) : t('noRecordsFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t elegant-divider flex items-center justify-between bg-[var(--bg-elevated)]">
        {tableLoading ? (
          <Skeleton className="h-4 w-52" />
        ) : (
          <span className="text-sm text-[var(--text-muted)]">
            {t('showing')} {displayedFrom} {t('to')}{' '}
            {displayedTo} {t('of')} {displayedTotal} {t('entries')}
          </span>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changePage(displayPage - 1)}
            disabled={displayPage === 1}
            className="icon-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => changePage(displayPage + 1)}
            disabled={displayPage === pageCount}
            className="icon-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
