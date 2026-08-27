import { redirect } from 'next/navigation'

export default function AssetPurchasesPage() {
  redirect('/dashboard/inventory-manager?view=asset-purchases')
}
