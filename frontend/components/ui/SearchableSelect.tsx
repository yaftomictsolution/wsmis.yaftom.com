'use client'

import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

export type SearchableSelectOption = {
  value: string | number
  label: string
  searchText?: string
}

type SearchableSelectProps = {
  label: string
  value?: string | number | null
  onChange: (value: string | number) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  required?: boolean
  disabled?: boolean
  error?: string
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No matching options found.',
  required = false,
  disabled = false,
  error,
}: SearchableSelectProps) {
  const { translate } = useLanguage()
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => String(option.value) === String(value ?? ''))
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options

    return options.filter((option) => (
      `${option.label} ${option.searchText ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
    ))
  }, [options, query])

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <label id={`${fieldId}-label`} className="block text-sm font-bold text-[var(--text-secondary)]">
        {translate(label)} {required && <span className="text-red-500">*</span>}
      </label>
      <button
        id={fieldId}
        type="button"
        role="combobox"
        aria-labelledby={`${fieldId}-label`}
        aria-expanded={open}
        aria-controls={`${fieldId}-options`}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        onClick={() => {
          if (open) setQuery('')
          setOpen(!open)
        }}
        className="field-control flex min-h-10 items-center justify-between gap-3 px-4 py-2.5 text-start text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
          {translate(selected?.label ?? placeholder)}
        </span>
        <ChevronsUpDown className="h-4 w-4 flex-none text-[var(--text-muted)]" />
      </button>

      {open && !disabled && (
        <div className="absolute z-[130] mt-2 w-full overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
          <div className="relative border-b border-[var(--border-subtle)] p-2">
            <Search className="absolute start-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={translate(searchPlaceholder)}
              aria-label={translate(`Search ${label}`)}
              className="field-control py-2 pe-3 ps-9 text-sm"
            />
          </div>
          <div id={`${fieldId}-options`} role="listbox" className="max-h-56 overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm font-bold text-[var(--text-muted)]">{translate(emptyMessage)}</p>
            ) : filteredOptions.map((option) => {
              const isSelected = String(option.value) === String(value ?? '')
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start text-sm font-bold transition-colors ${isSelected ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}
                >
                  <span className="min-w-0 flex-1 break-words">{translate(option.label)}</span>
                  {isSelected && <Check className="h-4 w-4 flex-none" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {error && <p id={errorId} className="mt-1 text-xs text-red-500">{translate(error)}</p>}
    </div>
  )
}
