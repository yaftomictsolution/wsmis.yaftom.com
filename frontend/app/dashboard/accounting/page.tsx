'use client'

import { useState } from 'react'
import { Banknote, Landmark, RotateCcw, WalletCards } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { DateText } from '@/components/ui/DateText'
import { useLanguage } from '@/context/LanguageContext'
import {
  useCreateAccountingAccountMutation,
  useDeleteAccountingAccountMutation,
  useGetAccountingAccountsQuery,
  useGetAccountingSummaryQuery,
  useUpdateAccountingAccountMutation,
  type AccountingAccount,
} from '@/src/store/waternetApi'

const money = (value: string | number | undefined) => `AFN ${Number(value ?? 0).toLocaleString()}`

const accountStatusColor = {
  active: 'emerald',
  inactive: 'slate',
} as const

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { message?: string; errors?: Record<string, string[]> } }).data
    if (data?.message) return data.message
    const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
    if (firstError) return firstError
  }

  return fallback
}

export default function AccountingPage() {
  const { t } = useLanguage()
  const { data: summary } = useGetAccountingSummaryQuery()
  const { data: accounts = [], isLoading, isError } = useGetAccountingAccountsQuery()
  const [createAccount, createAccountState] = useCreateAccountingAccountMutation()
  const [updateAccount, updateAccountState] = useUpdateAccountingAccountMutation()
  const [deleteAccount] = useDeleteAccountingAccountMutation()
  const [accountDraft, setAccountDraft] = useState<Partial<AccountingAccount>>({ type: 'cash', status: 'active' })
  const [selectedAccount, setSelectedAccount] = useState<AccountingAccount | null>(null)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const showSkeleton = isLoading && accounts.length === 0

  const summaryCards = [
    {
      title: t('totalAvailableBalance'),
      value: summary?.available_balance,
      caption: t('availableBalanceCaption'),
      icon: WalletCards,
      tone: 'text-[var(--accent)]',
    },
    {
      title: t('cashBalance'),
      value: summary?.cash_balance,
      caption: t('cashBalanceCaption'),
      icon: Banknote,
      tone: 'text-[var(--mint)]',
    },
    {
      title: t('bankBalance'),
      value: summary?.bank_balance,
      caption: t('bankBalanceCaption'),
      icon: Landmark,
      tone: 'text-[var(--violet)]',
    },
    {
      title: t('monthlyNetIncome'),
      value: summary?.monthly_net_income,
      caption: t('monthlyNetIncomeCaption'),
      icon: WalletCards,
      tone: Number(summary?.monthly_net_income ?? 0) >= 0 ? 'text-[var(--mint)]' : 'text-[var(--coral)]',
    },
    {
      title: t('customerDepositsHeld'),
      value: summary?.customer_deposit_liability,
      caption: t('customerDepositsCaption'),
      icon: WalletCards,
      tone: 'text-[var(--gold)]',
    },
    {
      title: t('refundsRequired'),
      value: summary?.customer_deposits_requiring_refund,
      caption: t('refundsRequiredCaption'),
      icon: RotateCcw,
      tone: 'text-[var(--coral)]',
    },
  ] as const

  const accountTypeLabel: Record<AccountingAccount['type'], string> = {
    cash: t('cash'),
    bank: t('bank'),
    mobile_money: t('mobileMoney'),
    check: t('check'),
    online: t('online'),
    other: t('other'),
  }

  const columns: Column<AccountingAccount>[] = [
    { key: 'name', label: t('accountName') },
    { key: 'type', label: t('accountTypeLabel'), render: (item) => accountTypeLabel[item.type] },
    { key: 'opening_balance', label: t('openingBalance'), render: (item) => money(item.opening_balance) },
    { key: 'total_income', label: t('totalIncome'), render: (item) => <span className="font-extrabold text-[var(--mint)]">{money(item.total_income)}</span> },
    { key: 'total_customer_advances', label: t('depositsReceived'), render: (item) => <span className="font-extrabold text-[var(--gold)]">{money(item.total_customer_advances)}</span> },
    { key: 'total_deposit_refunds', label: t('depositRefunds'), render: (item) => <span className="font-extrabold text-[var(--coral)]">{money(item.total_deposit_refunds)}</span> },
    { key: 'total_expense', label: t('totalExpense'), render: (item) => <span className="font-extrabold text-[var(--coral)]">{money(item.total_expense)}</span> },
    { key: 'current_balance', label: t('currentBalanceLabel'), render: (item) => <span className="font-extrabold text-[var(--text-primary)]">{money(item.current_balance)}</span> },
    { key: 'last_transaction_at', label: t('lastUpdated'), render: (item) => <DateText value={item.last_transaction_at} /> },
    { key: 'status', label: t('status'), render: (item) => <Badge color={accountStatusColor[item.status]}>{item.status}</Badge> },
    { key: 'code', label: t('code') },
    { key: 'notes', label: t('notes'), render: (item) => item.notes || '-' },
  ]

  const openNewAccount = () => {
    setError('')
    setAccountDraft({ type: 'cash', status: 'active', opening_balance: 0 })
    setIsAccountOpen(true)
  }

  const openEditAccount = (account: AccountingAccount) => {
    setError('')
    setAccountDraft({
      id: account.id,
      name: account.name,
      code: account.code,
      type: account.type,
      opening_balance: account.opening_balance,
      status: account.status,
      notes: account.notes ?? '',
    })
    setIsAccountOpen(true)
  }

  const saveAccount = async () => {
    setError('')

    if (!accountDraft.name || !accountDraft.code || !accountDraft.type) {
      setError(t('fillAccountFields'))
      return
    }

    const body: Partial<AccountingAccount> = {
      name: accountDraft.name,
      code: accountDraft.code,
      type: accountDraft.type,
      opening_balance: Number(accountDraft.opening_balance ?? 0),
      status: accountDraft.status ?? 'active',
      notes: accountDraft.notes ?? '',
    }

    try {
      if (accountDraft.id) {
        await updateAccount({ id: accountDraft.id, body }).unwrap()
      } else {
        await createAccount(body).unwrap()
      }
      setIsAccountOpen(false)
      setAccountDraft({ type: 'cash', status: 'active' })
    } catch (err) {
      setError(getApiErrorMessage(err, t('unableToSaveAccount')))
    }
  }

  const removeAccount = async () => {
    if (!selectedAccount) return
    setError('')

    try {
      await deleteAccount(selectedAccount.id).unwrap()
      setSelectedAccount(null)
      setIsDeleteOpen(false)
    } catch (err) {
      setError(getApiErrorMessage(err, t('unableToDeleteAccount')))
      setIsDeleteOpen(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader title={t('accounting')} subtitle={t('accountingCaption')}>
        <button type="button" onClick={openNewAccount} className="primary-action text-sm">
          <Landmark size={18} /> {t('addAccount')}
        </button>
      </PageHeader>

      {(error || isError) && (
        <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
          {error || t('unableToLoadAccountingAccounts')}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon

          return (
            <div key={card.title} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">{card.title}</p>
                  <p className="mt-2 text-xl font-extrabold text-[var(--text-primary)]">{money(card.value)}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                  <Icon className={`h-5 w-5 ${card.tone}`} />
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-[var(--text-muted)]">{card.caption}</p>
            </div>
          )
        })}
      </div>

      <DataTable
        columns={columns}
        data={accounts}
        loading={showSkeleton}
        onEdit={openEditAccount}
        onDelete={(account) => {
          setSelectedAccount(account)
          setIsDeleteOpen(true)
        }}
        searchKeys={['name', 'code', 'type', 'status']}
        summaryColumnCount={8}
      />

      <Modal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        title={accountDraft.id ? `${t('update')} ${t('account')}` : t('addAccount')}
        size="lg"
      >
        {isAccountOpen && error ? (
          <div role="alert" className="mb-4 rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
            {error}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label={t('accountName')} value={accountDraft.name ?? ''} onChange={(val) => setAccountDraft({ ...accountDraft, name: val as string })} required />
          <FormField label={t('code')} value={accountDraft.code ?? ''} onChange={(val) => setAccountDraft({ ...accountDraft, code: val as string })} placeholder="office_cash" required />
          <FormField label={t('accountTypeLabel')} type="select" value={accountDraft.type ?? 'cash'} onChange={(val) => setAccountDraft({ ...accountDraft, type: val as AccountingAccount['type'] })} options={[
            { value: 'cash', label: t('cash') },
            { value: 'bank', label: t('bank') },
            { value: 'mobile_money', label: t('mobileMoney') },
            { value: 'check', label: t('check') },
            { value: 'online', label: t('online') },
            { value: 'other', label: t('other') },
          ]} required />
          <FormField label={t('openingBalance')} type="number" value={accountDraft.opening_balance ?? 0} onChange={(val) => setAccountDraft({ ...accountDraft, opening_balance: Number(val) })} />
          <FormField
            label={t('status')}
            type="select"
            value={accountDraft.status ?? 'active'}
            onChange={(val) => setAccountDraft({ ...accountDraft, status: val as AccountingAccount['status'] })}
            options={[
              { value: 'active', label: t('active') },
              { value: 'inactive', label: t('inactive') },
            ]}
            required
          />
          <div className="md:col-span-2">
            <FormField label={t('notes')} type="textarea" value={accountDraft.notes ?? ''} onChange={(val) => setAccountDraft({ ...accountDraft, notes: val as string })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsAccountOpen(false)} className="secondary-action">{t('cancel')}</button>
          <LoadingButton
            onClick={() => void saveAccount()}
            loading={createAccountState.isLoading || updateAccountState.isLoading}
            loadingLabel={accountDraft.id ? 'Updating...' : 'Saving...'}
          >
            {accountDraft.id ? t('update') : t('saveAccount')}
          </LoadingButton>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={removeAccount}
        title={t('deleteAccount')}
        message={`${t('deleteAccount')} ${selectedAccount?.name ?? ''}? ${t('unableToDeleteAccount')}`}
      />
    </div>
  )
}
