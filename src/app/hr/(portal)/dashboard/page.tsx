'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExportButton } from '@/components/hr/ExportButton'
import { minutesToHours, minutesToHoursLabel } from '@/lib/pay-periods'
import { Calendar, Clock, AlertTriangle, ChevronRight, Bell, CalendarClock } from 'lucide-react'

interface EmployeeHours {
  employee_id: string
  full_name: string
  employee_code: string
  total_minutes: number
  session_count: number
  has_open_session: boolean
}

interface PayPeriod {
  id: string
  label: string
  start_date: string
  end_date: string
  is_closed: boolean
}

interface PendingEvent {
  id: string
  employee_id: string
  event_type: string
  leave_hours_owed: number | null
  details: Record<string, unknown> | null
  created_at: string
  employees: { full_name: string; employee_code: string } | null
}

interface DashboardData {
  current_period: PayPeriod | null
  past_periods: PayPeriod[]
  employee_hours: EmployeeHours[]
  pending_events: PendingEvent[]
}

const EVENT_LABELS: Record<string, string> = {
  leave_deduction_pending: 'Deducción pendiente',
  auto_clockout: 'Cierre automático',
  overtime_daily_warning: 'Tiempo extra diario',
  overtime_weekly_warning: 'Tiempo extra semanal',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/hr/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d && typeof d === 'object' && !d.error) setData(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">Dashboard</h2>
        {data?.current_period && (
          <ExportButton periodId={data.current_period.id} periodLabel={data.current_period.label} />
        )}
      </div>

      {/* Current period */}
      {data?.current_period ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-brand-red" />
            <span className="text-brand-red text-sm font-medium uppercase tracking-wide">Período Actual</span>
          </div>
          <p className="text-white text-xl font-bold">{data.current_period.label}</p>
          <p className="text-zinc-500 text-sm mt-1">
            {new Date(data.current_period.end_date + 'T00:00:00Z').toLocaleDateString('es-PR', { timeZone: 'UTC' })} — fin del período
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-amber-800 rounded-2xl p-5">
          <p className="text-amber-400 font-medium">No hay período de pago activo</p>
          <p className="text-zinc-500 text-sm mt-1">
            <Link href="/hr/pay-periods" className="underline hover:text-white">Crea un período de pago</Link> para comenzar a registrar horas.
          </p>
        </div>
      )}

      {/* Employee hours */}
      {(data?.employee_hours?.length ?? 0) > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
            <Clock size={16} className="text-zinc-400" />
            <h3 className="text-white font-semibold">
              {data?.current_period ? `Horas por empleado — ${data.current_period.label}` : 'Ponches registrados'}
            </h3>
          </div>

          <div className="divide-y divide-zinc-800">
            {(data?.employee_hours ?? []).map(emp => (
              <Link
                key={emp.employee_id}
                href={`/hr/employees/${emp.employee_id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-zinc-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300">
                    {emp.employee_code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{emp.full_name}</span>
                      {emp.has_open_session && (
                        <span className="flex items-center gap-1 text-amber-400 text-xs">
                          <AlertTriangle size={12} />
                          Turno abierto
                        </span>
                      )}
                    </div>
                    <span className="text-zinc-500 text-sm">{emp.session_count} sesión{emp.session_count !== 1 ? 'es' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-white font-bold text-lg">{minutesToHours(emp.total_minutes)}</span>
                    <span className="text-zinc-500 text-sm ml-1">hrs</span>
                    <p className="text-zinc-600 text-xs">{minutesToHoursLabel(emp.total_minutes)}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400" />
                </div>
              </Link>
            ))}
          </div>

          <div className="px-5 py-3 bg-zinc-800/50 border-t border-zinc-700 flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Total acumulado</span>
            <span className="text-white font-bold">
              {minutesToHours((data?.employee_hours ?? []).reduce((s, e) => s + e.total_minutes, 0))} hrs
            </span>
          </div>
        </div>
      )}

      {/* Pending events panel */}
      {(data?.pending_events?.length ?? 0) > 0 && (
        <div className="bg-zinc-900 border border-amber-800/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-amber-400" />
              <h3 className="text-white font-semibold">Alertas pendientes</h3>
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-1">
                {data!.pending_events.length}
              </span>
            </div>
            <Link href="/hr/actividad" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Ver todas →
            </Link>
          </div>
          <div className="divide-y divide-zinc-800">
            {data!.pending_events.slice(0, 5).map(event => (
              <div key={event.id} className="flex items-center gap-3 px-5 py-3.5">
                {event.event_type === 'leave_deduction_pending'
                  ? <CalendarClock size={15} className="text-amber-400 shrink-0" />
                  : <AlertTriangle size={15} className="text-orange-400 shrink-0" />
                }
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-300 text-sm font-medium">{event.employees?.full_name ?? '—'}</span>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
                      {EVENT_LABELS[event.event_type] ?? event.event_type}
                    </span>
                  </div>
                  {event.event_type === 'leave_deduction_pending' && event.leave_hours_owed && (
                    <p className="text-zinc-500 text-xs mt-0.5">Adeuda {event.leave_hours_owed}h de licencia — {String(event.details?.work_date ?? '')}</p>
                  )}
                </div>
                <span className="text-zinc-600 text-xs shrink-0">
                  {new Date(event.created_at).toLocaleDateString('es-PR')}
                </span>
              </div>
            ))}
          </div>
          {data!.pending_events.length > 5 && (
            <div className="px-5 py-3 bg-zinc-800/50 border-t border-zinc-700 text-center">
              <Link href="/hr/actividad" className="text-zinc-400 text-sm hover:text-white transition-colors">
                Ver {data!.pending_events.length - 5} más en Actividad →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Past periods */}
      {(data?.past_periods?.length ?? 0) > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-white font-semibold">Historial de períodos</h3>
          </div>
          <div className="divide-y divide-zinc-800">
            {data!.past_periods.map(period => (
              <Link
                key={period.id}
                href={`/hr/pay-periods/${period.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-zinc-500" />
                  <span className="text-zinc-300">{period.label}</span>
                  {period.is_closed && (
                    <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">Cerrado</span>
                  )}
                </div>
                <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
