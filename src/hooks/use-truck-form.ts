import { useState } from 'react'

interface TruckFormState {
  name: string
  privatePrice: string
  businessPrice: string
}

const INITIAL_STATE: TruckFormState = {
  name: '',
  privatePrice: '0',
  businessPrice: '0',
}

export function useTruckForm() {
  const [formState, setFormState] = useState<TruckFormState>(INITIAL_STATE)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const reset = () => {
    setFormState(INITIAL_STATE)
    setError('')
    setSuccess('')
  }

  const update = (updates: Partial<TruckFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }))
  }

  const setMessage = (message: string, type: 'error' | 'success') => {
    if (type === 'error') {
      setError(message)
      setSuccess('')
    } else {
      setSuccess(message)
      setError('')
    }
  }

  return {
    formState,
    error,
    success,
    reset,
    update,
    setMessage,
  }
}
