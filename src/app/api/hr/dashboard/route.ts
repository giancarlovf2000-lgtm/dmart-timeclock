import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'

export async function GET(request: NextRequest) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const supabase = createServiceClient()

  const { data: currentPeriod } = await supabase
    .from('pay_periods')
    .select('*')
    .eq('is_current', true)
    .single()

  const { data: pastPeriods } = await supabase
    .from('pay_periods')
    .select('id, label, start_date, end_date, is_closed')
    .eq('is_current', false)
    .order('start_date', { ascending: false })
    .limit(20)

  // Query sessions: if current period exists use date range, else show all recent
  let sessionsQuery = supabase
    .from('work_sessions')
    .select('employee_id, minutes_worked, work_date, clock_out_punch_id, employees(id, full_name, employee_code, is_active, pay_type)')
    .not('clock_out_punch_id', 'is', null)

  if (currentPeriod) {
    sessionsQuery = sessionsQuery
      .gte('work_date', currentPeriod.start_date)
      .lte('work_date', currentPeriod.end_date)
  }

  const { data: sessions } = await sessionsQuery

  // Open sessions (clocked in but no clock out)
  let openQuery = supabase
    .from('work_sessions')
    .select('employee_id, employees(full_name, employee_code)')
    .is('clock_out_punch_id', null)

  if (currentPeriod) {
    openQuery = openQuery
      .gte('work_date', currentPeriod.start_date)
      .lte('work_date', currentPeriod.end_date)
  }

  const { data: openSessions } = await openQuery
  const openEmployeeIds = new Set((openSessions || []).map(s => s.employee_id))

  const employeeMap = new Map<string, {
    employee_id: string
    full_name: string
    employee_code: string
    is_active: boolean
    pay_type: string
    total_minutes: number
    session_count: number
    uniqueDates: Set<string>
    has_open_session: boolean
  }>()

  for (const session of sessions || []) {
    const emp = session.employees as unknown as { id: string; full_name: string; employee_code: string; is_active: boolean; pay_type: string } | null
    if (!emp) continue
    if (!employeeMap.has(session.employee_id)) {
      employeeMap.set(session.employee_id, {
        employee_id: session.employee_id,
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        is_active: emp.is_active,
        pay_type: emp.pay_type ?? 'regular',
        total_minutes: 0,
        session_count: 0,
        uniqueDates: new Set(),
        has_open_session: openEmployeeIds.has(session.employee_id),
      })
    }
    const entry = employeeMap.get(session.employee_id)!
    entry.total_minutes += session.minutes_worked
    entry.session_count += 1
    entry.uniqueDates.add(session.work_date as string)
  }

  for (const openSession of openSessions || []) {
    const emp = openSession.employees as unknown as { full_name: string; employee_code: string } | null
    if (!emp || employeeMap.has(openSession.employee_id)) continue
    employeeMap.set(openSession.employee_id, {
      employee_id: openSession.employee_id,
      full_name: emp.full_name,
      employee_code: emp.employee_code,
      is_active: true,
      pay_type: 'regular',
      total_minutes: 0,
      session_count: 0,
      uniqueDates: new Set(),
      has_open_session: true,
    })
  }

  const employee_hours = Array.from(employeeMap.values())
    .map(e => ({
      ...e,
      total_minutes: e.pay_type === 'exempt' ? e.uniqueDates.size * 480 : e.total_minutes,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return NextResponse.json({
    current_period: currentPeriod ?? null,
    past_periods: pastPeriods || [],
    employee_hours,
  })
}
