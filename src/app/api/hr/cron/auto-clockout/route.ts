import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { autoCloseAfterMinutes, DEDUCTION_THRESHOLD_MINUTES, DAILY_MAX_MINUTES, WEEKLY_MAX_MINUTES, type PayType } from '@/lib/pay-type-rules'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  // Fetch all open sessions with employee pay_type and clock-in time
  const { data: openSessions } = await supabase
    .from('work_sessions')
    .select('id, employee_id, clock_in_punch_id, work_date, employees(pay_type, full_name)')
    .is('clock_out_punch_id', null)

  if (!openSessions || openSessions.length === 0) {
    return NextResponse.json({ closed: 0 })
  }

  let closed = 0

  for (const session of openSessions) {
    const emp = session.employees as unknown as { pay_type: string; full_name: string } | null
    if (!emp) continue

    const payType = (emp.pay_type ?? 'regular') as PayType

    // Get the clock-in punch time
    const { data: clockInPunch } = await supabase
      .from('punch_records')
      .select('punched_at')
      .eq('id', session.clock_in_punch_id)
      .single()

    if (!clockInPunch) continue

    const clockInAt = new Date(clockInPunch.punched_at)
    const expectedCloseMinutes = autoCloseAfterMinutes(payType, clockInAt)
    const expectedCloseAt = new Date(clockInAt.getTime() + expectedCloseMinutes * 60000)

    if (now < expectedCloseAt) continue

    // Auto-close this session
    try {
      const minutesWorked = Math.round((expectedCloseAt.getTime() - clockInAt.getTime()) / 60000)

      // Insert synthetic CLOCK_OUT punch
      const { data: syntheticPunch, error: punchErr } = await supabase
        .from('punch_records')
        .insert({
          employee_id: session.employee_id,
          punch_type: 'CLOCK_OUT',
          device_location: 'auto-close',
          punched_at: expectedCloseAt.toISOString(),
        })
        .select('id')
        .single()

      if (punchErr || !syntheticPunch) continue

      // Close the work session
      await supabase
        .from('work_sessions')
        .update({
          clock_out_punch_id: syntheticPunch.id,
          minutes_worked: Math.max(0, minutesWorked),
          updated_at: now.toISOString(),
        })
        .eq('id', session.id)

      // Log the auto-clockout event
      await supabase.from('employee_events').insert({
        employee_id: session.employee_id,
        event_type: 'auto_clockout',
        work_session_id: session.id,
        resolved: false,
        details: {
          work_date: session.work_date,
          clock_in_at: clockInAt.toISOString(),
          auto_closed_at: expectedCloseAt.toISOString(),
          minutes_worked: minutesWorked,
          pay_type: payType,
        },
      })

      // Run compliance checks (non-blocking)
      try {
        const sessionDate = session.work_date as string

        const { data: daySessions } = await supabase
          .from('work_sessions')
          .select('minutes_worked')
          .eq('employee_id', session.employee_id)
          .eq('work_date', sessionDate)
          .not('clock_out_punch_id', 'is', null)

        const dailyActualMinutes = (daySessions ?? []).reduce(
          (sum, s) => sum + (s.minutes_worked ?? 0), 0
        ) + Math.max(0, minutesWorked)

        const deductionThreshold = DEDUCTION_THRESHOLD_MINUTES[payType]
        if (deductionThreshold !== null && dailyActualMinutes < deductionThreshold) {
          const { data: openToday } = await supabase
            .from('work_sessions')
            .select('id')
            .eq('employee_id', session.employee_id)
            .eq('work_date', sessionDate)
            .is('clock_out_punch_id', null)

          if (!openToday || openToday.length === 0) {
            const hoursOwed = (deductionThreshold - dailyActualMinutes) / 60
            await supabase.from('employee_events').insert({
              employee_id: session.employee_id,
              event_type: 'leave_deduction_pending',
              work_session_id: session.id,
              leave_hours_owed: Math.round(hoursOwed * 100) / 100,
              resolved: false,
              details: {
                work_date: sessionDate,
                actual_minutes: dailyActualMinutes,
                threshold_minutes: deductionThreshold,
                pay_type: payType,
              },
            })
          }
        }

        const dailyMax = DAILY_MAX_MINUTES[payType]
        if (dailyMax !== null && dailyActualMinutes > dailyMax) {
          await supabase.from('employee_events').insert({
            employee_id: session.employee_id,
            event_type: 'overtime_daily_warning',
            work_session_id: session.id,
            resolved: false,
            details: {
              work_date: sessionDate,
              actual_minutes: dailyActualMinutes,
              max_minutes: dailyMax,
              pay_type: payType,
            },
          })
        }

        const weeklyMax = WEEKLY_MAX_MINUTES[payType]
        if (weeklyMax !== null) {
          const weekAgo = new Date(now)
          weekAgo.setDate(weekAgo.getDate() - 7)
          const { data: weekSessions } = await supabase
            .from('work_sessions')
            .select('minutes_worked')
            .eq('employee_id', session.employee_id)
            .gte('work_date', weekAgo.toISOString().split('T')[0])
            .not('clock_out_punch_id', 'is', null)

          const weeklyMinutes = (weekSessions ?? []).reduce(
            (sum, s) => sum + (s.minutes_worked ?? 0), 0
          )

          if (weeklyMinutes > weeklyMax) {
            await supabase.from('employee_events').insert({
              employee_id: session.employee_id,
              event_type: 'overtime_weekly_warning',
              work_session_id: session.id,
              resolved: false,
              details: {
                week_actual_minutes: weeklyMinutes,
                max_minutes: weeklyMax,
                pay_type: payType,
              },
            })
          }
        }
      } catch {
        // Compliance checks are best-effort
      }

      closed++
    } catch {
      // Continue with next session on error
    }
  }

  return NextResponse.json({ closed, checked: openSessions.length })
}
