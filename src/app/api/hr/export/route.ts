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
    .select('employee_id, minutes_worked, employees(full_name, quickbooks_display_name, pay_type)')
    .eq('pay_period_id', periodId)
    .not('clock_out_punch_id', 'is', null)
    .gt('minutes_worked', 0)

  // Aggregate totals per employee
  const employeeMap = new Map<string, {
    employee_name: string
    quickbooks_display_name: string | null
    pay_type: string
    total_minutes: number
    session_count: number
  }>()

  for (const session of sessions || []) {
    const emp = session.employees as unknown as { full_name: string; quickbooks_display_name: string | null; pay_type: string } | null
    if (!emp) continue
    if (!employeeMap.has(session.employee_id)) {
      employeeMap.set(session.employee_id, {
        employee_name: emp.full_name,
        quickbooks_display_name: emp.quickbooks_display_name,
        pay_type: emp.pay_type ?? 'regular',
        total_minutes: 0,
        session_count: 0,
      })
    }
    const entry = employeeMap.get(session.employee_id)!
    entry.total_minutes += session.minutes_worked
    entry.session_count += 1
  }

  // For exempt employees substitute actual minutes with 8h × session count
  const employees = Array.from(employeeMap.values()).map(e => ({
    ...e,
    total_minutes: e.pay_type === 'exempt' ? e.session_count * 480 : e.total_minutes,
  }))

  const csv = buildQuickBooksCSV(employees, period)

  const filename = `dmart-nomina-${period.start_date}-al-${period.end_date}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
