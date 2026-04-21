import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'
import {
  assignLaw,
  calculateMonthAccrual,
  enumerateMonths,
  type ApplicableLaw,
} from '@/lib/leave-accrual'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = params
  const supabase = createServiceClient()

  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, hire_date, applicable_law')
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

  const { data: sessions } = await supabase
    .from('work_sessions')
    .select('work_date, minutes_worked')
    .eq('employee_id', id)
    .not('clock_out_punch_id', 'is', null)
    .order('work_date', { ascending: true })

  // Aggregate minutes by calendar month
  const monthMap = new Map<string, number>()
  for (const s of sessions ?? []) {
    const key = (s.work_date as string).slice(0, 7)
    monthMap.set(key, (monthMap.get(key) ?? 0) + s.minutes_worked)
  }

  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const hireMonthStart = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1)

  const months = enumerateMonths(hireMonthStart, currentMonthStart)

  let totalVacationHours = 0
  let totalSickHours = 0

  const monthResults = months.map(monthYear => {
    const key = monthYear.toISOString().slice(0, 7)
    const minutesWorked = monthMap.get(key) ?? 0
    const isCurrentMonth = monthYear.getTime() === currentMonthStart.getTime()

    const result = calculateMonthAccrual(
      { hireDate, applicableLaw, monthYear, minutesWorked },
      isCurrentMonth
    )

    if (!isCurrentMonth) {
      totalVacationHours += result.vacationHours
      totalSickHours += result.sickHours
    }

    return result
  })

  return NextResponse.json({
    hire_date: employee.hire_date,
    applicable_law: applicableLaw,
    total_vacation_hours: Math.round(totalVacationHours * 100) / 100,
    total_sick_hours: Math.round(totalSickHours * 100) / 100,
    months: monthResults,
  })
}
