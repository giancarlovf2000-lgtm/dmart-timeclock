import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    const { employee_code } = await request.json()

    if (!employee_code || !/^\d{3}$/.test(String(employee_code).trim())) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: employee, error } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, is_active')
      .eq('employee_code', String(employee_code).trim())
      .single()

    if (error || !employee) {
      return NextResponse.json({ error: 'Código no encontrado' }, { status: 401 })
    }

    if (!employee.is_active) {
      return NextResponse.json({ error: 'Empleado inactivo' }, { status: 403 })
    }

    // Get last punch to determine expected action
    const { data: lastPunch } = await supabase
      .from('punch_records')
      .select('punch_type')
      .eq('employee_id', employee.id)
      .order('punched_at', { ascending: false })
      .limit(1)
      .single()

    const expectedAction: 'CLOCK_IN' | 'CLOCK_OUT' =
      lastPunch?.punch_type === 'CLOCK_IN' ? 'CLOCK_OUT' : 'CLOCK_IN'

    const token = jwt.sign(
      {
        sub: employee.id,
        code: employee.employee_code,
        name: employee.full_name,
        action: expectedAction,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '2h' }
    )

    return NextResponse.json({
      token,
      employee: {
        id: employee.id,
        full_name: employee.full_name,
        employee_code: employee.employee_code,
        expected_action: expectedAction,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
