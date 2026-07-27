import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (isAdminLoggedIn) throw redirect({ to: '/admin/vorgaenge' })
  },
})
