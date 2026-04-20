import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'

export async function GET(request: NextRequest) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const supabase = createServiceClient()

  // Get current pay period
  const { data: currentPeriod } = await supabase
    .from('pay_periods')
    .select('*')
    .eq('is_current', true)
    .single()

  // Get past periods
  const { data: pastPeriods } = await supabase
    .from('pay_periods')
    .select('id, label, start_date, end_date, is_closed')
    .eq('is_current', false)
    .order('start_date', { ascending: false })
    .limit(20)

  if (!currentPeriod) {
    return NextResponse.json({
      current_period: null,
      past_periods: pastPeriods || [],
      employee_hours: [],
    })
  }

  // Get hours for current period
  const { data: sessions } = await supabase
    .from('work_sessions')
    .select('employee_id, minutes_worked, employees(id, full_name, employee_code, is_active)')
    .eq('pay_period_id', currentPeriod.id)
    .not('clock_out_punch_id', 'is', null)

  // Check for open sessions (clocked in but no clock out)
  const { data: openSessions } = await supabase
    .from('work_sessions')
    .select('employee_id, employees(full_name, employee_code)')
    .eq('pay_period_id', currentPeriod.id)
    .is('clock_out_punch_id', null)

  const openEmployeeIds = new Set((openSessions || []).map(s => s.employee_id))

  const employeeMap = new Map<string, {
    employee_id: string
    full_name: string
    employee_code: string
    is_active: boolean
    total_minutes: number
    session_count: number
    has_open_session: boolean
  }>()

  for (const session of sessions || []) {
    const emp = session.employees as unknown as { id: string; full_name: string; employee_code: string; is_active: boolean } | null
    if (!emp) continue
    if (!employeeMap.has(session.employee_id)) {
      employeeMap.set(session.employee_id, {
        employee_id: session.employee_id,
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        is_active: emp.is_active,
        total_minutes: 0,
        session_count: 0,
        has_open_session: openEmployeeIds.has(session.employee_id),
      })
    }
    const entry = employeeMap.get(session.employee_id)!
    entry.total_minutes += session.minutes_worked
    entry.session_count += 1
  }

  // Include employees with open sessions even if no completed sessions
  for (const openSession of openSessions || []) {
    const emp = openSession.employees as unknown as { full_name: string; employee_code: string } | null
    if (!emp || employeeMap.has(openSession.employee_id)) continue
    employeeMap.set(openSession.employee_id, {
      employee_id: openSession.employee_id,
      full_name: emp.full_name,
      employee_code: emp.employee_code,
      is_active: true,
      total_minutes: 0,
      session_count: 0,
      has_open_session: true,
    })
  }

  return NextResponse.json({
    current_period: currentPeriod,
    past_periods: pastPeriods || [],
    employee_hours: Array.from(employeeMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name)),
  })
}
