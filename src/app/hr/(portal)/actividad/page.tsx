'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, CheckCircle, Clock, AlertTriangle, CalendarClock, Filter } from 'lucide-react'

interface EmployeeRef {
  full_name: string
  employee_code: string
}

interface HREvent {
  id: string
  employee_id: string
  event_type: string
  leave_hours_owed: number | null
  leave_type_applied: string | null
  resolved: boolean
  hr_notes: string | null
  details: Record<string, unknown> | null
  created_at: string
  resolved_at: string | null
  employees: EmployeeRef | null
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  auto_clockout: 'Cierre automático',
  missed_clockout_warning: 'Ponche faltante',
  leave_deduction_pending: 'Deducción de licencia pendiente',
  leave_deduction_applied: 'Deducción aplicada',
  overtime_daily_warning: 'Tiempo extra diario',
  overtime_weekly_warning: 'Tiempo extra semanal',
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function EventIcon({ type }: { type: string }) {
  if (type === 'leave_deduction_pending' || type === 'leave_deduction_applied') {
    return <CalendarClock size={16} className="text-amber-400" />
  }
  if (type === 'auto_clockout') {
    return <Clock size={16} className="text-blue-400" />
  }
  return <AlertTriangle size={16} className="text-orange-400" />
}

function EventDetail({ event }: { event: HREvent }) {
  const d = event.details
  if (!d) return null

  if (event.event_type === 'leave_deduction_pending' && event.leave_hours_owed) {
    return (
      <span className="text-zinc-400 text-sm">
        {formatMinutes(d.actual_minutes as number)} trabajados / mínimo {formatMinutes(d.threshold_minutes as number)} — adeuda {event.leave_hours_owed}h de licencia
      </span>
    )
  }
  if (event.event_type === 'leave_deduction_applied') {
    const typeLabel = event.leave_type_applied === 'vacation' ? 'Vacaciones' : 'Enfermedad'
    return (
      <span className="text-zinc-400 text-sm">
        {event.leave_hours_owed}h deducidas de {typeLabel}
      </span>
    )
  }
  if (event.event_type === 'auto_clockout') {
    return (
      <span className="text-zinc-400 text-sm">
        Cerrado automáticamente — {formatMinutes(d.minutes_worked as number)} trabajados
      </span>
    )
  }
  if (event.event_type === 'overtime_daily_warning') {
    return (
      <span className="text-zinc-400 text-sm">
        {formatMinutes(d.actual_minutes as number)} en el día / máximo {formatMinutes(d.max_minutes as number)}
      </span>
    )
  }
  if (event.event_type === 'overtime_weekly_warning') {
    return (
      <span className="text-zinc-400 text-sm">
        {formatMinutes(d.week_actual_minutes as number)} en la semana / máximo {formatMinutes(d.max_minutes as number)}
      </span>
    )
  }
  return null
}

export default function ActividadPage() {
  const [events, setEvents] = useState<HREvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'unresolved' | 'all'>('unresolved')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [resolving, setResolving] = useState<string | null>(null)

  const fetchEvents = useCallback(() => {
    setLoading(true)
    const resolved = filter === 'all' ? 'all' : 'false'
    const typeParam = typeFilter !== 'all' ? `&event_type=${typeFilter}` : ''
    fetch(`/api/hr/events?resolved=${resolved}&limit=100${typeParam}`)
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter, typeFilter])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  async function resolveEvent(id: string, leaveType?: 'vacation' | 'sick') {
    setResolving(id)
    try {
      await fetch(`/api/hr/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveType ? { leave_type: leaveType } : {}),
      })
      fetchEvents()
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={22} className="text-zinc-400" />
          <h2 className="text-2xl font-bold text-zinc-900">Actividad</h2>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-zinc-400" />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'unresolved' | 'all')}
            className="text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700"
          >
            <option value="unresolved">Pendientes</option>
            <option value="all">Todos</option>
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700"
          >
            <option value="all">Todos los tipos</option>
            <option value="leave_deduction_pending">Deducciones pendientes</option>
            <option value="leave_deduction_applied">Deducciones aplicadas</option>
            <option value="auto_clockout">Cierres automáticos</option>
            <option value="overtime_daily_warning">Tiempo extra diario</option>
            <option value="overtime_weekly_warning">Tiempo extra semanal</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500 py-12 text-center">Cargando...</div>
      ) : events.length === 0 ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-10 text-center">
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-zinc-600 font-medium">Todo al día</p>
          <p className="text-zinc-400 text-sm mt-1">No hay eventos {filter === 'unresolved' ? 'pendientes' : 'registrados'}.</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100">
          {events.map(event => (
            <div key={event.id} className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5">
                  <EventIcon type={event.event_type} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-zinc-900 text-sm">
                      {event.employees?.full_name ?? '—'}
                    </span>
                    <span className="text-zinc-400 text-xs">#{event.employees?.employee_code}</span>
                    <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                      {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                    </span>
                    {event.resolved && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Resuelto</span>
                    )}
                  </div>
                  <div className="mt-0.5">
                    <EventDetail event={event} />
                  </div>
                  <p className="text-zinc-400 text-xs mt-1">
                    {new Date(event.created_at).toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short' })}
                    {event.details?.work_date ? ` — ${event.details.work_date}` : ''}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {!event.resolved && (
                <div className="flex items-center gap-2 shrink-0">
                  {event.event_type === 'leave_deduction_pending' ? (
                    <>
                      <button
                        disabled={resolving === event.id}
                        onClick={() => resolveEvent(event.id, 'vacation')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium disabled:opacity-50 transition-colors"
                      >
                        Vacaciones
                      </button>
                      <button
                        disabled={resolving === event.id}
                        onClick={() => resolveEvent(event.id, 'sick')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 font-medium disabled:opacity-50 transition-colors"
                      >
                        Enfermedad
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={resolving === event.id}
                      onClick={() => resolveEvent(event.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 font-medium disabled:opacity-50 transition-colors"
                    >
                      Marcar revisado
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
