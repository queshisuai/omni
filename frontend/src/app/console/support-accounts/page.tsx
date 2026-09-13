import { redirect } from 'next/navigation'

export default function SupportAccountsCompatibilityPage() {
  redirect('/console/accounts?type=support')
}
