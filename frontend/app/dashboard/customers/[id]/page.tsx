'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileSignature,
  History,
  LoaderCircle,
  PackageCheck,
  PlugZap,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  WalletCards,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { RecordPaymentButton } from '@/components/payments/RecordPaymentButton'
import { CustomerMeterReadingModal } from '@/components/meter-readings/CustomerMeterReadingModal'
import { API_BASE_URL, getAuthToken } from '@/lib/api'
import { apiDateValue } from '@/lib/dates'
import { useCalendar } from '@/context/CalendarContext'
import { useLanguage } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useCancelCustomerChargeMutation,
  useCancelCustomerContractMutation,
  useConfirmCustomerContractMutation,
  useCreateCustomerChargeMutation,
  useCreateCustomerConnectionEventMutation,
  useCreateCustomerContractMutation,
  useCreateCustomerServiceRequestMutation,
  useDeleteCustomerDocumentMutation,
  useGetContractCancellationPreviewQuery,
  useGetCustomerDetailQuery,
  useGetCustomerDocumentsQuery,
  useGetAuthorityOptionsQuery,
  useGetMeQuery,
  useGetPaymentReceivingAccountsQuery,
  useGetSettingsQuery,
  useGetUsersQuery,
  useMarkCustomerContractPrintedMutation,
  useRefundCustomerDepositMutation,
  useResolveContractCancellationMutation,
  useUpdateCustomerContractMutation,
  useUpdateCustomerServiceRequestMutation,
  useUploadCustomerDocumentsMutation,
  type CustomerCharge,
  type CustomerConnectionEvent,
  type CustomerContract,
  type CustomerDeposit,
  type CustomerDocument,
  type CustomerLedgerEntry,
  type CustomerServiceRequest,
  type MeterSeal,
} from '@/src/store/waternetApi'

type TabKey =
  | 'profile'
  | 'contract'
  | 'deposits'
  | 'charges'
  | 'payments'
  | 'meters'
  | 'readings'
  | 'invoices'
  | 'ledger'
  | 'requests'
  | 'replacement'
  | 'connection'
  | 'documents'

const baseTabs: { key: TabKey; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'contract', label: 'Contract' },
  { key: 'charges', label: 'Charges' },
  { key: 'payments', label: 'Payments' },
  { key: 'meters', label: 'Meter Assignment' },
  { key: 'readings', label: 'Reading History' },
  { key: 'invoices', label: 'Invoices / Bills' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'requests', label: 'Complaints' },
  { key: 'replacement', label: 'Replacement History' },
  { key: 'connection', label: 'Disconnect / Reconnect' },
  { key: 'documents', label: 'Documents' },
]

const tabKeys = new Set<TabKey>([...baseTabs.map((tab) => tab.key), 'deposits'])
const isTabKey = (value: string | null): value is TabKey => Boolean(value && tabKeys.has(value as TabKey))

const statusColor: Record<string, 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'slate'> = {
  active: 'emerald',
  installation_pending: 'blue',
  approved: 'emerald',
  signed: 'emerald',
  printed: 'blue',
  pending_approval: 'amber',
  draft: 'slate',
  rejected: 'red',
  disconnected: 'red',
  posted: 'emerald',
  cancelled: 'slate',
  paid: 'emerald',
  partially_paid: 'amber',
  unpaid: 'red',
  open: 'blue',
  assigned: 'purple',
  in_progress: 'amber',
  resolved: 'emerald',
  closed: 'slate',
  replaced: 'purple',
  removed: 'red',
  completed: 'emerald',
  pending: 'amber',
  awaiting_approval: 'amber',
  awaiting_installation: 'blue',
  registered: 'slate',
  refund_required: 'red',
  refunded: 'slate',
  applied: 'emerald',
  partially_applied: 'amber',
  intact: 'emerald',
  broken: 'red',
}

const money = (value?: string | number) => `AFN ${Number(value ?? 0).toLocaleString()}`
const contractStatusLabel = (status: string) => status === 'installation_pending'
  ? 'Awaiting Installation'
  : status.replaceAll('_', ' ')
const apiErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } }).data
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0]
    if (first) return first
  }
  return data?.message || fallback
}

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const customerId = Number(params.id)
  const { translate } = useLanguage()
  const { formatDate } = useCalendar()
  const dateOnly = (value?: string) => formatDate(value)
  const { businessDate } = useTrainingMode()

  const { data, isLoading, isError, refetch } = useGetCustomerDetailQuery(customerId, { skip: !customerId })
  const { data: profile } = useGetMeQuery()
  const { data: settings } = useGetSettingsQuery()
  const { data: users = [] } = useGetUsersQuery()
  const { data: authorities = [], isFetching: authoritiesLoading } = useGetAuthorityOptionsQuery()
  const { data: documents = [] } = useGetCustomerDocumentsQuery(customerId, { skip: !customerId })
  const [createCharge] = useCreateCustomerChargeMutation()
  const [cancelCharge] = useCancelCustomerChargeMutation()
  const [createRequest, { isLoading: isCreatingRequest }] = useCreateCustomerServiceRequestMutation()
  const [updateRequest] = useUpdateCustomerServiceRequestMutation()
  const [createConnectionEvent] = useCreateCustomerConnectionEventMutation()
  const [uploadDocuments] = useUploadCustomerDocumentsMutation()
  const [deleteDocument] = useDeleteCustomerDocumentMutation()
  const [createContract] = useCreateCustomerContractMutation()
  const [updateContract] = useUpdateCustomerContractMutation()
  const [markContractPrinted] = useMarkCustomerContractPrintedMutation()
  const [confirmContract, { isLoading: isConfirmingContract }] = useConfirmCustomerContractMutation()
  const [cancelContract, { isLoading: isSubmittingCancellation }] = useCancelCustomerContractMutation()
  const [resolveContractCancellation] = useResolveContractCancellationMutation()
  const [refundDeposit] = useRefundCustomerDepositMutation()

  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const [chargeOpen, setChargeOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [documentOpen, setDocumentOpen] = useState(false)
  const [readingOpen, setReadingOpen] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)
  const [cancelContractOpen, setCancelContractOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [deleteDoc, setDeleteDoc] = useState<CustomerDocument | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<CustomerServiceRequest | null>(null)
  const [selectedDeposit, setSelectedDeposit] = useState<CustomerDeposit | null>(null)
  const [selectedHistoryContract, setSelectedHistoryContract] = useState<CustomerContract | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [error, setError] = useState('')
  const [documentError, setDocumentError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [workflowReason, setWorkflowReason] = useState('')
  const [refundPostedPayments, setRefundPostedPayments] = useState(false)
  const [materialsReceivedConfirmed, setMaterialsReceivedConfirmed] = useState(false)
  const [cancellationDecision, setCancellationDecision] = useState<'approved' | 'rejected' | null>(null)
  const [contractRefundDate, setContractRefundDate] = useState(businessDate)
  const [contractRefundReference, setContractRefundReference] = useState('')
  const [contractRefundAccountId, setContractRefundAccountId] = useState<number>()
  const [notice, setNotice] = useState('')
  const { data: refundAccounts = [], isFetching: refundAccountsLoading } = useGetPaymentReceivingAccountsQuery(undefined, {
    skip: !cancelContractOpen,
  })
  const [contractForm, setContractForm] = useState<Partial<CustomerContract>>({
    subscription_date: businessDate,
    meter_size: 'Half inch',
    connection_fee: 0,
    meter_fee: 0,
    discount_amount: 0,
  })

  const [chargeForm, setChargeForm] = useState<Partial<CustomerCharge>>({
    amount: 0,
    charge_date: businessDate,
  })
  const [requestForm, setRequestForm] = useState<Partial<CustomerServiceRequest>>({
    type: 'complaint',
    priority: 'normal',
    requested_at: businessDate,
  })
  const [eventForm, setEventForm] = useState<Partial<CustomerConnectionEvent>>({
    event_type: 'disconnection',
    status: 'completed',
    fee: 0,
    disconnected_at: businessDate,
  })
  const [documentForm, setDocumentForm] = useState({ documentType: '', notes: '' })

  useEffect(() => {
    if (isTabKey(requestedTab)) {
      setActiveTab(requestedTab)
    }
  }, [requestedTab])

  const customer = data?.customer
  const contractHistory = useMemo(
    () => [...(customer?.contracts ?? [])].sort((left, right) => right.id - left.id),
    [customer?.contracts],
  )
  const currentContract = useMemo(() => {
    if (customer?.latest_contract) {
      return contractHistory.find((contract) => contract.id === customer.latest_contract?.id) ?? customer.latest_contract
    }
    return contractHistory[0]
  }, [contractHistory, customer?.latest_contract])
  const { data: cancellationPreview, isFetching: cancellationPreviewLoading } = useGetContractCancellationPreviewQuery(
    currentContract?.id ?? 0,
    { skip: !cancelContractOpen || !currentContract?.id },
  )
  const pendingCancellation = currentContract?.pending_cancellation
  const cancellationRefundAmount = Number(cancellationPreview?.refundable_amount ?? 0)
  const cancellationHasMaterials = Number(cancellationPreview?.material_line_count ?? 0) > 0
  const selectedRefundAccount = refundAccounts.find((account) => account.id === contractRefundAccountId)
  const contractDeposits = currentContract?.deposits ?? []
  const visibleTabs = useMemo(() => {
    if (contractDeposits.length === 0) return baseTabs
    const contractIndex = baseTabs.findIndex((tab) => tab.key === 'contract')
    return [
      ...baseTabs.slice(0, contractIndex + 1),
      { key: 'deposits' as const, label: 'Legacy Deposit History' },
      ...baseTabs.slice(contractIndex + 1),
    ]
  }, [contractDeposits.length])
  useEffect(() => {
    if (activeTab === 'deposits' && contractDeposits.length === 0) setActiveTab('contract')
  }, [activeTab, contractDeposits.length])
  useEffect(() => {
    if (!cancelContractOpen || cancellationRefundAmount <= 0 || contractRefundAccountId) return
    const eligibleAccounts = refundAccounts.filter((account) => Number(account.current_balance) + 0.005 >= cancellationRefundAmount)
    if (eligibleAccounts.length === 1) setContractRefundAccountId(eligibleAccounts[0].id)
  }, [cancelContractOpen, cancellationRefundAmount, contractRefundAccountId, refundAccounts])
  const isAdmin = profile?.roles.some((role) => ['Admin', 'Super Admin'].includes(role)) ?? false
  const contractGross = Number(contractForm.connection_fee ?? 0) + Number(contractForm.meter_fee ?? 0)
  const contractNet = Math.max(0, contractGross - Number(contractForm.discount_amount ?? 0))
  const activeDocuments = documents.length > 0 ? documents : customer?.document_files ?? []
  const chargeTypes = settings?.customer_charge_types?.filter((type) => type.status === 'active') ?? []
  const technicians = useMemo(
    () => users.filter((user) => user.status === 'active' && user.roles?.some((role) => role.name === 'Technician')),
    [users],
  )
  const workflowReady = currentContract
    ? ['installation_pending', 'active'].includes(currentContract.status)
    : ['approved', 'installation_pending', 'signed', 'active'].includes(customer?.agreement_status ?? '')

  const openContractEditor = () => {
    const editable = currentContract && ['draft', 'printed'].includes(currentContract.status) ? currentContract : undefined
    setContractForm(editable ? {
      subscription_date: apiDateValue(editable.subscription_date),
      meter_size: editable.meter_size,
      connection_fee: editable.connection_fee,
      meter_fee: editable.meter_fee,
      discount_amount: editable.discount_amount,
      discount_authority_id: editable.discount_authority_id,
      notes: editable.notes,
    } : {
      subscription_date: businessDate,
      meter_size: 'Half inch',
      connection_fee: 0,
      meter_fee: 0,
      discount_amount: 0,
    })
    setError('')
    setContractOpen(true)
  }

  const saveContract = async () => {
    const gross = Number(contractForm.connection_fee ?? 0) + Number(contractForm.meter_fee ?? 0)
    const discount = Number(contractForm.discount_amount ?? 0)
    if (!contractForm.subscription_date || gross <= 0 || discount > gross) {
      setError('Enter a valid subscription date and contract fees.')
      return
    }
    if (discount > 0 && !contractForm.discount_authority_id) {
      setError('Select the authority who granted this discount.')
      return
    }

    try {
      if (currentContract && ['draft', 'printed'].includes(currentContract.status)) {
        await updateContract({ id: currentContract.id, customerId, body: contractForm }).unwrap()
      } else {
        await createContract({ customerId, body: contractForm }).unwrap()
      }
      await refetch()
      setContractOpen(false)
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save customer contract.'))
    }
  }

  const confirmCurrentContract = async () => {
    if (!currentContract || isConfirmingContract) return
    try {
      setError('')
      setNotice('')
      await confirmContract({ id: currentContract.id, customerId }).unwrap()
      await refetch()
      setNotice('Contract confirmed. The invoice is ready, the admin was notified, and meter installation can proceed.')
    } catch (err) {
      setNotice('')
      setError(apiErrorMessage(err, 'Unable to confirm customer contract.'))
    }
  }

  const cancelCurrentContract = async () => {
    if (!currentContract || !workflowReason.trim()) {
      setError('Enter the cancellation reason.')
      return
    }
    if (cancellationHasMaterials && !materialsReceivedConfirmed) {
      setError('Confirm that all listed contract materials were physically received.')
      return
    }
    if (cancellationRefundAmount > 0 && !refundPostedPayments) {
      setError('Confirm the customer refund that will be posted when Admin approves the cancellation.')
      return
    }
    if (cancellationRefundAmount > 0 && !contractRefundAccountId) {
      setError('Select the account that will pay the customer refund.')
      return
    }
    if (cancellationRefundAmount > 0 && Number(selectedRefundAccount?.current_balance ?? 0) + 0.005 < cancellationRefundAmount) {
      setError('The selected refund account does not have enough available balance.')
      return
    }
    try {
      await cancelContract({
        id: currentContract.id,
        customerId,
        reason: workflowReason,
        materialsReceivedConfirmed: cancellationHasMaterials,
        refundPostedPayments: cancellationRefundAmount > 0,
        refundAccountingAccountId: cancellationRefundAmount > 0 ? contractRefundAccountId : undefined,
        refundedAt: cancellationRefundAmount > 0 ? contractRefundDate : undefined,
        refundReference: cancellationRefundAmount > 0 ? contractRefundReference || undefined : undefined,
      }).unwrap()
      await refetch()
      setCancelContractOpen(false)
      setWorkflowReason('')
      setRefundPostedPayments(false)
      setMaterialsReceivedConfirmed(false)
      setContractRefundReference('')
      setContractRefundAccountId(undefined)
      setError('')
      setNotice('Cancellation sent to Admin. One approval will return the materials, process refunds, and cancel the contract.')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to cancel customer contract.'))
    }
  }

  const resolveCurrentCancellation = async (status: 'approved' | 'rejected') => {
    if (!pendingCancellation || !currentContract) return

    await resolveContractCancellation({
      id: pendingCancellation.id,
      customerId,
      contractId: currentContract.id,
      status,
    }).unwrap()
    await refetch()
    setNotice(status === 'approved'
      ? 'Cancellation approved. Materials and meter were returned and the contract was closed.'
      : 'Cancellation request rejected. The contract remains active.')
    setCancellationDecision(null)
  }

  const refundSelectedDeposit = async () => {
    if (!selectedDeposit || !workflowReason.trim()) {
      setError('Enter the refund reason.')
      return
    }
    try {
      const refunded = await refundDeposit({
        depositId: selectedDeposit.id,
        customerId,
        body: { refunded_at: businessDate, refund_reason: workflowReason },
      }).unwrap()
      await refetch()
      setRefundOpen(false)
      setSelectedDeposit(null)
      setWorkflowReason('')
      setError('')
      printDepositReceipt(refunded, true)
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to refund customer deposit.'))
    }
  }

  const printDepositReceipt = (deposit: CustomerDeposit, refund = false) => {
    const printWindow = window.open('', '_blank', 'width=900,height=760')
    if (!printWindow || !customer) return
    const receipt = refund ? deposit.refund_receipt_number : deposit.receipt_number
    const amount = refund ? Number(deposit.refunded_amount) : Number(deposit.amount)
    const date = refund ? deposit.refunded_at : deposit.received_at
    printWindow.document.write(`<!doctype html><html><head><title>${receipt ?? 'Receipt'}</title><style>
      @page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#111;margin:0}.sheet{border:1px solid #222;padding:28px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:18px}.title{font-size:24px;font-weight:800}.muted{color:#555}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #333;margin-top:24px}.cell{padding:12px;border-bottom:1px solid #bbb}.cell:nth-child(odd){border-right:1px solid #bbb}.amount{font-size:22px;font-weight:800}.signatures{display:flex;justify-content:space-between;margin-top:90px}.no-print{margin-bottom:16px}@media print{.no-print{display:none}}
    </style></head><body><button class="no-print" onclick="window.print()">Print</button><div class="sheet"><div class="head"><div><div class="title">Water Supply Management System</div><div class="muted">${refund ? 'Customer Deposit Refund Receipt' : 'Customer Deposit Receipt'}</div></div><div><strong>${receipt ?? '-'}</strong><br><span class="muted">${dateOnly(date)}</span></div></div><div class="grid"><div class="cell"><span class="muted">Customer</span><br><strong>${customer.name}</strong></div><div class="cell"><span class="muted">Customer Code</span><br><strong>${customer.subscription_code ?? '-'}</strong></div><div class="cell"><span class="muted">Contract</span><br><strong>${currentContract?.contract_number ?? '-'}</strong></div><div class="cell"><span class="muted">Account</span><br><strong>${deposit.account?.name ?? '-'}</strong></div><div class="cell"><span class="muted">Payment Method</span><br><strong>${deposit.payment_method?.name ?? '-'}</strong></div><div class="cell"><span class="muted">Amount</span><br><span class="amount">${money(amount)}</span></div><div class="cell"><span class="muted">Reference</span><br><strong>${refund ? deposit.refund_reference ?? '-' : deposit.reference ?? '-'}</strong></div><div class="cell"><span class="muted">Status</span><br><strong>${deposit.status}</strong></div></div><div class="signatures"><span>Customer signature</span><span>Cashier signature</span><span>Authorized signature</span></div></div><script>window.onload=()=>window.print()</script></body></html>`)
    printWindow.document.close()
  }

  const printCurrentContract = async () => {
    if (!currentContract || !customer) return
    const printWindow = window.open(`/print/customer-contract/${customer.id}`, '_blank')
    if (!printWindow) {
      setError('Unable to open the customer contract print page. Allow pop-ups and try again.')
      return
    }
    printWindow.opener = null

    if (['draft', 'printed'].includes(currentContract.status)) {
      try {
        await markContractPrinted({ id: currentContract.id, customerId }).unwrap()
      } catch (err) {
        setError(apiErrorMessage(err, 'The contract opened, but its printed status could not be saved.'))
      }
    }
  }

  const saveCharge = async () => {
    if (!chargeForm.customer_charge_type_id || !chargeForm.title || !chargeForm.amount || !chargeForm.charge_date) {
      setError('Select the charge type and enter the title, amount, and date.')
      return
    }

    try {
      await createCharge({ customerId, body: chargeForm }).unwrap()
      setChargeOpen(false)
      setChargeForm({ customer_charge_type_id: chargeTypes[0]?.id, amount: 0, charge_date: businessDate })
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to create customer charge.'))
    }
  }

  const openChargeForm = () => {
    setError('')
    setChargeForm({
      customer_charge_type_id: chargeTypes[0]?.id,
      amount: 0,
      charge_date: businessDate,
    })
    setChargeOpen(true)
  }

  const saveRequest = async () => {
    const description = requestForm.description?.trim()
    if (!description || !requestForm.requested_at) {
      setError('Enter request description and date.')
      return
    }

    try {
      await createRequest({
        customerId,
        body: {
          type: requestForm.type ?? 'complaint',
          priority: requestForm.priority ?? 'normal',
          requested_at: requestForm.requested_at,
          description,
          ...(requestForm.assigned_to ? { assigned_to: requestForm.assigned_to } : {}),
        },
      }).unwrap()
      setRequestOpen(false)
      setRequestForm({ type: 'complaint', priority: 'normal', requested_at: businessDate })
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to create service request.'))
    }
  }

  const openRequestForm = () => {
    setError('')
    setRequestForm({ type: 'complaint', priority: 'normal', requested_at: businessDate })
    setRequestOpen(true)
  }

  const openResolution = (request: CustomerServiceRequest) => {
    setSelectedRequest(request)
    setResolutionNote(request.resolution ?? '')
    setResolutionOpen(true)
  }

  const saveResolution = async () => {
    if (!selectedRequest) return

    if (!resolutionNote.trim()) {
      setError('Enter resolution note.')
      return
    }

    try {
      await updateRequest({
        customerId,
        requestId: selectedRequest.id,
        body: { status: 'resolved', resolution: resolutionNote },
      }).unwrap()
      setResolutionOpen(false)
      setSelectedRequest(null)
      setResolutionNote('')
      setError('')
    } catch {
      setError('Unable to resolve service request.')
    }
  }

  const closeRequest = async (request: CustomerServiceRequest) => {
    try {
      await updateRequest({
        customerId,
        requestId: request.id,
        body: { status: 'closed', resolution: request.resolution ?? 'Closed' },
      }).unwrap()
      setError('')
    } catch {
      setError('Unable to close service request.')
    }
  }

  const saveConnectionEvent = async () => {
    const requiredDate = eventForm.event_type === 'reconnection' ? eventForm.reconnected_at : eventForm.disconnected_at

    if (!requiredDate) {
      setError('Select the event date.')
      return
    }

    try {
      await createConnectionEvent({ customerId, body: eventForm }).unwrap()
      setEventOpen(false)
      setEventForm({ event_type: 'disconnection', status: 'completed', fee: 0, disconnected_at: businessDate })
      setError('')
    } catch {
      setError('Unable to save connection event.')
    }
  }

  const saveDocuments = async () => {
    if (files.length === 0) {
      setDocumentError('Select at least one file.')
      return
    }

    try {
      await uploadDocuments({
        customerId,
        files,
        documentType: documentForm.documentType || undefined,
        notes: documentForm.notes || undefined,
      }).unwrap()
      setDocumentOpen(false)
      setFiles([])
      setDocumentForm({ documentType: '', notes: '' })
      setDocumentError('')
    } catch {
      setDocumentError('Unable to upload customer documents.')
    }
  }

  const downloadDocument = async (document: CustomerDocument) => {
    const token = getAuthToken()
    setDocumentError('')

    try {
      const response = await fetch(`${API_BASE_URL}/customer-documents/${document.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.original_name
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setDocumentError('Unable to download customer document.')
    }
  }

  const downloadSealPhoto = async (seal: MeterSeal) => {
    const token = getAuthToken()
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/meter-seals/${seal.id}/photo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = seal.photo_original_name ?? `meter-seal-${seal.seal_number}`
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Unable to download the meter seal photograph.')
    }
  }

  const removeDocument = async () => {
    if (!deleteDoc) return

    try {
      await deleteDocument({ customerId, documentId: deleteDoc.id }).unwrap()
      setDeleteDoc(null)
      setDocumentError('')
    } catch {
      setDocumentError('Unable to delete customer document.')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-24 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="skeleton h-96 rounded-xl" />
      </div>
    )
  }

  if (isError || !customer || !data) {
    return (
      <div className="elegant-panel p-8 text-center">
        <p className="text-[var(--text-secondary)]">{translate('Unable to load customer workspace.')}</p>
        <button type="button" onClick={() => router.push('/dashboard/customers')} className="secondary-action mt-5">
          {translate('Back to Customers')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={[customer.name, customer.last_name].filter(Boolean).join(' ')} subtitle={`${customer.subscription_code ?? 'No subscription code'} | ${customer.service_area?.name ?? 'No service area'}`}>
        <button type="button" onClick={() => router.push('/dashboard/customers')} className="secondary-action">
          <ArrowLeft className="h-4 w-4" />
          {translate('Customers')}
        </button>
        <button type="button" onClick={() => refetch()} className="secondary-action">
          <RefreshCw className="h-4 w-4" />
          {translate('Refresh')}
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]" role="alert">
          {translate(error)}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm font-bold text-[var(--mint)]" role="status">
          {translate(notice)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Current Balance" value={money(customer.current_balance)} icon={<WalletCards className="h-5 w-5" />} />
        <Metric title="Contract" value={currentContract?.status ?? 'no contract'} badge />
        <Metric title="Customer Status" value={customer.status} badge />
        <Metric title="Current Meter" value={data.current_meter_assignment?.meter?.meter_number ?? 'Not assigned'} icon={<PlugZap className="h-5 w-5" />} />
      </div>

      <div className="elegant-panel overflow-hidden">
        <div className="flex gap-2 overflow-x-auto border-b elegant-divider p-3">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-[var(--teal-soft)] text-[var(--accent-strong)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]'
              }`}
            >
              {translate(tab.label)}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6">
          {activeTab === 'profile' && (
            <Section title="Customer Profile" action={null}>
              <InfoGrid
                items={[
                  ['First Name', customer.name],
                  ['Last Name', customer.last_name],
                  ['Father Name', customer.father_name],
                  ['Grandfather Name', customer.grandfather_name],
                  ['Phone', customer.phone],
                  ['Secondary Phone', customer.secondary_phone],
                  ['Tazkira Number', customer.tazkira_number],
                  ['Area', customer.service_area?.name],
                  ['Mosque', customer.service_area_mosque?.name],
                  ['House Number', customer.house_number],
                  ['Nearest House', customer.nearest_house_number],
                  ['Street', customer.street_number],
                  ['Original Residence', customer.original_residence],
                  ['Current Residence', customer.current_residence],
                  ['Address', customer.address],
                  ['Notes', customer.notes],
                ]}
              />
            </Section>
          )}

          {activeTab === 'contract' && (
            <Section
              title="Subscription / Connection Contract"
              action={(
                <div className="flex flex-wrap gap-2">
                  {(!currentContract || ['rejected', 'cancelled'].includes(currentContract.status)) && (
                    <button type="button" onClick={openContractEditor} className="primary-action"><FileSignature className="h-4 w-4" />{translate('Create Contract')}</button>
                  )}
                  {currentContract && ['draft', 'printed'].includes(currentContract.status) && (
                    <button type="button" onClick={openContractEditor} className="secondary-action">{translate('Edit')}</button>
                  )}
                  {currentContract && !['rejected', 'cancelled'].includes(currentContract.status) && (
                    <button type="button" onClick={printCurrentContract} className="secondary-action"><Printer className="h-4 w-4" />{translate('Print')}</button>
                  )}
                  {currentContract && ['draft', 'printed'].includes(currentContract.status) && (
                    <button
                      type="button"
                      onClick={confirmCurrentContract}
                      disabled={isConfirmingContract}
                      className="primary-action disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {isConfirmingContract ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {translate(isConfirmingContract ? 'Confirming...' : 'Confirm Contract')}
                    </button>
                  )}
                  {currentContract
                    && ['installation_pending', 'active'].includes(currentContract.status)
                    && Number(currentContract.remaining_amount) > 0
                    && currentContract.invoice?.id && (
                    <RecordPaymentButton customerId={customerId} invoiceId={currentContract.invoice.id} />
                  )}
                  {currentContract && !pendingCancellation && ['draft', 'printed', 'installation_pending', 'active'].includes(currentContract.status) && (
                    <button type="button" onClick={() => {
                      setWorkflowReason('')
                      setRefundPostedPayments(false)
                      setMaterialsReceivedConfirmed(false)
                      setContractRefundDate(businessDate)
                      setContractRefundReference('')
                      setContractRefundAccountId(undefined)
                      setError('')
                      setCancelContractOpen(true)
                    }} className="secondary-action">{translate('Cancel Contract')}</button>
                  )}
                </div>
              )}
            >
              {!currentContract ? (
                <div className="rounded-xl border border-dashed border-[var(--border-color)] p-10 text-center">
                  <FileSignature className="mx-auto h-8 w-8 text-[var(--accent)]" />
                  <p className="mt-3 text-sm font-bold text-[var(--text-secondary)]">{translate('This customer is registered, but no connection contract has been created yet.')}</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--border-color)] xl:grid-cols-4">
                    {[
                      ['Contract Total', currentContract.net_amount],
                      ['Paid', currentContract.paid_amount ?? Math.max(0, Number(currentContract.net_amount) - Number(currentContract.remaining_amount))],
                      ['Remaining', currentContract.remaining_amount],
                      ['Discount', currentContract.discount_amount],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="bg-[var(--bg-elevated)] px-4 py-3">
                        <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate(String(label))}</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{money(value)}</p>
                      </div>
                    ))}
                  </div>
                  {pendingCancellation ? (
                    <div className="flex flex-col gap-4 rounded-lg border border-[var(--gold)]/45 bg-[var(--gold-soft)] p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--gold)]">
                          <PackageCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-extrabold text-[var(--text-primary)]">{translate('Cancellation awaiting Admin approval')}</p>
                            <Badge color="amber">{translate('One approval')}</Badge>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">{pendingCancellation.reason}</p>
                          <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
                           {pendingCancellation.items?.length ?? 0} {translate('material lines')} | {translate('Requested by')} {pendingCancellation.requester?.name ?? '-'}
                          </p>
                          {pendingCancellation.refund_posted_payments ? (
                            <p className="mt-1 text-xs font-bold text-[var(--coral)]">
                              {translate('Refund From Account')}: {pendingCancellation.refund_account?.name ?? '-'}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {isAdmin ? (
                        <div className="flex flex-none gap-2">
                          <button type="button" onClick={() => setCancellationDecision('rejected')} className="secondary-action text-[var(--coral)]">{translate('Reject')}</button>
                          <button type="button" onClick={() => setCancellationDecision('approved')} className="primary-action"><ShieldCheck className="h-4 w-4" />{translate('Approve Cancellation')}</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <InfoGrid
                    items={[
                      ['Contract Number', currentContract.contract_number],
                      ['Subscription Date', dateOnly(currentContract.subscription_date)],
                      ['Meter Size', currentContract.meter_size],
                      ['Connection Fee', money(currentContract.connection_fee)],
                      ['Meter Fee', money(currentContract.meter_fee)],
                      ['Discount Amount', money(currentContract.discount_amount)],
                      ['Payment Status', <Badge key="payment-status" color={statusColor[currentContract.payment_status] ?? 'blue'}>{currentContract.payment_status}</Badge>],
                      ['Discount Given By', currentContract.discount_approved_by ?? currentContract.discount_authority?.name],
                      ['Authority Number', currentContract.discount_authority?.authority_number],
                      ['Contract Status', <Badge key="contract-status" color={statusColor[currentContract.status] ?? 'blue'}>{translate(contractStatusLabel(currentContract.status))}</Badge>],
                      ['Confirmed By', currentContract.confirmer?.name],
                      ['Confirmed At', dateOnly(currentContract.confirmed_at)],
                      ['Activated At', dateOnly(currentContract.activated_at)],
                      ['Notes', currentContract.notes],
                    ]}
                  />
                  {currentContract.status === 'installation_pending' && (
                    <div className="flex flex-col gap-3 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
                      <span>{translate('The contract is confirmed and its invoice is ready. Assign and seal a meter to activate service.')}</span>
                      <Link href={`/dashboard/meter-assignments?customer=${customerId}&contract=${currentContract.id}`} className="primary-action text-xs">
                        <PlugZap className="h-4 w-4" />{translate('Assign Meter')}
                      </Link>
                    </div>
                  )}
                  {currentContract.status === 'rejected' && contractDeposits.some((deposit) => deposit.status === 'refund_required') && (
                    <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
                      {translate('This contract was rejected. The held deposit must be refunded from its original receiving account.')}
                    </div>
                  )}
                </div>
              )}
              {contractHistory.length > 0 && (
                <div className="mt-7 border-t border-[var(--border-color)] pt-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-[var(--teal-soft)] p-2 text-[var(--accent-strong)]">
                        <History className="h-5 w-5" />
                      </span>
                      <h3 className="text-base font-extrabold text-[var(--text-primary)]">{translate('Contract History')}</h3>
                    </div>
                    <span className="text-xs font-extrabold uppercase text-[var(--text-muted)]">
                      {contractHistory.length} {translate(contractHistory.length === 1 ? 'record' : 'records')}
                    </span>
                  </div>
                  <Table
                    headers={['Contract', 'Subscription Date', 'Total', 'Paid', 'Remaining', 'Status', 'Last Milestone', 'Action']}
                    rows={contractHistory.map((contract) => [
                      <div key="contract" className="min-w-[190px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-[var(--text-primary)]">{contract.contract_number}</span>
                          {contract.id === currentContract?.id && <Badge color="blue">{translate('Latest')}</Badge>}
                        </div>
                        <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
                          {translate('Created By')}: {contract.creator?.name ?? '-'}
                        </p>
                      </div>,
                      dateOnly(contract.subscription_date),
                      money(contract.net_amount),
                      money(contract.paid_amount ?? Math.max(0, Number(contract.net_amount) - Number(contract.remaining_amount))),
                      money(contract.remaining_amount),
                      <Badge key="status" color={statusColor[contract.status] ?? 'blue'}>{translate(contractStatusLabel(contract.status))}</Badge>,
                      <div key="milestone" className="min-w-[170px]">
                        <p>{dateOnly(contract.cancelled_at ?? contract.activated_at ?? contract.confirmed_at ?? contract.rejected_at ?? contract.approved_at ?? contract.submitted_at ?? contract.created_at)}</p>
                        {contract.rejection_reason && (
                          <p className="mt-1 max-w-[220px] truncate text-xs font-bold text-[var(--text-muted)]" title={contract.rejection_reason}>
                            {contract.rejection_reason}
                          </p>
                        )}
                      </div>,
                      <button
                        key="view"
                        type="button"
                        onClick={() => setSelectedHistoryContract(contract)}
                        className="secondary-action px-3 py-2"
                      >
                        <Eye className="h-4 w-4" />
                        {translate('View')}
                      </button>,
                    ])}
                  />
                </div>
              )}
            </Section>
          )}

          {activeTab === 'deposits' && (
            <Section
              title="Legacy Contract Deposit History"
              action={null}
            >
              <Table
                headers={['Date', 'Receipt', 'Amount', 'Applied', 'Refunded', 'Method', 'Account', 'Receiver', 'Status', 'Action']}
                rows={contractDeposits.map((deposit) => [
                  dateOnly(deposit.received_at),
                  deposit.receipt_number,
                  money(deposit.amount),
                  money(deposit.applied_amount),
                  money(deposit.refunded_amount),
                  deposit.payment_method?.name ?? '-',
                  deposit.account?.name ?? '-',
                  deposit.receiver?.name ?? '-',
                  <Badge key="status" color={statusColor[deposit.status] ?? 'blue'}>{deposit.status}</Badge>,
                  <div key="actions" className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => printDepositReceipt(deposit, deposit.status === 'refunded')} className="secondary-action text-xs"><Printer className="h-3.5 w-3.5" />{translate('Receipt')}</button>
                    {deposit.status === 'refund_required' && (
                      <button type="button" onClick={() => { setSelectedDeposit(deposit); setWorkflowReason(''); setRefundOpen(true) }} className="secondary-action border-[var(--coral)] text-xs text-[var(--coral)]"><RotateCcw className="h-3.5 w-3.5" />{translate('Refund')}</button>
                    )}
                  </div>,
                ])}
              />
            </Section>
          )}

          {activeTab === 'charges' && (
            <Section
              title="Customer Charges"
              action={(
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <button type="button" onClick={() => router.push('/dashboard/settings/charge-types')} className="secondary-action">
                      <Settings2 className="h-4 w-4" />{translate('Manage Types')}
                    </button>
                  )}
                  <button type="button" onClick={openChargeForm} className="primary-action"><Plus className="h-4 w-4" />{translate('Add Charge')}</button>
                </div>
              )}
            >
              <Table
                headers={['Date', 'Title', 'Type', 'Invoice', 'Amount', 'Paid', 'Remaining', 'Status', 'Action']}
                rows={(customer.charges ?? []).map((charge) => [
                  dateOnly(charge.charge_date),
                  charge.title,
                  charge.charge_type?.name ?? charge.type,
                  charge.invoice?.invoice_number ?? '-',
                  money(charge.amount),
                  money(charge.paid_amount),
                  money(charge.remaining_amount),
                  <Badge key="status" color={statusColor[charge.status] ?? 'blue'}>{charge.status}</Badge>,
                  charge.status === 'posted' && Number(charge.paid_amount) <= 0 ? (
                    <button key="cancel" type="button" onClick={() => cancelCharge({ customerId, chargeId: charge.id })} className="secondary-action text-xs">
                      {translate('Cancel')}
                    </button>
                  ) : '-',
                ])}
              />
            </Section>
          )}

          {activeTab === 'payments' && (
            <Section
              title="Customer Payments"
              action={<RecordPaymentButton customerId={customerId} />}
            >
              <Table
                headers={['Date', 'Receipt', 'Invoice', 'Method', 'Receiving Account', 'Amount', 'Refund', 'Refund From', 'Receiver', 'Status']}
                rows={(customer.payments ?? []).map((payment) => [
                  dateOnly(payment.paid_at),
                  payment.receipt_number,
                  payment.invoice?.invoice_number ?? '-',
                  payment.payment_method?.name ?? '-',
                  payment.account?.name ?? '-',
                  money(payment.amount),
                  payment.status === 'refunded' ? (
                    <div key="refund">
                      <p className="font-extrabold text-[var(--coral)]">{money(payment.refunded_amount ?? payment.amount)}</p>
                      <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{payment.refund_receipt_number ?? '-'}</p>
                    </div>
                  ) : '-',
                  payment.refund_transaction?.account?.name ?? '-',
                  payment.receiver?.name ?? '-',
                  <Badge key="status" color={statusColor[payment.status] ?? 'blue'}>{payment.status}</Badge>,
                ])}
              />
            </Section>
          )}

          {activeTab === 'meters' && (
            <Section title="Meter Assignment" action={null}>
              <Table
                headers={['Meter', 'Installed', 'Initial Reading', 'Current Seal', 'Seal Status', 'Sealed At', 'Installed By', 'Assignment Status', 'Removed At']}
                rows={(customer.meter_assignments ?? []).map((assignment) => {
                  const currentSeal = assignment.seals?.find((seal) => seal.status === 'intact') ?? assignment.seals?.[0]
                  return [
                    assignment.meter?.meter_number ?? '-',
                    dateOnly(assignment.installation_date),
                    assignment.initial_reading,
                    currentSeal?.seal_number ?? assignment.seal_number ?? '-',
                    currentSeal ? <Badge key="seal-status" color={statusColor[currentSeal.status] ?? 'blue'}>{currentSeal.status}</Badge> : '-',
                    dateOnly(currentSeal?.sealed_at),
                    assignment.installer?.name ?? '-',
                    <Badge key="assignment-status" color={statusColor[assignment.status] ?? 'blue'}>{assignment.status}</Badge>,
                    dateOnly(assignment.removed_at),
                  ]
                })}
              />
              <div className="mt-7 border-t border-[var(--border-color)] pt-5">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Meter Seal History')}</h3>
                </div>
                <Table
                  headers={['Meter', 'Seal Number', 'Status', 'Sealed At', 'Sealed By', 'Removed At', 'Removed By', 'Reason', 'Photo']}
                  rows={(customer.meter_assignments ?? []).flatMap((assignment) => (assignment.seals ?? []).map((seal) => [
                    assignment.meter?.meter_number ?? '-',
                    seal.seal_number,
                    <Badge key="status" color={statusColor[seal.status] ?? 'blue'}>{seal.status}</Badge>,
                    dateOnly(seal.sealed_at),
                    seal.sealer?.name ?? '-',
                    dateOnly(seal.removed_at),
                    seal.remover?.name ?? '-',
                    seal.removal_reason ?? seal.notes ?? '-',
                    seal.photo_original_name
                      ? <button key="photo" type="button" onClick={() => downloadSealPhoto(seal)} className="icon-button" title={translate('Download Seal Photo')} aria-label={translate('Download Seal Photo')}><Download className="h-4 w-4" /></button>
                      : '-',
                  ]))}
                />
              </div>
            </Section>
          )}

          {activeTab === 'readings' && (
            <Section
              title="Meter Reading History"
              action={workflowReady && data.current_meter_assignment ? (
                <button type="button" onClick={() => setReadingOpen(true)} className="primary-action">
                  <Plus className="h-4 w-4" />{translate('Record Meter Reading')}
                </button>
              ) : null}
            >
              <Table
                headers={['Period', 'Date', 'Meter', 'Previous', 'Current', 'M3', 'Reader', 'Invoice']}
                rows={(customer.meter_readings ?? []).map((reading) => [
                  reading.billing_period?.name ?? '-',
                  dateOnly(reading.reading_date),
                  reading.meter?.meter_number ?? '-',
                  reading.previous_reading,
                  reading.current_reading,
                  reading.consumption,
                  reading.reader?.name ?? '-',
                  reading.invoice?.invoice_number ?? '-',
                ])}
              />
            </Section>
          )}

          {activeTab === 'invoices' && (
            <Section
              title="Customer Invoices / Bills"
              action={<RecordPaymentButton customerId={customerId} />}
            >
              <Table
                headers={['Invoice', 'Type', 'Issue Date', 'Due Date', 'Total', 'Paid', 'Remaining', 'Status', 'Action']}
                rows={(customer.invoices ?? []).map((invoice) => [
                  invoice.invoice_number,
                  invoice.invoice_type.replaceAll('_', ' '),
                  dateOnly(invoice.issue_date),
                  dateOnly(invoice.due_date),
                  money(invoice.total_amount),
                  money(invoice.paid_amount),
                  money(invoice.remaining_amount),
                  <Badge key="status" color={statusColor[invoice.status] ?? 'blue'}>{invoice.status}</Badge>,
                  !['paid', 'cancelled'].includes(invoice.status) && Number(invoice.remaining_amount) > 0 ? (
                    invoice.invoice_type === 'contract' && !['installation_pending', 'active'].includes(invoice.contract?.status ?? '') ? (
                      <Badge key="confirmation" color="amber">{translate('Confirm Contract')}</Badge>
                    ) : (
                      <RecordPaymentButton
                        key="pay"
                        customerId={customerId}
                        invoiceId={invoice.id}
                        label="Pay"
                        className="secondary-action text-xs"
                      />
                    )
                  ) : '-',
                ])}
              />
            </Section>
          )}

          {activeTab === 'ledger' && (
            <Section title="Customer Ledger / Account Statement" action={null}>
              <Table
                headers={['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']}
                rows={data.ledger.map((entry: CustomerLedgerEntry) => [
                  dateOnly(entry.date),
                  entry.reference,
                  entry.description,
                  money(entry.debit),
                  money(entry.credit),
                  money(entry.balance),
                ])}
              />
            </Section>
          )}

          {activeTab === 'requests' && (
            <Section
              title="Complaints / Service Requests"
              action={workflowReady ? <button type="button" onClick={openRequestForm} className="primary-action"><Plus className="h-4 w-4" />{translate('Add Request')}</button> : null}
            >
              <Table
                headers={['Number', 'Requested', 'Type', 'Priority', 'Assigned To', 'Assigned', 'Resolved', 'Closed', 'Status', 'Resolution', 'Action']}
                rows={(customer.service_requests ?? []).map((request) => [
                  request.request_number,
                  dateOnly(request.requested_at),
                  request.type,
                  request.priority,
                  request.assignee?.name ?? '-',
                  dateOnly(request.assigned_at),
                  dateOnly(request.resolved_at),
                  dateOnly(request.closed_at),
                  <Badge key="status" color={statusColor[request.status] ?? 'blue'}>{request.status}</Badge>,
                  request.resolution ?? '-',
                  request.status !== 'closed' ? (
                    <div key="actions" className="flex flex-wrap gap-2">
                      {['open', 'assigned'].includes(request.status) && (
                        <button type="button" onClick={() => updateRequest({ customerId, requestId: request.id, body: { status: 'in_progress' } })} className="secondary-action text-xs">
                          {translate('Start')}
                        </button>
                      )}
                      {request.status === 'in_progress' && (
                        <button type="button" onClick={() => openResolution(request)} className="secondary-action text-xs">
                          {translate('Resolve')}
                        </button>
                      )}
                      {request.status === 'resolved' && (
                        <button type="button" onClick={() => closeRequest(request)} className="secondary-action text-xs">
                          {translate('Close')}
                        </button>
                      )}
                    </div>
                  ) : '-',
                ])}
              />
            </Section>
          )}

          {activeTab === 'replacement' && (
            <Section title="Meter Replacement History" action={null}>
              <Table
                headers={['Meter', 'Installed', 'Removed / Replaced', 'Status', 'Initial Reading', 'Seal', 'Replacement Billing', 'Notes']}
                rows={data.meter_replacement_history.map((assignment) => [
                  assignment.meter?.meter_number ?? '-',
                  dateOnly(assignment.installation_date),
                  dateOnly(assignment.removed_at),
                  <Badge key="status" color={statusColor[assignment.status] ?? 'purple'}>{assignment.status}</Badge>,
                  assignment.initial_reading,
                  assignment.seal_number ?? '-',
                  assignment.replacement_charge ? (
                    <div key="replacement-billing">
                      <p className="font-mono text-xs font-extrabold">{assignment.replacement_charge.invoice?.invoice_number ?? `CHG-${assignment.replacement_charge.id}`}</p>
                      <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">{money(assignment.replacement_charge.amount)}</p>
                      <div className="mt-1"><Badge color={statusColor[assignment.replacement_charge.invoice?.status ?? assignment.replacement_charge.payment_status ?? 'unpaid'] ?? 'blue'}>{assignment.replacement_charge.invoice?.status ?? assignment.replacement_charge.payment_status ?? 'unpaid'}</Badge></div>
                    </div>
                  ) : translate('No fee'),
                  assignment.notes ?? '-',
                ])}
              />
            </Section>
          )}

          {activeTab === 'connection' && (
            <Section
              title="Disconnection / Reconnection"
              action={<button type="button" onClick={() => setEventOpen(true)} className="primary-action"><Plus className="h-4 w-4" />{translate('Add Event')}</button>}
            >
              <Table
                headers={['Type', 'Disconnected Date', 'Reconnected Date', 'Fee', 'Status', 'Processed By', 'Reason']}
                rows={(customer.connection_events ?? []).map((event) => [
                  event.event_type,
                  dateOnly(event.disconnected_at),
                  dateOnly(event.reconnected_at),
                  money(event.fee),
                  <Badge key="status" color={statusColor[event.status] ?? 'blue'}>{event.status}</Badge>,
                  event.processor?.name ?? '-',
                  event.reason ?? '-',
                ])}
              />
            </Section>
          )}

          {activeTab === 'documents' && (
            <Section
              title="Customer Documents"
              action={<button type="button" onClick={() => setDocumentOpen(true)} className="primary-action"><Upload className="h-4 w-4" />{translate('Upload')}</button>}
            >
              {documentError && <p className="mb-4 text-sm text-[var(--coral)]">{translate(documentError)}</p>}
              <Table
                headers={['Name', 'Type', 'Size', 'Uploaded By', 'Date', 'Action']}
                rows={activeDocuments.map((document) => [
                  document.original_name,
                  document.document_type ?? '-',
                  `${Math.round(document.size / 1024)} KB`,
                  document.uploader?.name ?? '-',
                  dateOnly(document.created_at),
                  <div key="actions" className="flex gap-2">
                    <button type="button" onClick={() => downloadDocument(document)} className="icon-button" title={translate('Download')} aria-label={translate('Download')}>
                      <Download className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteDoc(document)} className="icon-button text-[var(--coral)] hover:bg-[var(--coral-soft)]" title={translate('Delete')} aria-label={translate('Delete')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>,
                ])}
              />
            </Section>
          )}
        </div>
      </div>

      {readingOpen && (
        <CustomerMeterReadingModal
          isOpen
          onClose={() => setReadingOpen(false)}
          onSaved={refetch}
          customerName={[customer.name, customer.last_name].filter(Boolean).join(' ')}
          assignment={data.current_meter_assignment}
          readings={customer.meter_readings ?? []}
        />
      )}

      <Modal
        isOpen={Boolean(selectedHistoryContract)}
        onClose={() => setSelectedHistoryContract(null)}
        title="Contract Record"
        size="xl"
      >
        {selectedHistoryContract && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 border-b border-[var(--border-color)] pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate('Contract Number')}</p>
                <p className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">{selectedHistoryContract.contract_number}</p>
              </div>
              <Badge color={statusColor[selectedHistoryContract.status] ?? 'blue'}>{selectedHistoryContract.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--border-color)] xl:grid-cols-4">
              {[
                ['Contract Total', selectedHistoryContract.net_amount],
                ['Paid', selectedHistoryContract.paid_amount ?? Math.max(0, Number(selectedHistoryContract.net_amount) - Number(selectedHistoryContract.remaining_amount))],
                ['Remaining', selectedHistoryContract.remaining_amount],
                ['Discount Amount', selectedHistoryContract.discount_amount],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-[var(--bg-elevated)] px-4 py-3">
                  <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate(String(label))}</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{money(value)}</p>
                </div>
              ))}
            </div>

            <InfoGrid
              items={[
                ['Subscription Date', dateOnly(selectedHistoryContract.subscription_date)],
                ['Meter Size', selectedHistoryContract.meter_size],
                ['Connection Fee', money(selectedHistoryContract.connection_fee)],
                ['Meter Fee', money(selectedHistoryContract.meter_fee)],
                ['Discount Given By', selectedHistoryContract.discount_approved_by ?? selectedHistoryContract.discount_authority?.name],
                ['Authority Number', selectedHistoryContract.discount_authority?.authority_number],
                ['Payment Status', <Badge key="payment-status" color={statusColor[selectedHistoryContract.payment_status] ?? 'blue'}>{selectedHistoryContract.payment_status}</Badge>],
                ['Created By', selectedHistoryContract.creator?.name],
                ['Created At', dateOnly(selectedHistoryContract.created_at)],
                [selectedHistoryContract.status === 'cancelled' ? 'Cancelled By' : 'Last Updated By', selectedHistoryContract.updater?.name],
                ['Confirmed By', selectedHistoryContract.confirmer?.name],
                ['Confirmed At', dateOnly(selectedHistoryContract.confirmed_at)],
                ['Submitted By', selectedHistoryContract.submitter?.name],
                ['Submitted At', dateOnly(selectedHistoryContract.submitted_at)],
                ['Approved By', selectedHistoryContract.approver?.name],
                ['Approved At', dateOnly(selectedHistoryContract.approved_at)],
                ['Rejected By', selectedHistoryContract.rejector?.name],
                ['Rejected At', dateOnly(selectedHistoryContract.rejected_at)],
                ['Cancelled At', dateOnly(selectedHistoryContract.cancelled_at)],
                [selectedHistoryContract.status === 'cancelled' ? 'Cancellation Reason' : 'Rejection Reason', selectedHistoryContract.rejection_reason],
                ['Activated At', dateOnly(selectedHistoryContract.activated_at)],
                ['Notes', selectedHistoryContract.notes],
              ]}
            />

            {(selectedHistoryContract.deposits?.length ?? 0) > 0 && (
              <div className="space-y-3 border-t border-[var(--border-color)] pt-5">
                <h3 className="text-base font-extrabold text-[var(--text-primary)]">{translate('Deposit Records')}</h3>
                <Table
                  headers={['Date', 'Receipt', 'Amount', 'Applied', 'Refunded', 'Method', 'Account', 'Status']}
                  rows={(selectedHistoryContract.deposits ?? []).map((deposit) => [
                    dateOnly(deposit.received_at),
                    deposit.receipt_number,
                    money(deposit.amount),
                    money(deposit.applied_amount),
                    money(deposit.refunded_amount),
                    deposit.payment_method?.name ?? '-',
                    deposit.account?.name ?? '-',
                    <Badge key="status" color={statusColor[deposit.status] ?? 'blue'}>{deposit.status}</Badge>,
                  ])}
                />
              </div>
            )}

            <div className="flex justify-end border-t border-[var(--border-color)] pt-5">
              <button type="button" onClick={() => setSelectedHistoryContract(null)} className="secondary-action">
                {translate('Close')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={contractOpen} onClose={() => setContractOpen(false)} title={currentContract && ['draft', 'printed'].includes(currentContract.status) ? 'Edit Customer Contract' : 'Create Customer Contract'} size="xl">
        {error && <p className="mb-4 text-sm font-bold text-[var(--coral)]">{translate(error)}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Subscription Date" type="date" value={contractForm.subscription_date ?? businessDate} onChange={(value) => setContractForm((prev) => ({ ...prev, subscription_date: String(value) }))} required />
          <FormField label="Meter Size" value={contractForm.meter_size ?? ''} onChange={(value) => setContractForm((prev) => ({ ...prev, meter_size: String(value) }))} placeholder="Half inch" />
          <FormField label="Connection Fee" type="number" min={0} value={contractForm.connection_fee ?? 0} onChange={(value) => setContractForm((prev) => ({ ...prev, connection_fee: Number(value) }))} required />
          <FormField label="Meter Fee" type="number" min={0} value={contractForm.meter_fee ?? 0} onChange={(value) => setContractForm((prev) => ({ ...prev, meter_fee: Number(value) }))} required />
          <FormField
            label="Discount"
            type="number"
            min={0}
            max={contractGross}
            value={contractForm.discount_amount ?? 0}
            onChange={(value) => setContractForm((prev) => ({
              ...prev,
              discount_amount: Number(value),
            }))}
          />
          <SearchableSelect
            label="Discount Given By (Authority)"
            value={contractForm.discount_authority_id}
            onChange={(value) => setContractForm((prev) => ({ ...prev, discount_authority_id: Number(value) }))}
            options={authorities.map((authority) => ({
              value: authority.id,
              label: `${authority.name} (${authority.authority_number})${authority.title ? ` - ${authority.title}` : ''}`,
              searchText: `${authority.name} ${authority.father_name ?? ''} ${authority.title ?? ''} ${authority.authority_number}`,
            }))}
            placeholder={authoritiesLoading ? 'Loading authorities...' : 'Select who gave the discount'}
            searchPlaceholder="Search by authority name, number, father name, or position..."
            emptyMessage="No active authority matches your search."
            disabled={authoritiesLoading}
            required={Number(contractForm.discount_amount ?? 0) > 0}
          />
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate('Net Contract Amount')}</p>
            <p className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">{money(contractNet)}</p>
          </div>
          <div className="md:col-span-2">
            <FormField label="Notes" type="textarea" value={contractForm.notes ?? ''} onChange={(value) => setContractForm((prev) => ({ ...prev, notes: String(value) }))} rows={4} />
          </div>
        </div>
        <ModalActions onCancel={() => setContractOpen(false)} onSave={saveContract} saveLabel="Save Contract" />
      </Modal>

      <Modal isOpen={cancelContractOpen} onClose={() => setCancelContractOpen(false)} title="Cancel Customer Contract" size="lg">
        {error && <p className="mb-4 text-sm font-bold text-[var(--coral)]">{translate(error)}</p>}
        {cancellationPreviewLoading ? (
          <div className="flex min-h-36 items-center justify-center text-[var(--text-muted)]">
            <LoaderCircle className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--border-color)] sm:grid-cols-3">
              {[
                ['Assigned Meter', cancellationPreview?.active_meter_count ?? 0],
                ['Material Lines', cancellationPreview?.material_line_count ?? 0],
                ['Customer Refund', money(cancellationRefundAmount)],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-[var(--bg-elevated)] px-4 py-3">
                  <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate(String(label))}</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{value}</p>
                </div>
              ))}
            </div>

            {cancellationHasMaterials ? (
              <div className="overflow-hidden rounded-lg border border-[var(--border-color)]">
                <div className="border-b border-[var(--border-color)] bg-[var(--surface-soft)] px-4 py-3">
                  <p className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Materials returning to warehouse')}</p>
                </div>
                <div className="divide-y divide-[var(--border-color)]">
                  {cancellationPreview?.materials.map((item, index) => (
                    <div key={`${item.inventory_request_id}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--text-primary)]">{item.description}</p>
                        <p className="text-xs font-semibold text-[var(--text-muted)]">{item.request_number} | {item.warehouse?.name ?? '-'}</p>
                      </div>
                      <span className="flex-none font-extrabold text-[var(--accent-strong)]">{Number(item.quantity).toLocaleString()} {translate(item.unit)}</span>
                    </div>
                  ))}
                </div>
                <label className="flex cursor-pointer items-start gap-3 border-t border-[var(--border-color)] bg-[var(--mint-soft)] p-4">
                  <input type="checkbox" checked={materialsReceivedConfirmed} onChange={(event) => setMaterialsReceivedConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--mint)]" />
                  <span className="text-sm font-bold leading-5 text-[var(--text-secondary)]">{translate('I confirm that all listed materials were physically received.')}</span>
                </label>
              </div>
            ) : null}

            {cancellationRefundAmount > 0 ? (
              <div className="space-y-4 rounded-lg border border-[var(--coral)]/45 bg-[var(--coral-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Refund on approval')}</p>
                  <span className="text-lg font-extrabold text-[var(--coral)]">{money(cancellationRefundAmount)}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Refund Date" type="date" value={contractRefundDate} onChange={(value) => setContractRefundDate(String(value))} required />
                  <FormField label="Refund Reference" value={contractRefundReference} onChange={(value) => setContractRefundReference(String(value))} />
                </div>
                <SearchableSelect
                  label="Refund From Account"
                  value={contractRefundAccountId}
                  onChange={(value) => setContractRefundAccountId(Number(value))}
                  options={refundAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.name} (${account.type.replaceAll('_', ' ')}) - ${money(account.current_balance)}`,
                    searchText: `${account.code} ${account.type}`,
                  }))}
                  placeholder={refundAccountsLoading ? 'Loading accounts...' : 'Select refund account'}
                  searchPlaceholder="Search refund accounts..."
                  emptyMessage="No active refund account is available."
                  disabled={refundAccountsLoading}
                  required
                />
                {selectedRefundAccount ? (
                  <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--border-color)] sm:grid-cols-2">
                    <div className="bg-[var(--bg-elevated)] p-3">
                      <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate('Current Balance')}</p>
                      <p className="mt-1 font-extrabold text-[var(--text-primary)]">{money(selectedRefundAccount.current_balance)}</p>
                    </div>
                    <div className="bg-[var(--bg-elevated)] p-3">
                      <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate('Balance After Refund')}</p>
                      <p className={`mt-1 font-extrabold ${Number(selectedRefundAccount.current_balance) >= cancellationRefundAmount ? 'text-[var(--mint)]' : 'text-[var(--coral)]'}`}>
                        {money(Number(selectedRefundAccount.current_balance) - cancellationRefundAmount)}
                      </p>
                    </div>
                  </div>
                ) : null}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3">
                  <input type="checkbox" checked={refundPostedPayments} onChange={(event) => setRefundPostedPayments(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--coral)]" />
                  <span className="text-sm font-bold leading-5 text-[var(--text-secondary)]">{translate('Refund this amount automatically when Admin approves.')}</span>
                </label>
              </div>
            ) : null}

            <FormField label="Cancellation Reason" type="textarea" value={workflowReason} onChange={(value) => setWorkflowReason(String(value))} rows={4} required />
          </div>
        )}
        <ModalActions
          onCancel={() => setCancelContractOpen(false)}
          onSave={cancelCurrentContract}
          saveLabel={isSubmittingCancellation ? 'Sending...' : 'Send for One Approval'}
          disabled={cancellationPreviewLoading || isSubmittingCancellation || !workflowReason.trim() || (cancellationHasMaterials && !materialsReceivedConfirmed) || (cancellationRefundAmount > 0 && (!refundPostedPayments || !contractRefundAccountId))}
        />
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(cancellationDecision)}
        onClose={() => setCancellationDecision(null)}
        onConfirm={() => resolveCurrentCancellation(cancellationDecision ?? 'rejected')}
        title={cancellationDecision === 'approved' ? 'Approve Contract Cancellation' : 'Reject Contract Cancellation'}
        message={cancellationDecision === 'approved'
          ? `This single approval will return the listed materials and meter, refund ${money(cancellationRefundAmount)} from ${pendingCancellation?.refund_account?.name ?? 'the selected account'}, and cancel the contract.`
          : 'The contract will remain unchanged and its materials will stay issued.'}
        confirmLabel={cancellationDecision === 'approved' ? 'Approve Cancellation' : 'Reject Request'}
        loadingLabel={cancellationDecision === 'approved' ? 'Approving...' : 'Rejecting...'}
        kind={cancellationDecision === 'approved' ? 'approval' : 'danger'}
      />

      <Modal isOpen={refundOpen} onClose={() => setRefundOpen(false)} title="Refund Customer Deposit" size="md">
        {error && <p className="mb-4 text-sm font-bold text-[var(--coral)]">{translate(error)}</p>}
        <div className="mb-4 rounded-lg border border-[var(--border-color)] bg-[var(--surface-soft)] p-4">
          <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate('Full Refund')}</p>
          <p className="mt-2 text-xl font-extrabold text-[var(--text-primary)]">{money(selectedDeposit ? Number(selectedDeposit.amount) - Number(selectedDeposit.applied_amount) - Number(selectedDeposit.refunded_amount) : 0)}</p>
          <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{selectedDeposit?.account?.name ?? '-'}</p>
        </div>
        <FormField label="Refund Reason" type="textarea" value={workflowReason} onChange={(value) => setWorkflowReason(String(value))} rows={4} required />
        <ModalActions onCancel={() => setRefundOpen(false)} onSave={refundSelectedDeposit} saveLabel="Refund and Print Receipt" />
      </Modal>

      <Modal isOpen={chargeOpen} onClose={() => setChargeOpen(false)} title="Add Customer Charge" size="lg">
        {error && <p className="mb-4 text-sm text-[var(--coral)]">{translate(error)}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Title" value={chargeForm.title ?? ''} onChange={(value) => setChargeForm((prev) => ({ ...prev, title: String(value) }))} required />
          <FormField
            label="Type"
            type="select"
            value={chargeForm.customer_charge_type_id ?? ''}
            onChange={(value) => setChargeForm((prev) => ({ ...prev, customer_charge_type_id: Number(value) }))}
            options={chargeTypes.map((type) => ({ value: type.id, label: type.name }))}
            required
          />
          <FormField label="Amount" type="number" value={chargeForm.amount ?? 0} onChange={(value) => setChargeForm((prev) => ({ ...prev, amount: Number(value) }))} required />
          <FormField label="Charge Date" type="date" value={apiDateValue(chargeForm.charge_date)} onChange={(value) => setChargeForm((prev) => ({ ...prev, charge_date: String(value) }))} required />
          <div className="md:col-span-2">
            <FormField label="Notes" type="textarea" value={chargeForm.notes ?? ''} onChange={(value) => setChargeForm((prev) => ({ ...prev, notes: String(value) }))} />
          </div>
        </div>
        <ModalActions onCancel={() => setChargeOpen(false)} onSave={saveCharge} saveLabel="Save Charge" />
      </Modal>

      <Modal isOpen={requestOpen} onClose={() => setRequestOpen(false)} title="Add Service Request" size="lg">
        {error && <p className="mb-4 text-sm text-[var(--coral)]">{translate(error)}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Type"
            type="select"
            value={requestForm.type ?? 'complaint'}
            onChange={(value) => setRequestForm((prev) => ({ ...prev, type: String(value) as CustomerServiceRequest['type'] }))}
            options={[
              { value: 'complaint', label: 'Complaint' },
              { value: 'leak', label: 'Leak' },
              { value: 'meter_problem', label: 'Meter Problem' },
              { value: 'low_pressure', label: 'Low Pressure' },
              { value: 'billing_question', label: 'Billing Question' },
              { value: 'other', label: 'Other' },
            ]}
            required
          />
          <FormField
            label="Priority"
            type="select"
            value={requestForm.priority ?? 'normal'}
            onChange={(value) => setRequestForm((prev) => ({ ...prev, priority: String(value) as CustomerServiceRequest['priority'] }))}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
            required
          />
          <FormField
            label="Assigned To"
            type="select"
            value={requestForm.assigned_to ?? ''}
            onChange={(value) => setRequestForm((prev) => ({ ...prev, assigned_to: Number(value) || undefined }))}
            options={technicians.map((user) => ({ value: user.id, label: user.name }))}
          />
          <FormField label="Requested At" type="date" value={apiDateValue(requestForm.requested_at)} onChange={(value) => setRequestForm((prev) => ({ ...prev, requested_at: String(value) }))} required />
          <div className="md:col-span-2">
            <FormField label="Description" type="textarea" value={requestForm.description ?? ''} onChange={(value) => setRequestForm((prev) => ({ ...prev, description: String(value) }))} required rows={5} />
          </div>
        </div>
        <ModalActions onCancel={() => setRequestOpen(false)} onSave={saveRequest} saveLabel="Save Request" disabled={isCreatingRequest} />
      </Modal>

      <Modal isOpen={resolutionOpen} onClose={() => setResolutionOpen(false)} title="Resolve Service Request" size="md">
        {error && <p className="mb-4 text-sm text-[var(--coral)]">{translate(error)}</p>}
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-soft)] p-4">
            <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate('Request')}</p>
            <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{selectedRequest?.request_number ?? '-'}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedRequest?.description ?? '-'}</p>
          </div>
          <FormField
            label="Resolution Note"
            type="textarea"
            value={resolutionNote}
            onChange={(value) => setResolutionNote(String(value))}
            rows={5}
            required
          />
        </div>
        <ModalActions onCancel={() => setResolutionOpen(false)} onSave={saveResolution} saveLabel="Mark Resolved" />
      </Modal>

      <Modal isOpen={eventOpen} onClose={() => setEventOpen(false)} title="Add Connection Event" size="lg">
        {error && <p className="mb-4 text-sm text-[var(--coral)]">{translate(error)}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Event Type"
            type="select"
            value={eventForm.event_type ?? 'disconnection'}
            onChange={(value) => setEventForm((prev) => ({
              ...prev,
              event_type: String(value) as CustomerConnectionEvent['event_type'],
              disconnected_at: value === 'disconnection' ? businessDate : undefined,
              reconnected_at: value === 'reconnection' ? businessDate : undefined,
            }))}
            options={[
              { value: 'disconnection', label: 'Disconnection' },
              { value: 'reconnection', label: 'Reconnection' },
            ]}
            required
          />
          <FormField
            label="Status"
            type="select"
            value={eventForm.status ?? 'completed'}
            onChange={(value) => setEventForm((prev) => ({ ...prev, status: String(value) as CustomerConnectionEvent['status'] }))}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            required
          />
          {eventForm.event_type === 'reconnection' ? (
            <FormField label="Reconnected Date" type="date" value={apiDateValue(eventForm.reconnected_at)} onChange={(value) => setEventForm((prev) => ({ ...prev, reconnected_at: String(value) }))} required />
          ) : (
            <FormField label="Disconnected Date" type="date" value={apiDateValue(eventForm.disconnected_at)} onChange={(value) => setEventForm((prev) => ({ ...prev, disconnected_at: String(value) }))} required />
          )}
          <FormField label="Fee" type="number" value={eventForm.fee ?? 0} onChange={(value) => setEventForm((prev) => ({ ...prev, fee: Number(value) }))} />
          <div className="md:col-span-2">
            <FormField label="Reason" type="textarea" value={eventForm.reason ?? ''} onChange={(value) => setEventForm((prev) => ({ ...prev, reason: String(value) }))} rows={4} />
          </div>
          <div className="md:col-span-2">
            <FormField label="Notes" type="textarea" value={eventForm.notes ?? ''} onChange={(value) => setEventForm((prev) => ({ ...prev, notes: String(value) }))} />
          </div>
        </div>
        <ModalActions onCancel={() => setEventOpen(false)} onSave={saveConnectionEvent} saveLabel="Save Event" />
      </Modal>

      <Modal isOpen={documentOpen} onClose={() => setDocumentOpen(false)} title="Upload Customer Documents" size="lg">
        {documentError && <p className="mb-4 text-sm text-[var(--coral)]">{translate(documentError)}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Document Type" value={documentForm.documentType} onChange={(value) => setDocumentForm((prev) => ({ ...prev, documentType: String(value) }))} />
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-[var(--text-secondary)]">{translate('Files')}</label>
            <input
              type="file"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              className="field-control px-4 py-2.5 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <FormField label="Notes" type="textarea" value={documentForm.notes} onChange={(value) => setDocumentForm((prev) => ({ ...prev, notes: String(value) }))} />
          </div>
        </div>
        <ModalActions onCancel={() => setDocumentOpen(false)} onSave={saveDocuments} saveLabel="Upload Documents" />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={removeDocument}
        title="Delete Document"
        message="Are you sure you want to delete this customer document?"
      />
    </div>
  )
}

function Metric({ title, value, icon, badge }: { title: string; value: string; icon?: React.ReactNode; badge?: boolean }) {
  const { translate } = useLanguage()

  return (
    <div className="elegant-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate(title)}</p>
        {icon && <div className="rounded-lg bg-[var(--teal-soft)] p-2 text-[var(--accent-strong)]">{icon}</div>}
      </div>
      <div className="mt-4 text-xl font-extrabold text-[var(--text-primary)]">
        {badge ? <Badge color={statusColor[value] ?? 'blue'}>{value}</Badge> : translate(value)}
      </div>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) {
  const { translate } = useLanguage()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--text-primary)]">{translate(title)}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function InfoGrid({ items }: { items: [string, React.ReactNode][] }) {
  const { translate } = useLanguage()

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-soft)] p-4">
          <p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">{translate(label)}</p>
          <div className="mt-2 text-sm font-bold text-[var(--text-primary)]">{typeof value === 'string' || typeof value === 'number' ? translate(value || '-') : value ?? '-'}</div>
        </div>
      ))}
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  const { translate } = useLanguage()

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-color)] p-10 text-center text-sm text-[var(--text-muted)]">
        {translate('No records found.')}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-left text-xs uppercase text-[var(--text-muted)]">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-extrabold">{translate(header)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-[var(--surface-soft)]/60">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 text-[var(--text-secondary)]">
                    {typeof cell === 'string' || typeof cell === 'number' ? translate(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ModalActions({ onCancel, onSave, saveLabel, disabled = false }: { onCancel: () => void; onSave: () => void; saveLabel: string; disabled?: boolean }) {
  const { translate } = useLanguage()

  return (
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" onClick={onCancel} className="secondary-action">
        {translate('Cancel')}
      </button>
      <button type="button" onClick={onSave} disabled={disabled} className="primary-action disabled:cursor-not-allowed disabled:opacity-55">
        <CheckCircle2 className="h-4 w-4" />
        {translate(saveLabel)}
      </button>
    </div>
  )
}
