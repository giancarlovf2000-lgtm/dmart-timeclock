'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Copy } from 'lucide-react'
import { assignLaw, LEY_NUEVA_CUTOFF, type ApplicableLaw } from '@/lib/leave-accrual'

interface Props {
  open: boolean
  onClose: () => void
  onAdded: () => void
}

export function AddEmployeeModal({ open, onClose, onAdded }: Props) {
  const [fullName, setFullName] = useState('')
  const [qbName, setQbName] = useState('')
  const [department, setDepartment] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [lawOverride, setLawOverride] = useState<'auto' | ApplicableLaw>('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ employee_code: string; full_name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const autoLaw: ApplicableLaw | null = hireDate
    ? assignLaw(new Date(hireDate + 'T00:00:00'))
    : null

  const effectiveLaw: ApplicableLaw | null = lawOverride === 'auto' ? autoLaw : lawOverride

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          quickbooks_display_name: qbName.trim() || fullName.trim(),
          department: department.trim(),
          hire_date: hireDate || null,
          applicable_law: effectiveLaw || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al crear empleado')
        return
      }
      setCreated(data)
      onAdded()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  function handleCopyCode() {
    if (!created) return
    navigator.clipboard.writeText(created.employee_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    setFullName('')
    setQbName('')
    setDepartment('')
    setHireDate('')
    setLawOverride('auto')
    setError('')
    setCreated(null)
    setCopied(false)
    onClose()
  }

  function toggleLaw() {
    if (lawOverride === 'auto') {
      setLawOverride(effectiveLaw === 'ley_vieja' ? 'ley_nueva' : 'ley_vieja')
    } else {
      setLawOverride('auto')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {created ? 'Empleado creado' : 'Agregar empleado'}
          </DialogTitle>
        </DialogHeader>

        {!created ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Nombre completo *</label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ej: María Rodríguez"
                className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Nombre en QuickBooks</label>
              <Input
                value={qbName}
                onChange={e => setQbName(e.target.value)}
                placeholder="Igual al nombre en QuickBooks (opcional)"
                className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500"
              />
              <p className="text-zinc-500 text-xs mt-1">Si está vacío, se usa el nombre completo</p>
            </div>
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Departamento</label>
              <Input
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="Opcional"
                className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Fecha de contratación</label>
              <Input
                type="date"
                value={hireDate}
                onChange={e => { setHireDate(e.target.value); setLawOverride('auto') }}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>

            {/* Law preview — shown once hire date is entered */}
            {effectiveLaw && (
              <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-800 rounded-lg">
                <div>
                  <p className="text-zinc-500 text-xs mb-1">Ley laboral aplicable</p>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    effectiveLaw === 'ley_vieja'
                      ? 'bg-amber-900/40 text-amber-400'
                      : 'bg-purple-900/40 text-purple-400'
                  }`}>
                    {effectiveLaw === 'ley_vieja'
                      ? 'Ley Vieja — Núm. 180 de 1998'
                      : 'Ley Nueva — Núm. 4 de 2017'}
                  </span>
                  {lawOverride !== 'auto' && (
                    <span className="ml-2 text-xs text-zinc-500">ajustado manualmente</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleLaw}
                  className="text-xs text-zinc-400 hover:text-white underline shrink-0 ml-3"
                >
                  {lawOverride === 'auto' ? 'Cambiar' : 'Restablecer'}
                </button>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !fullName.trim()} className="flex-1 bg-brand-red hover:bg-brand-red-dark">
                {loading ? 'Creando...' : 'Crear empleado'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-emerald-900/30 border border-emerald-700 rounded-lg">
              <CheckCircle2 className="text-emerald-400 shrink-0" size={24} />
              <div>
                <p className="text-white font-semibold">{created.full_name}</p>
                <p className="text-zinc-400 text-sm">Empleado registrado exitosamente</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-800 rounded-lg text-center">
              <p className="text-zinc-400 text-sm mb-2">Código de acceso asignado</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-bold text-white tracking-widest">{created.employee_code}</span>
                <button
                  onClick={handleCopyCode}
                  className="text-zinc-400 hover:text-white transition-colors"
                  title="Copiar código"
                >
                  {copied ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Copy size={20} />}
                </button>
              </div>
              <p className="text-zinc-500 text-xs mt-3">Comparte este código con el empleado para que pueda ponchar</p>
            </div>

            <Button onClick={handleClose} className="w-full bg-zinc-700 hover:bg-zinc-600">
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
