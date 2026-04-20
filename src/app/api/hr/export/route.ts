import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'
import { buildQuickBooksCSV } from '@/lib/csv-export'

export async function GET(request: NextRequest) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const periodId = searchParams.get('period_id')

  if (!periodId) {
    return NextResponse.json({ error: 'period_id es requerido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: period, error: periodError } = await supabase
    .from('pay_periods')
    .select('id, label, start_date, end_date')
    .eq('id', periodId)
    .single()

  if (periodError || !period) {
    return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  }

  const { data: sessions } = await supabase
    .from('work_sessions')
    .select('employee_id, minutes_worked, employees(full_name, quickbooks_display_name)')
    .eq('pay_period_id', periodId)
    .not('clock_out_punch_id', 'is', null)
    .gt('minutes_worked', 0)

  // Aggregate totals per employee
  const employeeMap = new Map<string, {
    employee_name: string
    quickbooks_display_name: string | null
    total_minutes: number
  }>()

  for (const session of sessions || []) {
    const emp = session.employees as unknown as { full_name: string; quickbooks_display_name: string | null } | null
    if (!emp) continue
    if (!employeeMap.has(session.employee_id)) {
      employeeMap.set(session.employee_id, {
        employee_name: emp.full_name,
        quickbooks_display_name: emp.quickbooks_display_name,
        total_minutes: 0,
      })
    }
    employeeMap.get(session.employee_id)!.total_minutes += session.minutes_worked
  }

  const employees = Array.from(employeeMap.values())
  const csv = buildQuickBooksCSV(employees, period)

  const filename = `dmart-nomina-${period.start_date}-al-${period.end_date}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
