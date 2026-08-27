'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLanguage } from '@/context/LanguageContext'

const sizeClasses: Record<string, string> = {
  sm: 'w-full sm:max-w-md',
  md: 'w-full sm:max-w-lg',
  lg: 'w-full sm:max-w-2xl',
  xl: 'w-full sm:max-w-4xl',
  '40p': 'w-[90%] sm:w-[60%] md:w-[50%] lg:w-[45%] xl:w-[40%]',
  '50p': 'w-[90%] sm:w-[70%] md:w-[60%] lg:w-[50%]',
  '60p': 'w-[95%] sm:w-[80%] md:w-[70%] lg:w-[60%]',
  '70p': 'w-[95%] sm:w-[85%] md:w-[75%] lg:w-[70%]',
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '40p' | '50p' | '60p' | '70p'
  centered?: boolean
}

export function Modal({ isOpen, onClose, title, children, size = 'md', centered = false }: ModalProps) {
  const { t, translate } = useLanguage()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const frame = window.requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0 }))
    document.body.classList.add('modal-open')

    return () => {
      window.cancelAnimationFrame(frame)
      document.body.classList.remove('modal-open')
    }
  }, [isOpen, title])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 bg-black/55 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 ${centered ? 'lg:ps-[140px]' : ''}`}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className={`elegant-panel ${sizeClasses[size]} overflow-hidden max-h-[85vh] flex flex-col`}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b elegant-divider flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)]">{translate(title)}</h2>
              <button
                type="button"
                onClick={onClose}
                className="icon-button"
                aria-label={t('closeModal')}
              >
                <X size={20} />
              </button>
            </div>
            <div ref={contentRef} className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
