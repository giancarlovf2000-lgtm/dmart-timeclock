import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'
import { creditedMinutes, type PayType } from '@/lib/pay-type-rules'

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
    .select('employee_id, minutes_worked, work_date, employees(full_name, employee_code, pay_type)')
    .eq('pay_period_id', id)
    .not('clock_out_punch_id', 'is', null)

  // Aggregate by employee
  const employeeMap = new Map<string, { employee_id: string; full_name: string; employee_code: string; pay_type: string; total_minutes: number; session_count: number; uniqueDates: Set<string> }>()

  for (const session of sessions || []) {
    const emp = session.employees as unknown as { full_name: string; employee_code: string; pay_type: string } | null
    if (!emp) continue
    const key = session.employee_id
    if (!employeeMap.has(key)) {
      employeeMap.set(key, {
        employee_id: key,
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        pay_type: emp.pay_type ?? 'regular',
        total_minutes: 0,
        session_count: 0,
        uniqueDates: new Set(),
      })
    }
    const entry = employeeMap.get(key)!
    entry.total_minutes += session.minutes_worked
    entry.session_count += 1
    entry.uniqueDates.add(session.work_date as string)
  }

  const employees = Array.from(employeeMap.values())
    .map(e => ({
      ...e,
      total_minutes: creditedMinutes(e.pay_type as PayType, e.uniqueDates.size, e.total_minutes),
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return NextResponse.json({ period, employees })
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
