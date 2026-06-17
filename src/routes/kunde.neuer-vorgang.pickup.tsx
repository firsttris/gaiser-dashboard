import { createFileRoute } from '@tanstack/react-router'
import { WizardFlow } from '../components/wizard-flow'

export const Route = createFileRoute('/kunde/neuer-vorgang/pickup')({ component: () => <WizardFlow flowType="pickup" /> })
