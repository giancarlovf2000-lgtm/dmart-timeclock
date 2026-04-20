'use client'

import { useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  type: 'success' | 'error'
  employeeName?: string
  punchType?: 'CLOCK_IN' | 'CLOCK_OUT'
  message?: string
  onDismiss: () => void
  autoCloseMs?: number
}

export function PunchStatusBanner({ type, employeeName, punchType, message, onDismiss, autoCloseMs = 3000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoCloseMs)
    return () => clearTimeout(timer)
  }, [onDismiss, autoCloseMs])

  const isSuccess = type === 'success'

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8 ${
        isSuccess ? 'bg-emerald-900' : 'bg-red-900'
      }`}
      onClick={onDismiss}
    >
      {isSuccess ? (
        <CheckCircle2 size={96} className="text-emerald-300" />
      ) : (
        <XCircle size={96} className="text-red-300" />
      )}

      {isSuccess && (
        <>
          <div className="text-center">
            <p className="text-zinc-300 text-lg">{punchType === 'CLOCK_IN' ? 'Entrada registrada' : 'Salida registrada'}</p>
            <p className="text-white text-4xl font-bold mt-2">{employeeName}</p>
          </div>
          <p className="text-emerald-300 text-xl font-semibold">
            {punchType === 'CLOCK_IN' ? '✓ Clock In' : '✓ Clock Out'}
          </p>
        </>
      )}

      {!isSuccess && (
        <p className="text-red-200 text-xl text-center max-w-sm">{message}</p>
      )}

      <p className="text-zinc-400 text-sm mt-4">Toca para continuar</p>
    </div>
  )
}
