import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { data: period, error } = await supabase
    .from('pay_periods')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !period) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })

  // Get employee hours for this period
  const { data: sessions } = await supabase
    .from('work_sessions')
    .select('employee_id, minutes_worked, work_date, employees(full_name, employee_code)')
    .eq('pay_period_id', id)
    .not('clock_out_punch_id', 'is', null)

  // Aggregate by employee
  const employeeMap = new Map<string, { employee_id: string; full_name: string; employee_code: string; total_minutes: number; session_count: number }>()

  for (const session of sessions || []) {
    const emp = session.employees as unknown as { full_name: string; employee_code: string } | null
    if (!emp) continue
    const key = session.employee_id
    if (!employeeMap.has(key)) {
      employeeMap.set(key, {
        employee_id: key,
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        total_minutes: 0,
        session_count: 0,
      })
    }
    const entry = employeeMap.get(key)!
    entry.total_minutes += session.minutes_worked
    entry.session_count += 1
  }

  return NextResponse.json({
    period,
    employees: Array.from(employeeMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name)),
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  if (body.is_current === true) {
    await supabase.from('pay_periods').update({ is_current: false }).eq('is_current', true)
  }

  const updates: Record<string, unknown> = {}
  if (body.is_current !== undefined) updates.is_current = body.is_current
  if (body.is_closed !== undefined) updates.is_closed = body.is_closed

  const { data, error } = await supabase
    .from('pay_periods')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
