'use client'

import { WalletCards } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { usePaymentModal } from '@/context/PaymentModalContext'

type RecordPaymentButtonProps = {
  customerId?: number
  invoiceId?: number
  lockCustomer?: boolean
  className?: string
  label?: string
  iconOnly?: boolean
  onOpen?: () => void
}

export function RecordPaymentButton({
  customerId,
  invoiceId,
  lockCustomer = Boolean(customerId),
  className,
  label = 'Record Payment',
  iconOnly = false,
  onOpen,
}: RecordPaymentButtonProps) {
  const { translate } = useLanguage()
  const { canRecordPayment, openPayment } = usePaymentModal()
  if (!canRecordPayment) return null

  const translatedLabel = translate(label)
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.()
        openPayment({ customerId, invoiceId, lockCustomer })
      }}
      className={className ?? (iconOnly
        ? 'icon-button text-[var(--mint)] hover:bg-[var(--mint-soft)]'
        : 'primary-action')}
      title={translatedLabel}
      aria-label={translatedLabel}
    >
      <WalletCards className="h-4 w-4" />
      {!iconOnly && translatedLabel}
    </button>
  )
}
