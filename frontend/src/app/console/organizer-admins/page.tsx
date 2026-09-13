import { redirect } from 'next/navigation'

export default function OrganizerAdminsCompatibilityPage() {
  redirect('/console/accounts?type=organizer')
}
