'use client'

import { useId } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { DatePickerField } from '@/components/ui/DatePickerField'

interface Option {
  value: string | number
  label: string
}

interface FormFieldProps {
  label: string
  type?: 'text' | 'email' | 'number' | 'password' | 'select' | 'textarea' | 'date'
  textarea?: boolean
  value: string | number
  onChange: (value: string | number) => void
  error?: string
  options?: Option[]
  placeholder?: string
  required?: boolean
  rows?: number
  disabled?: boolean
  min?: number | string
  max?: number | string
}

const baseInputClasses =
  'field-control px-4 py-2.5 text-sm placeholder:text-[var(--text-muted)]'

export function FormField({
  label,
  type = 'text',
  textarea = false,
  value,
  onChange,
  error,
  options,
  placeholder,
  required,
  rows = 3,
  disabled = false,
  min,
  max,
}: FormFieldProps) {
  const { t, translate } = useLanguage()
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const resolvedType = textarea ? 'textarea' : type

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-bold text-[var(--text-secondary)]">
        {translate(label)} {required && <span className="text-red-500">*</span>}
      </label>
      {resolvedType === 'select' ? (
        <div className="relative">
          <select
            id={fieldId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-describedby={error ? errorId : undefined}
            className={`${baseInputClasses} appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <option value="" disabled>
              {placeholder ? translate(placeholder) : t('selectOption')}
            </option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {translate(opt.label)}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      ) : resolvedType === 'textarea' ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ? translate(placeholder) : undefined}
          rows={rows}
          disabled={disabled}
          aria-describedby={error ? errorId : undefined}
          className={`${baseInputClasses} disabled:cursor-not-allowed disabled:opacity-60`}
        />
      ) : resolvedType === 'date' ? (
        <DatePickerField
          id={fieldId}
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={placeholder ? translate(placeholder) : undefined}
          disabled={disabled}
          required={required}
          min={typeof min === 'string' ? min : undefined}
          max={typeof max === 'string' ? max : undefined}
          describedBy={error ? errorId : undefined}
          className={baseInputClasses}
        />
      ) : (
        <input
          id={fieldId}
          type={resolvedType}
          value={value}
          onChange={(e) => onChange(resolvedType === 'number' ? Number(e.target.value) : e.target.value)}
          onWheel={resolvedType === 'number' ? (event) => event.currentTarget.blur() : undefined}
          placeholder={placeholder ? translate(placeholder) : undefined}
          disabled={disabled}
          min={typeof min === 'number' ? min : undefined}
          max={typeof max === 'number' ? max : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${baseInputClasses} disabled:cursor-not-allowed disabled:opacity-60`}
        />
      )}
      {error && <p id={errorId} className="text-xs text-red-500 mt-1">{translate(error)}</p>}
    </div>
  )
}
