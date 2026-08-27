import {
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  ContactRound,
  FileChartColumn,
  Gauge,
  HandCoins,
  Landmark,
  LayoutDashboard,
  MapPinned,
  Package,
  ReceiptText,
  Scale,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  WalletCards,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { AuthUser } from '@/src/store/waternetApi'

export type WorkspaceTab = {
  label: string
  path: string
  icon: LucideIcon
  module?: string
  roles?: readonly string[]
  alwaysVisible?: boolean
}

export type WorkspaceDefinition = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  accent: 'accent' | 'mint' | 'gold' | 'violet' | 'coral'
  tabs: readonly WorkspaceTab[]
}

const financeRoles = ['Accountant', 'Manager', 'Admin', 'Super Admin'] as const
const payrollRoles = ['HR', 'Accountant', 'Manager', 'Admin', 'Super Admin'] as const
const staffRoles = [
  'HR',
  'Accountant',
  'Manager',
  'Admin',
  'Super Admin',
  'Technician',
  'Meter Reader',
  'Meter Assigner',
  'Collector',
  'Warehouse Officer',
] as const

export const workspaces: readonly WorkspaceDefinition[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: "Today's work and key system totals",
    icon: LayoutDashboard,
    accent: 'accent',
    tabs: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, alwaysVisible: true }],
  },
  {
    id: 'customers',
    label: 'Customer Desk',
    description: 'Customers, contracts, bills, payments, and service history',
    icon: Users,
    accent: 'mint',
    tabs: [
      { label: 'Customers', path: '/dashboard/customers', icon: Users, module: 'customers' },
      { label: 'All Invoices', path: '/dashboard/invoices', icon: ReceiptText, module: 'invoices' },
      { label: 'All Payments', path: '/dashboard/payments', icon: WalletCards, module: 'payments' },
    ],
  },
  {
    id: 'field',
    label: 'Field Operations',
    description: 'Areas, meters, installations, and monthly readings',
    icon: ClipboardCheck,
    accent: 'accent',
    tabs: [
      { label: 'Meter Readings', path: '/dashboard/meter-readings', icon: ClipboardCheck, module: 'meter-readings' },
      { label: 'Meter Assignments', path: '/dashboard/meter-assignments', icon: Wrench, module: 'meter-assignments' },
      { label: 'Meters', path: '/dashboard/meters', icon: Gauge, module: 'meters' },
      { label: 'Billing Periods', path: '/dashboard/billing-periods', icon: CalendarDays, module: 'billing-periods' },
      { label: 'Service Areas', path: '/dashboard/service-areas', icon: MapPinned, module: 'service-areas' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Assets',
    description: 'Purchases, issues, stock, warehouses, and equipment',
    icon: Boxes,
    accent: 'gold',
    tabs: [
      { label: 'Inventory', path: '/dashboard/inventory-manager', icon: Boxes, module: 'inventory' },
      { label: 'Warehouses', path: '/dashboard/warehouses', icon: Warehouse, module: 'warehouses' },
      { label: 'Goods', path: '/dashboard/goods', icon: Package, module: 'goods' },
      { label: 'Suppliers', path: '/dashboard/suppliers', icon: Building2, module: 'suppliers' },
      { label: 'Assets', path: '/dashboard/assets', icon: Wrench, module: 'assets' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Accounts, income, expenses, closing, and profit',
    icon: Landmark,
    accent: 'violet',
    tabs: [
      { label: 'Accounts', path: '/dashboard/accounting', icon: Landmark, module: 'accounting', roles: financeRoles },
      { label: 'Income', path: '/dashboard/finance-transactions', icon: CircleDollarSign, module: 'finance-transactions', roles: financeRoles },
      { label: 'Expenses', path: '/dashboard/expenses', icon: WalletCards, module: 'expenses', roles: financeRoles },
      { label: 'Expense Types', path: '/dashboard/expense-types', icon: Tags, module: 'expense-types', roles: financeRoles },
      { label: 'Reconciliation', path: '/dashboard/reconciliation', icon: Scale, module: 'reconciliation', roles: financeRoles },
      { label: 'Monthly Closing', path: '/dashboard/month-closing', icon: CalendarCheck2, module: 'financial-closing', roles: financeRoles },
      { label: 'Shareholders', path: '/dashboard/shareholders', icon: HandCoins, module: 'shareholders', roles: financeRoles },
      { label: 'Financial Reports', path: '/dashboard/financial-reports', icon: ChartNoAxesCombined, module: 'financial-reports', roles: financeRoles },
    ],
  },
  {
    id: 'people',
    label: 'People & Payroll',
    description: 'Employees, attendance, leave, and salary processing',
    icon: ContactRound,
    accent: 'coral',
    tabs: [
      { label: 'Employees', path: '/dashboard/hr', icon: ContactRound, module: 'employees', roles: payrollRoles },
      { label: 'Attendance & Leave', path: '/dashboard/attendance', icon: CalendarCheck2, module: 'attendance', roles: staffRoles },
      { label: 'Payroll', path: '/dashboard/payroll', icon: WalletCards, module: 'payroll', roles: payrollRoles },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Customer, financial, inventory, asset, and HR reports',
    icon: BarChart3,
    accent: 'mint',
    tabs: [
      { label: 'Report Center', path: '/dashboard/reports', icon: BarChart3, module: 'reports' },
      { label: 'Customer Report', path: '/dashboard/reports/customer', icon: Users, module: 'reports' },
      { label: 'Financial Report', path: '/dashboard/reports/financial', icon: FileChartColumn, module: 'reports' },
      { label: 'Inventory Report', path: '/dashboard/reports/inventory', icon: Boxes, module: 'reports' },
      { label: 'Asset Report', path: '/dashboard/reports/asset', icon: Wrench, module: 'reports' },
      { label: 'HR Report', path: '/dashboard/reports/hr', icon: ContactRound, module: 'reports' },
      { label: 'Custom Report', path: '/dashboard/reports/custom', icon: ChartNoAxesCombined, module: 'reports' },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    description: 'Settings, users, roles, permissions, and authorities',
    icon: Settings,
    accent: 'gold',
    tabs: [
      { label: 'Settings', path: '/dashboard/settings', icon: Settings, module: 'settings' },
      { label: 'Users', path: '/dashboard/users', icon: UserCog, module: 'users' },
      { label: 'Roles', path: '/dashboard/roles', icon: ShieldCheck, module: 'roles' },
      { label: 'Authorities', path: '/dashboard/authorities', icon: ShieldCheck, module: 'authorities' },
    ],
  },
] as const

const hasElevatedAccess = (profile?: AuthUser) => profile?.roles.some((role) => ['Admin', 'Super Admin'].includes(role)) ?? false

export const canAccessWorkspaceTab = (profile: AuthUser | undefined, tab: WorkspaceTab) => {
  if (tab.alwaysVisible) return true
  if (!profile) return false
  if (hasElevatedAccess(profile)) return true
  if (tab.roles?.some((role) => profile.roles.includes(role))) return true
  if (tab.module && profile.permissions.includes(`${tab.module}.view`)) return true
  return false
}

export const visibleWorkspaceTabs = (workspace: WorkspaceDefinition, profile?: AuthUser) => (
  workspace.tabs.filter((tab) => canAccessWorkspaceTab(profile, tab))
)

export const visibleWorkspaces = (profile?: AuthUser) => (
  workspaces.filter((workspace) => visibleWorkspaceTabs(workspace, profile).length > 0)
)

export const workspaceHome = (workspace: WorkspaceDefinition, profile?: AuthUser) => (
  visibleWorkspaceTabs(workspace, profile)[0]?.path ?? workspace.tabs[0].path
)

const routeMatches = (pathname: string, path: string) => (
  pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`))
)

export const workspaceForPath = (pathname: string) => (
  workspaces.find((workspace) => workspace.tabs.some((tab) => routeMatches(pathname, tab.path)))
)

export const activeWorkspaceTab = (workspace: WorkspaceDefinition, pathname: string, profile?: AuthUser) => (
  [...visibleWorkspaceTabs(workspace, profile)]
    .filter((tab) => routeMatches(pathname, tab.path))
    .sort((left, right) => right.path.length - left.path.length)[0]
)
