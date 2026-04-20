'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

interface Props {
  periodId: string
  periodLabel?: string
}

export function ExportButton({ periodId, periodLabel }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/export?period_id=${periodId}`)
      if (!res.ok) {
        alert('Error al generar el CSV')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'nomina.csv'
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      className="bg-emerald-700 hover:bg-emerald-600 text-white gap-2"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {loading ? 'Generando...' : 'Exportar QuickBooks CSV'}
    </Button>
  )
}
