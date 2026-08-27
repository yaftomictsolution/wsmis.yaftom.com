'use client'

import type { ReactNode } from 'react'
import { useLanguage } from '@/context/LanguageContext'

const colorStyles: Record<string, string> = {
  blue: 'badge-teal',
  emerald: 'badge-mint',
  amber: 'badge-gold',
  red: 'badge-coral',
  purple: 'badge-violet',
  slate: 'badge-neutral',
}

type BadgeColor = 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'slate'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'outline' | BadgeColor
  className?: string
  color?: BadgeColor
}

export function Badge({
  children,
  variant,
  className = '',
  color = 'blue',
}: BadgeProps) {
  const { translate } = useLanguage()
  const resolvedColor = variant && variant in colorStyles ? variant as BadgeColor : color

  return (
    <span className={`badge-base ${colorStyles[resolvedColor]} ${className}`}>
      {typeof children === 'string' || typeof children === 'number' ? translate(children) : children}
    </span>
  )
}
