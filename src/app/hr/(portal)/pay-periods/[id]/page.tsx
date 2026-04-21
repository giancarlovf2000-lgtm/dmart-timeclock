'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExportButton } from '@/components/hr/ExportButton'
import { minutesToHours, minutesToHoursLabel } from '@/lib/pay-periods'
import { ArrowLeft, ChevronRight, AlertTriangle } from 'lucide-react'

interface PayPeriod {
  id: string
  label: string
  start_date: string
  end_date: string
  is_current: boolean
  is_closed: boolean
}

interface EmployeeHours {
  employee_id: string
  full_name: string
  employee_code: string
  total_minutes: number
  session_count: number
}

export default function PayPeriodDetailPage({ params }: { params: { id: string } }) {
  const id = params.id
  const [period, setPeriod] = useState<PayPeriod | null>(null)
  const [employees, setEmployees] = useState<EmployeeHours[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/hr/pay-periods/${id}`)
      .then(r => r.json())
      .then(data => {
        setPeriod(data.period ?? null)
        setEmployees(Array.isArray(data.employees) ? data.employees : [])
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="p-6 text-zinc-500">Cargando...</div>
  if (!period) return <div className="p-6 text-red-400">Período no encontrado</div>

  const totalMinutes = employees.reduce((s, e) => s + e.total_minutes, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/hr/pay-periods" className="text-zinc-500 hover:text-white transition-colors mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">{period.label}</h2>
              <div className="flex items-center gap-2 mt-1">
                {period.is_current && (
                  <span className="text-xs bg-brand-red/15 text-brand-red border border-brand-red/30 px-2 py-0.5 rounded-full">Período actual</span>
                )}
                {period.is_closed && (
                  <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">Cerrado</span>
                )}
              </div>
            </div>
            <ExportButton periodId={period.id} periodLabel={period.label} />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Empleados</p>
          <p className="text-white text-3xl font-bold">{employees.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Total horas</p>
          <p className="text-white text-3xl font-bold">{minutesToHours(totalMinutes)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Sesiones</p>
          <p className="text-white text-3xl font-bold">{employees.reduce((s, e) => s + e.session_count, 0)}</p>
        </div>
      </div>

      {/* Employee breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold">Desglose por empleado</h3>
        </div>

        {employees.length === 0 ? (
          <div className="py-10 text-center">
            <AlertTriangle className="mx-auto text-amber-500 mb-2" size={24} />
            <p className="text-zinc-500">No hay horas registradas en este período</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-800">
              {employees.map(emp => (
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
                      <p className="text-white font-medium">{emp.full_name}</p>
                      <p className="text-zinc-500 text-sm">{emp.session_count} sesión{emp.session_count !== 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-white font-bold text-xl">{minutesToHours(emp.total_minutes)}</span>
                      <span className="text-zinc-500 text-sm ml-1">hrs</span>
                      <p className="text-zinc-600 text-xs">{minutesToHoursLabel(emp.total_minutes)}</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="px-5 py-3 bg-zinc-800/50 border-t border-zinc-700 flex justify-between">
              <span className="text-zinc-400 text-sm font-medium">Total del período</span>
              <span className="text-white font-bold">{minutesToHours(totalMinutes)} hrs ({minutesToHoursLabel(totalMinutes)})</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
