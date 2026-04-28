'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AddEmployeeModal } from '@/components/hr/AddEmployeeModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserPlus, Search, ChevronRight, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'

interface Employee {
  id: string
  employee_code: string
  full_name: string
  department: string | null
  is_active: boolean
  created_at: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function fetchEmployees() {
    const res = await fetch('/api/hr/employees')
    const data = await res.json()
    setEmployees(data)
    setLoading(false)
  }

  useEffect(() => { fetchEmployees() }, [])

  async function deleteEmployee(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/hr/employees/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setEmployees(prev => prev.filter(e => e.id !== id))
    }
    setDeletingId(null)
    setConfirmId(null)
  }

  async function toggleActive(emp: Employee) {
    const res = await fetch(`/api/hr/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !emp.is_active }),
    })
    if (res.ok) {
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: !e.is_active } : e))
    }
  }

  const filtered = employees
    .filter(e => {
      if (filter === 'active') return e.is_active
      if (filter === 'inactive') return !e.is_active
      return true
    })
    .filter(e =>
      !search ||
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.includes(search)
    )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">Empleados</h2>
        <Button onClick={() => setShowModal(true)} className="bg-brand-red hover:bg-brand-red-dark gap-2">
          <UserPlus size={16} />
          Agregar empleado
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="bg-zinc-800 border-zinc-700 text-white pl-9 placeholder-zinc-500"
          />
        </div>
        <div className="flex bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
          {(['active', 'inactive', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm transition-colors ${filter === f ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              {f === 'active' ? 'Activos' : f === 'inactive' ? 'Inactivos' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-zinc-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-zinc-500">
            {search ? 'Sin resultados' : 'No hay empleados'}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filtered.map(emp => (
              <div key={emp.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                  {emp.employee_code}
                </div>

                <div className="flex-1 min-w-0">
                  <Link href={`/hr/employees/${emp.id}`} className="text-white font-medium hover:text-brand-red-light transition-colors">
                    {emp.full_name}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    {emp.department && <span className="text-zinc-500 text-sm">{emp.department}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {emp.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!emp.is_active && (
                    confirmId === emp.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">¿Eliminar?</span>
                        <button
                          onClick={() => deleteEmployee(emp.id)}
                          disabled={deletingId === emp.id}
                          className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white disabled:opacity-50"
                        >
                          {deletingId === emp.id ? '...' : 'Sí'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(emp.id)}
                        title="Eliminar permanentemente"
                        className="text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )
                  )}

                  <button
                    onClick={() => { setConfirmId(null); toggleActive(emp) }}
                    title={emp.is_active ? 'Desactivar' : 'Activar'}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    {emp.is_active
                      ? <ToggleRight size={22} className="text-emerald-500" />
                      : <ToggleLeft size={22} />}
                  </button>

                  <Link href={`/hr/employees/${emp.id}`} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-800/30">
          <span className="text-zinc-500 text-sm">
            {filtered.length} empleado{filtered.length !== 1 ? 's' : ''}
            {employees.filter(e => e.is_active).length !== employees.length && ` (${employees.filter(e => e.is_active).length} activos)`}
          </span>
        </div>
      </div>

      <AddEmployeeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onAdded={fetchEmployees}
      />
    </div>
  )
}
