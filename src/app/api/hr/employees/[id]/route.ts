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
    .select('id, employee_code, full_name, quickbooks_display_name, department, is_active, hire_date, applicable_law, created_at')
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
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select('id, employee_code, full_name, quickbooks_display_name, department, is_active, hire_date, applicable_law, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()

  // Soft delete - deactivate only
  const { error } = await supabase
    .from('employees')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
