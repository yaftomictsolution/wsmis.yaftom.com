'use client'

import { useMemo, useState } from 'react'
import { CheckCheck, Plus, RotateCcw, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/context/LanguageContext'
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useGetRolesQuery,
  useUpdateRoleMutation,
  type Permission,
  type Role,
} from '@/src/store/waternetApi'

type RoleForm = {
  id?: number
  name?: string
  permissions?: Permission[] | string[]
}

const emptyPermissions: string[] = []

const permissionModuleLabels: Record<string, { en: string; fa: string }> = {
  dashboard: { en: 'Dashboard', fa: 'داشبورد' },
  users: { en: 'Users', fa: 'کاربران' },
  roles: { en: 'Roles', fa: 'نقش‌ها' },
  settings: { en: 'Settings', fa: 'تنظیمات' },
  'service-areas': { en: 'Service Areas', fa: 'ساحات خدمات' },
  authorities: { en: 'Discount Authorities', fa: 'صلاحیت‌دهندگان تخفیف' },
  customers: { en: 'Customers', fa: 'مشتریان' },
  'customer-contracts': { en: 'Customer Contracts', fa: 'قراردادهای مشتریان' },
  'customer-deposits': { en: 'Customer Deposits', fa: 'پیش‌پرداخت‌های مشتریان' },
  meters: { en: 'Meters', fa: 'میترها' },
  'meter-assignments': { en: 'Meter Assignments', fa: 'نصب میترها' },
  'billing-periods': { en: 'Billing Periods', fa: 'دوره‌های بل' },
  'meter-readings': { en: 'Meter Readings', fa: 'قرائت میترها' },
  invoices: { en: 'Invoices', fa: 'بل‌ها' },
  payments: { en: 'Payments', fa: 'پرداخت‌ها' },
  accounting: { en: 'Accounting', fa: 'حسابداری' },
  'finance-transactions': { en: 'Financial Transactions', fa: 'معاملات مالی' },
  expenses: { en: 'Expenses', fa: 'مصارف' },
  'expense-types': { en: 'Expense Types', fa: 'انواع مصارف' },
  suppliers: { en: 'Suppliers', fa: 'تأمین‌کنندگان' },
  assets: { en: 'Assets', fa: 'دارایی‌ها' },
  'asset-purchases': { en: 'Asset Purchases', fa: 'خرید دارایی‌ها' },
  warehouses: { en: 'Warehouses', fa: 'گدام‌ها' },
  inventory: { en: 'Inventory', fa: 'موجودی گدام' },
  goods: { en: 'Goods', fa: 'اجناس' },
  employees: { en: 'Employees', fa: 'کارمندان' },
  attendance: { en: 'Attendance', fa: 'حاضری' },
  'leave-requests': { en: 'Leave Requests', fa: 'درخواست‌های رخصتی' },
  'leave-policies': { en: 'Leave Policies', fa: 'پالیسی‌های رخصتی' },
  'work-schedules': { en: 'Work Schedules', fa: 'تقسیم اوقات کاری' },
  'salary-advances': { en: 'Salary Advances', fa: 'پیش‌پرداخت معاش' },
  'employee-adjustments': { en: 'Employee Adjustments', fa: 'تعدیلات کارمندان' },
  'performance-reviews': { en: 'Performance Reviews', fa: 'ارزیابی اجراآت' },
  payroll: { en: 'Payroll', fa: 'معاشات' },
  'payroll-deductions': { en: 'Payroll Deductions', fa: 'کسورات معاش' },
  'employee-terminations': { en: 'Employee Terminations', fa: 'ختم وظیفه کارمندان' },
  'biometric-imports': { en: 'Biometric Imports', fa: 'واردکردن حاضری بایومتریک' },
  'attendance-devices': { en: 'Electronic Attendance Devices', fa: 'دستگاه‌های حاضری الکترونیکی' },
  shareholders: { en: 'Shareholders', fa: 'سهم‌داران' },
  reconciliation: { en: 'Reconciliation', fa: 'تطبیق حسابات' },
  'financial-closing': { en: 'Financial Closing', fa: 'بستن حسابات مالی' },
  'financial-reports': { en: 'Financial Reports', fa: 'گزارش‌های مالی' },
  reports: { en: 'Reports', fa: 'گزارش‌ها' },
}

const permissionActionLabels: Record<string, { en: string; fa: string }> = {
  view: { en: 'View', fa: 'مشاهده' },
  create: { en: 'Create', fa: 'ایجاد' },
  update: { en: 'Update', fa: 'ویرایش' },
  delete: { en: 'Delete', fa: 'حذف' },
}

export default function RolesPage() {
  const { language } = useLanguage()
  const { data: rolesResponse, isLoading, isError } = useGetRolesQuery()
  const [createRole] = useCreateRoleMutation()
  const [updateRole] = useUpdateRoleMutation()
  const [deleteRole] = useDeleteRoleMutation()
  const [current, setCurrent] = useState<RoleForm>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const data = rolesResponse?.data ?? []
  const permissions = rolesResponse?.permissions ?? emptyPermissions
  const showSkeleton = isLoading && data.length === 0

  const selectedPermissions = (current.permissions ?? []).map((permission) =>
    typeof permission === 'string' ? permission : permission.name
  )
  const filteredPermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase()
    if (!query) return permissions
    return permissions.filter((permission) => {
      const [module, action] = permission.split('.')
      const moduleLabels = permissionModuleLabels[module]
      const actionLabels = permissionActionLabels[action]
      const searchableText = [
        permission,
        moduleLabels?.en,
        moduleLabels?.fa,
        actionLabels?.en,
        actionLabels?.fa,
      ].filter(Boolean).join(' ').toLowerCase()
      return searchableText.includes(query)
    })
  }, [permissionSearch, permissions])
  const permissionGroups = useMemo(() => {
    return filteredPermissions.reduce<Record<string, string[]>>((groups, permission) => {
      const [module] = permission.split('.')
      groups[module] = [...(groups[module] ?? []), permission]
      return groups
    }, {})
  }, [filteredPermissions])

  const columns: Column<Role>[] = [
    { key: 'name', label: language === 'fa' ? 'نقش' : 'Role' },
    { key: 'permissions', label: language === 'fa' ? 'صلاحیت‌ها' : 'Permissions', render: (item) => item.permissions?.length ?? 0 },
  ]

  const togglePermission = (permission: string) => {
    const selected = new Set(selectedPermissions)
    if (selected.has(permission)) selected.delete(permission)
    else selected.add(permission)
    setCurrent({ ...current, permissions: Array.from(selected) })
  }

  const selectVisiblePermissions = () => {
    setCurrent({
      ...current,
      permissions: Array.from(new Set([...selectedPermissions, ...filteredPermissions])),
    })
  }

  const clearPermissions = () => {
    setCurrent({ ...current, permissions: [] })
  }

  const openRoleForm = (role?: Role) => {
    setCurrent(role ?? { permissions: [] })
    setPermissionSearch('')
    setError('')
    setIsModalOpen(true)
  }

  const save = async () => {
    setError('')
    const body = {
      name: current.name,
      permissions: selectedPermissions,
    }

    try {
      if (current.id) {
        await updateRole({ id: current.id, body }).unwrap()
      } else {
        await createRole(body).unwrap()
      }
      setIsModalOpen(false)
      setCurrent({})
    } catch {
      setError('Unable to save role.')
    }
  }

  const remove = async () => {
    if (!current.id) return
    await deleteRole(current.id).unwrap()
    setIsDeleteOpen(false)
    setCurrent({})
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Roles" subtitle="Control module permissions">
        <button type="button" onClick={() => openRoleForm()} className="primary-action text-sm">
          <Plus size={18} /> Add Role
        </button>
      </PageHeader>
      {isError && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">Unable to load roles.</div>}
      <DataTable columns={columns} data={data} loading={showSkeleton} onEdit={openRoleForm} onDelete={(item) => { setCurrent(item); setIsDeleteOpen(true) }} searchKeys={['name']} />
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={current.id ? 'Edit Role' : 'Add Role'} size="xl">
        <div className="space-y-5">
          {error && <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error}</div>}
          <FormField label="Role Name" value={current.name ?? ''} onChange={(val) => setCurrent({ ...current, name: val as string })} required />
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--text-secondary)]">{language === 'fa' ? 'صلاحیت‌ها' : 'Permissions'}</p>
                <p className="text-xs font-bold text-[var(--text-muted)]">
                  {language === 'fa'
                    ? `${selectedPermissions.length} از ${permissions.length} انتخاب شده`
                    : `${selectedPermissions.length} of ${permissions.length} selected`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={selectVisiblePermissions} disabled={filteredPermissions.length === 0} className="secondary-action min-h-0 px-3 py-2 text-xs">
                  <CheckCheck size={15} /> {language === 'fa' ? 'انتخاب موارد نمایش‌داده‌شده' : 'Select Shown'}
                </button>
                <button type="button" onClick={clearPermissions} disabled={selectedPermissions.length === 0} className="secondary-action min-h-0 px-3 py-2 text-xs">
                  <RotateCcw size={15} /> {language === 'fa' ? 'پاک کردن' : 'Clear'}
                </button>
              </div>
            </div>
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
                placeholder={language === 'fa' ? 'جستجوی صلاحیت‌ها...' : 'Search permissions...'}
                aria-label={language === 'fa' ? 'جستجوی صلاحیت‌ها' : 'Search permissions'}
                className="field-control py-2.5 pe-4 ps-10 text-sm"
              />
            </div>
            <div className="max-h-[48vh] overflow-y-auto border-y border-[var(--border-subtle)]">
              {Object.entries(permissionGroups).map(([module, modulePermissions]) => (
                <section key={module} className="border-b border-[var(--border-subtle)] py-4 last:border-b-0">
                  <h3 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">
                    {permissionModuleLabels[module]?.[language] ?? module.replaceAll('-', ' ')}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {modulePermissions.map((permission) => {
                      const action = permission.split('.')[1] ?? permission
                      return (
                        <label key={permission} className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-bold capitalize text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]">
                          <input type="checkbox" checked={selectedPermissions.includes(permission)} onChange={() => togglePermission(permission)} className="h-4 w-4 accent-[var(--accent)]" />
                          {permissionActionLabels[action]?.[language] ?? action}
                        </label>
                      )
                    })}
                  </div>
                </section>
              ))}
              {permissions.length === 0 && !isLoading && (
                <p className="px-4 py-10 text-center text-sm font-bold text-[var(--text-muted)]">
                  {language === 'fa' ? 'هیچ صلاحیتی موجود نیست.' : 'No permissions are available.'}
                </p>
              )}
              {permissions.length > 0 && filteredPermissions.length === 0 && (
                <p className="px-4 py-10 text-center text-sm font-bold text-[var(--text-muted)]">
                  {language === 'fa' ? 'هیچ صلاحیتی با جستجوی شما مطابقت ندارد.' : 'No permissions match your search.'}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={save} className="primary-action">Save Role</button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={remove} title="Delete Role" message={`Delete ${current.name}?`} />
    </div>
  )
}
