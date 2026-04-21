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
  hire_date: string | null
  applicable_law: 'ley_vieja' | 'ley_nueva' | null
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

interface LeaveMonth {
  month_year: string
  hours_worked: number
  qualified: boolean
  vacation_hours: number
  sick_hours: number
  years_of_service: number
  is_current_month: boolean
}

interface LeaveData {
  hire_date: string
  applicable_law: string
  total_vacation_hours: number
  total_sick_hours: number
  months: LeaveMonth[]
}

export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const id = params.id
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [punches, setPunches] = useState<Punch[]>([])
  const [leaveData, setLeaveData] = useState<LeaveData | null>(null)
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

    // Leave fetched independently so a failure never crashes the main view
    fetch(`/api/hr/employees/${id}/leave`)
      .then(r => r.json())
      .then(leave => { if (leave && !leave.error) setLeaveData(leave) })
      .catch(() => {})
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

  const lawLabel = employee.applicable_law === 'ley_vieja'
    ? 'Ley Vieja — Núm. 180'
    : employee.applicable_law === 'ley_nueva'
    ? 'Ley Nueva — Núm. 4 de 2017'
    : null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/hr/employees" className="text-zinc-500 hover:text-zinc-900 transition-colors mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-300">
              {employee.employee_code}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">{employee.full_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {employee.department && <span className="text-zinc-500 text-sm">{employee.department}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${employee.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  {employee.is_active ? 'Activo' : 'Inactivo'}
                </span>
                {employee.hire_date && (
                  <span className="text-zinc-400 text-xs">
                    Contratado: {new Date(employee.hire_date + 'T00:00:00').toLocaleDateString('es-PR')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Licencias card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">Licencias</h3>
            <p className="text-zinc-500 text-sm mt-0.5">Acumulado bajo ley laboral de Puerto Rico</p>
          </div>
          {lawLabel && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              employee.applicable_law === 'ley_vieja'
                ? 'bg-amber-900/40 text-amber-400'
                : 'bg-purple-900/40 text-purple-400'
            }`}>
              {lawLabel}
            </span>
          )}
        </div>

        {!employee.hire_date ? (
          <div className="px-5 py-6 text-center text-zinc-500 text-sm">
            Falta la fecha de contratación. Edita el empleado para agregar esta información.
          </div>
        ) : !leaveData ? (
          <div className="px-5 py-6 text-center text-zinc-500 text-sm">
            No hay datos de licencia disponibles aún.
          </div>
        ) : (
          <>
            {/* Balance totals */}
            <div className="grid grid-cols-2 divide-x divide-zinc-800 border-b border-zinc-800">
              <div className="px-5 py-4">
                <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Vacaciones acumuladas</p>
                <p className="text-white text-2xl font-bold">
                  {leaveData.total_vacation_hours.toFixed(1)}
                  <span className="text-zinc-400 text-sm font-normal ml-1">hrs</span>
                </p>
                <p className="text-zinc-600 text-xs mt-1">{(leaveData.total_vacation_hours / 8).toFixed(2)} días</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Enfermedad acumulada</p>
                <p className="text-white text-2xl font-bold">
                  {leaveData.total_sick_hours.toFixed(1)}
                  <span className="text-zinc-400 text-sm font-normal ml-1">hrs</span>
                </p>
                <p className="text-zinc-600 text-xs mt-1">{(leaveData.total_sick_hours / 8).toFixed(2)} días</p>
              </div>
            </div>

            {/* Monthly breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-3 text-left text-zinc-500 text-xs uppercase tracking-wide">Mes</th>
                    <th className="px-4 py-3 text-right text-zinc-500 text-xs uppercase tracking-wide">Horas</th>
                    <th className="px-4 py-3 text-center text-zinc-500 text-xs uppercase tracking-wide">Calificó</th>
                    <th className="px-4 py-3 text-right text-zinc-500 text-xs uppercase tracking-wide">Vacac.</th>
                    <th className="px-4 py-3 text-right text-zinc-500 text-xs uppercase tracking-wide">Enferm.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {[...leaveData.months].reverse().map((m) => (
                    <tr key={m.month_year} className={m.is_current_month ? 'opacity-60' : ''}>
                      <td className="px-5 py-3 text-zinc-300">
                        {new Date(m.month_year).toLocaleDateString('es-PR', {
                          month: 'short', year: 'numeric', timeZone: 'UTC'
                        })}
                        {m.is_current_month && (
                          <span className="ml-2 text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
                            En progreso
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">{m.hours_worked.toFixed(1)}</td>
                      <td className="px-4 py-3 text-center">
                        {m.qualified
                          ? <span className="text-emerald-400 text-xs font-medium">Sí</span>
                          : <span className="text-zinc-600 text-xs">No</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">
                        {m.vacation_hours > 0 ? `${m.vacation_hours}h` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">
                        {m.sick_hours > 0 ? `${m.sick_hours}h` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Punch history card */}
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
