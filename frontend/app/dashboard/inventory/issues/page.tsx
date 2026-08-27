import { redirect } from 'next/navigation'

export default function LegacyInventoryIssuesPage() {
  redirect('/dashboard/inventory-manager')
}
