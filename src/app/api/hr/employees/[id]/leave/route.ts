import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'
import {
  assignLaw,
  calculateMonthAccrual,
  enumerateMonths,
  type ApplicableLaw,
} from '@/lib/leave-accrual'
import { type PayType, DAILY_CREDITED_MINUTES } from '@/lib/pay-type-rules'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, hire_date, applicable_law, initial_vacation_hours, initial_sick_hours, pay_type, created_at')
    .eq('id', id)
    .single()

  if (empError || !employee) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  }

  if (!employee.hire_date) {
    return NextResponse.json({ error: 'missing_hire_date' }, { status: 422 })
  }

  const hireDate = new Date(employee.hire_date + 'T00:00:00')
  const applicableLaw: ApplicableLaw = (employee.applicable_law as ApplicableLaw) ?? assignLaw(hireDate)
  const payType = (employee.pay_type ?? 'regular') as PayType
  const dailyCredited = DAILY_CREDITED_MINUTES[payType] // null = use actual minutes

  const { data: sessions } = await supabase
    .from('work_sessions')
    .select('work_date, minutes_worked')
    .eq('employee_id', id)
    .not('clock_out_punch_id', 'is', null)
    .order('work_date', { ascending: true })

  // Aggregate minutes and unique work dates by calendar month
  const monthMinutesMap = new Map<string, number>()
  const monthUniqueDatesMap = new Map<string, Set<string>>()
  for (const s of sessions ?? []) {
    const key = (s.work_date as string).slice(0, 7)
    monthMinutesMap.set(key, (monthMinutesMap.get(key) ?? 0) + s.minutes_worked)
    if (!monthUniqueDatesMap.has(key)) monthUniqueDatesMap.set(key, new Set())
    monthUniqueDatesMap.get(key)!.add(s.work_date as string)
  }

  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  // Start tracking from when the employee was added to this system, not hire date
  const systemEntryDate = new Date(employee.created_at)
  const systemMonthStart = new Date(systemEntryDate.getFullYear(), systemEntryDate.getMonth(), 1)

  const months = enumerateMonths(systemMonthStart, currentMonthStart)

  // Carry over any hours the employee had accumulated before joining this system
  let totalVacationHours = parseFloat(employee.initial_vacation_hours) || 0
  let totalSickHours = parseFloat(employee.initial_sick_hours) || 0

  const monthResults = months.map(monthYear => {
    const key = monthYear.toISOString().slice(0, 7)
    // For pay types with a fixed daily credit, use uniqueDates × credit; otherwise actual minutes
    const minutesWorked = dailyCredited !== null
      ? (monthUniqueDatesMap.get(key)?.size ?? 0) * dailyCredited
      : (monthMinutesMap.get(key) ?? 0)
    const isCurrentMonth = monthYear.getTime() === currentMonthStart.getTime()

    const result = calculateMonthAccrual(
      { hireDate, applicableLaw, monthYear, minutesWorked },
      isCurrentMonth
    )

    if (!isCurrentMonth) {
      totalVacationHours += result.vacation_hours
      totalSickHours += result.sick_hours
    }

    return result
  })

  // Subtract resolved leave deductions (HR-applied)
  const { data: deductions } = await supabase
    .from('employee_events')
    .select('leave_type_applied, leave_hours_owed')
    .eq('employee_id', id)
    .eq('event_type', 'leave_deduction_applied')
    .eq('resolved', true)

  for (const d of deductions ?? []) {
    if (d.leave_type_applied === 'vacation') totalVacationHours -= (d.leave_hours_owed ?? 0)
    if (d.leave_type_applied === 'sick') totalSickHours -= (d.leave_hours_owed ?? 0)
  }

  return NextResponse.json({
    hire_date: employee.hire_date,
    applicable_law: applicableLaw,
    pay_type: payType,
    initial_vacation_hours: parseFloat(employee.initial_vacation_hours) || 0,
    initial_sick_hours: parseFloat(employee.initial_sick_hours) || 0,
    total_vacation_hours: Math.round(Math.max(0, totalVacationHours) * 100) / 100,
    total_sick_hours: Math.round(Math.max(0, totalSickHours) * 100) / 100,
    months: monthResults,
  })
}
