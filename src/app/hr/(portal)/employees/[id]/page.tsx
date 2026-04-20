'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { minutesToHoursLabel } from '@/lib/pay-periods'
import { ArrowLeft, LogIn, LogOut, MapPin, Camera, AlertTriangle } from 'lucide-react'
import Image from 'next/image'

interface Employee {
  id: string
  employee_code: string
  full_name: string
  quickbooks_display_name: string | null
  department: string | null
  is_active: boolean
  created_at: string
}

interface Punch {
  id: string
  punch_type: 'CLOCK_IN' | 'CLOCK_OUT'
  punched_at: string
  device_location: string | null
  photo_url: string | null
  locations: { name: string } | null
}

export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const id = params.id
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [punches, setPunches] = useState<Punch[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [photoModal, setPhotoModal] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/hr/employees/${id}`).then(r => r.json()),
      fetch(`/api/hr/employees/${id}/punches`).then(r => r.json()),
    ])
      .then(([emp, p]) => {
        setEmployee(emp?.id ? emp : null)
        setPunches(Array.isArray(p) ? p : [])
      })
      .catch(() => setFetchError('Error cargando datos'))
      .finally(() => setLoading(false))
  }, [id])

  // Group punches into sessions
  const sessions: Array<{ clockIn: Punch; clockOut: Punch | null }> = []
  const sortedPunches = [...punches].sort((a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime())

  let i = 0
  while (i < sortedPunches.length) {
    const p = sortedPunches[i]
    if (p.punch_type === 'CLOCK_IN') {
      const next = sortedPunches[i + 1]
      const clockOut = next?.punch_type === 'CLOCK_OUT' ? next : null
      sessions.push({ clockIn: p, clockOut })
      i += clockOut ? 2 : 1
    } else {
      i++
    }
  }

  if (loading) return <div className="p-6 text-zinc-500">Cargando...</div>
  if (fetchError) return <div className="p-6 text-red-400">{fetchError}</div>
  if (!employee) return <div className="p-6 text-red-400">Empleado no encontrado</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/hr/employees" className="text-zinc-500 hover:text-white transition-colors mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-300">
              {employee.employee_code}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{employee.full_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {employee.department && <span className="text-zinc-500 text-sm">{employee.department}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${employee.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  {employee.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold">Historial de ponches</h3>
          <p className="text-zinc-500 text-sm mt-0.5">{sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} registrada{sessions.length !== 1 ? 's' : ''}</p>
        </div>

        {sessions.length === 0 ? (
          <div className="py-10 text-center text-zinc-500">Sin ponches registrados</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {[...sessions].reverse().map(({ clockIn, clockOut }, idx) => {
              const inDate = new Date(clockIn.punched_at)
              const outDate = clockOut ? new Date(clockOut.punched_at) : null
              const minutes = outDate ? Math.round((outDate.getTime() - inDate.getTime()) / 60000) : null

              return (
                <div key={idx} className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm font-medium">
                      {inDate.toLocaleDateString('es-PR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    {minutes !== null ? (
                      <span className="text-white font-semibold">{minutesToHoursLabel(minutes)}</span>
                    ) : (
                      <span className="text-amber-400 text-xs flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Turno abierto
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                        <LogIn size={14} /> Clock In
                      </div>
                      <p className="text-white text-lg font-bold">
                        {inDate.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {clockIn.device_location && (
                        <p className="text-zinc-500 text-xs flex items-center gap-1"><MapPin size={10} />{clockIn.device_location}</p>
                      )}
                      {clockIn.photo_url && (
                        <button onClick={() => setPhotoModal(clockIn.photo_url!)} className="text-zinc-500 hover:text-white text-xs flex items-center gap-1">
                          <Camera size={12} /> Ver foto
                        </button>
                      )}
                    </div>

                    <div className={`rounded-xl p-3 space-y-2 ${clockOut ? 'bg-zinc-800' : 'bg-amber-900/20 border border-amber-800/50'}`}>
                      <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                        <LogOut size={14} /> Clock Out
                      </div>
                      {clockOut ? (
                        <>
                          <p className="text-white text-lg font-bold">
                            {new Date(clockOut.punched_at).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {clockOut.device_location && (
                            <p className="text-zinc-500 text-xs flex items-center gap-1"><MapPin size={10} />{clockOut.device_location}</p>
                          )}
                          {clockOut.photo_url && (
                            <button onClick={() => setPhotoModal(clockOut.photo_url!)} className="text-zinc-500 hover:text-white text-xs flex items-center gap-1">
                              <Camera size={12} /> Ver foto
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-amber-400 text-sm">Pendiente</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {photoModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPhotoModal(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <Image src={photoModal} alt="Foto de ponche" width={400} height={300} className="rounded-2xl w-full object-cover" />
            <button onClick={() => setPhotoModal(null)} className="absolute top-3 right-3 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
