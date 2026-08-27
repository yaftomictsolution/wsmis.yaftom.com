import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { API_BASE_URL, clearAuthSession } from '@/lib/api'

export type Role = { id: number; name: string; permissions?: Permission[] }
export type Permission = { id: number; name: string }

export type User = {
  id: number
  name: string
  email: string
  phone?: string
  status: 'active' | 'inactive'
  roles: Role[]
  permissions?: string[]
  last_login_at?: string
}

export type AuthUser = Omit<User, 'roles' | 'permissions'> & {
  roles: string[]
  permissions: string[]
}

export type ServiceAreaMosque = {
  id?: number
  service_area_id?: number
  name: string
  status: 'active' | 'inactive'
  notes?: string
  customers_count?: number
}

export type ServiceArea = {
  id: number
  name: string
  mosque_name?: string | null
  mosque_names?: string
  mosques?: ServiceAreaMosque[]
  mosques_count?: number
  district?: string
  street_block_village?: string
  representative_name?: string
  representative_phone?: string
  households_count: number
  rate_per_cubic_meter: string | number
  status: 'active' | 'inactive'
  inactive_reason?: string
  notes?: string
  customers_count?: number
}

export type Authority = {
  id: number
  authority_number: string
  name: string
  father_name?: string
  title?: string
  phone?: string
  email?: string
  status: 'active' | 'inactive'
  notes?: string
  contracts_count?: number
  discount_payments_count?: number
}

export type Customer = {
  id: number
  service_area_id: number
  service_area?: ServiceArea
  service_area_mosque_id?: number | null
  service_area_mosque?: ServiceAreaMosque
  subscription_code?: string
  subscription_date?: string
  name: string
  last_name?: string
  father_name?: string
  grandfather_name?: string
  phone?: string
  secondary_phone?: string
  tazkira_number?: string
  house_number?: string
  nearest_house_number?: string
  street_number?: string
  original_residence?: string
  current_residence?: string
  meter_size?: string
  connection_fee: string | number
  meter_fee: string | number
  agreement_discount_amount: string | number
  agreement_paid_amount: string | number
  agreement_payment_method_id?: number | null
  agreement_accounting_account_id?: number | null
  agreement_payment_received_by?: number | null
  agreement_payment_date?: string
  agreement_payment_reference?: string
  agreement_payment_id?: number | null
  agreement_payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code' | 'status'>
  agreement_account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance' | 'status'>
  agreement_payment_receiver?: Pick<User, 'id' | 'name'>
  agreement_payment?: {
    id: number
    receipt_number: string
    amount: string | number
    paid_at: string
    status: string
  }
  agreement_remaining_amount: string | number
  discount_approved_by?: string
  agreement_status: 'draft' | 'printed' | 'installation_pending' | 'active' | 'cancelled' | 'pending_approval' | 'approved' | 'rejected' | 'signed'
  agreement_printed_at?: string
  submitted_for_approval_at?: string
  approved_by?: number
  approver?: Pick<User, 'id' | 'name'>
  approved_at?: string
  rejected_by?: number
  rejector?: Pick<User, 'id' | 'name'>
  rejected_at?: string
  rejection_reason?: string
  reversal_reason?: string
  address?: string
  opening_balance: string | number
  current_balance: string | number
  status: 'registered' | 'awaiting_approval' | 'awaiting_installation' | 'active' | 'inactive' | 'suspended' | 'disconnected'
  notes?: string
  has_photo?: boolean
  photo_original_name?: string
  photo_mime_type?: string
  photo_size?: number
  document_files_count?: number
  meter_assignments?: MeterAssignment[]
  latest_contract?: CustomerContract
  contracts?: CustomerContract[]
  deposits?: CustomerDeposit[]
}

export type CustomerContract = {
  id: number
  customer_id: number
  contract_number: string
  subscription_date?: string
  meter_size?: string
  connection_fee: string | number
  meter_fee: string | number
  discount_amount: string | number
  net_amount: string | number
  required_initial_payment: string | number
  deposited_amount: string | number
  applied_amount: string | number
  remaining_amount: string | number
  paid_amount: number
  payment_status: 'unpaid' | 'partially_paid' | 'paid'
  discount_approved_by?: string
  discount_authority_id?: number | null
  discount_authority?: Pick<Authority, 'id' | 'authority_number' | 'name' | 'father_name' | 'title' | 'status'>
  status: 'draft' | 'printed' | 'installation_pending' | 'active' | 'cancelled' | 'pending_approval' | 'approved' | 'rejected'
  printed_at?: string
  submitted_at?: string
  submitted_by?: number
  confirmed_at?: string
  confirmed_by?: number
  approved_at?: string
  rejected_at?: string
  activated_at?: string
  cancelled_at?: string
  rejection_reason?: string
  notes?: string
  created_at?: string
  updated_at?: string
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'house_number' | 'status'>
  creator?: Pick<User, 'id' | 'name'>
  updater?: Pick<User, 'id' | 'name'>
  submitter?: Pick<User, 'id' | 'name'>
  confirmer?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
  rejector?: Pick<User, 'id' | 'name'>
  deposits?: CustomerDeposit[]
  meter_assignments?: MeterAssignment[]
  invoice?: Invoice
  pending_cancellation?: ContractCancellationRequest
}

export type ContractCancellationItem = {
  id: number
  inventory_request_id: number
  inventory_request_item_id: number
  inventory_item_id: number
  warehouse_id: number
  description: string
  unit: string
  quantity: string | number
  unit_cost: string | number
  unit_price: string | number
  total_cost: string | number
  total_price: string | number
  returned_at?: string
  warehouse?: Pick<Warehouse, 'id' | 'name' | 'code' | 'status'>
  inventory_request?: Pick<InventoryRequest, 'id' | 'request_number' | 'document_number' | 'invoice_id' | 'return_status'>
}

export type ContractCancellationRequest = {
  id: number
  customer_contract_id: number
  customer_id: number
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  materials_received_confirmed: boolean
  refund_posted_payments: boolean
  refund_accounting_account_id?: number
  refund_account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance' | 'status'>
  refunded_at?: string
  refund_reference?: string
  requested_by: number
  resolved_by?: number
  resolved_at?: string
  resolution_notes?: string
  requester?: Pick<User, 'id' | 'name'>
  resolver?: Pick<User, 'id' | 'name'>
  contract?: Pick<CustomerContract, 'id' | 'customer_id' | 'contract_number' | 'status' | 'cancelled_at'>
  items?: ContractCancellationItem[]
}

export type ContractCancellationPreview = {
  contract_id: number
  contract_number: string
  materials: Array<{
    inventory_request_id: number
    request_number: string
    description: string
    quantity: number
    unit: string
    warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>
  }>
  material_request_count: number
  material_line_count: number
  material_quantity: number
  active_meter_count: number
  refundable_amount: number
  pending_request?: ContractCancellationRequest
}

export type AppNotification = {
  id: string
  type: string
  data: {
    event?: string
    title?: string
    message?: string
    href?: string
    contract_id?: number
    contract_number?: string
    customer_id?: number
    customer_name?: string
    confirmed_by_id?: number
    confirmed_by_name?: string
  }
  read_at?: string | null
  created_at: string
  updated_at: string
}

export type CustomerDeposit = {
  id: number
  customer_contract_id: number
  customer_id: number
  payment_method_id: number
  accounting_account_id: number
  received_by?: number
  applied_by?: number
  refunded_by?: number
  receipt_number: string
  amount: string | number
  applied_amount: string | number
  refunded_amount: string | number
  received_at: string
  refunded_at?: string
  applied_at?: string
  status: 'pending' | 'partially_applied' | 'applied' | 'refund_required' | 'refunded'
  reference?: string
  refund_receipt_number?: string
  refund_reference?: string
  refund_reason?: string
  notes?: string
  contract?: Pick<CustomerContract, 'id' | 'customer_id' | 'contract_number' | 'status' | 'net_amount' | 'remaining_amount'>
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'house_number'>
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance'>
  receiver?: Pick<User, 'id' | 'name'>
  applier?: Pick<User, 'id' | 'name'>
  refunder?: Pick<User, 'id' | 'name'>
  payment?: Pick<Payment, 'id' | 'receipt_number' | 'amount' | 'paid_at' | 'status'>
}

export type CustomerDocument = {
  id: number
  customer_id: number
  uploaded_by?: number
  uploader?: Pick<User, 'id' | 'name'>
  document_type?: string
  original_name: string
  stored_name: string
  path: string
  mime_type?: string
  size: number
  notes?: string
  created_at: string
  updated_at: string
}

export type Meter = {
  id: number
  good_id?: number
  inventory_item_id?: number
  purchase_request_item_id?: number
  supplier_id?: number
  source_warehouse_id?: number
  current_warehouse_id?: number
  source_type: 'purchase' | 'opening_stock' | 'inventory_opening'
  purchase_cost: string | number
  meter_number: string
  type?: string
  status: 'available' | 'installed' | 'broken' | 'replaced' | 'inactive' | 'sold' | 'issued'
  condition_notes?: string
  purchased_at?: string
  received_at?: string
  retired_at?: string
  good?: Pick<Good, 'id' | 'name' | 'code' | 'category'>
  inventory_item?: Pick<InventoryItem, 'id' | 'warehouse_id' | 'name' | 'code' | 'quantity' | 'unit_cost'>
  supplier?: Pick<Supplier, 'id' | 'name'>
  source_warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>
  current_warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>
  purchase_item?: InventoryRequestItem & {
    request?: Pick<InventoryRequest, 'id' | 'request_number' | 'supplier_id' | 'warehouse_id' | 'request_date'>
  }
  active_assignment?: MeterAssignment
  movements?: MeterMovement[]
}

export type MeterOpeningPayload = {
  meter_number: string
  good_id: number
  warehouse_id: number
  purchase_cost: number
  received_at: string
  purchased_at?: string
  type?: string
  condition_notes?: string
}

export type MeterMovement = {
  id: number
  meter_id: number
  type: string
  from_warehouse_id?: number
  to_warehouse_id?: number
  customer_id?: number
  meter_assignment_id?: number
  inventory_transaction_id?: number
  movement_date: string
  condition?: string
  notes?: string
  created_by?: number
  from_warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>
  to_warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>
  customer?: Pick<Customer, 'id' | 'name'>
  creator?: Pick<User, 'id' | 'name'>
}

export type MeterAssignment = {
  id: number
  customer_id: number
  customer_contract_id?: number
  replacement_charge_id?: number
  meter_id: number
  meter_assigner_id?: number
  source_warehouse_id?: number
  return_warehouse_id?: number
  installed_by?: number
  customer?: Pick<Customer, 'id' | 'service_area_id' | 'service_area_mosque_id' | 'subscription_code' | 'name' | 'last_name' | 'phone' | 'house_number' | 'agreement_status'> & {
    service_area?: Pick<ServiceArea, 'id' | 'name' | 'status'>
    service_area_mosque?: Pick<ServiceAreaMosque, 'id' | 'service_area_id' | 'name' | 'status'>
  }
  contract?: Pick<CustomerContract, 'id' | 'customer_id' | 'contract_number' | 'status' | 'net_amount' | 'remaining_amount'>
  replacement_charge?: CustomerCharge
  meter?: Pick<Meter, 'id' | 'meter_number' | 'status' | 'source_warehouse_id' | 'current_warehouse_id' | 'purchase_cost' | 'source_type'>
  source_warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>
  return_warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>
  installer?: Pick<User, 'id' | 'name'>
  initial_reading: string | number
  installation_date: string
  seal_number?: string
  sealed_at?: string
  sealed_by?: number
  seal_photo?: File
  seal_notes?: string
  seals?: MeterSeal[]
  status: 'active' | 'replaced' | 'removed'
  removed_at?: string
  removal_disposition?: 'return_to_stock' | 'repair' | 'scrap'
  previous_meter_disposition?: 'return_to_stock' | 'repair' | 'scrap'
  replacement_fee?: number
  replacement_due_date?: string
  notes?: string
}

export type MeterAssigner = {
  id: number
  user_id: number
  employee_number: string
  name: string
  email?: string
  position?: string
}

export type MeterSeal = {
  id: number
  meter_assignment_id: number
  sealed_by?: number
  removed_by?: number
  seal_number: string
  sealed_at: string
  status: 'intact' | 'broken' | 'removed' | 'replaced'
  removed_at?: string
  removal_reason?: string
  photo_original_name?: string
  photo_mime_type?: string
  photo_size?: number
  notes?: string
  sealer?: Pick<User, 'id' | 'name'>
  remover?: Pick<User, 'id' | 'name'>
}

export type BillingPeriod = {
  id: number
  name: string
  code: string
  starts_on: string
  ends_on: string
  status: 'open' | 'closed' | 'locked'
  locked_at?: string
  notes?: string
  meter_readings_count?: number
  invoices_count?: number
}

export type Invoice = {
  id: number
  invoice_type: 'water' | 'contract' | 'service' | 'adjustment' | 'inventory'
  billing_period_id?: number
  customer_id: number
  customer_contract_id?: number
  meter_reading_id?: number
  source_type?: string
  source_id?: number
  billing_period?: Pick<BillingPeriod, 'id' | 'name' | 'code'>
  customer?: Pick<Customer, 'id' | 'name' | 'last_name' | 'phone' | 'house_number' | 'subscription_code' | 'address'> & {
    service_area?: Pick<ServiceArea, 'id' | 'name'>
  }
  contract?: Pick<CustomerContract, 'id' | 'contract_number' | 'status' | 'net_amount' | 'remaining_amount'>
  meter_reading?: Pick<MeterReading, 'id' | 'current_reading' | 'previous_reading' | 'consumption'> & {
    meter?: Pick<Meter, 'id' | 'meter_number'>
  }
  inventory_request?: {
    id: number
    invoice_id: number
    document_number?: string
  }
  items?: InvoiceItem[]
  allocations?: PaymentAllocation[]
  payments?: Payment[]
  invoice_number: string
  issue_date: string
  due_date?: string
  previous_balance: string | number
  consumption: string | number
  rate_per_cubic_meter: string | number
  water_amount: string | number
  penalty_amount: string | number
  discount_amount: string | number
  payment_discount_amount?: string | number
  total_amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled'
  notes?: string
}

export type InvoiceItem = {
  id: number
  invoice_id: number
  customer_charge_id?: number
  financial_category_id?: number
  item_type: string
  description: string
  quantity: string | number
  unit_price: string | number
  discount_amount: string | number
  amount: string | number
  notes?: string
  category?: Pick<FinancialCategory, 'id' | 'name' | 'code' | 'type'>
  charge?: Pick<CustomerCharge, 'id' | 'title' | 'type' | 'amount' | 'paid_amount' | 'remaining_amount' | 'status'>
}

export type MeterReading = {
  id: number
  billing_period_id: number
  meter_assignment_id: number
  customer_id: number
  meter_id: number
  read_by?: number
  billing_period?: Pick<BillingPeriod, 'id' | 'name' | 'code'>
  meter_assignment?: Pick<MeterAssignment, 'id' | 'customer_id' | 'meter_id'>
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'house_number'>
  meter?: Pick<Meter, 'id' | 'meter_number'>
  reader?: Pick<User, 'id' | 'name'>
  invoice?: Pick<Invoice, 'id' | 'meter_reading_id' | 'invoice_number' | 'total_amount' | 'paid_amount' | 'remaining_amount' | 'status'>
  reading_date: string
  previous_reading: string | number
  current_reading: string | number
  consumption: string | number
  status: 'recorded' | 'reviewed'
  notes?: string
}

export type Payment = {
  id: number
  invoice_id?: number
  customer_id: number
  customer_contract_id?: number
  payment_method_id: number
  accounting_account_id: number
  received_by?: number
  discount_authority_id?: number
  refunded_by?: number
  refund_transaction_id?: number
  invoice?: Pick<Invoice, 'id' | 'invoice_number' | 'invoice_type' | 'total_amount' | 'paid_amount' | 'payment_discount_amount' | 'remaining_amount' | 'status'>
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'house_number'>
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance'>
  receiver?: Pick<User, 'id' | 'name'>
  discount_authority?: Pick<Authority, 'id' | 'authority_number' | 'name' | 'father_name' | 'title' | 'status'>
  refunder?: Pick<User, 'id' | 'name'>
  receipt_number: string
  refund_receipt_number?: string
  amount: string | number
  discount_amount?: string | number
  idempotency_key?: string
  refunded_amount?: string | number
  paid_at: string
  refunded_at?: string
  reference?: string
  refund_reference?: string
  refund_reason?: string
  status: 'posted' | 'cancelled' | 'refunded'
  notes?: string
  allocations?: PaymentAllocation[]
  refund_transaction?: Pick<AccountingTransaction, 'id' | 'accounting_account_id' | 'payment_method_id' | 'amount' | 'transaction_number'> & {
    account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance'>
  }
}

export type PaymentAllocation = {
  id: number
  payment_id: number
  invoice_id?: number
  customer_charge_id?: number
  amount: string | number
  discount_amount?: string | number
  refunded_amount?: string | number
  refunded_at?: string
  refund_receipt_number?: string
  refund_reference?: string
  refund_reason?: string
  payment?: Payment
  invoice?: Pick<Invoice, 'id' | 'invoice_number' | 'invoice_type' | 'total_amount' | 'paid_amount' | 'payment_discount_amount' | 'remaining_amount' | 'status'>
  charge?: Pick<CustomerCharge, 'id' | 'title' | 'type' | 'amount' | 'paid_amount' | 'remaining_amount' | 'status'>
}

export type CustomerCharge = {
  id: number
  customer_id: number
  customer_contract_id?: number
  customer_charge_type_id?: number
  financial_category_id?: number
  created_by?: number
  title: string
  type: string
  amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  payment_status?: 'unpaid' | 'partially_paid' | 'paid'
  charge_date: string
  paid_at?: string
  status: 'posted' | 'cancelled'
  notes?: string
  category?: Pick<FinancialCategory, 'id' | 'name' | 'type'>
  charge_type?: Pick<CustomerChargeType, 'id' | 'name' | 'code' | 'status' | 'is_system'>
  invoice?: Pick<Invoice, 'id' | 'invoice_number' | 'invoice_type' | 'total_amount' | 'paid_amount' | 'remaining_amount' | 'status'>
  creator?: Pick<User, 'id' | 'name'>
}

export type CustomerServiceRequest = {
  id: number
  customer_id: number
  assigned_to?: number
  created_by?: number
  closed_by?: number
  request_number: string
  type: 'complaint' | 'leak' | 'meter_problem' | 'low_pressure' | 'billing_question' | 'other'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  description: string
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  requested_at: string
  assigned_at?: string
  resolved_at?: string
  closed_at?: string
  resolution?: string
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'house_number'> & {
    service_area?: Pick<ServiceArea, 'id' | 'name'>
  }
  assignee?: Pick<User, 'id' | 'name'>
  creator?: Pick<User, 'id' | 'name'>
  closer?: Pick<User, 'id' | 'name'>
}

export type CustomerConnectionEvent = {
  id: number
  customer_id: number
  processed_by?: number
  customer_charge_id?: number
  event_type: 'disconnection' | 'reconnection'
  reason?: string
  fee: string | number
  status: 'pending' | 'completed' | 'cancelled'
  disconnected_at?: string
  reconnected_at?: string
  notes?: string
  processor?: Pick<User, 'id' | 'name'>
  charge?: Pick<CustomerCharge, 'id' | 'title' | 'amount' | 'status'>
}

export type CustomerLedgerEntry = {
  date?: string
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
  source: string
}

export type CustomerDetail = {
  customer: Customer & {
    contracts?: CustomerContract[]
    deposits?: CustomerDeposit[]
    charges?: CustomerCharge[]
    service_requests?: CustomerServiceRequest[]
    connection_events?: CustomerConnectionEvent[]
    meter_readings?: MeterReading[]
    invoices?: (Invoice & { payments?: Payment[] })[]
    payments?: Payment[]
    document_files?: CustomerDocument[]
  }
  current_meter_assignment?: MeterAssignment
  meter_replacement_history: MeterAssignment[]
  ledger: CustomerLedgerEntry[]
  totals: {
    charges: string | number
    invoiced: string | number
    paid: string | number
    balance: string | number
    deposits_held: string | number
  }
}

export type AccountingAccount = {
  id: number
  name: string
  code: string
  type: 'cash' | 'bank' | 'mobile_money' | 'check' | 'online' | 'other'
  opening_balance: string | number
  current_balance: string | number
  total_income?: string | number
  total_expense?: string | number
  total_equity?: string | number
  total_customer_advances?: string | number
  total_deposit_refunds?: string | number
  last_transaction_at?: string
  status: 'active' | 'inactive'
  notes?: string
}

export type AccountingSummary = {
  opening_balance: string | number
  cash_balance: string | number
  bank_balance: string | number
  available_balance: string | number
  today_income: string | number
  today_expense: string | number
  monthly_income: string | number
  monthly_expense: string | number
  monthly_net_income: string | number
  pending_customer_payments: string | number
  pending_expenses: string | number
  supplier_payables: string | number
  quarter_net_income: string | number
  customer_deposit_liability: string | number
  customer_deposits_requiring_refund: string | number
}

export type Supplier = {
  id: number
  name: string
  supplier_type?: string
  phone?: string
  address?: string
  status: 'active' | 'inactive'
  notes?: string
  contracts_count?: number
}

export type AccountingTransaction = {
  id: number
  financial_category_id?: number
  payment_method_id?: number
  accounting_account_id?: number
  customer_id?: number
  supplier_id?: number
  supplier_installment_id?: number
  recorded_by?: number
  reviewed_by?: number
  approved_by?: number
  rejected_by?: number
  transaction_number: string
  type: 'income' | 'expense' | 'equity' | 'customer_advance' | 'deposit_refund'
  title: string
  amount: string | number
  received_from?: string
  paid_to?: string
  transaction_date: string
  receipt_number?: string
  reference?: string
  source_type?: string
  source_id?: number
  status: 'pending_review' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled'
  reviewed_at?: string
  approved_at?: string
  rejected_at?: string
  posted_at?: string
  reversed_at?: string
  rejection_reason?: string
  description?: string
  attachment_path?: string
  attachment_original_name?: string
  category?: Pick<FinancialCategory, 'id' | 'name' | 'type'>
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance' | 'status'>
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'house_number'>
  supplier?: Pick<Supplier, 'id' | 'name' | 'supplier_type'>
  supplier_installment?: Pick<SupplierInstallment, 'id' | 'installment_number' | 'due_date' | 'status'>
  recorder?: Pick<User, 'id' | 'name'>
  reviewer?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
  rejector?: Pick<User, 'id' | 'name'>
}

export type PayrollItem = {
  id?: number
  user_id?: number
  employee_id?: number
  employee_name: string
  salary_type?: 'fixed' | 'daily' | 'attendance'
  contracted_salary?: string | number
  base_salary: string | number
  scheduled_days?: string | number
  present_days?: string | number
  paid_leave_days?: string | number
  absent_days?: string | number
  late_minutes?: number
  overtime_hours?: string | number
  bonus: string | number
  overtime_amount: string | number
  absence_deduction?: string | number
  late_deduction?: string | number
  advance_deduction: string | number
  tax_deduction?: string | number
  recurring_deduction?: string | number
  other_deduction: string | number
  net_amount: string | number
  payment_status?: 'pending' | 'paid' | 'reversed'
  paid_at?: string
  notes?: string
  user?: Pick<User, 'id' | 'name' | 'email'>
  employee?: Pick<Employee, 'id' | 'user_id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name'> & { position?: Pick<JobPosition, 'id' | 'title'> }
  advance_allocations?: PayrollAdvanceAllocation[]
  deduction_allocations?: PayrollDeductionAllocation[]
  payroll_run?: Pick<PayrollRun, 'id' | 'payroll_number' | 'period_start' | 'period_end' | 'payment_date' | 'status'>
}

export type PayrollRun = {
  id: number
  payroll_number: string
  title: string
  generated_from_hr?: boolean
  period_start: string
  period_end: string
  payment_date: string
  payment_method_id: number
  accounting_account_id: number
  total_base_salary: string | number
  total_bonus: string | number
  total_overtime: string | number
  total_absence_deduction?: string | number
  total_late_deduction?: string | number
  total_advance_deduction: string | number
  total_tax_deduction?: string | number
  total_recurring_deduction?: string | number
  total_other_deduction: string | number
  total_net: string | number
  status: 'draft' | 'pending_review' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled'
  rejection_reason?: string
  notes?: string
  items: PayrollItem[]
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance'>
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  transaction?: Pick<AccountingTransaction, 'id' | 'transaction_number' | 'status'>
  creator?: Pick<User, 'id' | 'name'>
  reviewer?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
}

export type PayrollEligibleEmployee = {
  id: number
  employee_number: string
  full_name: string
  status: 'active' | 'on_leave'
  salary_type: 'fixed' | 'daily' | 'attendance'
  base_salary: string | number
  daily_rate: string | number
  attendance_ready: boolean
  incomplete_attendance_count: number
  incomplete_attendance: { date: string; reason: string }[]
  position?: { id: number; title: string } | null
}

export type Department = {
  id: number
  code: string
  name: string
  description?: string
  status: 'active' | 'inactive'
  positions_count?: number
}

export type JobPosition = {
  id: number
  department_id?: number
  code: string
  title: string
  description?: string
  status: 'active' | 'inactive'
  department?: Pick<Department, 'id' | 'code' | 'name'>
  employees_count?: number
}

export type EmployeeDocument = {
  id: number
  employee_id: number
  document_type: string
  original_name: string
  stored_name: string
  path: string
  mime_type?: string
  size: number
  expires_on?: string
  notes?: string
  uploader?: Pick<User, 'id' | 'name'>
  created_at: string
}

export type Employee = {
  id: number
  user_id?: number
  job_position_id?: number
  service_area_id?: number
  referred_by_shareholder_id?: number
  employee_number: string
  biometric_id?: string
  first_name: string
  last_name?: string
  full_name: string
  father_name?: string
  grandfather_name?: string
  gender?: 'male' | 'female' | 'other'
  date_of_birth?: string
  tazkira_number?: string
  phone?: string
  secondary_phone?: string
  email?: string
  address?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  hire_date: string
  termination_date?: string
  employment_type: 'permanent' | 'contract' | 'temporary' | 'daily'
  salary_type: 'fixed' | 'daily' | 'attendance'
  base_salary: string | number
  daily_rate: string | number
  overtime_hourly_rate: string | number
  effective_overtime_hourly_rate: number
  overtime_rate_source: 'automatic' | 'custom'
  standard_daily_hours: string | number
  work_start_time: string
  work_end_time: string
  work_days: number[]
  bank_name?: string
  bank_account_number?: string
  status: 'active' | 'on_leave' | 'suspended' | 'terminated'
  notes?: string
  user?: Pick<User, 'id' | 'name' | 'email' | 'status' | 'roles'>
  position?: JobPosition
  service_area?: Pick<ServiceArea, 'id' | 'name'>
  referring_shareholder?: Pick<Shareholder, 'id' | 'shareholder_number' | 'name'>
  documents?: EmployeeDocument[]
  attendance_records?: AttendanceRecord[]
  leave_requests?: LeaveRequest[]
  salary_advances?: SalaryAdvance[]
  adjustments?: EmployeeAdjustment[]
  performance_reviews?: PerformanceReview[]
  payroll_items?: PayrollItem[]
  leave_balances?: EmployeeLeaveBalance[]
  shift_assignments?: EmployeeShiftAssignment[]
  payroll_deductions?: EmployeePayrollDeduction[]
  terminations?: EmployeeTermination[]
  documents_count?: number
  attendance_records_count?: number
  leave_requests_count?: number
}

export type AttendanceRecord = {
  id: number
  employee_id: number
  leave_request_id?: number
  attendance_date: string
  check_in?: string
  check_out?: string
  attendance_status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday'
  is_paid: boolean
  worked_minutes: number
  late_minutes: number
  overtime_minutes: number
  source: 'manual' | 'self_service' | 'leave' | 'biometric'
  external_reference?: string
  approval_status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  notes?: string
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name' | 'user_id'>
  recorder?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
  biometric_import_batch?: Pick<BiometricImportBatch, 'id' | 'batch_number'>
}

export type LeaveRequest = {
  id: number
  employee_id: number
  leave_policy_id?: number
  leave_number: string
  leave_type: 'annual' | 'sick' | 'unpaid' | 'emergency' | 'other'
  start_date: string
  end_date: string
  total_days: string | number
  is_paid: boolean
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  rejection_reason?: string
  attachment_path?: string
  attachment_original_name?: string
  employee?: Pick<Employee, 'id' | 'user_id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name'>
  creator?: Pick<User, 'id' | 'name'>
  reviewer?: Pick<User, 'id' | 'name'>
  policy?: LeavePolicy
}

export type LeavePolicy = {
  id: number
  code: string
  name: string
  days_per_year: string | number
  is_paid: boolean
  tracks_balance: boolean
  carry_forward_limit: string | number
  max_consecutive_days?: string | number
  attachment_after_days?: string | number
  payout_on_termination: boolean
  status: 'active' | 'inactive'
  description?: string
}

export type EmployeeLeaveBalance = {
  id: number
  employee_id: number
  leave_policy_id: number
  year: number
  entitlement_days: string | number
  carried_forward_days: string | number
  adjustment_days: string | number
  used_days: string | number
  pending_days: string | number
  available_days: string | number
  notes?: string
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name'>
  policy?: LeavePolicy
}

export type LeavePolicyData = { year: number; policies: LeavePolicy[]; balances: EmployeeLeaveBalance[] }

export type WorkShift = {
  id: number
  code: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
  late_grace_minutes: number
  overtime_after_minutes: number
  status: 'active' | 'inactive'
  notes?: string
  assignments_count?: number
}

export type EmployeeShiftAssignment = {
  id: number
  employee_id: number
  work_shift_id: number
  effective_from: string
  effective_to?: string
  work_days: number[]
  notes?: string
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name'>
  shift?: WorkShift
  assigner?: Pick<User, 'id' | 'name'>
}

export type PublicHoliday = {
  id: number
  holiday_date: string
  name: string
  is_paid: boolean
  status: 'active' | 'inactive'
  notes?: string
}

export type WorkScheduleData = { shifts: WorkShift[]; assignments: EmployeeShiftAssignment[]; holidays: PublicHoliday[] }

export type PayrollDeductionRule = {
  id: number
  code: string
  name: string
  type: 'tax' | 'insurance' | 'pension' | 'other'
  calculation_type: 'fixed' | 'percentage'
  value: string | number
  threshold_amount: string | number
  maximum_amount?: string | number
  status: 'active' | 'inactive'
  description?: string
  employee_deductions_count?: number
}

export type EmployeePayrollDeduction = {
  id: number
  employee_id: number
  payroll_deduction_rule_id: number
  override_value?: string | number
  effective_from: string
  effective_to?: string
  status: 'active' | 'inactive'
  notes?: string
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name'>
  rule?: PayrollDeductionRule
  assigner?: Pick<User, 'id' | 'name'>
}

export type PayrollDeductionData = { rules: PayrollDeductionRule[]; assignments: EmployeePayrollDeduction[] }

export type PayrollDeductionAllocation = {
  id: number
  code: string
  name: string
  type: PayrollDeductionRule['type']
  calculation_type: PayrollDeductionRule['calculation_type']
  value_snapshot: string | number
  amount: string | number
}

export type EmployeeTermination = {
  id: number
  employee_id: number
  payment_method_id: number
  accounting_account_id: number
  termination_number: string
  last_working_date: string
  termination_type: 'resignation' | 'termination' | 'end_of_contract' | 'retirement' | 'other'
  reason: string
  settlement_period_start: string
  final_salary: string | number
  unused_leave_payout: string | number
  severance_amount: string | number
  other_earnings: string | number
  advance_recovery: string | number
  other_deductions: string | number
  net_settlement: string | number
  status: 'pending_review' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled'
  rejection_reason?: string
  notes?: string
  employee?: Pick<Employee, 'id' | 'user_id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name' | 'status'>
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance'>
  transaction?: Pick<AccountingTransaction, 'id' | 'transaction_number' | 'status'>
  creator?: Pick<User, 'id' | 'name'>
  reviewer?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
}

export type TerminationPreview = {
  settlement_period_start: string
  paid_days: number
  daily_rate: number
  final_salary: number
  unused_leave_payout: number
  severance_amount: number
  other_earnings: number
  advance_recovery: number
  other_deductions: number
  net_settlement: number
}

export type BiometricImportBatch = {
  id: number
  batch_number: string
  original_name: string
  total_rows: number
  imported_rows: number
  failed_rows: number
  status: 'processing' | 'completed' | 'completed_with_errors' | 'failed'
  errors?: { row: number; message: string }[]
  importer?: Pick<User, 'id' | 'name'>
  created_at: string
}

export type PayrollMonthlyReport = {
  filters: { from: string; to: string }
  totals: { runs: number; employees: number; gross_earnings: number; absence_deduction: number; late_deduction: number; advance_deduction: number; tax_deduction: number; recurring_deduction: number; other_deduction: number; net_payroll: number }
  months: { month: string; runs: number; employees: number; gross_earnings: number; absence_deduction: number; late_deduction: number; advance_deduction: number; tax_deduction: number; recurring_deduction: number; other_deduction: number; net_payroll: number }[]
  employees: { employee_id?: number; employee_number: string; employee_name: string; gross_earnings: number; absence_deduction: number; late_deduction: number; advance_deduction: number; tax_deduction: number; recurring_deduction: number; other_deduction: number; net_paid: number }[]
  generated_at: string
}

export type SalaryAdvance = {
  id: number
  employee_id: number
  payment_method_id: number
  accounting_account_id: number
  advance_number: string
  amount: string | number
  deducted_amount: string | number
  remaining_amount: string | number
  payment_date: string
  deduction_start_date: string
  status: 'pending_review' | 'pending_approval' | 'approved' | 'partially_deducted' | 'deducted' | 'rejected' | 'cancelled'
  reason?: string
  notes?: string
  rejection_reason?: string
  employee?: Pick<Employee, 'id' | 'user_id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name'>
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance'>
  transaction?: Pick<AccountingTransaction, 'id' | 'transaction_number' | 'status'>
  creator?: Pick<User, 'id' | 'name'>
  reviewer?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
}

export type EmployeeAdjustment = {
  id: number
  employee_id: number
  payroll_item_id?: number
  adjustment_number: string
  type: 'bonus' | 'deduction'
  amount: string | number
  effective_date: string
  title: string
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  rejection_reason?: string
  notes?: string
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'full_name'>
  creator?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
}

export type PerformanceReview = {
  id: number
  employee_id: number
  period_start: string
  period_end: string
  rating: number
  achievements?: string
  concerns?: string
  goals?: string
  notes?: string
  status: 'draft' | 'finalized'
  finalized_at?: string
  reviewer?: Pick<User, 'id' | 'name'>
}

export type PayrollAdvanceAllocation = {
  id: number
  payroll_item_id: number
  salary_advance_id: number
  amount: string | number
  salary_advance?: Pick<SalaryAdvance, 'id' | 'advance_number' | 'amount' | 'deducted_amount' | 'status'>
}

export type HrSummary = {
  total_employees: number
  active_employees: number
  on_leave_employees: number
  present_today: number
  pending_attendance: number
  pending_leave: number
  outstanding_advances: string | number
  monthly_payroll: string | number
}

export type HrStructure = {
  departments: Department[]
  positions: JobPosition[]
  roles: Pick<Role, 'id' | 'name'>[]
  service_areas: Pick<ServiceArea, 'id' | 'name'>[]
  shareholders: Pick<Shareholder, 'id' | 'shareholder_number' | 'name'>[]
}

export type HrReportRow = {
  employee_id: number
  employee_number: string
  employee_name: string
  department?: string
  position?: string
  status: Employee['status']
  present_days: number
  absent_days: number
  late_minutes: number
  overtime_minutes: number
  leave_days: number
  net_salary: number
  advance_balance: number
  average_rating?: number | null
}

export type HrReport = { filters: { from: string; to: string }; rows: HrReportRow[]; generated_at: string }

export type Shareholder = {
  id: number
  shareholder_number: string
  name: string
  shareholder_type: 'individual' | 'company' | 'organization'
  father_name?: string
  phone?: string
  email?: string
  investment_amount: string | number
  ownership_percentage: string | number
  joined_on?: string
  status: 'active' | 'inactive'
  notes?: string
  entitled_amount?: string | number
  paid_amount?: string | number
}

export type ShareholderPayment = {
  id: number
  payment_number: string
  amount: string | number
  payment_date: string
  receipt_number?: string
  status: 'pending_review' | 'pending_approval' | 'paid' | 'rejected' | 'cancelled'
  notes?: string
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type'>
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  transaction?: Pick<AccountingTransaction, 'id' | 'transaction_number' | 'status'>
}

export type ShareholderDistributionItem = {
  id: number
  shareholder_id: number
  percentage_snapshot: string | number
  entitlement_amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  status: 'pending' | 'partially_paid' | 'paid'
  shareholder?: Pick<Shareholder, 'id' | 'shareholder_number' | 'name' | 'phone' | 'ownership_percentage'>
  payments?: ShareholderPayment[]
}

export type FinancialPeriodClosing = {
  id: number
  period_code: string
  period_start: string
  period_end: string
  total_income: string | number
  total_expense: string | number
  payroll_expense: string | number
  net_income: string | number
  receivables: string | number
  supplier_payables: string | number
  cash_balance: string | number
  bank_balance: string | number
  distributable_profit: string | number
  reconciliation_complete: boolean
  readiness?: {
    period_ended: boolean
    available_after: string
    pending_transactions: number
    can_close: boolean
    reconciliation: {
      period_end: string
      required_count: number
      approved_count: number
      complete: boolean
      accounts: Array<{
        account_id: number
        name: string
        code: string
        type: AccountingAccount['type']
        book_balance: string | number
        reconciliation_id?: number | null
        reconciliation_number?: string | null
        status: 'missing' | AccountReconciliation['status']
        difference?: string | number | null
      }>
    }
  }
  status: 'draft' | 'pending_review' | 'pending_approval' | 'closed' | 'rejected'
  rejection_reason?: string
  reopen_reason?: string
  notes?: string
  preparer?: Pick<User, 'id' | 'name'>
  reviewer?: Pick<User, 'id' | 'name'>
  closer?: Pick<User, 'id' | 'name'>
  distribution?: Pick<ShareholderDistribution, 'id' | 'distribution_number' | 'status' | 'distributable_amount' | 'paid_amount'>
}

export type ShareholderDistribution = {
  id: number
  financial_period_closing_id: number
  distribution_number: string
  distributable_amount: string | number
  allocated_amount: string | number
  paid_amount: string | number
  status: 'draft' | 'pending_review' | 'pending_approval' | 'approved' | 'partially_paid' | 'paid' | 'rejected'
  rejection_reason?: string
  notes?: string
  closing?: Pick<FinancialPeriodClosing, 'id' | 'period_code' | 'period_start' | 'period_end' | 'net_income' | 'distributable_profit' | 'status'>
  items: ShareholderDistributionItem[]
  creator?: Pick<User, 'id' | 'name'>
  reviewer?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
}

export type AccountReconciliationItem = {
  id?: number
  kind: string
  direction: 'add' | 'subtract'
  description: string
  reference?: string
  amount: string | number
  cleared?: boolean
}

export type AccountReconciliation = {
  id: number
  reconciliation_number: string
  accounting_account_id: number
  period_start: string
  period_end: string
  book_balance: string | number
  statement_balance: string | number
  adjusted_statement_balance: string | number
  difference: string | number
  status: 'draft' | 'pending_review' | 'pending_approval' | 'approved' | 'rejected'
  rejection_reason?: string
  notes?: string
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type' | 'current_balance'>
  items: AccountReconciliationItem[]
  creator?: Pick<User, 'id' | 'name'>
  reviewer?: Pick<User, 'id' | 'name'>
  approver?: Pick<User, 'id' | 'name'>
}

export type FinancialReport = {
  filters: { from: string; to: string; account_id?: number }
  summary: Record<string, string | number | boolean>
  income_by_category: { name: string; amount: number }[]
  expense_by_category: { name: string; amount: number }[]
  cash_flow: { date: string; income: number; outflow: number; net: number }[]
  accounts: { id: number; name: string; code: string; type: string; opening_balance: number; closing_balance: number }[]
  ledger: AccountingTransaction[]
  receivables: Customer[]
  supplier_payables: InventoryRequest[]
  payroll: PayrollRun[]
  shareholder_distributions: ShareholderDistribution[]
  reconciliations: AccountReconciliation[]
  closings: FinancialPeriodClosing[]
  generated_at: string
}

export type OperationalReport = {
  filters: {
    type: 'overview' | 'customer' | 'inventory' | 'hr' | 'asset' | 'all'
    from: string
    to: string
  }
  summary: {
    total_customers: number
    new_customers: number
    revenue: number
    expenses: number
    inventory_items: number
    inventory_quantity: number
    active_employees: number
    asset_count: number
  }
  recent_reports?: {
    name: string
    date: string
    type: string
    status: string
    href: string
  }[]
  customer?: {
    totals: {
      customers: number
      new_customers: number
      active_customers: number
      pending_customers: number
      receivables: number
      payments_received: number
      payments_count: number
    }
    status_distribution: { name: string; value: number }[]
    balance_distribution: { range: string; count: number }[]
    rows: Record<string, string | number | null>[]
  }
  inventory?: {
    totals: {
      items: number
      quantity: number
      stock_value: number
      low_stock_items: number
      purchased_quantity: number
      purchase_cost: number
      issued_quantity: number
      issue_value: number
    }
    category_distribution: { name: string; quantity: number; value: number }[]
    stock_levels: {
      code: string
      name: string
      category: string
      warehouse: string | null
      quantity: number
      reorder_level: number
      unit_cost: number
      stock_value: number
    }[]
  }
  hr?: {
    totals: {
      employees: number
      active_employees: number
      approved_leave_days: number
      pending_leave_requests: number
      payroll_runs: number
      payroll_cost: number
      attendance_records: number
    }
    department_distribution: { name: string; count: number }[]
    payroll_trend: { period: string; payroll_number: string; amount: number; status: string }[]
    leave_balances: { type: string; entitled: number; used: number; remaining: number }[]
  }
  asset?: {
    totals: {
      assets: number
      active_assets: number
      maintenance_assets: number
      asset_value: number
      maintenance_events: number
      maintenance_cost: number
    }
    type_distribution: { name: string; count: number }[]
    status_distribution: { name: string; value: number }[]
    rows: Record<string, string | number | null>[]
  }
  generated_at: string
}

export type SupplierInstallment = {
  id: number
  supplier_purchase_contract_id: number
  payment_method_id?: number
  accounting_account_id?: number
  accounting_transaction_id?: number
  recorded_by?: number
  installment_number: number
  due_date: string
  amount: string | number
  paid_amount: string | number
  paid_at?: string
  status: 'pending' | 'pending_review' | 'pending_approval' | 'paid' | 'cancelled'
  receipt_number?: string
  notes?: string
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type'>
  transaction?: Pick<AccountingTransaction, 'id' | 'transaction_number' | 'status' | 'approved_at'>
  contract?: Pick<SupplierPurchaseContract, 'id' | 'contract_number'> & { supplier?: Pick<Supplier, 'id' | 'name'> }
}

export type SupplierPurchaseContract = {
  id: number
  supplier_id: number
  financial_category_id?: number
  created_by?: number
  contract_number: string
  item_type: string
  total_amount: string | number
  down_payment_amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  installments_count: number
  installment_start_date?: string
  installment_end_date?: string
  next_payment_date?: string
  status: 'active' | 'completed' | 'overdue' | 'cancelled'
  notes?: string
  supplier?: Pick<Supplier, 'id' | 'name' | 'supplier_type' | 'phone'>
  category?: Pick<FinancialCategory, 'id' | 'name' | 'type'>
  creator?: Pick<User, 'id' | 'name'>
  installments?: SupplierInstallment[]
}

export type DashboardStats = {
  users: number
  service_areas: number
  customers: number
  active_customers: number
  contracts_draft: number
  contracts_awaiting_installation: number
  deposits_requiring_refund: number
  customer_deposits_held: string | number
  meters: number
  available_meters: number
  assigned_meters: number
  billing_periods: number
  meter_readings: number
  invoices: number
  unpaid_invoices: number
  payments: number
  outstanding_balance: string | number
  monthly_cash_movement: Array<{
    period: string
    period_start: string
    income: string | number
    expense: string | number
    net: string | number
  }>
}

export type SystemProfile = {
  company_name: string
  system_name: string
  currency: string
  language: string
  calendar_system: 'shamsi' | 'gregorian'
  show_gregorian_secondary: boolean
  phone?: string
  address?: string
}

export type LeaveSettings = {
  annual_leave_days: number
  carry_forward_days: number
  sick_leave_days: number
  emergency_leave_days: number
}

export type PaymentMethod = {
  id: number
  name: string
  code: string
  status: 'active' | 'inactive'
}

export type CustomerCollectionOptions = {
  payment_methods: PaymentMethod[]
  accounts: AccountingAccount[]
}

export type FinancialCategory = {
  id: number
  name: string
  code: string
  type: 'income' | 'expense'
  description?: string
  status: 'active' | 'inactive'
  transactions_count?: number
}

export type CustomerChargeType = {
  id: number
  name: string
  code: string
  description?: string
  status: 'active' | 'inactive'
  is_system: boolean
  charges_count?: number
}

type DataResponse<T> = { data: T }
export type PaginatedResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from?: number | null
  to?: number | null
}
type AuthUserResponse = { user: AuthUser }
type ProfileUpdateResponse = { token: string | null; user: AuthUser }
type RolesResponse = { data: Role[]; permissions: string[] }
type SettingsResponse = {
  data: {
    system: {
      system_profile?: SystemProfile
    }
    payment_methods: PaymentMethod[]
    financial_categories: FinancialCategory[]
    customer_charge_types: CustomerChargeType[]
  }
}

export type TrainingModeStatus = {
  environment: 'production' | 'training'
  enabled: boolean
  business_date: string | null
  effective_date: string
  real_date: string
  can_manage: boolean
  training_url?: string | null
  production_url?: string | null
  reset_confirmation: string
}

type TrainingModeResponse = {
  message?: string
  data: TrainingModeStatus
}

export type TrainingResetProgress = {
  operation_id: string
  status: 'running' | 'completed'
  stage: 'database' | 'files' | 'cache' | 'complete'
  message: string
  progress: number
  completed_steps: number
  total_steps: number
  remaining_steps: number
  cleared_tables: number
  total_tables: number
}

type TrainingResetResponse = {
  message: string
  data: TrainingResetProgress
}

// Asset types
export type AssetPurchase = {
  id: number
  purchase_number: string
  asset_code_prefix: string
  name: string
  type: 'well' | 'reservoir' | 'generator' | 'solar' | 'technical'
  quantity: number
  unit_cost: string | number
  total_amount: string | number
  supplier_id?: number
  supplier?: Supplier
  service_area_id?: number
  service_area?: ServiceArea
  financial_category_id: number
  category?: Pick<FinancialCategory, 'id' | 'name' | 'code' | 'type'>
  payment_method_id: number
  payment_method?: PaymentMethod
  accounting_account_id: number
  account?: AccountingAccount
  accounting_transaction_id?: number
  transaction?: Pick<AccountingTransaction, 'id' | 'transaction_number' | 'status' | 'rejection_reason' | 'posted_at' | 'reversed_at'>
  created_by?: number
  creator?: Pick<User, 'id' | 'name'>
  status: 'pending_review' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled'
  asset_status: 'active' | 'inactive'
  purchase_date: string
  warranty_expiry?: string
  invoice_number?: string
  address?: string
  attachment_path?: string
  attachment_original_name?: string
  notes?: string
  assets?: Array<Pick<Asset, 'id' | 'asset_purchase_id' | 'asset_code' | 'name' | 'status'>>
}

export type Asset = {
  id: number
  asset_purchase_id?: number
  asset_code: string
  name: string
  type: 'well' | 'reservoir' | 'generator' | 'solar' | 'technical'
  status: 'active' | 'inactive' | 'maintenance' | 'retired'
  service_area_id?: number
  service_area?: ServiceArea
  latitude?: number
  longitude?: number
  address?: string
  purchase_cost?: number
  purchase_date?: string
  warranty_expiry?: string
  supplier_id?: number
  supplier?: Supplier
  purchase?: Pick<AssetPurchase, 'id' | 'purchase_number' | 'quantity' | 'unit_cost' | 'total_amount' | 'status'> & {
    account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type'>
    transaction?: Pick<AccountingTransaction, 'id' | 'transaction_number' | 'status'>
  }
  attributes?: Record<string, unknown>
  notes?: string
  created_by?: number
  creator?: User
  created_at?: string
  updated_at?: string
}

export type AssetMaintenance = {
  id: number
  asset_id: number
  asset?: Asset
  maintenance_type: 'preventive' | 'corrective' | 'emergency'
  title: string
  description?: string
  cost?: number
  performed_at: string
  next_due_date?: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  performed_by?: string
  created_by?: number
  notes?: string
  created_at?: string
  updated_at?: string
}

export type Warehouse = {
  id: number
  name: string
  code: string
  address?: string
  service_area_id?: number
  service_area?: ServiceArea
  status: 'active' | 'inactive'
  notes?: string
  items_count?: number
  products_count?: number
  total_quantity?: number
  stock_value?: number
  low_stock_count?: number
  out_of_stock_count?: number
  last_movement_at?: string | null
  available_meter_serials_count?: number
  created_at?: string
  updated_at?: string
}

export type WarehouseSummary = {
  total_warehouses?: number
  active_warehouses?: number
  products_count: number
  total_quantity: number
  stock_value: number
  low_stock_count: number
  out_of_stock_count: number
  last_movement_at?: string | null
  available_meter_serials?: number
}

export type WarehouseListResponse = PaginatedResponse<Warehouse> & {
  summary: WarehouseSummary
}

export type InventoryItem = {
  id: number
  good_id?: number
  good?: Good
  warehouse_id: number
  warehouse?: Warehouse
  name: string
  code: string
  category: 'pipe' | 'meter' | 'chemical' | 'fuel' | 'solar' | 'technical' | 'office' | 'other'
  unit: string
  quantity: number
  unit_cost: number
  unit_price: number
  reorder_level: number
  supplier_id?: number
  supplier?: Supplier
  notes?: string
  serialized_available_count?: number
  created_at?: string
  updated_at?: string
}

export type InventoryTransaction = {
  id: number
  inventory_item_id: number
  inventory_item?: InventoryItem
  type: 'purchase' | 'sale' | 'internal_use' | 'return' | 'adjustment' | 'transfer'
  quantity: number
  unit_cost?: number
  unit_price?: number
  total_amount?: number
  transaction_date: string
  reference_type?: string
  reference_id?: number
  notes?: string
  created_by?: number
  creator?: Pick<User, 'id' | 'name'>
  created_at?: string
}

export type WarehouseDetail = {
  warehouse: Warehouse
  summary: WarehouseSummary
  inventory: PaginatedResponse<InventoryItem>
  movements: PaginatedResponse<InventoryTransaction>
  meters: PaginatedResponse<Meter>
}

export type WarehouseDetailParams = {
  id: number
  inventory_search?: string
  category?: string
  stock_status?: 'available' | 'low' | 'out' | ''
  inventory_page?: number
  inventory_per_page?: number
  movement_type?: InventoryTransaction['type'] | ''
  movement_from?: string
  movement_to?: string
  movement_page?: number
  movement_per_page?: number
  meter_search?: string
  meter_status?: Meter['status'] | ''
  meter_page?: number
  meter_per_page?: number
}

export type Good = {
  id: number
  name: string
  code: string
  category: 'pipe' | 'meter' | 'chemical' | 'fuel' | 'solar' | 'technical' | 'office' | 'other'
  unit: string
  default_cost: number
  default_price: number
  status: 'active' | 'inactive'
  description?: string
  created_at?: string
  updated_at?: string
}

export type InventoryIssue = {
  id: number
  issue_number: string
  issue_date: string
  type: 'internal' | 'customer'
  department_id?: number
  requested_by?: number
  approved_by?: number
  customer_id?: number
  customer_contract_id?: number
  status: 'draft' | 'pending_approval' | 'approved' | 'issued' | 'cancelled'
  notes?: string
  created_by?: number
  created_at?: string
  updated_at?: string
}

export type InventoryRequest = {
  id: number
  request_number: string
  type: 'purchase' | 'issue'
  issue_type?: 'internal' | 'customer'
  issue_purpose?: 'separate_sale' | 'contract_material'
  status: 'pending' | 'approved' | 'rejected' | 'processed'
  return_status?: 'not_required' | 'not_requested' | 'pending_approval' | 'returned'
  supplier_id?: number
  customer_id?: number
  customer_contract_id?: number
  department_id?: number
  accounting_account_id?: number
  payment_method_id?: number
  invoice_id?: number
  document_number?: string
  document_generated_at?: string
  warehouse_id: number
  supplier?: Supplier
  customer?: Customer
  contract?: Pick<CustomerContract, 'id' | 'customer_id' | 'contract_number' | 'status'>
  department?: { id: number; code: string; name: string }
  account?: AccountingAccount
  payment_method?: PaymentMethod
  invoice?: Invoice
  warehouse?: Warehouse
  requester?: { id: number; name: string }
  approver?: { id: number; name: string }
  items?: InventoryRequestItem[]
  request_date: string
  notes?: string
  total_amount: number
  initial_payment_amount: number
  paid_amount: number
  remaining_amount: number
  payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
  purchase_payments?: InventoryPurchasePayment[]
  total_items: number
  requested_by: number
  approved_by?: number
  approved_at?: string
  returned_by?: number
  returned_at?: string
  returner?: Pick<User, 'id' | 'name'>
  approval_notes?: string
  created_at?: string
  updated_at?: string
}

export type InventoryPurchasePayment = {
  id: number
  inventory_request_id: number
  accounting_account_id?: number
  payment_method_id?: number
  accounting_transaction_id?: number
  recorded_by?: number
  receipt_number: string
  amount: string | number
  paid_at: string
  reference?: string
  status: 'posted' | 'cancelled'
  notes?: string
  account?: Pick<AccountingAccount, 'id' | 'name' | 'code' | 'type'>
  payment_method?: Pick<PaymentMethod, 'id' | 'name' | 'code'>
  recorder?: Pick<User, 'id' | 'name'>
}

export type InventoryRequestItem = {
  id: number
  inventory_request_id: number
  good_id?: number
  inventory_item_id?: number
  good?: Good
  inventory_item?: InventoryItem
  description: string
  quantity: number
  unit_price: number
  total_price: number
  meter_serials?: string[]
  meter_ids?: number[]
}

export type InventoryRequestPayload = {
  type: 'purchase' | 'issue'
  issue_type?: 'internal' | 'customer'
  issue_purpose?: 'separate_sale' | 'contract_material'
  supplier_id?: number
  customer_id?: number
  customer_contract_id?: number
  department_id?: number
  accounting_account_id?: number
  payment_method_id?: number
  amount_paid?: number
  warehouse_id: number
  request_date: string
  notes?: string
  items: Array<{
    good_id?: number
    inventory_item_id?: number
    quantity: number
    unit_price: number
    meter_serials?: string[]
    meter_ids?: number[]
  }>
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    headers.set('Accept', 'application/json')

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('waternet_token')
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }

    return headers
  },
})

const authenticatedBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const currentPath = `${window.location.pathname}${window.location.search}`
    sessionStorage.setItem('wsmis_auth_next', currentPath.startsWith('/dashboard') ? currentPath : '/dashboard')
    sessionStorage.setItem('wsmis_session_expired', '1')
    clearAuthSession()
    window.location.replace('/login?reason=session_expired')
  }

  return result
}

export const waternetApi = createApi({
  reducerPath: 'waternetApi',
  baseQuery: authenticatedBaseQuery,
  keepUnusedDataFor: 600,
  tagTypes: [
    'Dashboard',
    'Profile',
    'Notifications',
    'Users',
    'Roles',
    'Settings',
    'TrainingMode',
    'PaymentMethods',
    'FinancialCategories',
    'CustomerChargeTypes',
    'Authorities',
    'ServiceAreas',
    'Customers',
    'CustomerDetail',
    'CustomerContracts',
    'CustomerDeposits',
    'CustomerDocuments',
    'ServiceRequests',
    'Meters',
    'MeterAssignments',
    'BillingPeriods',
    'MeterReadings',
    'Invoices',
    'Payments',
    'Accounting',
    'AccountingAccounts',
    'Suppliers',
    'Payroll',
    'HrSummary',
    'Employees',
    'HrStructure',
    'Attendance',
    'LeaveRequests',
    'SalaryAdvances',
    'EmployeeAdjustments',
    'PerformanceReviews',
    'HrReports',
    'LeavePolicies',
    'WorkSchedules',
    'PayrollDeductions',
    'EmployeeTerminations',
    'BiometricImports',
    'PayrollReports',
    'Shareholders',
    'ShareholderDistributions',
    'Reconciliations',
    'FinancialClosings',
    'FinancialReports',
    'OperationalReports',
    'Departments',
    'Goods',
    'Assets',
    'AssetPurchases',
    'AssetMaintenance',
    'Warehouses',
    'InventoryItems',
    'InventoryTransactions',
    'InventoryIssues',
    'InventoryRequests',
  ],
  endpoints: (builder) => ({
    getMe: builder.query<AuthUser, void>({
      query: () => '/auth/me',
      transformResponse: (response: AuthUserResponse) => response.user,
      providesTags: ['Profile'],
    }),
    getNotifications: builder.query<AppNotification[], void>({
      query: () => '/notifications',
      transformResponse: (response: DataResponse<AppNotification[]> & { unread_count: number }) => response.data,
      providesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation<AppNotification, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'POST' }),
      transformResponse: (response: DataResponse<AppNotification>) => response.data,
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: builder.mutation<{ message: string }, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),
    updateProfile: builder.mutation<ProfileUpdateResponse, Record<string, unknown>>({
      query: (body) => ({ url: '/auth/profile', method: 'PUT', body }),
      invalidatesTags: ['Profile', 'Users'],
    }),
    getDashboardStats: builder.query<DashboardStats, void>({
      query: () => '/dashboard/stats',
      transformResponse: (response: DataResponse<DashboardStats>) => response.data,
      providesTags: ['Dashboard'],
    }),
    getUsers: builder.query<User[], void>({
      query: () => '/users',
      transformResponse: (response: DataResponse<User[]>) => response.data,
      providesTags: ['Users'],
    }),
    createUser: builder.mutation<User, Record<string, unknown>>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['Users', 'Dashboard'],
    }),
    updateUser: builder.mutation<User, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Users', 'Dashboard'],
    }),
    deleteUser: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Users', 'Dashboard'],
    }),
    getRoles: builder.query<RolesResponse, void>({
      query: () => '/roles',
      providesTags: ['Roles'],
    }),
    createRole: builder.mutation<Role, Record<string, unknown>>({
      query: (body) => ({ url: '/roles', method: 'POST', body }),
      invalidatesTags: ['Roles'],
    }),
    updateRole: builder.mutation<Role, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/roles/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Roles'],
    }),
    deleteRole: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Roles'],
    }),
    getSettings: builder.query<SettingsResponse['data'], void>({
      query: () => '/settings',
      transformResponse: (response: SettingsResponse) => response.data,
      providesTags: ['Settings', 'PaymentMethods', 'FinancialCategories'],
    }),
    updateSystemProfile: builder.mutation<SettingsResponse, SystemProfile>({
      query: (body) => ({ url: '/settings/system-profile', method: 'PUT', body }),
      invalidatesTags: ['Settings'],
    }),
    getTrainingMode: builder.query<TrainingModeStatus, void>({
      query: () => '/training-mode',
      transformResponse: (response: TrainingModeResponse) => response.data,
      providesTags: ['TrainingMode'],
    }),
    updateTrainingMode: builder.mutation<TrainingModeStatus, { enabled: boolean; business_date: string }>({
      query: (body) => ({ url: '/settings/training-mode', method: 'PUT', body }),
      transformResponse: (response: TrainingModeResponse) => response.data,
      invalidatesTags: ['TrainingMode'],
    }),
    resetTrainingData: builder.mutation<{ message: string }, { confirmation: string; password: string }>({
      query: (body) => ({ url: '/settings/training-mode/reset', method: 'POST', body }),
      invalidatesTags: ['TrainingMode', 'Dashboard'],
    }),
    startTrainingDataReset: builder.mutation<TrainingResetProgress, { confirmation: string; password: string }>({
      query: (body) => ({ url: '/settings/training-mode/reset/start', method: 'POST', body }),
      transformResponse: (response: TrainingResetResponse) => response.data,
    }),
    advanceTrainingDataReset: builder.mutation<TrainingResetProgress, string>({
      query: (operationId) => ({ url: `/settings/training-mode/reset/${operationId}/advance`, method: 'POST' }),
      transformResponse: (response: TrainingResetResponse) => response.data,
    }),
    getLeaveSettings: builder.query<LeaveSettings, void>({
      query: () => '/settings/leave',
      transformResponse: (response: DataResponse<LeaveSettings>) => response.data,
      providesTags: ['LeavePolicies'],
    }),
    updateLeaveSettings: builder.mutation<LeaveSettings, LeaveSettings>({
      query: (body) => ({ url: '/settings/leave', method: 'PUT', body }),
      transformResponse: (response: DataResponse<LeaveSettings>) => response.data,
      invalidatesTags: ['LeavePolicies', 'LeaveRequests', 'Employees'],
    }),
    createPaymentMethod: builder.mutation<PaymentMethod, Partial<PaymentMethod>>({
      query: (body) => ({ url: '/payment-methods', method: 'POST', body }),
      invalidatesTags: ['PaymentMethods', 'Settings'],
    }),
    getPaymentMethods: builder.query<PaymentMethod[], void>({
      query: () => '/payment-methods',
      transformResponse: (response: DataResponse<PaymentMethod[]>) => response.data,
      providesTags: ['PaymentMethods'],
    }),
    updatePaymentMethod: builder.mutation<PaymentMethod, { id: number; body: Partial<PaymentMethod> }>({
      query: ({ id, body }) => ({ url: `/payment-methods/${id}`, method: 'PUT', body }),
      invalidatesTags: ['PaymentMethods', 'Settings'],
    }),
    deletePaymentMethod: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/payment-methods/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PaymentMethods', 'Settings'],
    }),
    createFinancialCategory: builder.mutation<FinancialCategory, Partial<FinancialCategory>>({
      query: (body) => ({ url: '/financial-categories', method: 'POST', body }),
      invalidatesTags: ['FinancialCategories', 'Settings'],
    }),
    getFinancialCategories: builder.query<FinancialCategory[], { type?: 'income' | 'expense' } | void>({
      query: (params) => ({ url: '/financial-categories', params: params || undefined }),
      transformResponse: (response: DataResponse<FinancialCategory[]>) => response.data,
      providesTags: ['FinancialCategories'],
    }),
    updateFinancialCategory: builder.mutation<FinancialCategory, { id: number; body: Partial<FinancialCategory> }>({
      query: ({ id, body }) => ({ url: `/financial-categories/${id}`, method: 'PUT', body }),
      invalidatesTags: ['FinancialCategories', 'Settings'],
    }),
    deleteFinancialCategory: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/financial-categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['FinancialCategories', 'Settings'],
    }),
    createCustomerChargeType: builder.mutation<CustomerChargeType, Partial<CustomerChargeType>>({
      query: (body) => ({ url: '/customer-charge-types', method: 'POST', body }),
      transformResponse: (response: DataResponse<CustomerChargeType>) => response.data,
      invalidatesTags: ['CustomerChargeTypes', 'Settings'],
    }),
    updateCustomerChargeType: builder.mutation<CustomerChargeType, { id: number; body: Partial<CustomerChargeType> }>({
      query: ({ id, body }) => ({ url: `/customer-charge-types/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<CustomerChargeType>) => response.data,
      invalidatesTags: ['CustomerChargeTypes', 'Settings', 'CustomerDetail'],
    }),
    deleteCustomerChargeType: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/customer-charge-types/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CustomerChargeTypes', 'Settings'],
    }),
    getAuthorities: builder.query<Authority[], void>({
      query: () => '/authorities',
      transformResponse: (response: DataResponse<Authority[]>) => response.data,
      providesTags: ['Authorities'],
    }),
    getAuthorityOptions: builder.query<Authority[], void>({
      query: () => '/authorities/options',
      transformResponse: (response: DataResponse<Authority[]>) => response.data,
      providesTags: ['Authorities'],
    }),
    createAuthority: builder.mutation<Authority, Partial<Authority>>({
      query: (body) => ({ url: '/authorities', method: 'POST', body }),
      transformResponse: (response: DataResponse<Authority>) => response.data,
      invalidatesTags: ['Authorities'],
    }),
    updateAuthority: builder.mutation<Authority, { id: number; body: Partial<Authority> }>({
      query: ({ id, body }) => ({ url: `/authorities/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Authority>) => response.data,
      invalidatesTags: ['Authorities', 'CustomerContracts', 'CustomerDetail'],
    }),
    deleteAuthority: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/authorities/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Authorities'],
    }),
    getServiceAreas: builder.query<ServiceArea[], void>({
      query: () => '/service-areas',
      transformResponse: (response: DataResponse<ServiceArea[]>) => response.data,
      providesTags: ['ServiceAreas'],
    }),
    createServiceArea: builder.mutation<ServiceArea, Partial<ServiceArea>>({
      query: (body) => ({ url: '/service-areas', method: 'POST', body }),
      transformResponse: (response: DataResponse<ServiceArea>) => response.data,
      invalidatesTags: ['ServiceAreas', 'Dashboard'],
    }),
    updateServiceArea: builder.mutation<ServiceArea, { id: number; body: Partial<ServiceArea> }>({
      query: ({ id, body }) => ({ url: `/service-areas/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<ServiceArea>) => response.data,
      invalidatesTags: ['ServiceAreas', 'Dashboard'],
    }),
    deleteServiceArea: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/service-areas/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ServiceAreas', 'Dashboard'],
    }),
    getCustomers: builder.query<Customer[], void>({
      query: () => '/customers',
      transformResponse: (response: DataResponse<Customer[]>) => response.data,
      providesTags: ['Customers'],
    }),
    getCustomerCollectionOptions: builder.query<CustomerCollectionOptions, void>({
      query: () => '/customers/collection-options',
      transformResponse: (response: DataResponse<CustomerCollectionOptions>) => response.data,
      providesTags: ['PaymentMethods', 'AccountingAccounts'],
    }),
    getCustomerDetail: builder.query<CustomerDetail, number>({
      query: (id) => `/customers/${id}/detail`,
      transformResponse: (response: DataResponse<CustomerDetail>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'CustomerDetail', id }],
    }),
    getCustomerContracts: builder.query<CustomerContract[], { status?: string; customerId?: number } | void>({
      query: (filters) => ({ url: '/customer-contracts', params: filters ? { status: filters.status, customer_id: filters.customerId } : undefined }),
      transformResponse: (response: DataResponse<CustomerContract[]>) => response.data,
      providesTags: ['CustomerContracts'],
    }),
    createCustomerContract: builder.mutation<CustomerContract, { customerId: number; body: Partial<CustomerContract> }>({
      query: ({ customerId, body }) => ({ url: `/customers/${customerId}/contracts`, method: 'POST', body }),
      transformResponse: (response: DataResponse<CustomerContract>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => ['Customers', 'CustomerContracts', { type: 'CustomerDetail', id: customerId }],
    }),
    updateCustomerContract: builder.mutation<CustomerContract, { id: number; customerId: number; body: Partial<CustomerContract> }>({
      query: ({ id, body }) => ({ url: `/customer-contracts/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<CustomerContract>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => ['Customers', 'CustomerContracts', { type: 'CustomerDetail', id: customerId }],
    }),
    markCustomerContractPrinted: builder.mutation<CustomerContract, { id: number; customerId: number }>({
      query: ({ id }) => ({ url: `/customer-contracts/${id}/printed`, method: 'POST' }),
      transformResponse: (response: DataResponse<CustomerContract>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => ['Customers', 'CustomerContracts', { type: 'CustomerDetail', id: customerId }],
    }),
    confirmCustomerContract: builder.mutation<CustomerContract, { id: number; customerId: number }>({
      query: ({ id }) => ({ url: `/customer-contracts/${id}/confirm`, method: 'POST' }),
      transformResponse: (response: DataResponse<CustomerContract>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => ['Customers', 'CustomerContracts', 'Invoices', 'Dashboard', 'Notifications', { type: 'CustomerDetail', id: customerId }],
    }),
    getContractCancellationPreview: builder.query<ContractCancellationPreview, number>({
      query: (id) => `/customer-contracts/${id}/cancellation-preview`,
      transformResponse: (response: DataResponse<ContractCancellationPreview>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'CustomerContracts', id }],
    }),
    cancelCustomerContract: builder.mutation<ContractCancellationRequest, {
      id: number
      customerId: number
      reason: string
      materialsReceivedConfirmed?: boolean
      refundPostedPayments?: boolean
      refundAccountingAccountId?: number
      refundedAt?: string
      refundReference?: string
    }>({
      query: ({ id, reason, materialsReceivedConfirmed, refundPostedPayments, refundAccountingAccountId, refundedAt, refundReference }) => ({
        url: `/customer-contracts/${id}/cancel`,
        method: 'POST',
        body: {
          reason,
          materials_received_confirmed: materialsReceivedConfirmed,
          refund_posted_payments: refundPostedPayments,
          refund_accounting_account_id: refundAccountingAccountId,
          refunded_at: refundedAt,
          refund_reference: refundReference,
        },
      }),
      transformResponse: (response: DataResponse<ContractCancellationRequest>) => response.data,
      invalidatesTags: (_result, _error, { id, customerId }) => ['Notifications', 'InventoryRequests', { type: 'CustomerContracts', id }, { type: 'CustomerDetail', id: customerId }],
    }),
    resolveContractCancellation: builder.mutation<ContractCancellationRequest, {
      id: number
      customerId: number
      contractId: number
      status: 'approved' | 'rejected'
      resolutionNotes?: string
    }>({
      query: ({ id, status, resolutionNotes }) => ({
        url: `/contract-cancellation-requests/${id}/resolve`,
        method: 'POST',
        body: { status, resolution_notes: resolutionNotes },
      }),
      transformResponse: (response: DataResponse<ContractCancellationRequest>) => response.data,
      invalidatesTags: (_result, _error, { customerId, contractId }) => [
        'Customers', 'CustomerContracts', 'CustomerDeposits', 'Invoices', 'Payments', 'Accounting',
        'AccountingAccounts', 'FinancialReports', 'InventoryRequests', 'InventoryItems',
        'InventoryTransactions', 'Warehouses', 'Meters', 'MeterAssignments', 'Notifications',
        { type: 'CustomerContracts', id: contractId }, { type: 'CustomerDetail', id: customerId },
      ],
    }),
    getCustomerDeposits: builder.query<CustomerDeposit[], { status?: string; customerId?: number } | void>({
      query: (filters) => ({ url: '/customer-deposits', params: filters ? { status: filters.status, customer_id: filters.customerId } : undefined }),
      transformResponse: (response: DataResponse<CustomerDeposit[]>) => response.data,
      providesTags: ['CustomerDeposits'],
    }),
    refundCustomerDeposit: builder.mutation<CustomerDeposit, { depositId: number; customerId: number; body: { refunded_at: string; refund_reason: string; refund_reference?: string } }>({
      query: ({ depositId, body }) => ({ url: `/customer-deposits/${depositId}/refund`, method: 'POST', body }),
      transformResponse: (response: DataResponse<CustomerDeposit>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => ['Customers', 'CustomerContracts', 'CustomerDeposits', 'Accounting', 'AccountingAccounts', { type: 'CustomerDetail', id: customerId }],
    }),
    getAssignedServiceRequests: builder.query<CustomerServiceRequest[], void>({
      query: () => '/service-requests/assigned-to-me',
      transformResponse: (response: DataResponse<CustomerServiceRequest[]>) => response.data,
      providesTags: ['ServiceRequests'],
    }),
    createCustomer: builder.mutation<Customer, Partial<Customer>>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      transformResponse: (response: DataResponse<Customer>) => response.data,
      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data: customer } = await queryFulfilled
          dispatch(waternetApi.util.updateQueryData('getCustomers', undefined, (customers) => {
            if (!customers.some((item) => item.id === customer.id)) customers.unshift(customer)
          }))
        } catch {
          // The form displays the API validation error.
        }
      },
      invalidatesTags: ['Customers', 'Dashboard'],
    }),
    updateCustomer: builder.mutation<Customer, { id: number; body: Partial<Customer> }>({
      query: ({ id, body }) => ({ url: `/customers/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Customer>) => response.data,
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data: customer } = await queryFulfilled
          dispatch(waternetApi.util.updateQueryData('getCustomers', undefined, (customers) => {
            const current = customers.find((item) => item.id === id)
            if (current) Object.assign(current, customer)
          }))
        } catch {
          // The form displays the API validation error.
        }
      },
      invalidatesTags: (_result, _error, { id }) => ['Customers', 'Dashboard', { type: 'CustomerDetail', id }],
    }),
    uploadCustomerPhoto: builder.mutation<Customer, { customerId: number; photo: File }>({
      query: ({ customerId, photo }) => {
        const body = new FormData()
        body.append('photo', photo)

        return { url: `/customers/${customerId}/photo`, method: 'POST', body }
      },
      transformResponse: (response: DataResponse<Customer>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => [
        'Customers',
        { type: 'CustomerDetail', id: customerId },
      ],
    }),
    deleteCustomerPhoto: builder.mutation<Customer, number>({
      query: (customerId) => ({ url: `/customers/${customerId}/photo`, method: 'DELETE' }),
      transformResponse: (response: DataResponse<Customer>) => response.data,
      invalidatesTags: (_result, _error, customerId) => [
        'Customers',
        { type: 'CustomerDetail', id: customerId },
      ],
    }),
    markCustomerAgreementPrinted: builder.mutation<Customer, number>({
      query: (id) => ({ url: `/customers/${id}/agreement/printed`, method: 'POST' }),
      transformResponse: (response: DataResponse<Customer>) => response.data,
      invalidatesTags: ['Customers'],
    }),
    createCustomerCharge: builder.mutation<CustomerCharge, { customerId: number; body: Partial<CustomerCharge> }>({
      query: ({ customerId, body }) => ({ url: `/customers/${customerId}/charges`, method: 'POST', body }),
      transformResponse: (response: DataResponse<CustomerCharge>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => [
        'Customers',
        'Settings',
        'CustomerChargeTypes',
        'Invoices',
        'Payments',
        'Dashboard',
        { type: 'CustomerDetail', id: customerId },
      ],
    }),
    cancelCustomerCharge: builder.mutation<CustomerCharge, { customerId: number; chargeId: number }>({
      query: ({ customerId, chargeId }) => ({ url: `/customers/${customerId}/charges/${chargeId}/cancel`, method: 'POST' }),
      transformResponse: (response: DataResponse<CustomerCharge>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => [
        'Customers',
        'Invoices',
        'Payments',
        'Dashboard',
        { type: 'CustomerDetail', id: customerId },
      ],
    }),
    createCustomerServiceRequest: builder.mutation<CustomerServiceRequest, { customerId: number; body: Partial<CustomerServiceRequest> }>({
      query: ({ customerId, body }) => ({ url: `/customers/${customerId}/service-requests`, method: 'POST', body }),
      transformResponse: (response: DataResponse<CustomerServiceRequest>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => ['ServiceRequests', { type: 'CustomerDetail', id: customerId }],
    }),
    updateCustomerServiceRequest: builder.mutation<CustomerServiceRequest, { customerId: number; requestId: number; body: Partial<CustomerServiceRequest> }>({
      query: ({ customerId, requestId, body }) => ({ url: `/customers/${customerId}/service-requests/${requestId}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<CustomerServiceRequest>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => ['ServiceRequests', { type: 'CustomerDetail', id: customerId }],
    }),
    createCustomerConnectionEvent: builder.mutation<CustomerConnectionEvent, { customerId: number; body: Partial<CustomerConnectionEvent> }>({
      query: ({ customerId, body }) => ({ url: `/customers/${customerId}/connection-events`, method: 'POST', body }),
      transformResponse: (response: DataResponse<CustomerConnectionEvent>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => [
        'Customers',
        'Invoices',
        'Payments',
        'Dashboard',
        { type: 'CustomerDetail', id: customerId },
      ],
    }),
    deleteCustomer: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Customers', 'CustomerDocuments', 'Dashboard'],
    }),
    getCustomerDocuments: builder.query<CustomerDocument[], number>({
      query: (customerId) => `/customers/${customerId}/documents`,
      transformResponse: (response: DataResponse<CustomerDocument[]>) => response.data,
      providesTags: (_result, _error, customerId) => [{ type: 'CustomerDocuments', id: customerId }],
    }),
    uploadCustomerDocuments: builder.mutation<CustomerDocument[], { customerId: number; files: File[]; documentType?: string; notes?: string }>({
      query: ({ customerId, files, documentType, notes }) => {
        const body = new FormData()
        files.forEach((file) => body.append('documents[]', file))
        if (documentType) body.append('document_type', documentType)
        if (notes) body.append('notes', notes)

        return { url: `/customers/${customerId}/documents`, method: 'POST', body }
      },
      transformResponse: (response: DataResponse<CustomerDocument[]>) => response.data,
      invalidatesTags: (_result, _error, { customerId }) => [
        { type: 'CustomerDocuments', id: customerId },
        'Customers',
      ],
    }),
    deleteCustomerDocument: builder.mutation<{ message: string }, { customerId: number; documentId: number }>({
      query: ({ documentId }) => ({ url: `/customer-documents/${documentId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { customerId }) => [
        { type: 'CustomerDocuments', id: customerId },
        'Customers',
      ],
    }),
    getMeters: builder.query<Meter[], void>({
      query: () => '/meters',
      transformResponse: (response: DataResponse<Meter[]>) => response.data,
      providesTags: ['Meters'],
    }),
    createMeter: builder.mutation<Meter, MeterOpeningPayload>({
      query: (body) => ({ url: '/meters', method: 'POST', body }),
      invalidatesTags: ['Meters', 'InventoryItems', 'InventoryTransactions', 'Warehouses', 'Dashboard'],
    }),
    updateMeter: builder.mutation<Meter, { id: number; body: Partial<Meter> }>({
      query: ({ id, body }) => ({ url: `/meters/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Meters', 'Dashboard'],
    }),
    returnMeterToStock: builder.mutation<Meter, { id: number; warehouse_id: number; returned_at: string; notes: string }>({
      query: ({ id, ...body }) => ({ url: `/meters/${id}/return-to-stock`, method: 'POST', body }),
      transformResponse: (response: DataResponse<Meter>) => response.data,
      invalidatesTags: ['Meters', 'InventoryItems', 'InventoryTransactions', 'Warehouses', 'Dashboard'],
    }),
    deleteMeter: builder.mutation<{ message: string }, { id: number; reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/meters/${id}`, method: 'DELETE', body }),
      invalidatesTags: ['Meters', 'InventoryItems', 'InventoryTransactions', 'Warehouses', 'Dashboard'],
    }),
    getMeterAssignments: builder.query<MeterAssignment[], void>({
      query: () => '/meter-assignments',
      transformResponse: (response: DataResponse<MeterAssignment[]>) => response.data,
      providesTags: ['MeterAssignments'],
    }),
    getMeterAssigners: builder.query<MeterAssigner[], void>({
      query: () => '/meter-assignments/assigners',
      transformResponse: (response: DataResponse<MeterAssigner[]>) => response.data,
      providesTags: ['Employees'],
    }),
    createMeterAssignment: builder.mutation<MeterAssignment, Partial<MeterAssignment> | FormData>({
      query: (body) => ({ url: '/meter-assignments', method: 'POST', body }),
      transformResponse: (response: DataResponse<MeterAssignment>) => response.data,
      invalidatesTags: ['MeterAssignments', 'Meters', 'InventoryItems', 'InventoryTransactions', 'Warehouses', 'Customers', 'CustomerContracts', 'CustomerDeposits', 'CustomerDetail', 'Invoices', 'Payments', 'Accounting', 'AccountingAccounts', 'Dashboard'],
    }),
    updateMeterAssignment: builder.mutation<MeterAssignment, { id: number; body: Partial<MeterAssignment> }>({
      query: ({ id, body }) => ({ url: `/meter-assignments/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<MeterAssignment>) => response.data,
      invalidatesTags: ['MeterAssignments', 'Meters', 'Customers', 'CustomerDetail', 'Dashboard'],
    }),
    resealMeterAssignment: builder.mutation<MeterAssignment, { id: number; body: FormData }>({
      query: ({ id, body }) => ({ url: `/meter-assignments/${id}/seals`, method: 'POST', body }),
      transformResponse: (response: DataResponse<MeterAssignment>) => response.data,
      invalidatesTags: ['MeterAssignments', 'Customers', 'CustomerDetail', 'Dashboard'],
    }),
    deleteMeterAssignment: builder.mutation<{ message: string }, { id: number; disposition?: 'return_to_stock' | 'repair' | 'scrap'; return_warehouse_id?: number; reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/meter-assignments/${id}`, method: 'DELETE', body }),
      invalidatesTags: ['MeterAssignments', 'Meters', 'InventoryItems', 'InventoryTransactions', 'Warehouses', 'Customers', 'CustomerDetail', 'Dashboard'],
    }),
    getBillingPeriods: builder.query<BillingPeriod[], void>({
      query: () => '/billing-periods',
      transformResponse: (response: DataResponse<BillingPeriod[]>) => response.data,
      providesTags: ['BillingPeriods'],
    }),
    createBillingPeriod: builder.mutation<BillingPeriod, Partial<BillingPeriod>>({
      query: (body) => ({ url: '/billing-periods', method: 'POST', body }),
      transformResponse: (response: DataResponse<BillingPeriod>) => response.data,
      invalidatesTags: ['BillingPeriods', 'Dashboard'],
    }),
    updateBillingPeriod: builder.mutation<BillingPeriod, { id: number; body: Partial<BillingPeriod> }>({
      query: ({ id, body }) => ({ url: `/billing-periods/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<BillingPeriod>) => response.data,
      invalidatesTags: ['BillingPeriods', 'Dashboard'],
    }),
    deleteBillingPeriod: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/billing-periods/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BillingPeriods', 'Dashboard'],
    }),
    getMeterReadings: builder.query<MeterReading[], void>({
      query: () => '/meter-readings',
      transformResponse: (response: DataResponse<MeterReading[]>) => response.data,
      providesTags: ['MeterReadings'],
    }),
    createMeterReading: builder.mutation<MeterReading, Record<string, unknown>>({
      query: (body) => ({ url: '/meter-readings', method: 'POST', body }),
      invalidatesTags: ['MeterReadings', 'Invoices', 'Customers', 'Dashboard'],
    }),
    deleteMeterReading: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/meter-readings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['MeterReadings', 'Invoices', 'Customers', 'Dashboard'],
    }),
    getInvoices: builder.query<Invoice[], void>({
      query: () => '/invoices',
      transformResponse: (response: DataResponse<Invoice[]>) => response.data,
      providesTags: ['Invoices'],
    }),
    getInvoice: builder.query<Invoice, number>({
      query: (id) => `/invoices/${id}`,
      transformResponse: (response: DataResponse<Invoice>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Invoices', id }],
    }),
    getPayments: builder.query<Payment[], void>({
      query: () => '/payments',
      transformResponse: (response: DataResponse<Payment[]>) => response.data,
      providesTags: ['Payments'],
    }),
    getPaymentReceivingAccounts: builder.query<AccountingAccount[], void>({
      query: () => '/payments/receiving-accounts',
      transformResponse: (response: DataResponse<AccountingAccount[]>) => response.data,
      providesTags: ['AccountingAccounts'],
    }),
    createPayment: builder.mutation<Payment, Record<string, unknown>>({
      query: (body) => ({ url: '/payments', method: 'POST', body }),
      invalidatesTags: (_result, _error, body) => [
        'Payments',
        'Invoices',
        'Customers',
        'Dashboard',
        'Accounting',
        'AccountingAccounts',
        'InventoryRequests',
        { type: 'CustomerDetail', id: Number(body.customer_id) },
      ],
    }),
    updatePayment: builder.mutation<Payment, { id: number; body: Pick<Payment, 'status'> & { notes?: string } }>({
      query: ({ id, body }) => ({ url: `/payments/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Payments', 'Invoices', 'Customers', 'CustomerDetail', 'Dashboard', 'Accounting', 'AccountingAccounts'],
    }),
    getAccountingSummary: builder.query<AccountingSummary, void>({
      query: () => '/accounting/summary',
      transformResponse: (response: DataResponse<AccountingSummary>) => response.data,
      providesTags: ['Accounting', 'AccountingAccounts'],
    }),
    getAccountingAccounts: builder.query<AccountingAccount[], void>({
      query: () => '/accounting/accounts',
      transformResponse: (response: DataResponse<AccountingAccount[]>) => response.data,
      providesTags: ['AccountingAccounts'],
    }),
    createAccountingAccount: builder.mutation<AccountingAccount, Partial<AccountingAccount>>({
      query: (body) => ({ url: '/accounting/accounts', method: 'POST', body }),
      transformResponse: (response: DataResponse<AccountingAccount>) => response.data,
      invalidatesTags: ['AccountingAccounts', 'Accounting'],
    }),
    updateAccountingAccount: builder.mutation<AccountingAccount, { id: number; body: Partial<AccountingAccount> }>({
      query: ({ id, body }) => ({ url: `/accounting/accounts/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<AccountingAccount>) => response.data,
      invalidatesTags: ['AccountingAccounts', 'Accounting'],
    }),
    deleteAccountingAccount: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/accounting/accounts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AccountingAccounts', 'Accounting'],
    }),
    getAccountingTransactions: builder.query<AccountingTransaction[], { status?: string; type?: string; account_id?: number; from?: string; to?: string } | void>({
      query: (params) => ({ url: '/accounting/transactions', params: params || undefined }),
      transformResponse: (response: DataResponse<AccountingTransaction[]>) => response.data,
      providesTags: ['Accounting'],
    }),
    getExpenses: builder.query<PaginatedResponse<AccountingTransaction>, { page?: number; per_page?: number; status?: string; account_id?: number; from?: string; to?: string; search?: string } | void>({
      query: (params) => ({ url: '/accounting/expenses', params: params || undefined }),
      providesTags: ['Accounting'],
    }),
    createAccountingTransaction: builder.mutation<AccountingTransaction, Partial<AccountingTransaction> | FormData>({
      query: (body) => ({ url: '/accounting/transactions', method: 'POST', body }),
      transformResponse: (response: DataResponse<AccountingTransaction>) => response.data,
      invalidatesTags: ['Accounting', 'FinancialReports'],
    }),
    updateAccountingTransaction: builder.mutation<AccountingTransaction, { id: number; body: Partial<AccountingTransaction> | FormData }>({
      query: ({ id, body }) => ({ url: `/accounting/transactions/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<AccountingTransaction>) => response.data,
      invalidatesTags: ['Accounting', 'FinancialReports'],
    }),
    deleteAccountingTransaction: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/accounting/transactions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Accounting', 'FinancialReports'],
    }),
    reviewAccountingTransaction: builder.mutation<AccountingTransaction, number>({
      query: (id) => ({ url: `/accounting/transactions/${id}/review`, method: 'POST' }),
      transformResponse: (response: DataResponse<AccountingTransaction>) => response.data,
      invalidatesTags: ['Accounting', 'AssetPurchases', 'ShareholderDistributions'],
    }),
    approveAccountingTransaction: builder.mutation<AccountingTransaction, number>({
      query: (id) => ({ url: `/accounting/transactions/${id}/approve`, method: 'POST' }),
      transformResponse: (response: DataResponse<AccountingTransaction>) => response.data,
      invalidatesTags: ['Accounting', 'AccountingAccounts', 'AssetPurchases', 'Assets', 'Shareholders', 'ShareholderDistributions', 'FinancialReports'],
    }),
    rejectAccountingTransaction: builder.mutation<AccountingTransaction, { id: number; rejectionReason: string }>({
      query: ({ id, rejectionReason }) => ({
        url: `/accounting/transactions/${id}/reject`,
        method: 'POST',
        body: { rejection_reason: rejectionReason },
      }),
      transformResponse: (response: DataResponse<AccountingTransaction>) => response.data,
      invalidatesTags: ['Accounting', 'AssetPurchases', 'ShareholderDistributions'],
    }),
    cancelAccountingTransaction: builder.mutation<AccountingTransaction, number | { id: number; reversalReason?: string }>({
      query: (input) => {
        const id = typeof input === 'number' ? input : input.id
        const reversalReason = typeof input === 'number' ? undefined : input.reversalReason
        return {
          url: `/accounting/transactions/${id}/cancel`,
          method: 'POST',
          body: reversalReason ? { reversal_reason: reversalReason } : undefined,
        }
      },
      transformResponse: (response: DataResponse<AccountingTransaction>) => response.data,
      invalidatesTags: ['Accounting', 'AccountingAccounts', 'AssetPurchases', 'Assets'],
    }),
    getHrSummary: builder.query<HrSummary, void>({
      query: () => '/hr/summary',
      transformResponse: (response: DataResponse<HrSummary>) => response.data,
      providesTags: ['HrSummary'],
    }),
    getHrReport: builder.query<HrReport, { from: string; to: string }>({
      query: (params) => ({ url: '/hr/reports', params }),
      transformResponse: (response: DataResponse<HrReport>) => response.data,
      providesTags: ['HrReports'],
    }),
    getEmployees: builder.query<Employee[], { status?: string; department_id?: number } | void>({
      query: (params) => ({ url: '/employees', params: params || undefined }),
      transformResponse: (response: DataResponse<Employee[]>) => response.data,
      providesTags: ['Employees'],
    }),
    getEmployee: builder.query<Employee, number>({
      query: (id) => `/employees/${id}`,
      transformResponse: (response: DataResponse<Employee>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Employees', id }],
    }),
    getMyEmployeeProfile: builder.query<Employee | null, void>({
      query: () => '/employees/me',
      transformResponse: (response: DataResponse<Employee | null>) => response.data,
      providesTags: ['Employees'],
    }),
    createEmployee: builder.mutation<Employee, Record<string, unknown>>({
      query: (body) => ({ url: '/employees', method: 'POST', body }),
      transformResponse: (response: DataResponse<Employee>) => response.data,
      invalidatesTags: ['Employees', 'HrSummary', 'HrReports', 'Users', 'Dashboard'],
    }),
    updateEmployee: builder.mutation<Employee, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/employees/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Employee>) => response.data,
      invalidatesTags: (_result, _error, { id }) => ['Employees', 'HrSummary', 'HrReports', 'Users', { type: 'Employees', id }],
    }),
    deleteEmployee: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/employees/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Employees', 'HrSummary', 'HrReports', 'Users', 'Dashboard'],
    }),
    getHrStructure: builder.query<HrStructure, void>({
      query: () => '/hr/structure',
      transformResponse: (response: DataResponse<HrStructure>) => response.data,
      providesTags: ['HrStructure'],
    }),
    createDepartment: builder.mutation<Department, Partial<Department>>({
      query: (body) => ({ url: '/hr/departments', method: 'POST', body }),
      transformResponse: (response: DataResponse<Department>) => response.data,
      invalidatesTags: ['HrStructure'],
    }),
    updateDepartment: builder.mutation<Department, { id: number; body: Partial<Department> }>({
      query: ({ id, body }) => ({ url: `/hr/departments/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Department>) => response.data,
      invalidatesTags: ['HrStructure', 'Employees', 'HrReports'],
    }),
    deleteDepartment: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/hr/departments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['HrStructure'],
    }),
    createJobPosition: builder.mutation<JobPosition, Partial<JobPosition>>({
      query: (body) => ({ url: '/hr/positions', method: 'POST', body }),
      transformResponse: (response: DataResponse<JobPosition>) => response.data,
      invalidatesTags: ['HrStructure'],
    }),
    updateJobPosition: builder.mutation<JobPosition, { id: number; body: Partial<JobPosition> }>({
      query: ({ id, body }) => ({ url: `/hr/positions/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<JobPosition>) => response.data,
      invalidatesTags: ['HrStructure', 'Employees', 'HrReports'],
    }),
    deleteJobPosition: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/hr/positions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['HrStructure'],
    }),
    uploadEmployeeDocuments: builder.mutation<EmployeeDocument[], { employeeId: number; body: FormData }>({
      query: ({ employeeId, body }) => ({ url: `/employees/${employeeId}/documents`, method: 'POST', body }),
      transformResponse: (response: DataResponse<EmployeeDocument[]>) => response.data,
      invalidatesTags: (_result, _error, { employeeId }) => ['Employees', { type: 'Employees', id: employeeId }],
    }),
    deleteEmployeeDocument: builder.mutation<{ message: string }, { id: number; employeeId: number }>({
      query: ({ id }) => ({ url: `/employee-documents/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { employeeId }) => ['Employees', { type: 'Employees', id: employeeId }],
    }),
    getAttendanceRecords: builder.query<AttendanceRecord[], { employee_id?: number; from?: string; to?: string; approval_status?: string } | void>({
      query: (params) => ({ url: '/attendance', params: params || undefined }),
      transformResponse: (response: DataResponse<AttendanceRecord[]>) => response.data,
      providesTags: ['Attendance'],
    }),
    createAttendanceRecord: builder.mutation<AttendanceRecord, Record<string, unknown>>({
      query: (body) => ({ url: '/attendance', method: 'POST', body }),
      transformResponse: (response: DataResponse<AttendanceRecord>) => response.data,
      invalidatesTags: ['Attendance', 'HrSummary', 'Payroll', 'HrReports'],
    }),
    updateAttendanceRecord: builder.mutation<AttendanceRecord, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/attendance/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<AttendanceRecord>) => response.data,
      invalidatesTags: ['Attendance', 'HrSummary', 'Payroll', 'HrReports'],
    }),
    deleteAttendanceRecord: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/attendance/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Attendance', 'HrSummary', 'Payroll', 'HrReports'],
    }),
    checkInAttendance: builder.mutation<AttendanceRecord, void>({
      query: () => ({ url: '/attendance/check-in', method: 'POST' }),
      transformResponse: (response: DataResponse<AttendanceRecord>) => response.data,
      invalidatesTags: ['Attendance', 'HrSummary'],
    }),
    checkOutAttendance: builder.mutation<AttendanceRecord, void>({
      query: () => ({ url: '/attendance/check-out', method: 'POST' }),
      transformResponse: (response: DataResponse<AttendanceRecord>) => response.data,
      invalidatesTags: ['Attendance', 'HrSummary'],
    }),
    resolveAttendanceRecord: builder.mutation<AttendanceRecord, { id: number; action: 'approve' | 'reject'; rejection_reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/attendance/${id}/resolve`, method: 'POST', body }),
      transformResponse: (response: DataResponse<AttendanceRecord>) => response.data,
      invalidatesTags: ['Attendance', 'HrSummary', 'Payroll', 'HrReports'],
    }),
    getLeaveRequests: builder.query<LeaveRequest[], { employee_id?: number; status?: string } | void>({
      query: (params) => ({ url: '/leave-requests', params: params || undefined }),
      transformResponse: (response: DataResponse<LeaveRequest[]>) => response.data,
      providesTags: ['LeaveRequests'],
    }),
    createLeaveRequest: builder.mutation<LeaveRequest, Record<string, unknown> | FormData>({
      query: (body) => ({ url: '/leave-requests', method: 'POST', body }),
      transformResponse: (response: DataResponse<LeaveRequest>) => response.data,
      invalidatesTags: ['LeaveRequests', 'LeavePolicies', 'Employees', 'HrSummary', 'Notifications'],
    }),
    updateLeaveRequest: builder.mutation<LeaveRequest, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/leave-requests/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<LeaveRequest>) => response.data,
      invalidatesTags: ['LeaveRequests', 'LeavePolicies', 'Employees', 'HrSummary'],
    }),
    resolveLeaveRequest: builder.mutation<LeaveRequest, { id: number; action: 'approve' | 'reject'; rejection_reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/leave-requests/${id}/resolve`, method: 'POST', body }),
      transformResponse: (response: DataResponse<LeaveRequest>) => response.data,
      invalidatesTags: ['LeaveRequests', 'LeavePolicies', 'Employees', 'Attendance', 'HrSummary', 'Payroll', 'HrReports', 'Notifications'],
    }),
    cancelLeaveRequest: builder.mutation<LeaveRequest, number>({
      query: (id) => ({ url: `/leave-requests/${id}/cancel`, method: 'POST' }),
      transformResponse: (response: DataResponse<LeaveRequest>) => response.data,
      invalidatesTags: ['LeaveRequests', 'LeavePolicies', 'Employees', 'Attendance', 'HrSummary', 'Payroll', 'HrReports'],
    }),
    getLeavePolicies: builder.query<LeavePolicyData, { year?: number; employee_id?: number } | void>({
      query: (params) => ({ url: '/leave-policies', params: params || undefined }),
      transformResponse: (response: DataResponse<LeavePolicyData>) => response.data,
      providesTags: ['LeavePolicies'],
    }),
    createLeavePolicy: builder.mutation<LeavePolicy, Partial<LeavePolicy>>({
      query: (body) => ({ url: '/leave-policies', method: 'POST', body }),
      transformResponse: (response: DataResponse<LeavePolicy>) => response.data,
      invalidatesTags: ['LeavePolicies'],
    }),
    updateLeavePolicy: builder.mutation<LeavePolicy, { id: number; body: Partial<LeavePolicy> }>({
      query: ({ id, body }) => ({ url: `/leave-policies/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<LeavePolicy>) => response.data,
      invalidatesTags: ['LeavePolicies', 'LeaveRequests', 'Employees'],
    }),
    deleteLeavePolicy: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/leave-policies/${id}`, method: 'DELETE' }),
      invalidatesTags: ['LeavePolicies'],
    }),
    adjustLeaveBalance: builder.mutation<EmployeeLeaveBalance, Record<string, unknown>>({
      query: (body) => ({ url: '/leave-balances/adjust', method: 'POST', body }),
      transformResponse: (response: DataResponse<EmployeeLeaveBalance>) => response.data,
      invalidatesTags: ['LeavePolicies', 'LeaveRequests', 'Employees'],
    }),
    getWorkSchedules: builder.query<WorkScheduleData, void>({
      query: () => '/work-schedules',
      transformResponse: (response: DataResponse<WorkScheduleData>) => response.data,
      providesTags: ['WorkSchedules'],
    }),
    createWorkShift: builder.mutation<WorkShift, Partial<WorkShift>>({
      query: (body) => ({ url: '/work-shifts', method: 'POST', body }),
      transformResponse: (response: DataResponse<WorkShift>) => response.data,
      invalidatesTags: ['WorkSchedules'],
    }),
    updateWorkShift: builder.mutation<WorkShift, { id: number; body: Partial<WorkShift> }>({
      query: ({ id, body }) => ({ url: `/work-shifts/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<WorkShift>) => response.data,
      invalidatesTags: ['WorkSchedules', 'Attendance', 'Payroll'],
    }),
    deleteWorkShift: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/work-shifts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['WorkSchedules'],
    }),
    createShiftAssignment: builder.mutation<EmployeeShiftAssignment, Record<string, unknown>>({
      query: (body) => ({ url: '/shift-assignments', method: 'POST', body }),
      transformResponse: (response: DataResponse<EmployeeShiftAssignment>) => response.data,
      invalidatesTags: ['WorkSchedules', 'Employees', 'Attendance', 'Payroll'],
    }),
    updateShiftAssignment: builder.mutation<EmployeeShiftAssignment, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/shift-assignments/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<EmployeeShiftAssignment>) => response.data,
      invalidatesTags: ['WorkSchedules', 'Employees', 'Attendance', 'Payroll'],
    }),
    deleteShiftAssignment: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/shift-assignments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['WorkSchedules', 'Employees', 'Attendance', 'Payroll'],
    }),
    createPublicHoliday: builder.mutation<PublicHoliday, Partial<PublicHoliday>>({
      query: (body) => ({ url: '/public-holidays', method: 'POST', body }),
      transformResponse: (response: DataResponse<PublicHoliday>) => response.data,
      invalidatesTags: ['WorkSchedules', 'Attendance', 'Payroll', 'LeavePolicies'],
    }),
    updatePublicHoliday: builder.mutation<PublicHoliday, { id: number; body: Partial<PublicHoliday> }>({
      query: ({ id, body }) => ({ url: `/public-holidays/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<PublicHoliday>) => response.data,
      invalidatesTags: ['WorkSchedules', 'Attendance', 'Payroll', 'LeavePolicies'],
    }),
    deletePublicHoliday: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/public-holidays/${id}`, method: 'DELETE' }),
      invalidatesTags: ['WorkSchedules', 'Attendance', 'Payroll', 'LeavePolicies'],
    }),
    getSalaryAdvances: builder.query<SalaryAdvance[], { employee_id?: number; status?: string } | void>({
      query: (params) => ({ url: '/salary-advances', params: params || undefined }),
      transformResponse: (response: DataResponse<SalaryAdvance[]>) => response.data,
      providesTags: ['SalaryAdvances'],
    }),
    createSalaryAdvance: builder.mutation<SalaryAdvance, Record<string, unknown>>({
      query: (body) => ({ url: '/salary-advances', method: 'POST', body }),
      transformResponse: (response: DataResponse<SalaryAdvance>) => response.data,
      invalidatesTags: ['SalaryAdvances', 'Accounting', 'Notifications'],
    }),
    reviewSalaryAdvance: builder.mutation<SalaryAdvance, number>({
      query: (id) => ({ url: `/salary-advances/${id}/review`, method: 'POST' }),
      transformResponse: (response: DataResponse<SalaryAdvance>) => response.data,
      invalidatesTags: ['SalaryAdvances', 'Accounting', 'Notifications'],
    }),
    approveSalaryAdvance: builder.mutation<SalaryAdvance, number>({
      query: (id) => ({ url: `/salary-advances/${id}/approve`, method: 'POST' }),
      transformResponse: (response: DataResponse<SalaryAdvance>) => response.data,
      invalidatesTags: ['SalaryAdvances', 'Accounting', 'AccountingAccounts', 'Payroll', 'HrSummary', 'HrReports', 'Notifications'],
    }),
    rejectSalaryAdvance: builder.mutation<SalaryAdvance, { id: number; rejection_reason: string }>({
      query: ({ id, rejection_reason }) => ({ url: `/salary-advances/${id}/reject`, method: 'POST', body: { rejection_reason } }),
      transformResponse: (response: DataResponse<SalaryAdvance>) => response.data,
      invalidatesTags: ['SalaryAdvances', 'Accounting'],
    }),
    cancelSalaryAdvance: builder.mutation<SalaryAdvance, number>({
      query: (id) => ({ url: `/salary-advances/${id}/cancel`, method: 'POST' }),
      transformResponse: (response: DataResponse<SalaryAdvance>) => response.data,
      invalidatesTags: ['SalaryAdvances', 'Accounting', 'AccountingAccounts', 'Payroll', 'HrSummary', 'HrReports'],
    }),
    getEmployeeAdjustments: builder.query<EmployeeAdjustment[], { employee_id?: number; status?: string } | void>({
      query: (params) => ({ url: '/employee-adjustments', params: params || undefined }),
      transformResponse: (response: DataResponse<EmployeeAdjustment[]>) => response.data,
      providesTags: ['EmployeeAdjustments'],
    }),
    createEmployeeAdjustment: builder.mutation<EmployeeAdjustment, Record<string, unknown>>({
      query: (body) => ({ url: '/employee-adjustments', method: 'POST', body }),
      transformResponse: (response: DataResponse<EmployeeAdjustment>) => response.data,
      invalidatesTags: ['EmployeeAdjustments', 'Payroll'],
    }),
    updateEmployeeAdjustment: builder.mutation<EmployeeAdjustment, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/employee-adjustments/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<EmployeeAdjustment>) => response.data,
      invalidatesTags: ['EmployeeAdjustments', 'Payroll'],
    }),
    resolveEmployeeAdjustment: builder.mutation<EmployeeAdjustment, { id: number; action: 'approve' | 'reject'; rejection_reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/employee-adjustments/${id}/resolve`, method: 'POST', body }),
      transformResponse: (response: DataResponse<EmployeeAdjustment>) => response.data,
      invalidatesTags: ['EmployeeAdjustments', 'Payroll'],
    }),
    deleteEmployeeAdjustment: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/employee-adjustments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['EmployeeAdjustments', 'Payroll'],
    }),
    createPerformanceReview: builder.mutation<PerformanceReview, { employeeId: number; body: Record<string, unknown> }>({
      query: ({ employeeId, body }) => ({ url: `/employees/${employeeId}/performance-reviews`, method: 'POST', body }),
      transformResponse: (response: DataResponse<PerformanceReview>) => response.data,
      invalidatesTags: (_result, _error, { employeeId }) => ['PerformanceReviews', 'HrReports', { type: 'Employees', id: employeeId }],
    }),
    updatePerformanceReview: builder.mutation<PerformanceReview, { id: number; employeeId: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/performance-reviews/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<PerformanceReview>) => response.data,
      invalidatesTags: (_result, _error, { employeeId }) => ['PerformanceReviews', 'HrReports', { type: 'Employees', id: employeeId }],
    }),
    finalizePerformanceReview: builder.mutation<PerformanceReview, { id: number; employeeId: number }>({
      query: ({ id }) => ({ url: `/performance-reviews/${id}/finalize`, method: 'POST' }),
      transformResponse: (response: DataResponse<PerformanceReview>) => response.data,
      invalidatesTags: (_result, _error, { employeeId }) => ['PerformanceReviews', 'HrReports', { type: 'Employees', id: employeeId }],
    }),
    deletePerformanceReview: builder.mutation<{ message: string }, { id: number; employeeId: number }>({
      query: ({ id }) => ({ url: `/performance-reviews/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { employeeId }) => ['PerformanceReviews', 'HrReports', { type: 'Employees', id: employeeId }],
    }),
    getPayrollDeductions: builder.query<PayrollDeductionData, void>({
      query: () => '/payroll-deductions',
      transformResponse: (response: DataResponse<PayrollDeductionData>) => response.data,
      providesTags: ['PayrollDeductions'],
    }),
    createPayrollDeductionRule: builder.mutation<PayrollDeductionRule, Partial<PayrollDeductionRule>>({
      query: (body) => ({ url: '/payroll-deduction-rules', method: 'POST', body }),
      transformResponse: (response: DataResponse<PayrollDeductionRule>) => response.data,
      invalidatesTags: ['PayrollDeductions'],
    }),
    updatePayrollDeductionRule: builder.mutation<PayrollDeductionRule, { id: number; body: Partial<PayrollDeductionRule> }>({
      query: ({ id, body }) => ({ url: `/payroll-deduction-rules/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<PayrollDeductionRule>) => response.data,
      invalidatesTags: ['PayrollDeductions', 'Payroll'],
    }),
    deletePayrollDeductionRule: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/payroll-deduction-rules/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PayrollDeductions'],
    }),
    createEmployeePayrollDeduction: builder.mutation<EmployeePayrollDeduction, Record<string, unknown>>({
      query: (body) => ({ url: '/employee-payroll-deductions', method: 'POST', body }),
      transformResponse: (response: DataResponse<EmployeePayrollDeduction>) => response.data,
      invalidatesTags: ['PayrollDeductions', 'Employees', 'Payroll'],
    }),
    updateEmployeePayrollDeduction: builder.mutation<EmployeePayrollDeduction, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/employee-payroll-deductions/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<EmployeePayrollDeduction>) => response.data,
      invalidatesTags: ['PayrollDeductions', 'Employees', 'Payroll'],
    }),
    deleteEmployeePayrollDeduction: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/employee-payroll-deductions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PayrollDeductions', 'Employees', 'Payroll'],
    }),
    getEmployeeTerminations: builder.query<EmployeeTermination[], void>({
      query: () => '/employee-terminations',
      transformResponse: (response: DataResponse<EmployeeTermination[]>) => response.data,
      providesTags: ['EmployeeTerminations'],
    }),
    previewEmployeeTermination: builder.mutation<TerminationPreview, Record<string, unknown>>({
      query: (body) => ({ url: '/employee-terminations/preview', method: 'POST', body }),
      transformResponse: (response: DataResponse<TerminationPreview>) => response.data,
    }),
    createEmployeeTermination: builder.mutation<EmployeeTermination, Record<string, unknown>>({
      query: (body) => ({ url: '/employee-terminations', method: 'POST', body }),
      transformResponse: (response: DataResponse<EmployeeTermination>) => response.data,
      invalidatesTags: ['EmployeeTerminations', 'Accounting', 'Notifications'],
    }),
    reviewEmployeeTermination: builder.mutation<EmployeeTermination, number>({
      query: (id) => ({ url: `/employee-terminations/${id}/review`, method: 'POST' }),
      transformResponse: (response: DataResponse<EmployeeTermination>) => response.data,
      invalidatesTags: ['EmployeeTerminations', 'Accounting', 'Notifications'],
    }),
    approveEmployeeTermination: builder.mutation<EmployeeTermination, number>({
      query: (id) => ({ url: `/employee-terminations/${id}/approve`, method: 'POST' }),
      transformResponse: (response: DataResponse<EmployeeTermination>) => response.data,
      invalidatesTags: ['EmployeeTerminations', 'Employees', 'Payroll', 'LeavePolicies', 'Accounting', 'AccountingAccounts', 'Notifications'],
    }),
    rejectEmployeeTermination: builder.mutation<EmployeeTermination, { id: number; rejection_reason: string }>({
      query: ({ id, rejection_reason }) => ({ url: `/employee-terminations/${id}/reject`, method: 'POST', body: { rejection_reason } }),
      transformResponse: (response: DataResponse<EmployeeTermination>) => response.data,
      invalidatesTags: ['EmployeeTerminations', 'Accounting', 'Notifications'],
    }),
    cancelEmployeeTermination: builder.mutation<EmployeeTermination, number>({
      query: (id) => ({ url: `/employee-terminations/${id}/cancel`, method: 'POST' }),
      transformResponse: (response: DataResponse<EmployeeTermination>) => response.data,
      invalidatesTags: ['EmployeeTerminations', 'Employees', 'Payroll', 'LeavePolicies', 'Accounting', 'AccountingAccounts'],
    }),
    getBiometricImports: builder.query<BiometricImportBatch[], void>({
      query: () => '/biometric-imports',
      transformResponse: (response: DataResponse<BiometricImportBatch[]>) => response.data,
      providesTags: ['BiometricImports'],
    }),
    importBiometricAttendance: builder.mutation<BiometricImportBatch, FormData>({
      query: (body) => ({ url: '/biometric-imports', method: 'POST', body }),
      transformResponse: (response: DataResponse<BiometricImportBatch>) => response.data,
      invalidatesTags: ['BiometricImports', 'Attendance', 'HrSummary', 'Payroll'],
    }),
    getPayrollRuns: builder.query<PayrollRun[], void>({
      query: () => '/payroll-runs',
      transformResponse: (response: DataResponse<PayrollRun[]>) => response.data,
      providesTags: ['Payroll'],
    }),
    getPayrollEligibleEmployees: builder.query<PayrollEligibleEmployee[], { period_start: string; period_end: string }>({
      query: (params) => ({ url: '/payroll-runs/eligible-employees', params }),
      transformResponse: (response: DataResponse<PayrollEligibleEmployee[]>) => response.data,
      providesTags: ['Payroll'],
    }),
    createPayrollRun: builder.mutation<PayrollRun, Record<string, unknown>>({
      query: (body) => ({ url: '/payroll-runs', method: 'POST', body }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll'],
    }),
    generatePayrollRun: builder.mutation<PayrollRun, Record<string, unknown>>({
      query: (body) => ({ url: '/payroll-runs/generate', method: 'POST', body }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll', 'PayrollReports', 'EmployeeAdjustments', 'SalaryAdvances'],
    }),
    recalculatePayrollRun: builder.mutation<PayrollRun, number>({
      query: (id) => ({ url: `/payroll-runs/${id}/recalculate`, method: 'POST' }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll', 'PayrollReports', 'EmployeeAdjustments', 'SalaryAdvances', 'Accounting'],
    }),
    getPayrollPayslip: builder.query<PayrollItem, number>({
      query: (id) => `/payroll-items/${id}/payslip`,
      transformResponse: (response: DataResponse<PayrollItem>) => response.data,
      providesTags: ['Payroll'],
    }),
    updatePayrollRun: builder.mutation<PayrollRun, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/payroll-runs/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll'],
    }),
    deletePayrollRun: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/payroll-runs/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Payroll'],
    }),
    submitPayrollRun: builder.mutation<PayrollRun, number>({
      query: (id) => ({ url: `/payroll-runs/${id}/submit`, method: 'POST' }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll', 'Accounting'],
    }),
    reviewPayrollRun: builder.mutation<PayrollRun, number>({
      query: (id) => ({ url: `/payroll-runs/${id}/review`, method: 'POST' }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll', 'Accounting'],
    }),
    approvePayrollRun: builder.mutation<PayrollRun, number>({
      query: (id) => ({ url: `/payroll-runs/${id}/approve`, method: 'POST' }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll', 'PayrollReports', 'Accounting', 'AccountingAccounts', 'FinancialReports', 'HrSummary', 'HrReports'],
    }),
    rejectPayrollRun: builder.mutation<PayrollRun, { id: number; rejection_reason: string }>({
      query: ({ id, rejection_reason }) => ({ url: `/payroll-runs/${id}/reject`, method: 'POST', body: { rejection_reason } }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll', 'Accounting'],
    }),
    cancelPayrollRun: builder.mutation<PayrollRun, number>({
      query: (id) => ({ url: `/payroll-runs/${id}/cancel`, method: 'POST' }),
      transformResponse: (response: DataResponse<PayrollRun>) => response.data,
      invalidatesTags: ['Payroll', 'PayrollReports', 'Accounting', 'AccountingAccounts', 'FinancialReports', 'HrSummary', 'HrReports'],
    }),
    getPayrollMonthlyReport: builder.query<PayrollMonthlyReport, { from: string; to: string }>({
      query: (params) => ({ url: '/payroll-reports/monthly', params }),
      transformResponse: (response: DataResponse<PayrollMonthlyReport>) => response.data,
      providesTags: ['PayrollReports'],
    }),
    getShareholders: builder.query<{ data: Shareholder[]; ownership_total: number }, void>({
      query: () => '/shareholders',
      providesTags: ['Shareholders'],
    }),
    createShareholder: builder.mutation<Shareholder, Partial<Shareholder>>({
      query: (body) => ({ url: '/shareholders', method: 'POST', body }),
      transformResponse: (response: DataResponse<Shareholder>) => response.data,
      invalidatesTags: ['Shareholders'],
    }),
    updateShareholder: builder.mutation<Shareholder, { id: number; body: Partial<Shareholder> }>({
      query: ({ id, body }) => ({ url: `/shareholders/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Shareholder>) => response.data,
      invalidatesTags: ['Shareholders', 'ShareholderDistributions'],
    }),
    deleteShareholder: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/shareholders/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Shareholders'],
    }),
    getShareholderDistributions: builder.query<ShareholderDistribution[], void>({
      query: () => '/shareholder-distributions',
      transformResponse: (response: DataResponse<ShareholderDistribution[]>) => response.data,
      providesTags: ['ShareholderDistributions'],
    }),
    createShareholderDistribution: builder.mutation<ShareholderDistribution, Record<string, unknown>>({
      query: (body) => ({ url: '/shareholder-distributions', method: 'POST', body }),
      transformResponse: (response: DataResponse<ShareholderDistribution>) => response.data,
      invalidatesTags: ['ShareholderDistributions', 'FinancialClosings'],
    }),
    deleteShareholderDistribution: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/shareholder-distributions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ShareholderDistributions', 'FinancialClosings'],
    }),
    submitShareholderDistribution: builder.mutation<ShareholderDistribution, number>({
      query: (id) => ({ url: `/shareholder-distributions/${id}/submit`, method: 'POST' }),
      transformResponse: (response: DataResponse<ShareholderDistribution>) => response.data,
      invalidatesTags: ['ShareholderDistributions'],
    }),
    reviewShareholderDistribution: builder.mutation<ShareholderDistribution, number>({
      query: (id) => ({ url: `/shareholder-distributions/${id}/review`, method: 'POST' }),
      transformResponse: (response: DataResponse<ShareholderDistribution>) => response.data,
      invalidatesTags: ['ShareholderDistributions'],
    }),
    approveShareholderDistribution: builder.mutation<ShareholderDistribution, number>({
      query: (id) => ({ url: `/shareholder-distributions/${id}/approve`, method: 'POST' }),
      transformResponse: (response: DataResponse<ShareholderDistribution>) => response.data,
      invalidatesTags: ['ShareholderDistributions'],
    }),
    rejectShareholderDistribution: builder.mutation<ShareholderDistribution, { id: number; rejection_reason: string }>({
      query: ({ id, rejection_reason }) => ({ url: `/shareholder-distributions/${id}/reject`, method: 'POST', body: { rejection_reason } }),
      transformResponse: (response: DataResponse<ShareholderDistribution>) => response.data,
      invalidatesTags: ['ShareholderDistributions'],
    }),
    payShareholderDistribution: builder.mutation<ShareholderPayment, { itemId: number; body: Record<string, unknown> }>({
      query: ({ itemId, body }) => ({ url: `/shareholder-distribution-items/${itemId}/payments`, method: 'POST', body }),
      transformResponse: (response: DataResponse<ShareholderPayment>) => response.data,
      invalidatesTags: ['ShareholderDistributions', 'Accounting'],
    }),
    getAccountReconciliations: builder.query<AccountReconciliation[], void>({
      query: () => '/account-reconciliations',
      transformResponse: (response: DataResponse<AccountReconciliation[]>) => response.data,
      providesTags: ['Reconciliations'],
    }),
    createAccountReconciliation: builder.mutation<AccountReconciliation, Record<string, unknown>>({
      query: (body) => ({ url: '/account-reconciliations', method: 'POST', body }),
      transformResponse: (response: DataResponse<AccountReconciliation>) => response.data,
      invalidatesTags: ['Reconciliations'],
    }),
    updateAccountReconciliation: builder.mutation<AccountReconciliation, { id: number; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/account-reconciliations/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<AccountReconciliation>) => response.data,
      invalidatesTags: ['Reconciliations'],
    }),
    deleteAccountReconciliation: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/account-reconciliations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Reconciliations'],
    }),
    submitAccountReconciliation: builder.mutation<AccountReconciliation, number>({
      query: (id) => ({ url: `/account-reconciliations/${id}/submit`, method: 'POST' }),
      transformResponse: (response: DataResponse<AccountReconciliation>) => response.data,
      invalidatesTags: ['Reconciliations'],
    }),
    reviewAccountReconciliation: builder.mutation<AccountReconciliation, number>({
      query: (id) => ({ url: `/account-reconciliations/${id}/review`, method: 'POST' }),
      transformResponse: (response: DataResponse<AccountReconciliation>) => response.data,
      invalidatesTags: ['Reconciliations'],
    }),
    approveAccountReconciliation: builder.mutation<AccountReconciliation, number>({
      query: (id) => ({ url: `/account-reconciliations/${id}/approve`, method: 'POST' }),
      transformResponse: (response: DataResponse<AccountReconciliation>) => response.data,
      invalidatesTags: ['Reconciliations', 'FinancialClosings'],
    }),
    rejectAccountReconciliation: builder.mutation<AccountReconciliation, { id: number; rejection_reason: string }>({
      query: ({ id, rejection_reason }) => ({ url: `/account-reconciliations/${id}/reject`, method: 'POST', body: { rejection_reason } }),
      transformResponse: (response: DataResponse<AccountReconciliation>) => response.data,
      invalidatesTags: ['Reconciliations'],
    }),
    getFinancialClosings: builder.query<FinancialPeriodClosing[], void>({
      query: () => '/financial-closings',
      transformResponse: (response: DataResponse<FinancialPeriodClosing[]>) => response.data,
      providesTags: ['FinancialClosings'],
    }),
    createFinancialClosing: builder.mutation<FinancialPeriodClosing, Record<string, unknown>>({
      query: (body) => ({ url: '/financial-closings', method: 'POST', body }),
      transformResponse: (response: DataResponse<FinancialPeriodClosing>) => response.data,
      invalidatesTags: ['FinancialClosings'],
    }),
    deleteFinancialClosing: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/financial-closings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['FinancialClosings'],
    }),
    refreshFinancialClosing: builder.mutation<FinancialPeriodClosing, number>({
      query: (id) => ({ url: `/financial-closings/${id}/refresh`, method: 'POST' }),
      transformResponse: (response: DataResponse<FinancialPeriodClosing>) => response.data,
      invalidatesTags: ['FinancialClosings'],
    }),
    submitFinancialClosing: builder.mutation<FinancialPeriodClosing, number>({
      query: (id) => ({ url: `/financial-closings/${id}/submit`, method: 'POST' }),
      transformResponse: (response: DataResponse<FinancialPeriodClosing>) => response.data,
      invalidatesTags: ['FinancialClosings'],
    }),
    reviewFinancialClosing: builder.mutation<FinancialPeriodClosing, number>({
      query: (id) => ({ url: `/financial-closings/${id}/review`, method: 'POST' }),
      transformResponse: (response: DataResponse<FinancialPeriodClosing>) => response.data,
      invalidatesTags: ['FinancialClosings'],
    }),
    closeFinancialClosing: builder.mutation<FinancialPeriodClosing, number>({
      query: (id) => ({ url: `/financial-closings/${id}/close`, method: 'POST' }),
      transformResponse: (response: DataResponse<FinancialPeriodClosing>) => response.data,
      invalidatesTags: ['FinancialClosings', 'FinancialReports'],
    }),
    rejectFinancialClosing: builder.mutation<FinancialPeriodClosing, { id: number; rejection_reason: string }>({
      query: ({ id, rejection_reason }) => ({ url: `/financial-closings/${id}/reject`, method: 'POST', body: { rejection_reason } }),
      transformResponse: (response: DataResponse<FinancialPeriodClosing>) => response.data,
      invalidatesTags: ['FinancialClosings'],
    }),
    reopenFinancialClosing: builder.mutation<FinancialPeriodClosing, { id: number; reopen_reason: string }>({
      query: ({ id, reopen_reason }) => ({ url: `/financial-closings/${id}/reopen`, method: 'POST', body: { reopen_reason } }),
      transformResponse: (response: DataResponse<FinancialPeriodClosing>) => response.data,
      invalidatesTags: ['FinancialClosings', 'FinancialReports'],
    }),
    getFinancialReport: builder.query<FinancialReport, { from: string; to: string; account_id?: number }>({
      query: (params) => ({ url: '/financial-reports', params }),
      transformResponse: (response: DataResponse<FinancialReport>) => response.data,
      providesTags: ['FinancialReports'],
    }),
    getOperationalReport: builder.query<OperationalReport, {
      type: 'overview' | 'customer' | 'inventory' | 'hr' | 'asset' | 'all'
      from: string
      to: string
    }>({
      query: (params) => ({ url: '/reports/operational', params }),
      transformResponse: (response: DataResponse<OperationalReport>) => response.data,
      providesTags: ['OperationalReports'],
      keepUnusedDataFor: 60,
    }),
    getSuppliers: builder.query<Supplier[], { search?: string } | void>({
      query: (params) => ({ url: '/suppliers', params: params || undefined }),
      transformResponse: (response: DataResponse<Supplier[]>) => response.data,
      providesTags: ['Suppliers'],
    }),
    createSupplier: builder.mutation<Supplier, Partial<Supplier>>({
      query: (body) => ({ url: '/suppliers', method: 'POST', body }),
      transformResponse: (response: DataResponse<Supplier>) => response.data,
      invalidatesTags: ['Suppliers'],
    }),
    updateSupplier: builder.mutation<Supplier, { id: number; body: Partial<Supplier> }>({
      query: ({ id, body }) => ({ url: `/suppliers/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Supplier>) => response.data,
      invalidatesTags: ['Suppliers'],
    }),
    deleteSupplier: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/suppliers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Suppliers'],
    }),
    // Asset endpoints
    getAssetPurchases: builder.query<PaginatedResponse<AssetPurchase>, { page?: number; status?: string; search?: string } | void>({
      query: (params) => ({ url: '/asset-purchases', params: params || undefined }),
      providesTags: ['AssetPurchases'],
    }),
    createAssetPurchase: builder.mutation<AssetPurchase, FormData>({
      query: (body) => ({ url: '/asset-purchases', method: 'POST', body }),
      transformResponse: (response: DataResponse<AssetPurchase>) => response.data,
      invalidatesTags: ['AssetPurchases', 'Accounting'],
    }),
    updateAssetPurchase: builder.mutation<AssetPurchase, { id: number; body: FormData }>({
      query: ({ id, body }) => ({ url: `/asset-purchases/${id}`, method: 'POST', body: (() => {
        body.set('_method', 'PUT')
        return body
      })() }),
      transformResponse: (response: DataResponse<AssetPurchase>) => response.data,
      invalidatesTags: ['AssetPurchases', 'Accounting'],
    }),
    deleteAssetPurchase: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/asset-purchases/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AssetPurchases', 'Accounting'],
    }),

    getAssets: builder.query<Asset[], { search?: string; type?: string; status?: string; service_area_id?: number }>({
      query: (params) => ({ url: '/assets', params }),
      transformResponse: (response: DataResponse<Asset[]>) => response.data,
      providesTags: ['Assets'],
    }),
    getAsset: builder.query<Asset, number>({
      query: (id) => `/assets/${id}`,
      transformResponse: (response: DataResponse<Asset>) => response.data,
      providesTags: ['Assets'],
    }),
    createAsset: builder.mutation<Asset, Partial<Asset>>({
      query: (body) => ({ url: '/assets', method: 'POST', body }),
      transformResponse: (response: DataResponse<Asset>) => response.data,
      invalidatesTags: ['Assets'],
    }),
    updateAsset: builder.mutation<Asset, { id: number; body: Partial<Asset> }>({
      query: ({ id, body }) => ({ url: `/assets/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Asset>) => response.data,
      invalidatesTags: ['Assets'],
    }),
    deleteAsset: builder.mutation<void, number>({
      query: (id) => ({ url: `/assets/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Assets'],
    }),
    getAssetStats: builder.query<{ total: number; active: number; maintenance: number; total_value: number }, void>({
      query: () => '/assets/stats',
      providesTags: ['Assets'],
    }),

    // Asset Maintenance endpoints
    getAssetMaintenance: builder.query<AssetMaintenance[], { asset_id?: number; status?: string; type?: string; upcoming?: boolean }>({
      query: (params) => ({ url: '/assets-maintenance', params }),
      transformResponse: (response: DataResponse<AssetMaintenance[]>) => response.data,
      providesTags: ['AssetMaintenance'],
    }),
    createAssetMaintenance: builder.mutation<AssetMaintenance, Partial<AssetMaintenance>>({
      query: (body) => ({ url: '/assets-maintenance', method: 'POST', body }),
      transformResponse: (response: DataResponse<AssetMaintenance>) => response.data,
      invalidatesTags: ['AssetMaintenance', 'Assets'],
    }),
    updateAssetMaintenance: builder.mutation<AssetMaintenance, { id: number; body: Partial<AssetMaintenance> }>({
      query: ({ id, body }) => ({ url: `/assets-maintenance/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<AssetMaintenance>) => response.data,
      invalidatesTags: ['AssetMaintenance', 'Assets'],
    }),
    deleteAssetMaintenance: builder.mutation<void, number>({
      query: (id) => ({ url: `/assets-maintenance/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AssetMaintenance', 'Assets'],
    }),

    // Inventory endpoints
    getWarehouses: builder.query<WarehouseListResponse, { status?: string; search?: string }>({
      query: (params) => ({ url: '/warehouses', params }),
      providesTags: ['Warehouses'],
    }),
    getWarehouseDetails: builder.query<WarehouseDetail, WarehouseDetailParams>({
      query: ({ id, ...params }) => ({ url: `/warehouses/${id}`, params }),
      transformResponse: (response: DataResponse<WarehouseDetail>) => response.data,
      providesTags: ['Warehouses', 'InventoryItems', 'InventoryTransactions'],
    }),
    createWarehouse: builder.mutation<Warehouse, Partial<Warehouse>>({
      query: (body) => ({ url: '/warehouses', method: 'POST', body }),
      transformResponse: (response: DataResponse<Warehouse>) => response.data,
      invalidatesTags: ['Warehouses'],
    }),
    updateWarehouse: builder.mutation<Warehouse, { id: number; body: Partial<Warehouse> }>({
      query: ({ id, body }) => ({ url: `/warehouses/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Warehouse>) => response.data,
      invalidatesTags: ['Warehouses'],
    }),
    deleteWarehouse: builder.mutation<void, number>({
      query: (id) => ({ url: `/warehouses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Warehouses'],
    }),

    getInventoryItems: builder.query<InventoryItem[], { search?: string; category?: string; warehouse_id?: string; low_stock?: boolean }>({
      query: (params) => ({ url: '/inventory-items', params }),
      transformResponse: (response: DataResponse<InventoryItem[]>) => response.data,
      providesTags: ['InventoryItems'],
    }),
    createInventoryItem: builder.mutation<InventoryItem, Partial<InventoryItem>>({
      query: (body) => ({ url: '/inventory-items', method: 'POST', body }),
      transformResponse: (response: DataResponse<InventoryItem>) => response.data,
      invalidatesTags: ['InventoryItems', 'Warehouses'],
    }),
    updateInventoryItem: builder.mutation<InventoryItem, { id: number; body: Partial<InventoryItem> }>({
      query: ({ id, body }) => ({ url: `/inventory-items/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<InventoryItem>) => response.data,
      invalidatesTags: ['InventoryItems', 'Warehouses'],
    }),
    deleteInventoryItem: builder.mutation<void, number>({
      query: (id) => ({ url: `/inventory-items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['InventoryItems', 'Warehouses'],
    }),
    getInventoryStats: builder.query<{ total_items: number; low_stock: number; total_value: number }, void>({
      query: () => '/inventory/stats',
      providesTags: ['InventoryItems'],
    }),
    getDepartments: builder.query<{ id: number; code: string; name: string }[], void>({
      query: () => '/inventory/departments',
      transformResponse: (response: { data: { id: number; code: string; name: string }[] }) => response.data,
      providesTags: ['Departments'],
    }),

    // Goods endpoints
    getGoods: builder.query<Good[], { search?: string; category?: string; status?: string }>({
      query: (params) => ({ url: '/goods', params }),
      transformResponse: (response: DataResponse<Good[]>) => response.data,
      providesTags: ['Goods'],
    }),
    createGood: builder.mutation<Good, Partial<Good>>({
      query: (body) => ({ url: '/goods', method: 'POST', body }),
      transformResponse: (response: DataResponse<Good>) => response.data,
      invalidatesTags: ['Goods'],
    }),
    updateGood: builder.mutation<Good, { id: number; body: Partial<Good> }>({
      query: ({ id, body }) => ({ url: `/goods/${id}`, method: 'PUT', body }),
      transformResponse: (response: DataResponse<Good>) => response.data,
      invalidatesTags: ['Goods'],
    }),
    deleteGood: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/goods/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Goods'],
    }),

    // Inventory Issue endpoints
    getInventoryIssues: builder.query<InventoryIssue[], { type?: string; status?: string; customer_id?: number }>({
      query: (params) => ({ url: '/inventory-issues', params }),
      transformResponse: (response: DataResponse<InventoryIssue[]>) => response.data,
      providesTags: ['InventoryIssues'],
    }),
    // Inventory Request endpoints
    getInventoryPurchaseAccounts: builder.query<AccountingAccount[], void>({
      query: () => '/inventory-requests/purchase-accounts',
      transformResponse: (response: DataResponse<AccountingAccount[]>) => response.data,
      providesTags: ['AccountingAccounts'],
    }),
    getInventoryRequests: builder.query<{ data: InventoryRequest[] }, { status?: string; type?: string }>({
      query: (params) => ({ url: '/inventory-requests', params }),
      transformResponse: (response: { data: { data: InventoryRequest[] } }) => ({ data: response.data.data }),
      providesTags: ['InventoryRequests'],
    }),
    getInventoryRequest: builder.query<InventoryRequest, number>({
      query: (id) => `/inventory-requests/${id}`,
      transformResponse: (response: DataResponse<InventoryRequest>) => response.data,
      providesTags: ['InventoryRequests'],
    }),
    createInventoryRequest: builder.mutation<InventoryRequest, InventoryRequestPayload>({
      query: (body) => ({ url: '/inventory-requests', method: 'POST', body }),
      transformResponse: (response: DataResponse<InventoryRequest>) => response.data,
      invalidatesTags: ['InventoryRequests', 'Notifications'],
    }),
    approveInventoryRequest: builder.mutation<InventoryRequest, { id: number; status: string; approval_notes?: string }>({
      query: ({ id, ...body }) => ({ url: `/inventory-requests/${id}/approve`, method: 'POST', body }),
      transformResponse: (response: DataResponse<InventoryRequest>) => response.data,
      invalidatesTags: ['InventoryRequests', 'InventoryItems', 'InventoryTransactions', 'Warehouses', 'Meters', 'Accounting', 'AccountingAccounts', 'Invoices', 'Payments', 'Customers', 'Dashboard', 'Notifications'],
    }),
    recordInventoryPurchasePayment: builder.mutation<InventoryRequest, {
      id: number
      amount: number
      payment_method_id: number
      accounting_account_id: number
      paid_at: string
      reference?: string
      notes?: string
    }>({
      query: ({ id, ...body }) => ({ url: `/inventory-requests/${id}/payments`, method: 'POST', body }),
      transformResponse: (response: DataResponse<InventoryRequest>) => response.data,
      invalidatesTags: ['InventoryRequests', 'Accounting', 'AccountingAccounts', 'FinancialReports', 'FinancialClosings', 'Dashboard'],
    }),
  }),
})

export const {
  useGetMeQuery,
  useUpdateProfileMutation,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetDashboardStatsQuery,
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetSettingsQuery,
  useUpdateSystemProfileMutation,
  useGetTrainingModeQuery,
  useUpdateTrainingModeMutation,
  useResetTrainingDataMutation,
  useStartTrainingDataResetMutation,
  useAdvanceTrainingDataResetMutation,
  useGetLeaveSettingsQuery,
  useUpdateLeaveSettingsMutation,
  useGetPaymentMethodsQuery,
  useCreatePaymentMethodMutation,
  useUpdatePaymentMethodMutation,
  useDeletePaymentMethodMutation,
  useGetFinancialCategoriesQuery,
  useCreateFinancialCategoryMutation,
  useUpdateFinancialCategoryMutation,
  useDeleteFinancialCategoryMutation,
  useCreateCustomerChargeTypeMutation,
  useUpdateCustomerChargeTypeMutation,
  useDeleteCustomerChargeTypeMutation,
  useGetAuthoritiesQuery,
  useGetAuthorityOptionsQuery,
  useCreateAuthorityMutation,
  useUpdateAuthorityMutation,
  useDeleteAuthorityMutation,
  useGetServiceAreasQuery,
  useCreateServiceAreaMutation,
  useUpdateServiceAreaMutation,
  useDeleteServiceAreaMutation,
  useGetCustomersQuery,
  useGetCustomerCollectionOptionsQuery,
  useGetCustomerDetailQuery,
  useGetCustomerContractsQuery,
  useCreateCustomerContractMutation,
  useUpdateCustomerContractMutation,
  useMarkCustomerContractPrintedMutation,
  useConfirmCustomerContractMutation,
  useGetContractCancellationPreviewQuery,
  useCancelCustomerContractMutation,
  useResolveContractCancellationMutation,
  useGetCustomerDepositsQuery,
  useRefundCustomerDepositMutation,
  useGetAssignedServiceRequestsQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useUploadCustomerPhotoMutation,
  useDeleteCustomerPhotoMutation,
  useMarkCustomerAgreementPrintedMutation,
  useCreateCustomerChargeMutation,
  useCancelCustomerChargeMutation,
  useCreateCustomerServiceRequestMutation,
  useUpdateCustomerServiceRequestMutation,
  useCreateCustomerConnectionEventMutation,
  useDeleteCustomerMutation,
  useGetCustomerDocumentsQuery,
  useUploadCustomerDocumentsMutation,
  useDeleteCustomerDocumentMutation,
  useGetMetersQuery,
  useCreateMeterMutation,
  useUpdateMeterMutation,
  useReturnMeterToStockMutation,
  useDeleteMeterMutation,
  useGetMeterAssignmentsQuery,
  useGetMeterAssignersQuery,
  useCreateMeterAssignmentMutation,
  useUpdateMeterAssignmentMutation,
  useResealMeterAssignmentMutation,
  useDeleteMeterAssignmentMutation,
  useGetBillingPeriodsQuery,
  useCreateBillingPeriodMutation,
  useUpdateBillingPeriodMutation,
  useDeleteBillingPeriodMutation,
  useGetMeterReadingsQuery,
  useCreateMeterReadingMutation,
  useDeleteMeterReadingMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useGetPaymentsQuery,
  useGetPaymentReceivingAccountsQuery,
  useCreatePaymentMutation,
  useUpdatePaymentMutation,
  useGetAccountingSummaryQuery,
  useGetAccountingAccountsQuery,
  useCreateAccountingAccountMutation,
  useUpdateAccountingAccountMutation,
  useDeleteAccountingAccountMutation,
  useGetAccountingTransactionsQuery,
  useGetExpensesQuery,
  useCreateAccountingTransactionMutation,
  useUpdateAccountingTransactionMutation,
  useDeleteAccountingTransactionMutation,
  useReviewAccountingTransactionMutation,
  useApproveAccountingTransactionMutation,
  useRejectAccountingTransactionMutation,
  useCancelAccountingTransactionMutation,
  useGetHrSummaryQuery,
  useGetHrReportQuery,
  useGetEmployeesQuery,
  useGetEmployeeQuery,
  useGetMyEmployeeProfileQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetHrStructureQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useCreateJobPositionMutation,
  useUpdateJobPositionMutation,
  useDeleteJobPositionMutation,
  useUploadEmployeeDocumentsMutation,
  useDeleteEmployeeDocumentMutation,
  useGetAttendanceRecordsQuery,
  useCreateAttendanceRecordMutation,
  useUpdateAttendanceRecordMutation,
  useDeleteAttendanceRecordMutation,
  useCheckInAttendanceMutation,
  useCheckOutAttendanceMutation,
  useResolveAttendanceRecordMutation,
  useGetLeaveRequestsQuery,
  useCreateLeaveRequestMutation,
  useUpdateLeaveRequestMutation,
  useResolveLeaveRequestMutation,
  useCancelLeaveRequestMutation,
  useGetLeavePoliciesQuery,
  useCreateLeavePolicyMutation,
  useUpdateLeavePolicyMutation,
  useDeleteLeavePolicyMutation,
  useAdjustLeaveBalanceMutation,
  useGetWorkSchedulesQuery,
  useCreateWorkShiftMutation,
  useUpdateWorkShiftMutation,
  useDeleteWorkShiftMutation,
  useCreateShiftAssignmentMutation,
  useUpdateShiftAssignmentMutation,
  useDeleteShiftAssignmentMutation,
  useCreatePublicHolidayMutation,
  useUpdatePublicHolidayMutation,
  useDeletePublicHolidayMutation,
  useGetSalaryAdvancesQuery,
  useCreateSalaryAdvanceMutation,
  useReviewSalaryAdvanceMutation,
  useApproveSalaryAdvanceMutation,
  useRejectSalaryAdvanceMutation,
  useCancelSalaryAdvanceMutation,
  useGetEmployeeAdjustmentsQuery,
  useCreateEmployeeAdjustmentMutation,
  useUpdateEmployeeAdjustmentMutation,
  useResolveEmployeeAdjustmentMutation,
  useDeleteEmployeeAdjustmentMutation,
  useCreatePerformanceReviewMutation,
  useUpdatePerformanceReviewMutation,
  useFinalizePerformanceReviewMutation,
  useDeletePerformanceReviewMutation,
  useGetPayrollDeductionsQuery,
  useCreatePayrollDeductionRuleMutation,
  useUpdatePayrollDeductionRuleMutation,
  useDeletePayrollDeductionRuleMutation,
  useCreateEmployeePayrollDeductionMutation,
  useUpdateEmployeePayrollDeductionMutation,
  useDeleteEmployeePayrollDeductionMutation,
  useGetEmployeeTerminationsQuery,
  usePreviewEmployeeTerminationMutation,
  useCreateEmployeeTerminationMutation,
  useReviewEmployeeTerminationMutation,
  useApproveEmployeeTerminationMutation,
  useRejectEmployeeTerminationMutation,
  useCancelEmployeeTerminationMutation,
  useGetBiometricImportsQuery,
  useImportBiometricAttendanceMutation,
  useGetPayrollRunsQuery,
  useGetPayrollEligibleEmployeesQuery,
  useCreatePayrollRunMutation,
  useGeneratePayrollRunMutation,
  useRecalculatePayrollRunMutation,
  useGetPayrollPayslipQuery,
  useUpdatePayrollRunMutation,
  useDeletePayrollRunMutation,
  useSubmitPayrollRunMutation,
  useReviewPayrollRunMutation,
  useApprovePayrollRunMutation,
  useRejectPayrollRunMutation,
  useCancelPayrollRunMutation,
  useGetPayrollMonthlyReportQuery,
  useGetShareholdersQuery,
  useCreateShareholderMutation,
  useUpdateShareholderMutation,
  useDeleteShareholderMutation,
  useGetShareholderDistributionsQuery,
  useCreateShareholderDistributionMutation,
  useDeleteShareholderDistributionMutation,
  useSubmitShareholderDistributionMutation,
  useReviewShareholderDistributionMutation,
  useApproveShareholderDistributionMutation,
  useRejectShareholderDistributionMutation,
  usePayShareholderDistributionMutation,
  useGetAccountReconciliationsQuery,
  useCreateAccountReconciliationMutation,
  useUpdateAccountReconciliationMutation,
  useDeleteAccountReconciliationMutation,
  useSubmitAccountReconciliationMutation,
  useReviewAccountReconciliationMutation,
  useApproveAccountReconciliationMutation,
  useRejectAccountReconciliationMutation,
  useGetFinancialClosingsQuery,
  useCreateFinancialClosingMutation,
  useDeleteFinancialClosingMutation,
  useRefreshFinancialClosingMutation,
  useSubmitFinancialClosingMutation,
  useReviewFinancialClosingMutation,
  useCloseFinancialClosingMutation,
  useRejectFinancialClosingMutation,
  useReopenFinancialClosingMutation,
  useGetFinancialReportQuery,
  useLazyGetFinancialReportQuery,
  useGetOperationalReportQuery,
  useLazyGetOperationalReportQuery,
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  // Asset hooks
  useGetAssetPurchasesQuery,
  useCreateAssetPurchaseMutation,
  useUpdateAssetPurchaseMutation,
  useDeleteAssetPurchaseMutation,
  useGetAssetsQuery,
  useGetAssetQuery,
  useCreateAssetMutation,
  useUpdateAssetMutation,
  useDeleteAssetMutation,
  useGetAssetStatsQuery,
  // Asset Maintenance hooks
  useGetAssetMaintenanceQuery,
  useCreateAssetMaintenanceMutation,
  useUpdateAssetMaintenanceMutation,
  useDeleteAssetMaintenanceMutation,
  // Inventory hooks
  useGetWarehousesQuery,
  useGetWarehouseDetailsQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,
  useGetInventoryItemsQuery,
  useCreateInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
  useGetInventoryStatsQuery,
  useGetDepartmentsQuery,
  // Goods hooks
  useGetGoodsQuery,
  useCreateGoodMutation,
  useUpdateGoodMutation,
  useDeleteGoodMutation,
  // Inventory Issue hooks
  useGetInventoryIssuesQuery,
  // Inventory Request hooks
  useGetInventoryPurchaseAccountsQuery,
  useGetInventoryRequestsQuery,
  useGetInventoryRequestQuery,
  useCreateInventoryRequestMutation,
  useApproveInventoryRequestMutation,
  useRecordInventoryPurchasePaymentMutation,
} = waternetApi
