import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_code, full_name, quickbooks_display_name, department, is_active, hire_date, applicable_law, initial_vacation_hours, initial_sick_hours, pay_type, created_at')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  const updates: Record<string, unknown> = {}
  if (body.full_name !== undefined) updates.full_name = body.full_name.trim()
  if (body.quickbooks_display_name !== undefined) updates.quickbooks_display_name = body.quickbooks_display_name.trim()
  if (body.department !== undefined) updates.department = body.department?.trim() || null
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)
  if (body.hire_date !== undefined) updates.hire_date = body.hire_date || null
  if (body.applicable_law !== undefined) updates.applicable_law = body.applicable_law || null
  if (body.pay_type !== undefined) updates.pay_type = ['exempt', 'professor_exempt', 'professor_regular'].includes(body.pay_type) ? body.pay_type : 'regular'
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select('id, employee_code, full_name, quickbooks_display_name, department, is_active, hire_date, applicable_law, initial_vacation_hours, initial_sick_hours, pay_type, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()

  // Only allow permanent deletion of inactive employees
  const { data: emp } = await supabase.from('employees').select('is_active').eq('id', id).single()
  if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  if (emp.is_active) return NextResponse.json({ error: 'Solo se pueden eliminar empleados inactivos' }, { status: 409 })

  // Delete dependent records first to respect FK constraints
  await supabase.from('work_sessions').delete().eq('employee_id', id)
  await supabase.from('punch_records').delete().eq('employee_id', id)

  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
