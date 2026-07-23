import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { customerSessionStatusQueryOptions } from '../server/customer-auth'

export const Route = createFileRoute('/kunde')({
  beforeLoad: async ({ context }) => {
    const { isLoggedIn } = await context.queryClient.ensureQueryData(customerSessionStatusQueryOptions())
    if (!isLoggedIn) throw redirect({ to: '/' })
  },
  component: () => <Outlet />,
})
