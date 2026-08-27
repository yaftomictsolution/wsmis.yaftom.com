'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useLanguage } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useCreatePaymentMutation,
  useGetAuthorityOptionsQuery,
  useGetCustomerDetailQuery,
  useGetCustomersQuery,
  useGetMeQuery,
  useGetPaymentReceivingAccountsQuery,
  useGetSettingsQuery,
  type Payment,
} from '@/src/store/waternetApi'

type PaymentModalRequest = {
  customerId?: number
  invoiceId?: number
  lockCustomer?: boolean
  onSuccess?: (payment: Payment) => void
}

type PaymentModalContextValue = {
  canRecordPayment: boolean
  openPayment: (request?: PaymentModalRequest) => void
  closePayment: () => void
}

type PayableItem = {
  key: string
  type: 'invoice'
  id: number
  invoiceNumber: string
  title: string
  invoiceType: 'water' | 'contract' | 'service' | 'adjustment' | 'inventory'
  total: number
  paid: number
  remaining: number
  status: string
  paymentDiscount: number
}

const PaymentModalContext = createContext<PaymentModalContextValue | null>(null)
const money = (value: string | number) => `AFN ${Number(value).toLocaleString()}`
const dateValue = (value?: string) => (value ? value.slice(0, 10) : '')
const accountTypeForMethod = (code?: string) => {
  switch (code) {
    case 'bank_transfer': return 'bank'
    case 'mobile_money': return 'mobile_money'
    case 'check': return 'check'
    case 'online_payment': return 'online'
    default: return 'cash'
  }
}
const newPaymentRequestKey = () => (
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`
)
const paymentErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object') return fallback
  const message = (data as { message?: unknown }).message
  if (typeof message === 'string' && message !== 'The given data was invalid.') return message
  const errors = (data as { errors?: Record<string, string[] | string> }).errors
  if (!errors) return fallback
  const first = Object.values(errors)[0]
  return Array.isArray(first) ? first[0] ?? fallback : first ?? fallback
}

export function PaymentModalProvider({ children }: { children: ReactNode }) {
  const { t, translate } = useLanguage()
  const { businessDate } = useTrainingMode()
  const { data: profile } = useGetMeQuery()
  const paymentRoles = ['Collector', 'Accountant', 'Manager', 'Admin', 'Super Admin']
  const canRecordPayment = Boolean(profile && (
    profile.roles.some((role) => paymentRoles.includes(role)) || profile.permissions.includes('payments.create')
  ))
  const [request, setRequest] = useState<PaymentModalRequest>({})
  const [current, setCurrent] = useState<Partial<Payment>>({})
  const [isOpen, setIsOpen] = useState(false)
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({})
  const [discountAmounts, setDiscountAmounts] = useState<Record<string, string>>({})
  const [paymentRequestKey, setPaymentRequestKey] = useState('')
  const [error, setError] = useState('')
  const { data: customers = [] } = useGetCustomersQuery(undefined, { skip: !isOpen || !canRecordPayment })
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !isOpen || !canRecordPayment })
  const { data: accounts = [] } = useGetPaymentReceivingAccountsQuery(undefined, { skip: !isOpen || !canRecordPayment })
  const { data: authorities = [] } = useGetAuthorityOptionsQuery(undefined, { skip: !isOpen || !canRecordPayment })
  const selectedCustomerId = Number(current.customer_id || 0)
  const { data: selectedCustomerDetail, isFetching: customerDetailLoading } = useGetCustomerDetailQuery(selectedCustomerId, {
    skip: !isOpen || !selectedCustomerId || !canRecordPayment,
  })
  const [createPayment, { isLoading: isSavingPayment }] = useCreatePaymentMutation()

  const paymentMethods = settings?.payment_methods.filter((method) => method.status === 'active') ?? []
  const selectedPaymentMethod = paymentMethods.find((method) => method.id === Number(current.payment_method_id))
  const expectedAccountType = accountTypeForMethod(selectedPaymentMethod?.code)
  const receivingAccounts = accounts.filter((account) => account.status === 'active' && account.type === expectedAccountType)
  const selectedAccount = receivingAccounts.find((account) => account.id === Number(current.accounting_account_id))
  const unconfirmedContractInvoice = (selectedCustomerDetail?.customer.invoices ?? []).find(
    (invoice) => invoice.invoice_type === 'contract'
      && !['installation_pending', 'active'].includes(invoice.contract?.status ?? '')
      && !['paid', 'cancelled'].includes(invoice.status)
      && Number(invoice.remaining_amount) > 0,
  )
  const payableItems = useMemo<PayableItem[]>(() => {
    const customer = selectedCustomerDetail?.customer
    if (!customer) return []

    const invoices = (customer.invoices ?? [])
      .filter((invoice) => (
        invoice.status !== 'paid'
        && invoice.status !== 'cancelled'
        && Number(invoice.remaining_amount) > 0
        && (invoice.invoice_type !== 'contract' || ['installation_pending', 'active'].includes(invoice.contract?.status ?? ''))
      ))
    const scopedInvoices = request.invoiceId
      ? invoices.filter((invoice) => invoice.id === request.invoiceId)
      : invoices

    return scopedInvoices.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      type: 'invoice' as const,
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      title: invoice.items?.map((line) => line.description).filter(Boolean).join(' + ') || invoice.invoice_number,
      invoiceType: invoice.invoice_type ?? 'water',
      total: Number(invoice.total_amount),
      paid: Number(invoice.paid_amount),
      remaining: Number(invoice.remaining_amount),
      status: invoice.status,
      paymentDiscount: Number(invoice.payment_discount_amount ?? 0),
    }))
  }, [request.invoiceId, selectedCustomerDetail])
  const effectivePaymentAmounts = useMemo(() => {
    if (Object.keys(paymentAmounts).length > 0) return paymentAmounts
    const preferredItem = request.invoiceId
      ? payableItems.find((item) => item.id === request.invoiceId)
      : payableItems.length === 1 ? payableItems[0] : undefined
    return preferredItem ? { [preferredItem.key]: preferredItem.remaining.toFixed(2) } : paymentAmounts
  }, [payableItems, paymentAmounts, request.invoiceId])
  const selectedPayableItems = payableItems.filter((item) => (
    Number(effectivePaymentAmounts[item.key] ?? 0) > 0 || Number(discountAmounts[item.key] ?? 0) > 0
  ))
  const selectedTotal = selectedPayableItems.reduce((sum, item) => sum + Number(effectivePaymentAmounts[item.key] ?? 0), 0)
  const selectedDiscountTotal = selectedPayableItems.reduce((sum, item) => sum + Number(discountAmounts[item.key] ?? 0), 0)
  const totalAlreadyPaid = payableItems.reduce((sum, item) => sum + item.paid, 0)
  const totalAlreadyDiscounted = payableItems.reduce((sum, item) => sum + item.paymentDiscount, 0)
  const selectedRemainingAfterPayment = Math.max(
    0,
    payableItems.reduce((sum, item) => sum + item.remaining, 0) - selectedTotal - selectedDiscountTotal,
  )
  const hasInvalidAmount = selectedPayableItems.some((item) => {
    const payment = Number(effectivePaymentAmounts[item.key] ?? 0)
    const discount = Number(discountAmounts[item.key] ?? 0)
    return payment < 0
      || discount < 0
      || payment + discount > item.remaining + 0.005
      || (discount > 0.005 && item.invoiceType !== 'water')
  })
  const requiresDiscountAuthority = selectedDiscountTotal > 0.005
  const hasWaterPayableInvoices = payableItems.some((item) => item.invoiceType === 'water')
  const canSavePayment = Boolean(
    current.customer_id
      && current.payment_method_id
      && current.accounting_account_id
      && selectedPayableItems.length > 0
      && !hasInvalidAmount
      && (!requiresDiscountAuthority || current.discount_authority_id),
  )

  const openPayment = useCallback((nextRequest: PaymentModalRequest = {}) => {
    setRequest(nextRequest)
    setCurrent({ customer_id: nextRequest.customerId, paid_at: businessDate })
    setPaymentAmounts({})
    setDiscountAmounts({})
    setPaymentRequestKey(newPaymentRequestKey())
    setError('')
    setIsOpen(true)
  }, [businessDate])
  const closePayment = useCallback(() => {
    if (isSavingPayment) return
    setIsOpen(false)
    setCurrent({})
    setPaymentAmounts({})
    setDiscountAmounts({})
    setPaymentRequestKey('')
    setError('')
    setRequest({})
  }, [isSavingPayment])

  const save = async () => {
    if (isSavingPayment) return
    setError('')
    if (!current.customer_id || selectedPayableItems.length === 0 || !current.payment_method_id || !current.accounting_account_id) {
      setError(t('selectCustomerAndAmount'))
      return
    }
    if (hasInvalidAmount) {
      setError(t('paymentExceedsBalance'))
      return
    }
    if (requiresDiscountAuthority && !current.discount_authority_id) {
      setError(translate('Select the authority who granted this water bill discount.'))
      return
    }

    try {
      const payment = await createPayment({
        customer_id: current.customer_id,
        payment_method_id: current.payment_method_id,
        accounting_account_id: current.accounting_account_id,
        paid_at: dateValue(current.paid_at) || businessDate,
        idempotency_key: paymentRequestKey || newPaymentRequestKey(),
        discount_authority_id: requiresDiscountAuthority ? current.discount_authority_id : undefined,
        reference: current.reference,
        notes: current.notes,
        items: selectedPayableItems.map((item) => ({
          type: item.type,
          id: item.id,
          amount: Number(effectivePaymentAmounts[item.key]),
          discount_amount: Number(discountAmounts[item.key] ?? 0),
        })),
      }).unwrap()
      request.onSuccess?.(payment)
      closePayment()
    } catch (paymentError) {
      setError(paymentErrorMessage(paymentError, t('unableToPostPayment')))
    }
  }

  return (
    <PaymentModalContext.Provider value={{ canRecordPayment, openPayment, closePayment }}>
      {children}
      <Modal isOpen={isOpen} onClose={closePayment} title={t('recordPayment')} size="xl">
        {error && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{translate(error)}</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label={t('customer')}
            type="select"
            value={current.customer_id ?? ''}
            onChange={(value) => {
              setCurrent({ ...current, customer_id: Number(value), discount_authority_id: undefined })
              setPaymentAmounts({})
              setDiscountAmounts({})
            }}
            options={customers
              .filter((customer) => Number(customer.current_balance) > 0 || customer.id === Number(current.customer_id))
              .map((customer) => ({
                value: customer.id,
                label: `${customer.name}${customer.last_name ? ` ${customer.last_name}` : ''}${customer.house_number ? ` (${customer.house_number})` : ''} - ${money(customer.current_balance)}`,
              }))}
            disabled={Boolean(request.lockCustomer || request.customerId)}
            required
          />
          <FormField
            label={t('paymentMethod')}
            type="select"
            value={current.payment_method_id ?? ''}
            onChange={(value) => {
              const method = paymentMethods.find((item) => item.id === Number(value))
              const accountType = accountTypeForMethod(method?.code)
              const matchingAccounts = accounts.filter((account) => account.status === 'active' && account.type === accountType)
              setCurrent({
                ...current,
                payment_method_id: Number(value),
                accounting_account_id: matchingAccounts.length === 1 ? matchingAccounts[0].id : undefined,
              })
            }}
            options={paymentMethods.map((method) => ({ value: method.id, label: method.name }))}
            required
          />
          <FormField
            label={t('receivingAccount')}
            type="select"
            value={current.accounting_account_id ?? ''}
            onChange={(value) => setCurrent({ ...current, accounting_account_id: Number(value) })}
            options={receivingAccounts.map((account) => ({
              value: account.id,
              label: `${account.name} - ${money(account.current_balance)}`,
            }))}
            required
          />
          {selectedPaymentMethod && receivingAccounts.length === 0 && (
            <div className="md:col-span-2 rounded-lg border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">
              {t('noActiveAccountForMethod').replace('{accountType}', expectedAccountType.replace('_', ' '))}
            </div>
          )}
          {selectedAccount && (
            <div className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <p className="text-[10px] font-extrabold uppercase text-[var(--text-muted)]">{t('receivingAccount')}</p>
              <p className="mt-1 text-sm font-extrabold text-[var(--text-primary)]">{selectedAccount.name}</p>
              <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{t('currentBalance')}: {money(selectedAccount.current_balance)}</p>
            </div>
          )}
          {selectedCustomerId > 0 && (
            <div className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-[var(--text-muted)]">{t('unpaidInvoices')}</p>
                  <p className="text-sm font-extrabold text-[var(--text-primary)]">{t('enterAmountCustomerPayingNow')}</p>
                </div>
                <Badge color={selectedTotal > 0 ? 'emerald' : 'slate'}>{money(selectedTotal)}</Badge>
              </div>
              {hasWaterPayableInvoices && (
                <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-end">
                  <SearchableSelect
                    label="Discount Given By (Authority)"
                    value={current.discount_authority_id}
                    onChange={(value) => setCurrent({ ...current, discount_authority_id: Number(value) })}
                    options={authorities.map((authority) => ({
                      value: authority.id,
                      label: `${authority.authority_number} - ${authority.name}${authority.title ? ` (${authority.title})` : ''}`,
                      searchText: `${authority.father_name ?? ''} ${authority.title ?? ''} ${authority.phone ?? ''}`,
                    }))}
                    placeholder="Select who gave the discount"
                    searchPlaceholder="Search authorities..."
                    emptyMessage="No active authority is available."
                    required={requiresDiscountAuthority}
                  />
                  <p className="pb-2 text-xs font-bold leading-5 text-[var(--text-muted)]">
                    {translate('Discounts apply only to meter-reading water invoices. Only cash received increases the selected account balance.')}
                  </p>
                </div>
              )}
              {customerDetailLoading ? (
                <div className="flex min-h-32 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-[var(--accent)]" /></div>
              ) : payableItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-6 text-center">
                  <p className="text-sm font-bold text-[var(--text-muted)]">{t('noPayableInvoice')}</p>
                  {unconfirmedContractInvoice && <p className="mt-2 text-xs font-bold text-[var(--gold)]">{t('confirmContractBeforeCollecting')}</p>}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="bg-[var(--bg-surface)] text-left text-[10px] uppercase text-[var(--text-muted)]">
                      <tr>
                        <th className="w-12 px-3 py-2 text-center" />
                        <th className="px-3 py-2">{t('invoiceType')}</th>
                        <th className="px-3 py-2">{t('title')}</th>
                        <th className="px-3 py-2">{t('total')}</th>
                        <th className="px-3 py-2">{t('paid')}</th>
                        <th className="px-3 py-2">{t('remaining')}</th>
                        <th className="px-3 py-2">{t('discount')}</th>
                        <th className="px-3 py-2">{t('payNow')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {payableItems.map((item) => (
                        <tr key={item.key}>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={Number(effectivePaymentAmounts[item.key] ?? 0) + Number(discountAmounts[item.key] ?? 0) > 0}
                              onChange={(event) => {
                                const discount = Number(discountAmounts[item.key] ?? 0)
                                setPaymentAmounts((amounts) => ({
                                  ...amounts,
                                  [item.key]: event.target.checked ? Math.max(0, item.remaining - discount).toFixed(2) : '',
                                }))
                                if (!event.target.checked) setDiscountAmounts((amounts) => ({ ...amounts, [item.key]: '' }))
                              }}
                              aria-label={`Select ${item.title} for payment`}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                          </td>
                          <td className="px-3 py-3"><Badge color="blue">{item.invoiceType.replace('_', ' ')}</Badge></td>
                          <td className="px-3 py-3">
                            <p className="font-extrabold text-[var(--text-primary)]">{item.invoiceNumber}</p>
                            <p className="mt-1 max-w-64 truncate text-xs font-bold text-[var(--text-muted)]">{item.title}</p>
                          </td>
                          <td className="px-3 py-3">{money(item.total)}</td>
                          <td className="px-3 py-3 text-[var(--mint)]">{money(item.paid)}</td>
                          <td className="px-3 py-3 text-[var(--coral)]">{money(item.remaining)}</td>
                          <td className="px-3 py-3">
                            {item.invoiceType === 'water' ? (
                              <input
                                type="number"
                                min={0}
                                max={item.remaining}
                                step="0.01"
                                value={discountAmounts[item.key] ?? ''}
                                onChange={(event) => {
                                  const nextValue = event.target.value
                                  const nextDiscount = Number(nextValue || 0)
                                  const previousDiscount = Number(discountAmounts[item.key] ?? 0)
                                  const currentPayment = Number(effectivePaymentAmounts[item.key] ?? 0)
                                  setDiscountAmounts((amounts) => ({ ...amounts, [item.key]: nextValue }))
                                  if (Math.abs(currentPayment + previousDiscount - item.remaining) <= 0.005) {
                                    setPaymentAmounts((amounts) => ({ ...amounts, [item.key]: Math.max(0, item.remaining - nextDiscount).toFixed(2) }))
                                  }
                                }}
                                aria-label={`Discount for ${item.title}`}
                                placeholder="0.00"
                                className="field-control h-10 min-w-28 px-3 text-sm font-extrabold"
                              />
                            ) : <span className="text-xs font-bold text-[var(--text-muted)]">{translate('Water bills only')}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-48 items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={item.remaining}
                                step="0.01"
                                value={effectivePaymentAmounts[item.key] ?? ''}
                                onChange={(event) => setPaymentAmounts((amounts) => ({ ...amounts, [item.key]: event.target.value }))}
                                aria-label={`Pay now for ${item.title}`}
                                placeholder="0.00"
                                className="field-control h-10 min-w-28 px-3 text-sm font-extrabold"
                              />
                              <button
                                type="button"
                                className="secondary-action min-h-10 whitespace-nowrap px-3 py-2 text-xs"
                                onClick={() => {
                                  const selected = Number(effectivePaymentAmounts[item.key] ?? 0) + Number(discountAmounts[item.key] ?? 0) > 0
                                  setPaymentAmounts((amounts) => ({ ...amounts, [item.key]: selected ? '' : item.remaining.toFixed(2) }))
                                  if (selected) setDiscountAmounts((amounts) => ({ ...amounts, [item.key]: '' }))
                                }}
                              >
                                {Number(effectivePaymentAmounts[item.key] ?? 0) + Number(discountAmounts[item.key] ?? 0) > 0 ? t('clear') : t('payFull')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [t('amountReceived'), money(selectedTotal), 'text-[var(--text-primary)]'],
                  [t('discount'), money(selectedDiscountTotal), 'text-[var(--gold)]'],
                  [translate('Settled After Receipt'), money(totalAlreadyPaid + totalAlreadyDiscounted + selectedTotal + selectedDiscountTotal), 'text-[var(--mint)]'],
                  [t('remainingAfterReceipt'), money(selectedRemainingAfterPayment), 'text-[var(--coral)]'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[10px] font-extrabold uppercase text-[var(--text-muted)]">{label}</p>
                    <p className={`mt-1 text-base font-extrabold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <FormField label={t('paidAt')} type="date" value={dateValue(current.paid_at) || businessDate} onChange={(value) => setCurrent({ ...current, paid_at: value as string })} required />
          <FormField label={t('reference')} value={current.reference ?? ''} onChange={(value) => setCurrent({ ...current, reference: value as string })} />
          <div className="md:col-span-2">
            <FormField label={t('notes')} type="textarea" value={current.notes ?? ''} onChange={(value) => setCurrent({ ...current, notes: value as string })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={closePayment} disabled={isSavingPayment} className="secondary-action disabled:opacity-50">{t('cancel')}</button>
          <button type="button" onClick={save} disabled={!canSavePayment || isSavingPayment} className="primary-action disabled:cursor-not-allowed disabled:opacity-50">
            {isSavingPayment && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isSavingPayment ? translate('Saving Payment...') : t('savePayment')}
          </button>
        </div>
      </Modal>
    </PaymentModalContext.Provider>
  )
}

export function usePaymentModal(): PaymentModalContextValue {
  const context = useContext(PaymentModalContext)
  if (!context) throw new Error('usePaymentModal must be used inside PaymentModalProvider')
  return context
}
