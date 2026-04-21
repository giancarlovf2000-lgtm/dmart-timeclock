'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarPlus, ChevronRight, Calendar, Check } from 'lucide-react'
import { getNextPeriodDates, formatPeriodLabel } from '@/lib/pay-periods'

interface PayPeriod {
  id: string
  label: string
  start_date: string
  end_date: string
  is_current: boolean
  is_closed: boolean
  created_at: string
}

export default function PayPeriodsPage() {
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [periodType, setPeriodType] = useState<'biweekly' | 'semi_monthly'>('biweekly')
  const [setCurrent, setSetCurrent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [previewLabel, setPreviewLabel] = useState('')

  async function fetchPeriods() {
    try {
      const res = await fetch('/api/hr/pay-periods')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error cargando períodos')
      setPeriods(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPeriods() }, [])

  useEffect(() => {
    if (!startDate) { setPreviewLabel(''); return }
    try {
      const { start, end } = getNextPeriodDates(new Date(startDate + 'T00:00:00Z'), periodType)
      setPreviewLabel(formatPeriodLabel(start, end))
    } catch {
      setPreviewLabel('')
    }
  }, [startDate, periodType])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate) return
    setSubmitting(true)
    setFormError('')

    try {
      const res = await fetch('/api/hr/pay-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate, period_type: periodType, set_current: setCurrent }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Error creando período'); return }

      setShowForm(false)
      setStartDate('')
      setSetCurrent(false)
      fetchPeriods()
    } catch {
      setFormError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  async function markCurrent(periodId: string) {
    try {
      await fetch(`/api/hr/pay-periods/${periodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_current: true }),
      })
      fetchPeriods()
    } catch {
      // silently retry on next load
    }
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">Períodos de Pago</h2>
        <Button onClick={() => setShowForm(!showForm)} className="bg-brand-red hover:bg-brand-red-dark gap-2">
          <CalendarPlus size={16} />
          Nuevo período
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-semibold">Crear nuevo período</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 block mb-1.5">Tipo de período</label>
              <Select value={periodType} onValueChange={v => setPeriodType(v as 'biweekly' | 'semi_monthly')}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectItem value="biweekly" className="text-white focus:bg-zinc-700 focus:text-white">Bi-semanal (14 días)</SelectItem>
                  <SelectItem value="semi_monthly" className="text-white focus:bg-zinc-700 focus:text-white">Quincenal (1-15 / 16-fin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-zinc-400 block mb-1.5">Fecha de inicio</label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>

          {previewLabel && (
            <div className="bg-zinc-800 rounded-lg px-4 py-2">
              <span className="text-zinc-400 text-sm">Vista previa: </span>
              <span className="text-white text-sm font-medium">{previewLabel}</span>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={setCurrent}
              onChange={e => setSetCurrent(e.target.checked)}
              className="accent-brand-red"
            />
            <span className="text-zinc-300 text-sm">Marcar como período actual</span>
          </label>

          {formError && <p className="text-red-400 text-sm">{formError}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !startDate} className="flex-1 bg-brand-red hover:bg-brand-red-dark">
              {submitting ? 'Creando...' : 'Crear período'}
            </Button>
          </div>
        </form>
      )}

      {/* Periods list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-zinc-500">Cargando...</div>
        ) : periods.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-zinc-500">No hay períodos creados</p>
            <p className="text-zinc-600 text-sm">Crea un período para comenzar a registrar horas</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {periods.map(period => (
              <div key={period.id} className="flex items-center gap-4 px-5 py-4">
                <Calendar size={18} className={period.is_current ? 'text-brand-red' : 'text-zinc-500'} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/hr/pay-periods/${period.id}`} className="text-white font-medium hover:text-brand-red-light transition-colors">
                      {period.label}
                    </Link>
                    {period.is_current && (
                      <span className="text-xs bg-brand-red/15 text-brand-red border border-brand-red/30 px-2 py-0.5 rounded-full">Actual</span>
                    )}
                    {period.is_closed && (
                      <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">Cerrado</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!period.is_current && !period.is_closed && (
                    <button
                      onClick={() => markCurrent(period.id)}
                      className="text-xs text-zinc-500 hover:text-brand-red transition-colors flex items-center gap-1"
                      title="Marcar como actual"
                    >
                      <Check size={14} />
                      Marcar actual
                    </button>
                  )}
                  <Link href={`/hr/pay-periods/${period.id}`} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
