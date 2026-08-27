'use client'

import { useRef, useState, type DragEvent } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud, XCircle } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DateText } from '@/components/ui/DateText'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage } from '@/components/finance/FinanceUI'
import { downloadApiFile } from '@/lib/api'
import {
  useGetBiometricImportsQuery,
  useImportBiometricAttendanceMutation,
  type BiometricImportBatch,
} from '@/src/store/waternetApi'

export function BiometricImportPanel() {
  const { data: batches = [], isLoading, isError } = useGetBiometricImportsQuery()
  const [importAttendance, importState] = useImportBiometricAttendanceMutation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const selectFile = (next?: File | null) => {
    setError('')
    if (!next) { setFile(null); return }
    if (!next.name.toLowerCase().endsWith('.csv')) { setError('Select a CSV attendance file.'); return }
    setFile(next)
  }
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    selectFile(event.dataTransfer.files?.[0])
  }
  const upload = async () => {
    if (!file) { setError('Select a CSV attendance file.'); return }
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      await importAttendance(body).unwrap()
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (uploadError) { setError(getApiErrorMessage(uploadError, 'Unable to import biometric attendance.')) }
  }

  const columns: Column<BiometricImportBatch>[] = [
    { key: 'batch_number', label: 'Import Batch' },
    { key: 'original_name', label: 'CSV File' },
    { key: 'created_at', label: 'Imported On', render: (item) => <DateText value={item.created_at} /> },
    { key: 'imported_rows', label: 'Imported', render: (item) => <span className="font-extrabold text-[var(--mint)]">{item.imported_rows}</span> },
    { key: 'failed_rows', label: 'Failed', render: (item) => <span className={item.failed_rows ? 'font-extrabold text-[var(--coral)]' : ''}>{item.failed_rows}</span> },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'importer', label: 'Imported By', render: (item) => item.importer?.name ?? '-' },
    { key: 'errors', label: 'Import Errors', render: (item) => item.errors?.length ? <div className="space-y-1">{item.errors.slice(0, 8).map((issue, index) => <p key={`${issue.row}-${index}`} className="text-xs text-[var(--coral)]">Row {issue.row}: {issue.message}</p>)}</div> : 'No row errors' },
  ]

  const totals = batches.reduce((result, item) => ({ imported: result.imported + item.imported_rows, failed: result.failed + item.failed_rows }), { imported: 0, failed: 0 })

  return (
    <div className="space-y-5">
      <InlineError message={error || (isError ? 'Unable to load biometric import history.' : '')} />
      <div className="grid gap-3 sm:grid-cols-3"><FinanceMetric label="Import Batches" value={String(batches.length)} icon={FileSpreadsheet} /><FinanceMetric label="Rows Imported" value={String(totals.imported)} icon={CheckCircle2} tone="text-[var(--mint)]" /><FinanceMetric label="Rows Rejected" value={String(totals.failed)} icon={XCircle} tone="text-[var(--coral)]" /></div>

      <section className="tool-panel p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-extrabold">Biometric Attendance Import</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Optional CSV import for attendance devices. Existing approved attendance is never overwritten.</p></div><button type="button" className="secondary-action text-sm" onClick={() => void downloadApiFile('/biometric-imports/template', 'biometric-attendance-template.csv')}><Download size={17} /> Download CSV Template</button></div>
        <div onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => inputRef.current?.click()} className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]'}`}>
          <UploadCloud className="mb-3 text-[var(--accent)]" size={34} /><p className="font-extrabold text-[var(--text-primary)]">{file ? file.name : 'Drop biometric CSV here'}</p><p className="mt-1 text-xs text-[var(--text-muted)]">or click to browse · maximum 10 MB</p><input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
        </div>
        <div className="mt-4 flex justify-end"><LoadingButton className="primary-action" disabled={!file} loading={importState.isLoading} loadingLabel="Importing..." onClick={upload}><UploadCloud size={17} /> Import Attendance</LoadingButton></div>
      </section>

      <section className="tool-panel overflow-hidden"><div className="border-b p-4 elegant-divider"><h2 className="font-extrabold">Import History</h2><p className="text-xs text-[var(--text-muted)]">Imported rows remain pending until attendance is approved</p></div><DataTable columns={columns} data={batches} loading={isLoading} searchKeys={['batch_number', 'original_name', 'status']} summaryColumnCount={6} /></section>
    </div>
  )
}
