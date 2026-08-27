'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, CloudUpload, Download, FileSignature, FileText, MapPin, Paperclip, Plus, Printer, Trash2, Upload, UserRound, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DateText } from '@/components/ui/DateText'
import { API_BASE_URL, getAuthToken } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'
import {
  useCreateCustomerMutation,
  useDeleteCustomerPhotoMutation,
  useDeleteCustomerDocumentMutation,
  useDeleteCustomerMutation,
  useGetCustomerDocumentsQuery,
  useGetCustomersQuery,
  useGetServiceAreasQuery,
  useMarkCustomerAgreementPrintedMutation,
  useUploadCustomerDocumentsMutation,
  useUploadCustomerPhotoMutation,
  useUpdateCustomerMutation,
  type CustomerDocument,
  type Customer,
} from '@/src/store/waternetApi'

const CustomerPhotoCapture = dynamic(
  () => import('@/components/customers/CustomerPhotoCapture').then((module) => module.CustomerPhotoCapture),
  { loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--bg-muted)]" /> },
)

const statusColor = {
  active: 'emerald',
  inactive: 'slate',
  suspended: 'amber',
  disconnected: 'red',
  registered: 'slate',
  awaiting_approval: 'amber',
  awaiting_installation: 'blue',
} as const

const agreementStatusColor = {
  draft: 'slate',
  printed: 'blue',
  installation_pending: 'blue',
  pending_approval: 'amber',
  approved: 'emerald',
  rejected: 'red',
  signed: 'amber',
  active: 'emerald',
  cancelled: 'slate',
} as const

const money = (value?: string | number) => `AFN ${Number(value ?? 0).toLocaleString()}`
const contractStatusLabel = (status?: string) => status === 'installation_pending'
  ? 'Awaiting Installation'
  : status?.replaceAll('_', ' ') ?? 'No Contract'

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const customerDisplayName = (customer: Pick<Customer, 'name' | 'last_name'>) =>
  [customer.name, customer.last_name].filter(Boolean).join(' ')

const fallbackCustomerError = 'Request failed.'
const acceptedCustomerDocumentExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'txt'])
const customerDocumentAccept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt'
const maxCustomerDocumentSize = 10 * 1024 * 1024
const maxCustomerDocuments = 10

const mergeCustomerDocumentFiles = (currentFiles: File[], incomingFiles: File[]) => {
  const files = [...currentFiles]
  let error = ''

  incomingFiles.forEach((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!acceptedCustomerDocumentExtensions.has(extension)) {
      error ||= `${file.name}: unsupported file type`
      return
    }
    if (file.size > maxCustomerDocumentSize) {
      error ||= `${file.name}: exceeds 10 MB`
      return
    }
    if (files.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) {
      return
    }
    if (files.length >= maxCustomerDocuments) {
      error ||= 'A maximum of 10 files can be uploaded at one time.'
      return
    }
    files.push(file)
  })
  return { files, error }
}

const getApiErrorMessage = (err: unknown, fallback = fallbackCustomerError) => {
  if (!err || typeof err !== 'object' || !('data' in err)) return fallback

  const data = (err as { data?: unknown }).data
  if (!data || typeof data !== 'object') return fallback

  const message = (data as { message?: unknown }).message
  if (typeof message === 'string') return message

  const errors = (data as { errors?: unknown }).errors
  if (!errors || typeof errors !== 'object') return fallback

  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
    if (typeof value === 'string') return value
  }

  return fallback
}

const getApiFieldErrors = (err: unknown): Record<string, string> => {
  if (!err || typeof err !== 'object' || !('data' in err)) return {}
  const data = (err as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('errors' in data)) return {}
  const errors = (data as { errors?: unknown }).errors
  if (!errors || typeof errors !== 'object') return {}

  return Object.fromEntries(
    Object.entries(errors as Record<string, unknown>).flatMap(([field, value]) => {
      if (Array.isArray(value) && typeof value[0] === 'string') return [[field, value[0]]]
      if (typeof value === 'string') return [[field, value]]
      return []
    }),
  )
}

const defaultCustomerDraft = (): Partial<Customer> => ({
  status: 'registered',
  agreement_status: 'draft',
  opening_balance: 0,
  current_balance: 0,
})

const customerFormSteps = [
  { label: 'Identity', icon: UserRound },
  { label: 'Address', icon: MapPin },
  { label: 'Photo & Documents', icon: Paperclip },
  { label: 'Review', icon: ClipboardCheck },
] as const

const customerStepFields: Record<number, Array<keyof Customer>> = {
  0: ['name', 'last_name', 'father_name', 'grandfather_name', 'tazkira_number', 'phone', 'secondary_phone'],
  1: ['service_area_id', 'service_area_mosque_id', 'house_number', 'nearest_house_number', 'street_number', 'original_residence', 'current_residence', 'address'],
  2: ['notes'],
  3: [],
}

const customerFieldStep = (field: string) => {
  const matchingStep = Object.entries(customerStepFields).find(([, fields]) => fields.includes(field as keyof Customer))
  if (field === 'photo' || field === 'attachments') return 2
  return matchingStep ? Number(matchingStep[0]) : 0
}

export default function CustomersPage() {
  const router = useRouter()
  const customerAttachmentInputRef = useRef<HTMLInputElement>(null)
  const customerFormTopRef = useRef<HTMLDivElement>(null)
  const { direction, translate } = useLanguage()
  const { data: areas = [] } = useGetServiceAreasQuery()
  const { data = [], isLoading: customersLoading, isError: customersError } = useGetCustomersQuery()
  const [createCustomer] = useCreateCustomerMutation()
  const [updateCustomer] = useUpdateCustomerMutation()
  const [uploadCustomerPhoto] = useUploadCustomerPhotoMutation()
  const [deleteCustomerPhoto] = useDeleteCustomerPhotoMutation()
  const [deleteCustomer] = useDeleteCustomerMutation()
  const [markAgreementPrinted] = useMarkCustomerAgreementPrintedMutation()
  const [uploadCustomerDocuments, { isLoading: documentsUploading }] = useUploadCustomerDocumentsMutation()
  const [deleteCustomerDocument] = useDeleteCustomerDocumentMutation()
  const [current, setCurrent] = useState<Partial<Customer>>({})
  const [documentCustomer, setDocumentCustomer] = useState<Customer | null>(null)
  const [documentType, setDocumentType] = useState('')
  const [documentNotes, setDocumentNotes] = useState('')
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [documentInputKey, setDocumentInputKey] = useState(0)
  const [customerAttachments, setCustomerAttachments] = useState<File[]>([])
  const [customerPhoto, setCustomerPhoto] = useState<File | null>(null)
  const [removeStoredCustomerPhoto, setRemoveStoredCustomerPhoto] = useState(false)
  const [customerAttachmentType, setCustomerAttachmentType] = useState('')
  const [customerAttachmentNotes, setCustomerAttachmentNotes] = useState('')
  const [isAttachmentDragging, setIsAttachmentDragging] = useState(false)
  const [isDocumentDragging, setIsDocumentDragging] = useState(false)
  const [customerFieldErrors, setCustomerFieldErrors] = useState<Record<string, string>>({})
  const [customerFormStep, setCustomerFormStep] = useState(0)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const [documentError, setDocumentError] = useState('')
  const showSkeleton = customersLoading && data.length === 0
  const selectedCustomerId = documentCustomer?.id ?? 0
  const { data: documents = [], isLoading: documentsLoading } = useGetCustomerDocumentsQuery(selectedCustomerId, {
    skip: selectedCustomerId === 0,
  })
  const selectedArea = areas.find((area) => area.id === Number(current.service_area_id))
  const selectedAreaMosques = (selectedArea?.mosques ?? []).filter((mosque) => (
    mosque.status === 'active' || mosque.id === current.service_area_mosque_id
  ))
  const selectedMosque = selectedAreaMosques.find((mosque) => mosque.id === Number(current.service_area_mosque_id))

  const columns: Column<Customer>[] = [
    { key: 'subscription_code', label: 'Subscription Code', render: (item) => item.subscription_code || '-' },
    { key: 'name', label: 'Customer', render: (item) => customerDisplayName(item) },
    { key: 'phone', label: 'Phone', render: (item) => item.phone || '-' },
    { key: 'service_area', label: 'Area', render: (item) => item.service_area?.name ?? '-' },
    { key: 'service_area_mosque', label: 'Mosque', render: (item) => item.service_area_mosque?.name ?? '-' },
    { key: 'house_number', label: 'House', render: (item) => item.house_number || '-' },
    { key: 'current_balance', label: 'Customer Balance', render: (item) => money(item.current_balance) },
    { 
      key: 'document_files_count',
      label: 'Documents',
      render: (item) => (
        <button type="button" onClick={() => openDocuments(item)} className="secondary-action min-h-0 px-2 py-1 text-xs">
          <FileText className="h-3.5 w-3.5" />
          {translate(String(item.document_files_count ?? 0))}
        </button>
      ),
    },
    {
      key: 'latest_contract',
      label: 'Contract',
      render: (item) => (
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={item.latest_contract ? agreementStatusColor[item.latest_contract.status] : 'slate'}>
            {translate(contractStatusLabel(item.latest_contract?.status))}
          </Badge>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/customers/${item.id}?tab=contract`)}
            className="secondary-action min-h-0 px-2 py-1 text-xs"
            title={translate('Open Contract')}
          >
            <FileSignature className="h-3.5 w-3.5" />
            {translate(item.latest_contract ? 'Open' : 'Create')}
          </button>
          {item.latest_contract && (
            <button type="button" onClick={() => printAgreement(item)} className="secondary-action min-h-0 px-2 py-1 text-xs" title={translate('Print Contract')}>
              <Printer className="h-3.5 w-3.5" />
              {translate('Print')}
            </button>
          )}
        </div>
      ),
    },
    { key: 'father_name', label: 'Father Name', render: (item) => item.father_name || '-' },
    { key: 'last_name', label: 'Last Name', render: (item) => item.last_name || '-' },
    { key: 'grandfather_name', label: 'Grandfather Name', render: (item) => item.grandfather_name || '-' },
    { key: 'tazkira_number', label: 'Tazkira Number', render: (item) => item.tazkira_number || '-' },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
  ]

  const resetCustomerAttachments = () => {
    setCustomerAttachments([])
    setCustomerAttachmentType('')
    setCustomerAttachmentNotes('')
    setIsAttachmentDragging(false)
    if (customerAttachmentInputRef.current) customerAttachmentInputRef.current.value = ''
  }

  const resetCustomerPhoto = () => {
    setCustomerPhoto(null)
    setRemoveStoredCustomerPhoto(false)
  }

  const openCustomerForm = (customer?: Customer) => {
    setCurrent(customer ?? defaultCustomerDraft())
    setCustomerFormStep(0)
    setCustomerFieldErrors({})
    setError('')
    resetCustomerAttachments()
    resetCustomerPhoto()
    setIsModalOpen(true)
  }

  const closeCustomerForm = () => {
    if (isSavingCustomer) return
    setIsModalOpen(false)
    setCurrent({})
    setCustomerFormStep(0)
    setCustomerFieldErrors({})
    setError('')
    resetCustomerAttachments()
    resetCustomerPhoto()
  }

  const updateCustomerField = (field: keyof Customer, value: string | number | null) => {
    setCurrent((customer) => ({ ...customer, [field]: value }))
    setCustomerFieldErrors((errors) => {
      if (!errors[field]) return errors
      const next = { ...errors }
      delete next[field]
      return next
    })
  }

  const addCustomerAttachments = (incomingFiles: File[]) => {
    const result = mergeCustomerDocumentFiles(customerAttachments, incomingFiles)
    setCustomerAttachments(result.files)

    setCustomerFieldErrors((errors) => {
      const next = { ...errors }
      if (result.error) next.attachments = result.error
      else delete next.attachments
      return next
    })
  }

  const addManagedDocuments = (incomingFiles: File[]) => {
    const result = mergeCustomerDocumentFiles(documentFiles, incomingFiles)
    setDocumentFiles(result.files)
    setDocumentError(result.error)
  }

  const removeCustomerAttachment = (file: File) => {
    setCustomerAttachments((files) => files.filter((item) => item !== file))
    setCustomerFieldErrors((errors) => {
      if (!errors.attachments) return errors
      const next = { ...errors }
      delete next.attachments
      return next
    })
  }

  const getCustomerValidationErrors = () => {
    const errors: Record<string, string> = {}
    if (!current.name?.trim()) errors.name = 'Enter the customer first name.'
    if (!current.father_name?.trim()) errors.father_name = 'Enter the customer father name.'
    if (!current.phone?.trim()) errors.phone = 'Enter the customer primary phone number.'
    else if ((current.phone.match(/\d/g) ?? []).length < 8) errors.phone = 'Enter a valid phone number using at least 8 digits.'
    if (!current.service_area_id) errors.service_area_id = 'Select the customer service area.'
    if (!current.house_number?.trim()) errors.house_number = 'Enter the customer house number.'
    return errors
  }

  const validateCustomerStep = (step: number) => {
    const fields = customerStepFields[step] ?? []
    const allErrors = getCustomerValidationErrors()
    const errors = Object.fromEntries(Object.entries(allErrors).filter(([field]) => fields.includes(field as keyof Customer)))
    setCustomerFieldErrors((existing) => {
      const next = { ...existing }
      fields.forEach((field) => delete next[field])
      return { ...next, ...errors }
    })
    return Object.keys(errors).length === 0
  }

  const validateCustomerForm = () => {
    const errors = getCustomerValidationErrors()
    setCustomerFieldErrors((existing) => ({ ...existing, ...errors }))
    return Object.keys(errors).length === 0
  }

  const showCustomerValidation = () => {
    window.requestAnimationFrame(() => customerFormTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const continueCustomerForm = () => {
    if (!validateCustomerStep(customerFormStep)) {
      setError('Complete the required information in this step before continuing.')
      showCustomerValidation()
      return
    }
    setError('')
    setCustomerFormStep((step) => Math.min(step + 1, customerFormSteps.length - 1))
    showCustomerValidation()
  }

  const returnCustomerForm = () => {
    setError('')
    setCustomerFormStep((step) => Math.max(step - 1, 0))
    showCustomerValidation()
  }

  const save = async () => {
    setError('')
    if (!validateCustomerForm()) {
      setError('Complete the required customer information before saving.')
      showCustomerValidation()
      return
    }

    setIsSavingCustomer(true)
    try {
      const payload: Partial<Customer> = { ...current }
      delete payload.subscription_code
      let savedCustomer: Customer

      if (current.id) {
        savedCustomer = await updateCustomer({ id: current.id, body: payload }).unwrap()
      } else {
        savedCustomer = await createCustomer(payload).unwrap()
      }

      if (customerPhoto) {
        try {
          savedCustomer = await uploadCustomerPhoto({ customerId: savedCustomer.id, photo: customerPhoto }).unwrap()
        } catch (photoError) {
          setCurrent(savedCustomer)
          setCustomerFormStep(2)
          setCustomerFieldErrors({ photo: getApiErrorMessage(photoError, 'Unable to save the customer photo.') })
          setError('The customer was saved, but the photo was not uploaded. Try saving the photo again.')
          return
        }
      } else if (removeStoredCustomerPhoto && savedCustomer.has_photo) {
        try {
          savedCustomer = await deleteCustomerPhoto(savedCustomer.id).unwrap()
        } catch (photoError) {
          setCurrent(savedCustomer)
          setCustomerFormStep(2)
          setCustomerFieldErrors({ photo: getApiErrorMessage(photoError, 'Unable to remove the customer photo.') })
          setError('The customer was saved, but the old photo could not be removed.')
          return
        }
      }

      if (customerAttachments.length > 0) {
        try {
          await uploadCustomerDocuments({
            customerId: savedCustomer.id,
            files: customerAttachments,
            documentType: customerAttachmentType,
            notes: customerAttachmentNotes,
          }).unwrap()
        } catch (uploadError) {
          setCurrent(savedCustomer)
          setCustomerFormStep(2)
          setCustomerFieldErrors({ attachments: getApiErrorMessage(uploadError, 'Unable to upload customer attachments.') })
          setError('The customer was saved, but the attachments were not uploaded. Check the files and save again to retry.')
          return
        }
      }

      setIsModalOpen(false)
      setCurrent({})
      setCustomerFormStep(0)
      setCustomerFieldErrors({})
      resetCustomerAttachments()
      resetCustomerPhoto()
    } catch (err) {
      const apiFieldErrors = getApiFieldErrors(err)
      setCustomerFieldErrors((errors) => ({ ...errors, ...apiFieldErrors }))
      const firstErrorField = Object.keys(apiFieldErrors)[0]
      if (firstErrorField) setCustomerFormStep(customerFieldStep(firstErrorField))
      setError(getApiErrorMessage(err, 'Unable to save customer.'))
      showCustomerValidation()
    } finally {
      setIsSavingCustomer(false)
    }
  }

  const remove = async () => {
    if (!current.id) return
    await deleteCustomer(current.id).unwrap()
    setIsDeleteOpen(false)
    setCurrent({})
  }

  const openDocuments = (customer: Customer) => {
    setDocumentCustomer(customer)
    setDocumentType('')
    setDocumentNotes('')
    setDocumentFiles([])
    setDocumentError('')
    setIsDocumentDragging(false)
    setDocumentInputKey((key) => key + 1)
  }

  const uploadDocuments = async () => {
    if (!documentCustomer) return
    setDocumentError('')

    if (documentFiles.length === 0) {
      setDocumentError('Select at least one document file.')
      return
    }

    try {
      await uploadCustomerDocuments({
        customerId: documentCustomer.id,
        files: documentFiles,
        documentType,
        notes: documentNotes,
      }).unwrap()

      setDocumentType('')
      setDocumentNotes('')
      setDocumentFiles([])
      setIsDocumentDragging(false)
      setDocumentInputKey((key) => key + 1)
    } catch {
      setDocumentError('Unable to upload customer documents.')
    }
  }

  const downloadDocument = async (document: CustomerDocument) => {
    setDocumentError('')
    const token = getAuthToken()

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

  const removeDocument = async (document: CustomerDocument) => {
    if (!documentCustomer) return
    setDocumentError('')

    try {
      await deleteCustomerDocument({ customerId: documentCustomer.id, documentId: document.id }).unwrap()
    } catch {
      setDocumentError('Unable to delete customer document.')
    }
  }

  const printAgreement = async (customer: Customer) => {
    setError('')
    const printWindow = window.open(`/print/customer-contract/${customer.id}`, '_blank')
    if (!printWindow) {
      setError('Unable to print agreement.')
      return
    }
    printWindow.opener = null

    if (customer.latest_contract && ['draft', 'printed'].includes(customer.latest_contract.status)) {
      try {
        await markAgreementPrinted(customer.id).unwrap()
      } catch (err) {
        setError(getApiErrorMessage(err, 'Agreement printed, but the printed status could not be saved.'))
      }
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Customers" subtitle="Register houses and customer profiles by service area">
        <button type="button" onClick={() => openCustomerForm()} className="primary-action text-sm">
          <Plus size={18} /> Add Customer
        </button>
      </PageHeader>
      {(error || customersError) && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{translate(error || 'Unable to load customers.')}</div>}
      <DataTable
        columns={columns}
        data={data}
        loading={showSkeleton}
        onView={(item) => router.push(`/dashboard/customers/${item.id}`)}
        viewLabel="Details"
        onEdit={(item) => openCustomerForm(item)}
        onDelete={(item) => { setCurrent(item); setIsDeleteOpen(true) }}
        searchKeys={['name', 'last_name', 'father_name', 'phone', 'house_number', 'subscription_code']}
        summaryColumnCount={6}
      />
      <Modal isOpen={isModalOpen} onClose={closeCustomerForm} title={current.id ? 'Edit Customer' : 'Add Customer'} size="xl">
        <div ref={customerFormTopRef} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {translate(error)}
            </div>
          )}
          {current.id && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Customer Record')}</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-sm font-bold text-[var(--text-secondary)]">{translate('Subscription Code')}</p>
                  <div className="field-control flex min-h-[42px] items-center px-4 py-2.5 font-bold text-[var(--text-primary)]">
                    {current.subscription_code || '-'}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-bold text-[var(--text-secondary)]">{translate('Status')}</p>
                  <div className="field-control flex min-h-[42px] items-center px-4 py-2.5">
                    <Badge color={statusColor[current.status ?? 'registered']}>{translate(current.status ?? 'registered')}</Badge>
                  </div>
                </div>
              </div>
            </section>
          )}

          <nav aria-label={translate('Customer registration steps')} className="border-y border-[var(--border-subtle)] py-4">
            <ol className="grid grid-cols-4 gap-1 sm:gap-3">
              {customerFormSteps.map((step, index) => {
                const StepIcon = step.icon
                const isActive = index === customerFormStep
                const isComplete = index < customerFormStep
                return (
                  <li key={step.label} className="min-w-0">
                    <button
                      type="button"
                      disabled={index > customerFormStep}
                      aria-current={isActive ? 'step' : undefined}
                      aria-label={`${translate('Step')} ${index + 1}: ${translate(step.label)}`}
                      onClick={() => {
                        if (index < customerFormStep) {
                          setError('')
                          setCustomerFormStep(index)
                          showCustomerValidation()
                        }
                      }}
                      className={`flex w-full min-w-0 flex-col items-center gap-2 text-center disabled:cursor-default ${isActive ? 'text-[var(--accent)]' : isComplete ? 'text-[var(--mint)]' : 'text-[var(--text-muted)]'}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${isActive ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]' : isComplete ? 'border-[var(--mint)] bg-[var(--mint-soft)] text-[var(--mint)]' : 'border-[var(--border-strong)] bg-[var(--bg-elevated)]'}`}>
                        {isComplete ? <Check size={16} /> : <StepIcon size={16} />}
                      </span>
                      <span className="hidden max-w-full truncate text-xs font-extrabold sm:block">{translate(step.label)}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="mt-3 text-center text-sm font-extrabold text-[var(--text-primary)] sm:hidden">
              {translate('Step')} {customerFormStep + 1} / {customerFormSteps.length}: {translate(customerFormSteps[customerFormStep].label)}
            </p>
          </nav>

          {customerFormStep === 0 && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <UserRound className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Customer Identity')}</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="First Name" value={current.name ?? ''} onChange={(val) => updateCustomerField('name', val)} error={customerFieldErrors.name} required />
                <FormField label="Last Name" value={current.last_name ?? ''} onChange={(val) => updateCustomerField('last_name', val)} error={customerFieldErrors.last_name} />
                <FormField label="Father Name" value={current.father_name ?? ''} onChange={(val) => updateCustomerField('father_name', val)} error={customerFieldErrors.father_name} required />
                <FormField label="Grandfather Name" value={current.grandfather_name ?? ''} onChange={(val) => updateCustomerField('grandfather_name', val)} error={customerFieldErrors.grandfather_name} />
                <FormField label="Tazkira Number" value={current.tazkira_number ?? ''} onChange={(val) => updateCustomerField('tazkira_number', val)} error={customerFieldErrors.tazkira_number} />
                <FormField label="Phone" value={current.phone ?? ''} onChange={(val) => updateCustomerField('phone', val)} error={customerFieldErrors.phone} placeholder="07XXXXXXXX or +93XXXXXXXXX" required />
                <FormField label="Secondary Phone" value={current.secondary_phone ?? ''} onChange={(val) => updateCustomerField('secondary_phone', val)} error={customerFieldErrors.secondary_phone} placeholder="Optional alternate number" />
              </div>
            </section>
          )}

          {customerFormStep === 1 && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Location and House')}</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  label="Service Area"
                  type="select"
                  value={current.service_area_id ?? ''}
                  onChange={(value) => {
                    updateCustomerField('service_area_id', Number(value))
                    updateCustomerField('service_area_mosque_id', null)
                  }}
                  error={customerFieldErrors.service_area_id}
                  options={areas.map((area) => ({ value: area.id, label: area.name }))}
                  required
                />
                <div>
                  <FormField
                    label="Mosque"
                    type="select"
                    value={current.service_area_id ? (current.service_area_mosque_id ?? 'none') : ''}
                    onChange={(value) => updateCustomerField('service_area_mosque_id', value === 'none' ? null : Number(value))}
                    error={customerFieldErrors.service_area_mosque_id}
                    options={[
                      { value: 'none', label: 'No specific mosque' },
                      ...selectedAreaMosques.map((mosque) => ({ value: mosque.id ?? 0, label: mosque.name })),
                    ]}
                    disabled={!current.service_area_id}
                    placeholder="Select service area first"
                  />
                  {current.service_area_id && selectedAreaMosques.length === 0 && (
                    <p className="mt-1.5 text-xs font-bold text-[var(--text-muted)]">{translate('No active mosque has been added to this service area.')}</p>
                  )}
                </div>
                <FormField label="House Number" value={current.house_number ?? ''} onChange={(val) => updateCustomerField('house_number', val)} error={customerFieldErrors.house_number} required />
                <FormField label="Nearest House Number" value={current.nearest_house_number ?? ''} onChange={(val) => updateCustomerField('nearest_house_number', val)} error={customerFieldErrors.nearest_house_number} />
                <FormField label="Street Number" value={current.street_number ?? ''} onChange={(val) => updateCustomerField('street_number', val)} error={customerFieldErrors.street_number} />
                <FormField label="Original Residence" value={current.original_residence ?? ''} onChange={(val) => updateCustomerField('original_residence', val)} error={customerFieldErrors.original_residence} />
                <FormField label="Current Residence" value={current.current_residence ?? ''} onChange={(val) => updateCustomerField('current_residence', val)} error={customerFieldErrors.current_residence} />
                <div className="md:col-span-2">
                  <FormField label="Address" type="textarea" value={current.address ?? ''} onChange={(val) => updateCustomerField('address', val)} error={customerFieldErrors.address} />
                </div>
              </div>
            </section>
          )}

          {customerFormStep === 2 && (
            <div className="space-y-6">
              <section>
                <FormField label="Notes" type="textarea" value={current.notes ?? ''} onChange={(val) => updateCustomerField('notes', val)} error={customerFieldErrors.notes} />
              </section>

              <CustomerPhotoCapture
                customerId={current.id}
                hasStoredPhoto={Boolean(current.has_photo && !removeStoredCustomerPhoto)}
                file={customerPhoto}
                onChange={(photo) => {
                  setCustomerPhoto(photo)
                  if (photo) setRemoveStoredCustomerPhoto(false)
                  setCustomerFieldErrors((errors) => {
                    if (!errors.photo) return errors
                    const next = { ...errors }
                    delete next.photo
                    return next
                  })
                }}
                onRemoveStoredPhoto={() => setRemoveStoredCustomerPhoto(true)}
                disabled={isSavingCustomer}
                error={customerFieldErrors.photo}
              />

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-[var(--accent)]" />
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Customer Attachments')}</h3>
                    <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">{translate('Optional documents saved with this customer profile')}</p>
                  </div>
                </div>

                <input
                  ref={customerAttachmentInputRef}
                  type="file"
                  multiple
                  accept={customerDocumentAccept}
                  className="sr-only"
                  onChange={(event) => addCustomerAttachments(Array.from(event.target.files ?? []))}
                />
                <button
                  type="button"
                  onClick={() => customerAttachmentInputRef.current?.click()}
                  onDragEnter={(event) => { event.preventDefault(); setIsAttachmentDragging(true) }}
                  onDragOver={(event) => { event.preventDefault(); setIsAttachmentDragging(true) }}
                  onDragLeave={(event) => { event.preventDefault(); setIsAttachmentDragging(false) }}
                  onDrop={(event) => {
                    event.preventDefault()
                    setIsAttachmentDragging(false)
                    addCustomerAttachments(Array.from(event.dataTransfer.files))
                  }}
                  className={`flex min-h-[132px] w-full flex-col items-center justify-center border-2 border-dashed px-5 py-6 text-center transition-colors ${isAttachmentDragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-color)] bg-[var(--bg-elevated)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]'}`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    <CloudUpload className="h-5 w-5" />
                  </span>
                  <span className="mt-3 text-sm font-extrabold text-[var(--text-primary)]">{translate('Drop customer documents here or browse files')}</span>
                  <span className="mt-1 text-xs font-bold text-[var(--text-muted)]">{translate('PDF, image, Word, Excel, or text files. Maximum 10 MB each.')}</span>
                </button>
                {customerFieldErrors.attachments && <p className="mt-2 text-xs font-bold text-[var(--coral)]">{translate(customerFieldErrors.attachments)}</p>}

                {customerAttachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {customerAttachments.map((file) => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-h-[54px] items-center gap-3 border-b border-[var(--border-subtle)] py-2 last:border-0">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-[var(--text-primary)]">{file.name}</p>
                          <p className="text-xs font-bold text-[var(--text-muted)]">{formatFileSize(file.size)}</p>
                        </div>
                        <button type="button" onClick={() => removeCustomerAttachment(file)} className="icon-button" title={translate('Remove file')} aria-label={translate('Remove file')}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <div className="grid gap-4 pt-2 md:grid-cols-2">
                      <FormField label="Document Type" value={customerAttachmentType} onChange={(value) => setCustomerAttachmentType(String(value))} placeholder="Tazkira, application, photo..." />
                      <FormField label="Attachment Notes" value={customerAttachmentNotes} onChange={(value) => setCustomerAttachmentNotes(String(value))} placeholder="Optional note for these files" />
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {customerFormStep === 3 && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Review Customer')}</h3>
              </div>
              <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {[
                  ['Customer', customerDisplayName({ name: current.name ?? '', last_name: current.last_name }) || '-'],
                  ['Father Name', current.father_name || '-'],
                  ['Phone', current.phone || '-'],
                  ['Tazkira Number', current.tazkira_number || '-'],
                  ['Service Area', selectedArea?.name || '-'],
                  ['Mosque', selectedMosque?.name || translate('No specific mosque')],
                  ['House Number', current.house_number || '-'],
                  ['Address', current.address || current.current_residence || '-'],
                  ['Customer Photo', customerPhoto?.name || (current.has_photo && !removeStoredCustomerPhoto ? translate('Saved photo') : translate('No photo selected'))],
                  ['Customer Attachments', `${customerAttachments.length} ${translate(customerAttachments.length === 1 ? 'file' : 'files')}`],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 border-b border-[var(--border-subtle)] py-3">
                    <dt className="text-xs font-extrabold text-[var(--text-muted)]">{translate(label)}</dt>
                    <dd className="mt-1 break-words text-sm font-extrabold text-[var(--text-primary)]">{value}</dd>
                  </div>
                ))}
              </dl>
              {current.notes && (
                <div className="border-b border-[var(--border-subtle)] py-3">
                  <p className="text-xs font-extrabold text-[var(--text-muted)]">{translate('Notes')}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-[var(--text-secondary)]">{current.notes}</p>
                </div>
              )}
            </section>
          )}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={closeCustomerForm} disabled={isSavingCustomer} className="secondary-action justify-center disabled:cursor-wait disabled:opacity-60">{translate('Cancel')}</button>
          <div className="flex items-center justify-end gap-3">
            {customerFormStep > 0 && (
              <button type="button" onClick={returnCustomerForm} disabled={isSavingCustomer} className="secondary-action disabled:cursor-wait disabled:opacity-60">
                {direction === 'rtl' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                {translate('Back')}
              </button>
            )}
            {customerFormStep < customerFormSteps.length - 1 ? (
              <button type="button" onClick={continueCustomerForm} className="primary-action">
                {translate('Continue')}
                {direction === 'rtl' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </button>
            ) : (
              <button type="button" onClick={save} disabled={isSavingCustomer} className="primary-action disabled:cursor-wait disabled:opacity-70">
                <Check size={16} />
                {isSavingCustomer ? translate('Saving Customer...') : translate('Save Customer')}
              </button>
            )}
          </div>
        </div>
      </Modal>
      <Modal isOpen={Boolean(documentCustomer)} onClose={() => setDocumentCustomer(null)} title={documentCustomer ? `${customerDisplayName(documentCustomer)} Documents` : 'Customer Documents'} size="xl">
        <div className="space-y-5">
          {documentError && (
            <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {translate(documentError)}
            </div>
          )}

          <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Upload className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Upload Documents')}</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Document Type" value={documentType} onChange={(value) => setDocumentType(value as string)} placeholder="Tazkira, contract, request..." />
              <FormField label="Notes" value={documentNotes} onChange={(value) => setDocumentNotes(value as string)} />
              <label
                htmlFor={`managed-customer-documents-${documentInputKey}`}
                onDragEnter={(event) => { event.preventDefault(); setIsDocumentDragging(true) }}
                onDragOver={(event) => { event.preventDefault(); setIsDocumentDragging(true) }}
                onDragLeave={(event) => { event.preventDefault(); setIsDocumentDragging(false) }}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDocumentDragging(false)
                  addManagedDocuments(Array.from(event.dataTransfer.files))
                }}
                className={`md:col-span-2 flex min-h-[116px] cursor-pointer flex-col items-center justify-center border-2 border-dashed px-5 py-5 text-center transition-colors ${isDocumentDragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--accent)]'}`}
              >
                <input
                  id={`managed-customer-documents-${documentInputKey}`}
                  key={documentInputKey}
                  type="file"
                  multiple
                  accept={customerDocumentAccept}
                  onChange={(event) => addManagedDocuments(Array.from(event.target.files ?? []))}
                  className="sr-only"
                />
                <CloudUpload className="h-6 w-6 text-[var(--accent)]" />
                <span className="mt-2 text-sm font-extrabold text-[var(--text-primary)]">{translate('Drop customer documents here or browse files')}</span>
                <span className="mt-1 text-xs font-bold text-[var(--text-muted)]">{translate('Up to 10 files, maximum 10 MB each')}</span>
              </label>
            </div>
            {documentFiles.length > 0 && (
              <div className="mt-3 divide-y divide-[var(--border-subtle)]">
                {documentFiles.map((file) => (
                  <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-h-[44px] items-center gap-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--text-secondary)]">{file.name}</span>
                    <span className="text-xs font-bold text-[var(--text-muted)]">{formatFileSize(file.size)}</span>
                    <button type="button" onClick={(event) => { event.preventDefault(); setDocumentFiles((files) => files.filter((item) => item !== file)) }} className="icon-button" title={translate('Remove file')} aria-label={translate('Remove file')}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={uploadDocuments} disabled={documentsUploading} className="primary-action text-sm disabled:cursor-wait disabled:opacity-70">
                <Upload className="h-4 w-4" />
                {documentsUploading ? translate('Uploading...') : translate('Upload Documents')}
              </button>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Customer Documents')}</h3>
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-elevated)] text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">{translate('Document')}</th>
                    <th className="px-4 py-3">{translate('Type')}</th>
                    <th className="px-4 py-3">{translate('Size')}</th>
                    <th className="px-4 py-3">{translate('Uploaded')}</th>
                    <th className="px-4 py-3 text-right">{translate('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {documentsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm font-bold text-[var(--text-muted)]">{translate('Loading documents...')}</td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm font-bold text-[var(--text-muted)]">{translate('No customer documents uploaded yet.')}</td>
                    </tr>
                  ) : (
                    documents.map((document) => (
                      <tr key={document.id} className="hover:bg-[var(--bg-elevated)]">
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-[var(--text-primary)]">{document.original_name}</div>
                          {document.notes && <div className="mt-1 text-xs text-[var(--text-muted)]">{document.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{document.document_type || '-'}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{formatFileSize(document.size)}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]"><DateText value={document.created_at} /></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => downloadDocument(document)} className="icon-button" title={translate('Download')} aria-label={translate('Download')}>
                              <Download className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => removeDocument(document)} className="icon-button text-[var(--coral)] hover:bg-[var(--coral-soft)]" title={translate('Delete')} aria-label={translate('Delete')}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </Modal>
      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={remove} title="Delete Customer" message={`Delete ${current.name}?`} />
    </div>
  )
}
