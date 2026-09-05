'use client'

import { useMemo, useRef, useState, type DragEvent } from 'react'
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Download,
  Edit2,
  FileSpreadsheet,
  FileUp,
  Fingerprint,
  Link2,
  PlayCircle,
  RefreshCcw,
  Trash2,
  UploadCloud,
  Usb,
  Wifi,
  XCircle,
} from 'lucide-react'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { DateText } from '@/components/ui/DateText'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage, today } from '@/components/finance/FinanceUI'
import { downloadApiFile } from '@/lib/api'
import {
  useCreateAttendanceDeviceMappingMutation,
  useCreateAttendanceDeviceMutation,
  useDeleteAttendanceDeviceMappingMutation,
  useDeleteAttendanceDeviceMutation,
  useGetAttendanceDeviceEventsQuery,
  useGetAttendanceDeviceMappingsQuery,
  useGetAttendanceDevicesQuery,
  useGetBiometricImportsQuery,
  useGetEmployeesQuery,
  useIgnoreAttendanceDeviceEventMutation,
  useImportAttendanceDeviceFileMutation,
  useImportBiometricAttendanceMutation,
  useReprocessAttendanceDeviceEventMutation,
  useSimulateAttendanceDeviceMutation,
  useSyncAttendanceDeviceMutation,
  useTestAttendanceDeviceMutation,
  useUpdateAttendanceDeviceMutation,
  type AttendanceDevice,
  type AttendanceDeviceEvent,
  type AttendanceDeviceMapping,
  type AttendanceDeviceSyncCounts,
  type BiometricImportBatch,
  type Employee,
} from '@/src/store/waternetApi'

type Tab = 'devices' | 'events' | 'usb' | 'history'

type DeviceDraft = {
  id?: number
  name: string
  code: string
  vendor: string
  model: string
  serial_number: string
  connection_mode: AttendanceDevice['connection_mode']
  ip_address: string
  port: number
  timeout_seconds: number
  timezone: string
  status: AttendanceDevice['status']
}

type MappingDraft = {
  employee_id: string | number
  device_user_id: string
  device_user_name: string
  card_number: string
}

const emptyDeviceDraft = (): DeviceDraft => ({
  name: '',
  code: '',
  vendor: 'ZKTeco',
  model: 'uFace 950',
  serial_number: '',
  connection_mode: 'usb',
  ip_address: '',
  port: 4370,
  timeout_seconds: 8,
  timezone: 'Asia/Kabul',
  status: 'active',
})

const emptyMappingDraft = (): MappingDraft => ({
  employee_id: '',
  device_user_id: '',
  device_user_name: '',
  card_number: '',
})

const modeIcon = {
  network: Wifi,
  usb: Usb,
  simulator: Cpu,
}

const eventStatusColor: Record<string, 'emerald' | 'amber' | 'red' | 'slate' | 'purple'> = {
  processed: 'emerald',
  unmatched: 'amber',
  conflict: 'red',
  invalid: 'red',
  ignored: 'slate',
  processing: 'purple',
}

function deviceLabel(device: AttendanceDevice) {
  return `${device.name} (${device.code})`
}

function employeeLabel(employee?: Pick<Employee, 'employee_number' | 'full_name' | 'first_name' | 'last_name'> | null) {
  if (!employee) return '-'
  const name = employee.full_name || `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim()
  return `${employee.employee_number} - ${name}`
}

function countsText(counts?: AttendanceDeviceSyncCounts) {
  if (!counts) return ''
  return `${counts.processed} processed, ${counts.duplicates} duplicates, ${counts.unmatched} need mapping, ${counts.conflicts + counts.invalid} issues`
}

export function BiometricImportPanel() {
  const { data: deviceOverview, isLoading: devicesLoading, isError: devicesError } = useGetAttendanceDevicesQuery()
  const { data: batches = [], isLoading: batchesLoading, isError: batchesError } = useGetBiometricImportsQuery()
  const { data: employees = [] } = useGetEmployeesQuery({ status: 'active' })

  const [tab, setTab] = useState<Tab>('devices')
  const [eventFilters, setEventFilters] = useState<{ device_id?: number; status?: string; from?: string; to?: string }>({})
  const { data: events = [], isLoading: eventsLoading, isError: eventsError } = useGetAttendanceDeviceEventsQuery(eventFilters)

  const devices = useMemo(() => deviceOverview?.devices ?? [], [deviceOverview?.devices])
  const selectedDeviceOptions = devices.map((device) => ({ value: device.id, label: deviceLabel(device), searchText: `${device.code} ${device.name} ${device.serial_number ?? ''}` }))
  const employeeOptions = employees
    .filter((employee) => employee.status !== 'terminated')
    .map((employee) => ({ value: employee.id, label: employeeLabel(employee), searchText: `${employee.full_name} ${employee.employee_number} ${employee.biometric_id ?? ''}` }))

  const [createDevice, createDeviceState] = useCreateAttendanceDeviceMutation()
  const [updateDevice, updateDeviceState] = useUpdateAttendanceDeviceMutation()
  const [deleteDevice, deleteDeviceState] = useDeleteAttendanceDeviceMutation()
  const [testDevice, testDeviceState] = useTestAttendanceDeviceMutation()
  const [syncDevice, syncDeviceState] = useSyncAttendanceDeviceMutation()
  const [simulateDevice, simulateDeviceState] = useSimulateAttendanceDeviceMutation()
  const [importDeviceFile, importDeviceFileState] = useImportAttendanceDeviceFileMutation()
  const [importLegacyCsv, importLegacyCsvState] = useImportBiometricAttendanceMutation()
  const [createMapping, createMappingState] = useCreateAttendanceDeviceMappingMutation()
  const [deleteMapping, deleteMappingState] = useDeleteAttendanceDeviceMappingMutation()
  const [reprocessEvent, reprocessEventState] = useReprocessAttendanceDeviceEventMutation()
  const [ignoreEvent, ignoreEventState] = useIgnoreAttendanceDeviceEventMutation()

  const [deviceOpen, setDeviceOpen] = useState(false)
  const [deviceDraft, setDeviceDraft] = useState<DeviceDraft>(emptyDeviceDraft())
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const selectedDevice = useMemo(() => devices.find((device) => device.id === selectedDeviceId) ?? null, [devices, selectedDeviceId])
  const { data: mappings = [], isLoading: mappingsLoading } = useGetAttendanceDeviceMappingsQuery(selectedDeviceId ?? 0, { skip: !selectedDeviceId })

  const [mappingOpen, setMappingOpen] = useState(false)
  const [mappingDraft, setMappingDraft] = useState<MappingDraft>(emptyMappingDraft())
  const [eventForMapping, setEventForMapping] = useState<AttendanceDeviceEvent | null>(null)
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [simulatorDraft, setSimulatorDraft] = useState<Record<string, string | number>>({
    employee_id: '',
    device_user_id: '',
    attendance_date: today(),
    check_in: '08:00',
    check_out: '16:00',
    verification_type: 'fingerprint',
  })
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'device' | 'mapping'; id: number; label: string; deviceId?: number } | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [error, setError] = useState('')

  const deviceFileRef = useRef<HTMLInputElement>(null)
  const legacyFileRef = useRef<HTMLInputElement>(null)
  const [deviceFile, setDeviceFile] = useState<File | null>(null)
  const [legacyFile, setLegacyFile] = useState<File | null>(null)
  const [draggingDeviceFile, setDraggingDeviceFile] = useState(false)
  const [draggingLegacyFile, setDraggingLegacyFile] = useState(false)

  const overview = useMemo(() => ({
    devices: devices.length,
    ready: devices.filter((device) => device.status === 'active' && device.connection_status === 'online').length,
    events: devices.reduce((sum, device) => sum + Number(device.events_count ?? 0), 0),
    needsReview: devices.reduce((sum, device) => sum + Number(device.unmatched_events_count ?? 0) + Number(device.conflict_events_count ?? 0), 0),
  }), [devices])

  const batchesTotals = batches.reduce((result, batch) => ({
    imported: result.imported + Number(batch.imported_rows ?? 0),
    failed: result.failed + Number(batch.failed_rows ?? 0),
    unmatched: result.unmatched + Number(batch.unmatched_rows ?? 0),
  }), { imported: 0, failed: 0, unmatched: 0 })

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    setActionMessage('')
    try {
      await action()
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, fallback))
    }
  }

  const openDevice = (device?: AttendanceDevice) => {
    setError('')
    setActionMessage('')
    setDeviceDraft(device ? {
      id: device.id,
      name: device.name,
      code: device.code,
      vendor: device.vendor,
      model: device.model ?? '',
      serial_number: device.serial_number ?? '',
      connection_mode: device.connection_mode,
      ip_address: device.ip_address ?? '',
      port: device.port,
      timeout_seconds: device.timeout_seconds,
      timezone: device.timezone,
      status: device.status,
    } : emptyDeviceDraft())
    setDeviceOpen(true)
  }

  const saveDevice = () => runAction(async () => {
    const body = {
      ...deviceDraft,
      ip_address: deviceDraft.connection_mode === 'network' ? deviceDraft.ip_address : '',
      model: deviceDraft.model || null,
      serial_number: deviceDraft.serial_number || null,
      port: Number(deviceDraft.port || 4370),
      timeout_seconds: Number(deviceDraft.timeout_seconds || 8),
    }
    if (deviceDraft.id) {
      await updateDevice({ id: deviceDraft.id, body }).unwrap()
    } else {
      const created = await createDevice(body).unwrap()
      setSelectedDeviceId(created.id)
    }
    setDeviceOpen(false)
    setActionMessage('Attendance device saved.')
  }, 'Unable to save attendance device.')

  const selectUploadFile = (next?: File | null, kind: 'device' | 'legacy' = 'device') => {
    setError('')
    if (!next) {
      if (kind === 'device') setDeviceFile(null)
      else setLegacyFile(null)
      return
    }
    const allowed = kind === 'device' ? /\.(csv|txt|dat)$/i : /\.csv$/i
    if (!allowed.test(next.name)) {
      setError(kind === 'device' ? 'Select a CSV, TXT, or DAT file exported from the attendance device.' : 'Select a CSV attendance file.')
      return
    }
    if (kind === 'device') setDeviceFile(next)
    else setLegacyFile(next)
  }

  const dropUploadFile = (event: DragEvent<HTMLDivElement>, kind: 'device' | 'legacy') => {
    event.preventDefault()
    setDraggingDeviceFile(false)
    setDraggingLegacyFile(false)
    selectUploadFile(event.dataTransfer.files?.[0], kind)
  }

  const uploadDeviceFile = () => runAction(async () => {
    if (!selectedDeviceId) throw new Error('Select an attendance device first.')
    if (!deviceFile) throw new Error('Select a device export file first.')
    const body = new FormData()
    body.append('file', deviceFile)
    const result = await importDeviceFile({ id: selectedDeviceId, body }).unwrap()
    setDeviceFile(null)
    if (deviceFileRef.current) deviceFileRef.current.value = ''
    setActionMessage(`Device import finished: ${countsText(result.counts)}.`)
    if (result.counts.unmatched || result.counts.conflicts || result.counts.invalid) setTab('events')
  }, 'Unable to import attendance device file.')

  const uploadLegacyCsv = () => runAction(async () => {
    if (!legacyFile) throw new Error('Select a CSV attendance file first.')
    const body = new FormData()
    body.append('file', legacyFile)
    await importLegacyCsv(body).unwrap()
    setLegacyFile(null)
    if (legacyFileRef.current) legacyFileRef.current.value = ''
    setActionMessage('Legacy biometric CSV imported.')
  }, 'Unable to import biometric attendance.')

  const openMappings = (device: Pick<AttendanceDevice, 'id' | 'name' | 'code'>) => {
    setError('')
    setActionMessage('')
    setSelectedDeviceId(device.id)
    setMappingDraft(emptyMappingDraft())
    setEventForMapping(null)
    setMappingOpen(true)
  }

  const openEventMapping = (event: AttendanceDeviceEvent) => {
    setError('')
    setActionMessage('')
    setSelectedDeviceId(event.attendance_device_id)
    setEventForMapping(event)
    setMappingDraft({
      employee_id: event.employee_id ?? '',
      device_user_id: event.device_user_id,
      device_user_name: event.device_user_name ?? '',
      card_number: '',
    })
    setMappingOpen(true)
  }

  const saveMapping = () => runAction(async () => {
    if (!selectedDeviceId) throw new Error('Select an attendance device first.')
    if (!mappingDraft.employee_id) throw new Error('Select the employee for this device user.')
    const result = await createMapping({
      deviceId: selectedDeviceId,
      body: {
        employee_id: Number(mappingDraft.employee_id),
        device_user_id: mappingDraft.device_user_id,
        device_user_name: mappingDraft.device_user_name || null,
        card_number: mappingDraft.card_number || null,
      },
    }).unwrap()
    setMappingDraft(emptyMappingDraft())
    setEventForMapping(null)
    setActionMessage(`Device user mapped. ${result.processed_events} waiting punch(es) processed.`)
  }, 'Unable to map device user to employee.')

  const testSelectedDevice = (device: AttendanceDevice) => runAction(async () => {
    const result = await testDevice(device.id).unwrap()
    setActionMessage(`${result.device.name} is ready for attendance import.`)
  }, 'Unable to connect to attendance device.')

  const syncSelectedDevice = (device: AttendanceDevice) => runAction(async () => {
    const result = await syncDevice(device.id).unwrap()
    setActionMessage(`Device sync finished: ${countsText(result.counts)}.`)
    if (result.counts.unmatched || result.counts.conflicts || result.counts.invalid) setTab('events')
  }, 'Unable to synchronize attendance device.')

  const openSimulator = (device: AttendanceDevice) => {
    const firstEmployee = employees.find((employee) => employee.status !== 'terminated')
    setError('')
    setActionMessage('')
    setSelectedDeviceId(device.id)
    setSimulatorDraft({
      employee_id: firstEmployee?.id ?? '',
      device_user_id: firstEmployee?.biometric_id || firstEmployee?.employee_number || '',
      attendance_date: today(),
      check_in: '08:00',
      check_out: '16:00',
      verification_type: 'fingerprint',
    })
    setSimulatorOpen(true)
  }

  const createSimulatorPunches = () => runAction(async () => {
    if (!selectedDeviceId) throw new Error('Select a simulator device first.')
    const result = await simulateDevice({ id: selectedDeviceId, body: simulatorDraft }).unwrap()
    setSimulatorOpen(false)
    setActionMessage(`Simulator punches created: ${countsText(result.counts)}.`)
  }, 'Unable to create simulator punches.')

  const deviceColumns: Column<AttendanceDevice>[] = [
    {
      key: 'name',
      label: 'Device',
      render: (device) => {
        const Icon = modeIcon[device.connection_mode]
        return (
          <div className="text-start">
            <p className="font-extrabold text-[var(--text-primary)]">{device.name}</p>
            <p className="mt-1 inline-flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
              <Icon size={14} /> {device.code} - {device.vendor} {device.model ?? ''}
            </p>
          </div>
        )
      },
    },
    {
      key: 'connection_mode',
      label: 'Connection',
      render: (device) => device.connection_mode === 'network'
        ? <span>{device.ip_address}:{device.port}</span>
        : <span>{device.connection_mode === 'usb' ? 'USB / File import' : 'Test simulator'}</span>,
    },
    { key: 'status', label: 'Status', render: (device) => <FinanceStatus value={device.status} /> },
    {
      key: 'connection_status',
      label: 'Device Health',
      render: (device) => <Badge color={device.connection_status === 'online' ? 'emerald' : device.connection_status === 'offline' ? 'red' : 'slate'}>{device.connection_status}</Badge>,
    },
    {
      key: 'unmatched_events_count',
      label: 'Review',
      render: (device) => {
        const review = Number(device.unmatched_events_count ?? 0) + Number(device.conflict_events_count ?? 0)
        return <span className={review ? 'font-extrabold text-[var(--gold)]' : 'font-bold text-[var(--mint)]'}>{review}</span>
      },
    },
    { key: 'active_mappings_count', label: 'Mapped Staff', render: (device) => Number(device.active_mappings_count ?? 0) },
    { key: 'last_sync_at', label: 'Last Sync', render: (device) => device.last_sync_at ? <DateText value={device.last_sync_at} /> : '-' },
    {
      key: 'actions',
      label: 'Actions',
      render: (device) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <button type="button" className="icon-button h-8 w-8" title="Mappings" onClick={() => openMappings(device)}><Link2 size={14} /></button>
          <LoadingButton className="icon-button h-8 w-8" title="Test connection" loading={testDeviceState.isLoading} onClick={() => testSelectedDevice(device)}><Cable size={14} /></LoadingButton>
          {device.connection_mode === 'network' ? <LoadingButton className="icon-button h-8 w-8" title="Sync from device" loading={syncDeviceState.isLoading} onClick={() => syncSelectedDevice(device)}><RefreshCcw size={14} /></LoadingButton> : null}
          {device.connection_mode === 'simulator' ? <button type="button" className="icon-button h-8 w-8" title="Create test punches" onClick={() => openSimulator(device)}><PlayCircle size={14} /></button> : null}
          <button type="button" className="icon-button h-8 w-8" title="Edit" onClick={() => openDevice(device)}><Edit2 size={14} /></button>
          <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={() => setDeleteTarget({ kind: 'device', id: device.id, label: device.name })}><Trash2 size={14} /></button>
        </div>
      ),
    },
    { key: 'serial_number', label: 'Serial Number', render: (device) => device.serial_number || '-' },
    { key: 'last_error', label: 'Last Error', render: (device) => device.last_error || '-' },
  ]

  const eventColumns: Column<AttendanceDeviceEvent>[] = [
    {
      key: 'occurred_at',
      label: 'Punch Time',
      render: (event) => (
        <div>
          <p className="font-extrabold text-[var(--text-primary)]">{dateValue(event.attendance_date)}</p>
          <p className="text-xs font-bold text-[var(--text-muted)]">{String(event.local_occurred_at ?? event.occurred_at).replace('T', ' ').slice(0, 16)}</p>
        </div>
      ),
    },
    { key: 'device', label: 'Device', render: (event) => event.device ? `${event.device.name} (${event.device.code})` : '-' },
    {
      key: 'device_user_id',
      label: 'Device User',
      render: (event) => (
        <div>
          <p className="font-extrabold">{event.device_user_id}</p>
          <p className="text-xs text-[var(--text-muted)]">{event.device_user_name || '-'}</p>
        </div>
      ),
    },
    { key: 'employee', label: 'Employee', render: (event) => employeeLabel(event.employee) },
    { key: 'punch_state', label: 'Punch', render: (event) => event.punch_state?.replace('_', ' ') || 'Auto' },
    { key: 'status', label: 'Status', render: (event) => <Badge color={eventStatusColor[event.status] ?? 'slate'}>{event.status.replace('_', ' ')}</Badge> },
    {
      key: 'actions',
      label: 'Actions',
      render: (event) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {['unmatched', 'conflict', 'invalid'].includes(event.status) ? <button type="button" className="secondary-action px-2 py-1 text-xs" onClick={() => openEventMapping(event)}><Link2 size={13} /> Map</button> : null}
          {event.status !== 'processed' ? <LoadingButton className="icon-button h-8 w-8" title="Retry" loading={reprocessEventState.isLoading} onClick={() => runAction(async () => { await reprocessEvent(event.id).unwrap(); setActionMessage('Punch processing retried.') }, 'Unable to retry punch processing.')}><RefreshCcw size={14} /></LoadingButton> : null}
          {!['processed', 'ignored'].includes(event.status) ? <LoadingButton className="icon-button h-8 w-8 text-[var(--coral)]" title="Ignore" loading={ignoreEventState.isLoading} onClick={() => runAction(async () => { await ignoreEvent(event.id).unwrap(); setActionMessage('Punch ignored.') }, 'Unable to ignore punch.')}><XCircle size={14} /></LoadingButton> : null}
        </div>
      ),
    },
    { key: 'source', label: 'Source', render: (event) => event.source },
    { key: 'verification_type', label: 'Verification', render: (event) => event.verification_type },
    { key: 'error_message', label: 'Issue', render: (event) => event.error_message || '-' },
  ]

  const mappingColumns: Column<AttendanceDeviceMapping>[] = [
    { key: 'device_user_id', label: 'Device User ID' },
    { key: 'device_user_name', label: 'Device Name', render: (mapping) => mapping.device_user_name || '-' },
    { key: 'employee', label: 'Employee', render: (mapping) => employeeLabel(mapping.employee) },
    { key: 'card_number', label: 'Card Number', render: (mapping) => mapping.card_number || '-' },
    { key: 'mapping_source', label: 'Source', render: (mapping) => mapping.mapping_source },
    { key: 'status', label: 'Status', render: (mapping) => <FinanceStatus value={mapping.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (mapping) => (
        <button
          type="button"
          className="icon-button h-8 w-8 text-[var(--coral)]"
          title="Remove mapping"
          onClick={() => setDeleteTarget({ kind: 'mapping', id: mapping.id, label: mapping.device_user_id, deviceId: mapping.attendance_device_id })}
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ]

  const batchColumns: Column<BiometricImportBatch>[] = [
    { key: 'batch_number', label: 'Import Batch' },
    { key: 'original_name', label: 'Source File' },
    { key: 'source', label: 'Source', render: (batch) => batch.source ?? 'legacy_csv' },
    { key: 'device', label: 'Device', render: (batch) => batch.device ? `${batch.device.name} (${batch.device.code})` : '-' },
    { key: 'created_at', label: 'Imported On', render: (batch) => <DateText value={batch.created_at} /> },
    { key: 'imported_rows', label: 'Processed', render: (batch) => <span className="font-extrabold text-[var(--mint)]">{batch.imported_rows}</span> },
    { key: 'skipped_rows', label: 'Duplicates', render: (batch) => batch.skipped_rows ?? 0 },
    { key: 'unmatched_rows', label: 'Unmatched', render: (batch) => <span className={(batch.unmatched_rows ?? 0) ? 'font-extrabold text-[var(--gold)]' : ''}>{batch.unmatched_rows ?? 0}</span> },
    { key: 'failed_rows', label: 'Issues', render: (batch) => <span className={batch.failed_rows ? 'font-extrabold text-[var(--coral)]' : ''}>{batch.failed_rows}</span> },
    { key: 'status', label: 'Status', render: (batch) => <FinanceStatus value={batch.status} /> },
    { key: 'importer', label: 'Imported By', render: (batch) => batch.importer?.name ?? '-' },
    {
      key: 'errors',
      label: 'Import Errors',
      render: (batch) => batch.errors?.length
        ? <div className="space-y-1">{batch.errors.slice(0, 8).map((issue, index) => <p key={`${issue.row}-${index}`} className="text-xs text-[var(--coral)]">Row {issue.row}: {issue.message}</p>)}</div>
        : 'No row errors',
    },
  ]

  const deviceFileBox = (
    <div
      onDragEnter={(event) => { event.preventDefault(); setDraggingDeviceFile(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDraggingDeviceFile(false)}
      onDrop={(event) => dropUploadFile(event, 'device')}
      onClick={() => deviceFileRef.current?.click()}
      className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${draggingDeviceFile ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]'}`}
    >
      <UploadCloud className="mb-3 text-[var(--accent)]" size={34} />
      <p className="font-extrabold text-[var(--text-primary)]">{deviceFile ? deviceFile.name : 'Drop ZKTeco export file here'}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">CSV, TXT, or DAT export. Maximum 20 MB.</p>
      <input ref={deviceFileRef} type="file" accept=".csv,.txt,.dat,text/csv,text/plain" className="hidden" onChange={(event) => selectUploadFile(event.target.files?.[0], 'device')} />
    </div>
  )

  const legacyFileBox = (
    <div
      onDragEnter={(event) => { event.preventDefault(); setDraggingLegacyFile(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDraggingLegacyFile(false)}
      onDrop={(event) => dropUploadFile(event, 'legacy')}
      onClick={() => legacyFileRef.current?.click()}
      className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-6 text-center transition ${draggingLegacyFile ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]'}`}
    >
      <FileSpreadsheet className="mb-3 text-[var(--accent)]" size={28} />
      <p className="font-extrabold text-[var(--text-primary)]">{legacyFile ? legacyFile.name : 'Drop old summary CSV here'}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Use this only for the older employee/date/check-in/check-out format.</p>
      <input ref={legacyFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => selectUploadFile(event.target.files?.[0], 'legacy')} />
    </div>
  )

  return (
    <div className="space-y-5">
      <InlineError message={error || (devicesError ? 'Unable to load attendance devices.' : '') || (eventsError ? 'Unable to load attendance punches.' : '') || (batchesError ? 'Unable to load biometric import history.' : '')} />
      {actionMessage ? <div className="rounded-lg border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-4 py-3 text-sm font-extrabold text-[var(--mint)]">{actionMessage}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Attendance Devices" value={String(overview.devices)} icon={Fingerprint} />
        <FinanceMetric label="Ready Devices" value={String(overview.ready)} icon={CheckCircle2} tone="text-[var(--mint)]" />
        <FinanceMetric label="Device Punches" value={String(overview.events)} icon={ClipboardList} />
        <FinanceMetric label="Needs Review" value={String(overview.needsReview + batchesTotals.unmatched + batchesTotals.failed)} icon={AlertTriangle} tone="text-[var(--gold)]" />
      </div>

      <section className="tool-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-extrabold text-[var(--text-primary)]">Electronic Attendance</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">
              Configure ZKTeco or compatible devices, map device users to employees, then approve generated attendance before payroll.
            </p>
          </div>
          <button type="button" className="primary-action text-sm" onClick={() => openDevice()}>
            <Fingerprint size={17} /> Add Attendance Device
          </button>
        </div>
        {deviceOverview?.meta.network_connector_enabled === false ? (
          <div className="mt-4 rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">
            Direct device sync is disabled on this server. USB/file import and simulator mode are still available.
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          ['devices', 'Devices'],
          ['events', 'Punch Review'],
          ['usb', 'USB Import'],
          ['history', 'Import History'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as Tab)}
            className={`secondary-action min-h-10 px-3 py-2 text-sm ${tab === value ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'devices' ? (
        <section className="tool-panel overflow-hidden">
          <DataTable columns={deviceColumns} data={devices} loading={devicesLoading} searchKeys={['name', 'code', 'vendor', 'serial_number']} summaryColumnCount={8} />
        </section>
      ) : null}

      {tab === 'events' ? (
        <section className="space-y-4">
          <div className="tool-panel p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <SearchableSelect
                label="Device"
                value={eventFilters.device_id ?? ''}
                onChange={(value) => setEventFilters({ ...eventFilters, device_id: Number(value) })}
                options={selectedDeviceOptions}
                placeholder="All devices"
                emptyMessage="No attendance devices found."
              />
              <FormField
                label="Punch Status"
                type="select"
                value={eventFilters.status ?? ''}
                onChange={(value) => setEventFilters({ ...eventFilters, status: value ? String(value) : undefined })}
                options={[
                  { value: 'unmatched', label: 'Unmatched' },
                  { value: 'conflict', label: 'Conflict' },
                  { value: 'invalid', label: 'Invalid' },
                  { value: 'processed', label: 'Processed' },
                  { value: 'ignored', label: 'Ignored' },
                ]}
                placeholder="All statuses"
              />
              <FormField label="From" type="date" value={eventFilters.from ?? ''} onChange={(value) => setEventFilters({ ...eventFilters, from: String(value) })} />
              <FormField label="To" type="date" value={eventFilters.to ?? ''} onChange={(value) => setEventFilters({ ...eventFilters, to: String(value) })} />
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className="secondary-action text-sm" onClick={() => setEventFilters({})}>Clear Filters</button>
            </div>
          </div>
          <DataTable columns={eventColumns} data={events} loading={eventsLoading} searchKeys={['device_user_id', 'device_user_name', 'status', 'source', 'error_message']} summaryColumnCount={7} />
        </section>
      ) : null}

      {tab === 'usb' ? (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="tool-panel p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-extrabold">Device USB / File Import</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Use this when the device exports raw punch logs by USB flash drive.</p>
              </div>
              <button type="button" className="secondary-action text-sm" onClick={() => void downloadApiFile('/attendance-devices/import-template', 'zkteco-raw-punch-template.csv')}>
                <Download size={17} /> Download Raw Template
              </button>
            </div>
            <div className="mb-4">
              <SearchableSelect
                label="Attendance Device"
                value={selectedDeviceId ?? ''}
                onChange={(value) => setSelectedDeviceId(Number(value))}
                options={selectedDeviceOptions}
                placeholder="Select attendance device"
                emptyMessage="Create an attendance device first."
                required
              />
            </div>
            {deviceFileBox}
            <div className="mt-4 flex justify-end">
              <LoadingButton className="primary-action" disabled={!selectedDeviceId || !deviceFile} loading={importDeviceFileState.isLoading} loadingLabel="Importing..." onClick={uploadDeviceFile}>
                <FileUp size={17} /> Import Device File
              </LoadingButton>
            </div>
          </section>

          <section className="tool-panel p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-extrabold">Legacy CSV Import</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Optional old format: employee number, attendance date, check-in, check-out.</p>
              </div>
              <button type="button" className="secondary-action text-sm" onClick={() => void downloadApiFile('/biometric-imports/template', 'biometric-attendance-template.csv')}>
                <Download size={17} /> Download CSV Template
              </button>
            </div>
            {legacyFileBox}
            <div className="mt-4 flex justify-end">
              <LoadingButton className="primary-action" disabled={!legacyFile} loading={importLegacyCsvState.isLoading} loadingLabel="Importing..." onClick={uploadLegacyCsv}>
                <UploadCloud size={17} /> Import Legacy CSV
              </LoadingButton>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'history' ? (
        <section className="tool-panel overflow-hidden">
          <div className="border-b p-4 elegant-divider">
            <h2 className="font-extrabold">Import History</h2>
            <p className="text-xs text-[var(--text-muted)]">Imported rows remain pending until attendance is approved.</p>
          </div>
          <DataTable columns={batchColumns} data={batches} loading={batchesLoading} searchKeys={['batch_number', 'original_name', 'status', 'source']} summaryColumnCount={10} />
        </section>
      ) : null}

      <Modal isOpen={deviceOpen} onClose={() => setDeviceOpen(false)} title={deviceDraft.id ? 'Edit Attendance Device' : 'Add Attendance Device'} size="lg">
        <InlineError message={deviceOpen ? error : ''} />
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Device Name" value={deviceDraft.name} onChange={(value) => setDeviceDraft({ ...deviceDraft, name: String(value) })} required />
          <FormField label="Device Code" value={deviceDraft.code} onChange={(value) => setDeviceDraft({ ...deviceDraft, code: String(value).trim() })} required />
          <FormField label="Vendor" value={deviceDraft.vendor} onChange={(value) => setDeviceDraft({ ...deviceDraft, vendor: String(value) })} required />
          <FormField label="Model" value={deviceDraft.model} onChange={(value) => setDeviceDraft({ ...deviceDraft, model: String(value) })} />
          <FormField label="Serial Number" value={deviceDraft.serial_number} onChange={(value) => setDeviceDraft({ ...deviceDraft, serial_number: String(value) })} />
          <FormField
            label="Connection Mode"
            type="select"
            value={deviceDraft.connection_mode}
            onChange={(value) => setDeviceDraft({ ...deviceDraft, connection_mode: String(value) as AttendanceDevice['connection_mode'] })}
            options={[
              { value: 'usb', label: 'USB / File Import' },
              { value: 'network', label: 'Network TCP/IP' },
              { value: 'simulator', label: 'Simulator' },
            ]}
            required
          />
          {deviceDraft.connection_mode === 'network' ? (
            <>
              <FormField label="Device IP Address" value={deviceDraft.ip_address} onChange={(value) => setDeviceDraft({ ...deviceDraft, ip_address: String(value) })} placeholder="192.168.1.201" required />
              <FormField label="Port" type="number" min={1} max={65535} value={deviceDraft.port} onChange={(value) => setDeviceDraft({ ...deviceDraft, port: Number(value) })} required />
            </>
          ) : null}
          <FormField label="Timeout Seconds" type="number" min={2} max={30} value={deviceDraft.timeout_seconds} onChange={(value) => setDeviceDraft({ ...deviceDraft, timeout_seconds: Number(value) })} required />
          <FormField label="Timezone" value={deviceDraft.timezone} onChange={(value) => setDeviceDraft({ ...deviceDraft, timezone: String(value) })} required />
          <FormField
            label="Status"
            type="select"
            value={deviceDraft.status}
            onChange={(value) => setDeviceDraft({ ...deviceDraft, status: String(value) as AttendanceDevice['status'] })}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            required
          />
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-action" onClick={() => setDeviceOpen(false)}>Cancel</button>
          <LoadingButton loading={createDeviceState.isLoading || updateDeviceState.isLoading} loadingLabel={deviceDraft.id ? 'Updating...' : 'Saving...'} onClick={saveDevice}>Save Device</LoadingButton>
        </div>
      </Modal>

      <Modal isOpen={mappingOpen} onClose={() => setMappingOpen(false)} title={eventForMapping ? 'Map Punch To Employee' : 'Device Employee Mapping'} size="xl">
        <InlineError message={mappingOpen ? error : ''} />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
            <div className="mb-3">
              <SearchableSelect
                label="Attendance Device"
                value={selectedDeviceId ?? ''}
                onChange={(value) => setSelectedDeviceId(Number(value))}
                options={selectedDeviceOptions}
                placeholder="Select attendance device"
                required
              />
            </div>
            <div className="space-y-3">
              <SearchableSelect
                label="Employee"
                value={mappingDraft.employee_id}
                onChange={(value) => setMappingDraft({ ...mappingDraft, employee_id: value })}
                options={employeeOptions}
                placeholder="Select employee"
                emptyMessage="No active employee found."
                required
              />
              <FormField label="Device User ID" value={mappingDraft.device_user_id} onChange={(value) => setMappingDraft({ ...mappingDraft, device_user_id: String(value) })} required />
              <FormField label="Device User Name" value={mappingDraft.device_user_name} onChange={(value) => setMappingDraft({ ...mappingDraft, device_user_name: String(value) })} />
              <FormField label="Card Number" value={mappingDraft.card_number} onChange={(value) => setMappingDraft({ ...mappingDraft, card_number: String(value) })} />
            </div>
            <div className="mt-5 flex justify-end">
              <LoadingButton loading={createMappingState.isLoading} loadingLabel="Mapping..." onClick={saveMapping}>
                <Link2 size={17} /> Save Mapping
              </LoadingButton>
            </div>
          </section>
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold">Existing Mappings</h3>
                <p className="text-xs text-[var(--text-muted)]">{selectedDevice ? selectedDevice.name : 'Select a device to review mappings.'}</p>
              </div>
            </div>
            <DataTable columns={mappingColumns} data={mappings} loading={mappingsLoading} searchKeys={['device_user_id', 'device_user_name', 'card_number']} summaryColumnCount={7} />
          </section>
        </div>
      </Modal>

      <Modal isOpen={simulatorOpen} onClose={() => setSimulatorOpen(false)} title="Create Simulator Punches" size="lg">
        <InlineError message={simulatorOpen ? error : ''} />
        <div className="grid gap-3 md:grid-cols-2">
          <SearchableSelect
            label="Employee"
            value={simulatorDraft.employee_id}
            onChange={(value) => {
              const employee = employees.find((item) => item.id === Number(value))
              setSimulatorDraft({ ...simulatorDraft, employee_id: value, device_user_id: employee?.biometric_id || employee?.employee_number || '' })
            }}
            options={employeeOptions}
            placeholder="Select employee"
            required
          />
          <FormField label="Device User ID" value={simulatorDraft.device_user_id} onChange={(value) => setSimulatorDraft({ ...simulatorDraft, device_user_id: String(value) })} required />
          <FormField label="Attendance Date" type="date" value={simulatorDraft.attendance_date} onChange={(value) => setSimulatorDraft({ ...simulatorDraft, attendance_date: String(value) })} required />
          <FormField label="Check In" value={simulatorDraft.check_in} onChange={(value) => setSimulatorDraft({ ...simulatorDraft, check_in: String(value) })} required />
          <FormField label="Check Out" value={simulatorDraft.check_out} onChange={(value) => setSimulatorDraft({ ...simulatorDraft, check_out: String(value) })} />
          <FormField
            label="Verification"
            type="select"
            value={simulatorDraft.verification_type}
            onChange={(value) => setSimulatorDraft({ ...simulatorDraft, verification_type: String(value) })}
            options={[{ value: 'fingerprint', label: 'Fingerprint' }, { value: 'face', label: 'Face' }, { value: 'card', label: 'Card' }, { value: 'pin', label: 'PIN' }]}
            required
          />
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-action" onClick={() => setSimulatorOpen(false)}>Cancel</button>
          <LoadingButton loading={simulateDeviceState.isLoading} loadingLabel="Creating..." onClick={createSimulatorPunches}>
            <PlayCircle size={17} /> Create Test Punches
          </LoadingButton>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => runAction(async () => {
          if (!deleteTarget) return
          if (deleteTarget.kind === 'device') await deleteDevice(deleteTarget.id).unwrap()
          else await deleteMapping({ deviceId: Number(deleteTarget.deviceId), mappingId: deleteTarget.id }).unwrap()
        }, deleteTarget?.kind === 'device' ? 'Unable to delete attendance device.' : 'Unable to delete device mapping.')}
        title={deleteTarget?.kind === 'device' ? 'Delete Attendance Device' : 'Remove Device Mapping'}
        message={deleteTarget?.kind === 'device' ? `Delete ${deleteTarget.label}? Devices with punch history should be set inactive instead.` : `Remove mapping for device user ${deleteTarget?.label ?? ''}?`}
        confirmLabel={deleteTarget?.kind === 'device' ? 'Delete Device' : 'Remove Mapping'}
        loadingLabel={deleteDeviceState.isLoading || deleteMappingState.isLoading ? 'Deleting...' : 'Processing...'}
        kind="danger"
      />
    </div>
  )
}
