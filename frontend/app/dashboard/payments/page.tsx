'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { RecordPaymentButton } from '@/components/payments/RecordPaymentButton'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DateText } from '@/components/ui/DateText'
import { PageHeader } from '@/components/ui/PageHeader'
import { useLanguage } from '@/context/LanguageContext'
import { usePaymentModal } from '@/context/PaymentModalContext'
import {
  useGetMeQuery,
  useGetPaymentsQuery,
  useUpdatePaymentMutation,
  type Payment,
} from '@/src/store/waternetApi'

const statusColor: Record<string, 'emerald' | 'amber' | 'red' | 'slate'> = {
  posted: 'emerald',
  cancelled: 'slate',
  pending: 'amber',
  partially_applied: 'amber',
  applied: 'emerald',
  refund_required: 'red',
  refunded: 'slate',
}
const money = (value: string | number) => `AFN ${Number(value).toLocaleString()}`

export default function PaymentsPage() {
  const { t, translate } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { openPayment } = usePaymentModal()
  const { data: profile, isLoading: isProfileLoading, isError: isProfileError } = useGetMeQuery()
  const paymentRoles = ['Collector', 'Accountant', 'Manager', 'Admin', 'Super Admin']
  const cancellationRoles = ['Manager', 'Admin', 'Super Admin']
  const canViewPayments = Boolean(profile && (
    profile.roles.some((role) => paymentRoles.includes(role)) || profile.permissions.includes('payments.view')
  ))
  const canCreatePayments = Boolean(profile && (
    profile.roles.some((role) => paymentRoles.includes(role)) || profile.permissions.includes('payments.create')
  ))
  const canCancelPayments = Boolean(profile && (
    profile.roles.some((role) => cancellationRoles.includes(role)) || profile.permissions.includes('payments.update')
  ))
  const { data = [], isLoading, isError } = useGetPaymentsQuery(undefined, { skip: !canViewPayments })
  const [updatePayment] = useUpdatePaymentMutation()
  const [cancellationTarget, setCancellationTarget] = useState<Payment | null>(null)
  const linkedPaymentHandled = useRef(false)
  const [error, setError] = useState('')
  const showSkeleton = isLoading && data.length === 0

  useEffect(() => {
    if (linkedPaymentHandled.current || !canCreatePayments) return
    const customerId = Number(searchParams.get('customer') || 0)
    const invoiceId = Number(searchParams.get('invoice') || 0)
    if (!customerId && !invoiceId) {
      linkedPaymentHandled.current = true
      return
    }

    openPayment({
      customerId: customerId || undefined,
      invoiceId: invoiceId || undefined,
      lockCustomer: Boolean(customerId),
    })
    linkedPaymentHandled.current = true
    router.replace('/dashboard/payments', { scroll: false })
  }, [canCreatePayments, openPayment, router, searchParams])

  const columns: Column<Payment>[] = [
    { key: 'receipt_number', label: t('receipt') },
    {
      key: 'allocations',
      label: t('items'),
      render: (payment) => {
        const allocations = payment.allocations ?? []
        if (allocations.length === 0) return payment.invoice?.invoice_number ?? '-'
        return allocations
          .map((allocation) => allocation.invoice?.invoice_number ?? allocation.charge?.title ?? t('payableItem'))
          .join(', ')
      },
    },
    { key: 'customer', label: t('customer'), render: (payment) => payment.customer?.name ?? '-' },
    { key: 'payment_method', label: t('method'), render: (payment) => payment.payment_method?.name ?? '-' },
    { key: 'account', label: t('receivingAccount'), render: (payment) => payment.account?.name ?? '-' },
    { key: 'amount', label: t('amount'), render: (payment) => money(payment.amount) },
    { key: 'discount_amount', label: t('discount'), render: (payment) => money(payment.discount_amount ?? 0) },
    { key: 'discount_authority', label: translate('Discount Given By'), render: (payment) => payment.discount_authority?.name ?? '-' },
    { key: 'paid_at', label: t('paidAt'), render: (payment) => <DateText value={payment.paid_at} /> },
    { key: 'receiver', label: t('receiver'), render: (payment) => payment.receiver?.name ?? '-' },
    { key: 'refund_account', label: 'Refund From', render: (payment) => payment.refund_transaction?.account?.name ?? '-' },
    { key: 'status', label: t('status'), render: (payment) => <Badge color={statusColor[payment.status]}>{payment.status}</Badge> },
  ]

  const cancelPayment = async () => {
    if (!cancellationTarget) return
    try {
      setError('')
      await updatePayment({ id: cancellationTarget.id, body: { status: 'cancelled', notes: cancellationTarget.notes } }).unwrap()
      setCancellationTarget(null)
    } catch {
      setError(t('unableToCancelPayment'))
      setCancellationTarget(null)
    }
  }

  if (isProfileLoading) {
    return (
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title={t('payments')} subtitle={t('customerPaymentCollection')} />
        <div className="min-h-64 animate-pulse border-y elegant-divider bg-[var(--surface-soft)]" />
      </div>
    )
  }

  if (isProfileError || !profile || !canViewPayments) {
    return (
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title={t('payments')} subtitle={t('customerPaymentCollection')} />
        <div className="flex min-h-64 items-center justify-center border-y elegant-divider">
          <div className="max-w-xl text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-[var(--gold)]" />
            <h2 className="mt-4 text-lg font-extrabold text-[var(--text-primary)]">{t('paymentAccessRestricted')}</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--text-muted)]">{t('paymentAccessMessage')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader title={t('payments')} subtitle={t('recordCustomerMoney')}>
        {canCreatePayments && <RecordPaymentButton lockCustomer={false} />}
      </PageHeader>
      {(error || isError) && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error || t('unableToLoadCollectionHistory')}</div>}
      <DataTable
        columns={columns}
        data={data}
        loading={showSkeleton}
        onDelete={canCancelPayments ? (payment) => setCancellationTarget(payment) : undefined}
        searchKeys={['receipt_number', 'reference', 'status']}
      />
      <ConfirmDialog
        isOpen={Boolean(cancellationTarget)}
        onClose={() => setCancellationTarget(null)}
        onConfirm={cancelPayment}
        title={t('cancelPayment')}
        message={`${t('cancelReceipt')} ${cancellationTarget?.receipt_number ?? ''}? ${t('restoreInvoiceBalance')}`}
      />
    </div>
  )
}
