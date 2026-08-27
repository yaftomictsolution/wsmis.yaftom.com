'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetRolesQuery,
  useGetUsersQuery,
  useUpdateUserMutation,
  type User,
} from '@/src/store/waternetApi'

type UserForm = Partial<User> & { password?: string; role?: string }

const statusColor = { active: 'emerald', inactive: 'slate' } as const

export default function UsersPage() {
  const { data = [], isLoading: usersLoading, isError: usersError } = useGetUsersQuery()
  const { data: rolesResponse, isLoading: rolesLoading } = useGetRolesQuery()
  const [createUser] = useCreateUserMutation()
  const [updateUser] = useUpdateUserMutation()
  const [deleteUser] = useDeleteUserMutation()
  const [current, setCurrent] = useState<UserForm>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const roles = rolesResponse?.data ?? []
  const isLoading = usersLoading && data.length === 0

  const columns: Column<User>[] = [
    { key: 'name', label: 'User' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', render: (item) => item.phone || '-' },
    { key: 'roles', label: 'Roles', render: (item) => item.roles.map((role) => role.name).join(', ') || '-' },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
  ]

  const openEdit = (item: User) => {
    setCurrent({ ...item, role: item.roles[0]?.name ?? '' })
    setIsModalOpen(true)
  }

  const save = async () => {
    setError('')
    const body = {
      name: current.name,
      email: current.email,
      phone: current.phone,
      password: current.password,
      status: current.status ?? 'active',
      roles: current.role ? [current.role] : [],
    }

    try {
      if (current.id) {
        await updateUser({ id: current.id, body }).unwrap()
      } else {
        await createUser(body).unwrap()
      }
      setIsModalOpen(false)
      setCurrent({})
    } catch (err) {
      setError('Unable to save user.')
    }
  }

  const remove = async () => {
    if (!current.id) return
    await deleteUser(current.id).unwrap()
    setIsDeleteOpen(false)
    setCurrent({})
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Users" subtitle="Manage staff access accounts">
        <button type="button" onClick={() => { setCurrent({ status: 'active' }); setIsModalOpen(true) }} className="primary-action text-sm">
          <Plus size={18} /> Add User
        </button>
      </PageHeader>
      {(error || usersError) && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error || 'Unable to load users.'}</div>}
      <DataTable columns={columns} data={data} loading={isLoading} onEdit={openEdit} onDelete={(item) => { setCurrent(item); setIsDeleteOpen(true) }} searchKeys={['name', 'email', 'phone']} />
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={current.id ? 'Edit User' : 'Add User'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Full Name" value={current.name ?? ''} onChange={(val) => setCurrent({ ...current, name: val as string })} required />
          <FormField label="Email" type="email" value={current.email ?? ''} onChange={(val) => setCurrent({ ...current, email: val as string })} required />
          <FormField label="Phone" value={current.phone ?? ''} onChange={(val) => setCurrent({ ...current, phone: val as string })} />
          <FormField label="Password" value={current.password ?? ''} onChange={(val) => setCurrent({ ...current, password: val as string })} placeholder={current.id ? 'Leave blank to keep current password' : 'Minimum 6 characters'} required={!current.id} />
          <FormField label="Role" type="select" value={current.role ?? ''} onChange={(val) => setCurrent({ ...current, role: val as string })} options={roles.map((role) => ({ value: role.name, label: role.name }))} placeholder={rolesLoading ? 'Loading roles...' : 'Select role'} />
          <FormField label="Status" type="select" value={current.status ?? 'active'} onChange={(val) => setCurrent({ ...current, status: val as User['status'] })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={save} className="primary-action">Save User</button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={remove} title="Delete User" message={`Delete ${current.name}?`} />
    </div>
  )
}
