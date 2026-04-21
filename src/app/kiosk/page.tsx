'use client'

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { NumericKeypad } from '@/components/kiosk/NumericKeypad'
import { PinDisplay } from '@/components/kiosk/PinDisplay'
import { CameraPreview, CameraHandle } from '@/components/kiosk/CameraPreview'
import { PunchStatusBanner } from '@/components/kiosk/PunchStatusBanner'
import { LogIn, LogOut, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Employee {
  id: string
  full_name: string
  employee_code: string
  expected_action: 'CLOCK_IN' | 'CLOCK_OUT'
}

type AppState = 'pin' | 'punch' | 'loading' | 'success' | 'error'

function KioskContent() {
  const searchParams = useSearchParams()
  const location = searchParams.get('location') || 'unknown'

  const [state, setState] = useState<AppState>('pin')
  const [code, setCode] = useState('')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const cameraRef = useRef<CameraHandle>(null)

  useEffect(() => {
    if (location !== 'unknown') {
      sessionStorage.setItem('kiosk_location', location)
    }
  }, [location])

  const handleDigit = useCallback((digit: string) => {
    if (state !== 'pin' || code.length >= 3) return
    const newCode = code + digit
    setCode(newCode)
    if (newCode.length === 3) {
      handleLogin(newCode)
    }
  }, [state, code])

  const handleBackspace = useCallback(() => {
    setCode(prev => prev.slice(0, -1))
  }, [])

  const handleClear = useCallback(() => {
    setCode('')
  }, [])

  async function handleLogin(employeeCode: string) {
    setState('loading')
    try {
      const res = await fetch('/api/kiosk/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: employeeCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg(data.error || 'Error al ingresar')
        setState('error')
        return
      }
      setEmployee(data.employee)
      setToken(data.token)
      setState('punch')
    } catch {
      setStatusMsg('Error de conexión')
      setState('error')
    }
  }

  async function handlePunch(punchType: 'CLOCK_IN' | 'CLOCK_OUT') {
    if (!token || !employee) return
    setState('loading')

    const photo = await cameraRef.current?.captureSnapshot()
    const formData = new FormData()
    formData.append('punch_type', punchType)
    formData.append('location', location)
    if (photo) formData.append('photo', photo, 'punch.jpg')

    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg(data.error || 'Error al registrar ponche')
        setState('error')
        return
      }
      setState('success')
    } catch {
      setStatusMsg('Error de conexión')
      setState('error')
    }
  }

  function resetToPin() {
    setState('pin')
    setCode('')
    setEmployee(null)
    setToken(null)
    setStatusMsg('')
    setCameraReady(false)
  }

  const locationName = (() => {
    const loc = location || sessionStorage.getItem('kiosk_location') || ''
    const names: Record<string, string> = {
      'vega-alta': 'Vega Alta',
      'barranquitas': 'Barranquitas',
      'oficinas-corporativas': 'Oficinas Corporativas',
    }
    return names[loc] || loc
  })()

  return (
    <div className="min-h-screen flex flex-col select-none">
      {/* Status banners */}
      {state === 'success' && employee && (
        <PunchStatusBanner
          type="success"
          employeeName={employee.full_name}
          punchType={employee.expected_action}
          onDismiss={resetToPin}
        />
      )}
      {state === 'error' && (
        <PunchStatusBanner
          type="error"
          message={statusMsg}
          onDismiss={resetToPin}
        />
      )}

      {/* Header */}
      <header className="px-6 pt-8 pb-4 flex flex-col items-center gap-2">
        <Image
          src="/dmart-logo.png"
          alt="D'mart Institute"
          width={180}
          height={101}
          className="object-contain"
          priority
        />
        {locationName && (
          <p className="text-zinc-500 text-sm">{locationName}</p>
        )}
      </header>

      {/* PIN entry state */}
      {(state === 'pin' || state === 'loading') && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <div className="text-center">
            <p className="text-zinc-700 text-lg">Ingresa tu código</p>
            <p className="text-zinc-400 text-sm mt-1">3 dígitos</p>
          </div>

          <PinDisplay length={code.length} maxLength={3} />

          {state === 'loading' && (
            <Loader2 className="animate-spin text-brand-red" size={32} />
          )}

          <NumericKeypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onClear={handleClear}
            disabled={state === 'loading'}
          />
        </main>
      )}

      {/* Punch state */}
      {state === 'punch' && employee && (
        <main className="flex-1 flex flex-col items-center justify-between px-6 pb-8 gap-4">
          <div className="text-center py-2">
            <p className="text-zinc-500 text-sm">Bienvenido/a</p>
            <p className="text-zinc-900 text-2xl font-bold">{employee.full_name}</p>
            <p className="text-zinc-400 text-xs mt-1">Código: {employee.employee_code}</p>
          </div>

          <div className="w-full max-w-sm">
            <CameraPreview
              ref={cameraRef}
              onReady={() => setCameraReady(true)}
              onError={(err) => setCameraError(err)}
            />
            {!cameraReady && !cameraError && (
              <p className="text-zinc-500 text-xs text-center mt-2">Activando cámara...</p>
            )}
            {cameraError && (
              <p className="text-red-400 text-xs text-center mt-2">Cámara no disponible</p>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            {employee.expected_action === 'CLOCK_IN' ? (
              <button
                onClick={() => handlePunch('CLOCK_IN')}
                className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xl font-bold flex items-center justify-center gap-3 transition-colors"
              >
                <LogIn size={24} />
                Clock In
              </button>
            ) : (
              <button
                onClick={() => handlePunch('CLOCK_OUT')}
                className="w-full h-16 rounded-2xl bg-brand-red hover:bg-brand-red-dark active:bg-brand-red-dark text-white text-xl font-bold flex items-center justify-center gap-3 transition-colors"
              >
                <LogOut size={24} />
                Clock Out
              </button>
            )}

            <button
              onClick={resetToPin}
              className="w-full h-12 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </main>
      )}
    </div>
  )
}

export default function KioskPage() {
  return (
    <Suspense>
      <KioskContent />
    </Suspense>
  )
}
