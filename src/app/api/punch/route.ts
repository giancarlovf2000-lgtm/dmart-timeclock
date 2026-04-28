import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import jwt from 'jsonwebtoken'
import {
  type PayType,
  DEDUCTION_THRESHOLD_MINUTES,
  DAILY_MAX_MINUTES,
  WEEKLY_MAX_MINUTES,
} from '@/lib/pay-type-rules'

interface KioskToken {
  sub: string
  code: string
  name: string
  action: 'CLOCK_IN' | 'CLOCK_OUT'
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    let payload: KioskToken
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as KioskToken
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const formData = await request.formData()
    const photo = formData.get('photo') as File | null
    const location = formData.get('location') as string || 'unknown'
    const punchType = formData.get('punch_type') as string

    if (!punchType || !['CLOCK_IN', 'CLOCK_OUT'].includes(punchType)) {
      return NextResponse.json({ error: 'Tipo de ponche inválido' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify employee still active + fetch pay_type
    const { data: employee } = await supabase
      .from('employees')
      .select('id, full_name, is_active, pay_type')
      .eq('id', payload.sub)
      .single()

    if (!employee?.is_active) {
      return NextResponse.json({ error: 'Empleado inactivo' }, { status: 403 })
    }

    const payType = (employee.pay_type ?? 'regular') as PayType

    // Enforce sequence - check last punch
    const { data: lastPunch } = await supabase
      .from('punch_records')
      .select('punch_type, id')
      .eq('employee_id', payload.sub)
      .order('punched_at', { ascending: false })
      .limit(1)
      .single()

    const expectedAction = lastPunch?.punch_type === 'CLOCK_IN' ? 'CLOCK_OUT' : 'CLOCK_IN'

    if (punchType !== expectedAction) {
      const msg = punchType === 'CLOCK_IN'
        ? 'Ya tienes un clock-in activo. Debes hacer clock-out primero.'
        : 'No tienes un clock-in activo. Debes hacer clock-in primero.'
      return NextResponse.json({ error: msg }, { status: 422 })
    }

    // Find location record
    const { data: locationRecord } = await supabase
      .from('locations')
      .select('id')
      .eq('kiosk_code', location)
      .single()

    // Upload photo to Supabase Storage
    let photoPath: string | null = null
    if (photo) {
      const timestamp = Date.now()
      const fileName = `${payload.sub}/${payload.code}_${timestamp}.jpg`
      const arrayBuffer = await photo.arrayBuffer()
      const { error: uploadError } = await supabase.storage
        .from('punch-photos')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false })

      if (!uploadError) {
        photoPath = fileName
      }
    }

    // Get current pay period
    const { data: currentPeriod } = await supabase
      .from('pay_periods')
      .select('id')
      .eq('is_current', true)
      .single()

    const now = new Date()
    const workDate = now.toISOString().split('T')[0]

    // Insert punch record
    const { data: punchRecord, error: punchError } = await supabase
      .from('punch_records')
      .insert({
        employee_id: payload.sub,
        location_id: locationRecord?.id ?? null,
        punch_type: punchType,
        photo_path: photoPath,
        device_location: location,
      })
      .select('id')
      .single()

    if (punchError || !punchRecord) {
      return NextResponse.json({ error: 'Error al registrar ponche' }, { status: 500 })
    }

    // Manage work sessions
    if (punchType === 'CLOCK_IN') {
      await supabase.from('work_sessions').insert({
        employee_id: payload.sub,
        pay_period_id: currentPeriod?.id ?? null,
        clock_in_punch_id: punchRecord.id,
        work_date: workDate,
        minutes_worked: 0,
      })
    } else {
      // CLOCK_OUT: close the open session
      const { data: openSession } = await supabase
        .from('work_sessions')
        .select('id, clock_in_punch_id, created_at, work_date')
        .eq('employee_id', payload.sub)
        .is('clock_out_punch_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (openSession) {
        // Get clock-in time from punch record
        const { data: clockInPunch } = await supabase
          .from('punch_records')
          .select('punched_at')
          .eq('id', openSession.clock_in_punch_id)
          .single()

        const minutesWorked = clockInPunch
          ? Math.round((now.getTime() - new Date(clockInPunch.punched_at).getTime()) / 60000)
          : 0

        await supabase
          .from('work_sessions')
          .update({
            clock_out_punch_id: punchRecord.id,
            minutes_worked: Math.max(0, minutesWorked),
            updated_at: now.toISOString(),
          })
          .eq('id', openSession.id)

        // ── Post-clockout compliance checks (non-blocking) ────────────────────
        try {
          const sessionDate = openSession.work_date as string

          // Sum all completed sessions for this employee on this work date
          const { data: daySessions } = await supabase
            .from('work_sessions')
            .select('minutes_worked')
            .eq('employee_id', payload.sub)
            .eq('work_date', sessionDate)
            .not('clock_out_punch_id', 'is', null)

          const dailyActualMinutes = (daySessions ?? []).reduce(
            (sum, s) => sum + (s.minutes_worked ?? 0), 0
          ) + Math.max(0, minutesWorked)

          // Deduction check: pay types with a threshold
          const deductionThreshold = DEDUCTION_THRESHOLD_MINUTES[payType]
          if (deductionThreshold !== null && dailyActualMinutes < deductionThreshold) {
            // Only create a pending deduction if there are no more open sessions today
            const { data: openToday } = await supabase
              .from('work_sessions')
              .select('id')
              .eq('employee_id', payload.sub)
              .eq('work_date', sessionDate)
              .is('clock_out_punch_id', null)

            if (!openToday || openToday.length === 0) {
              const hoursOwed = (deductionThreshold - dailyActualMinutes) / 60
              await supabase.from('employee_events').insert({
                employee_id: payload.sub,
                event_type: 'leave_deduction_pending',
                work_session_id: openSession.id,
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

          // Daily overtime warning
          const dailyMax = DAILY_MAX_MINUTES[payType]
          if (dailyMax !== null && dailyActualMinutes > dailyMax) {
            await supabase.from('employee_events').insert({
              employee_id: payload.sub,
              event_type: 'overtime_daily_warning',
              work_session_id: openSession.id,
              resolved: false,
              details: {
                work_date: sessionDate,
                actual_minutes: dailyActualMinutes,
                max_minutes: dailyMax,
                pay_type: payType,
              },
            })
          }

          // Weekly overtime warning (rolling 7 days)
          const weeklyMax = WEEKLY_MAX_MINUTES[payType]
          if (weeklyMax !== null) {
            const weekAgo = new Date(now)
            weekAgo.setDate(weekAgo.getDate() - 7)
            const { data: weekSessions } = await supabase
              .from('work_sessions')
              .select('minutes_worked')
              .eq('employee_id', payload.sub)
              .gte('work_date', weekAgo.toISOString().split('T')[0])
              .not('clock_out_punch_id', 'is', null)

            const weeklyMinutes = (weekSessions ?? []).reduce(
              (sum, s) => sum + (s.minutes_worked ?? 0), 0
            )

            if (weeklyMinutes > weeklyMax) {
              await supabase.from('employee_events').insert({
                employee_id: payload.sub,
                event_type: 'overtime_weekly_warning',
                work_session_id: openSession.id,
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
          // Compliance checks are best-effort — don't fail the punch
        }
      }
    }

    return NextResponse.json({
      success: true,
      punch_type: punchType,
      employee_name: employee.full_name,
      punched_at: now.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
