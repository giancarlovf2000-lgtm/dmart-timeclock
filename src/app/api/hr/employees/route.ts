import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'

export async function GET(request: NextRequest) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_code, full_name, quickbooks_display_name, department, is_active, created_at')
    .order('employee_code', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { full_name, department, quickbooks_display_name } = await request.json()

  if (!full_name?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Find next available 3-digit code
  const { data: existingCodes } = await supabase
    .from('employees')
    .select('employee_code')
    .order('employee_code', { ascending: true })

  const usedCodes = new Set((existingCodes || []).map(e => e.employee_code))
  let nextCode: string | null = null

  for (let i = 1; i <= 999; i++) {
    const code = String(i).padStart(3, '0')
    if (!usedCodes.has(code)) {
      nextCode = code
      break
    }
  }

  if (!nextCode) {
    return NextResponse.json({ error: 'No hay códigos disponibles' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('employees')
    .insert({
      employee_code: nextCode,
      full_name: full_name.trim(),
      quickbooks_display_name: quickbooks_display_name?.trim() || full_name.trim(),
      department: department?.trim() || null,
    })
    .select('id, employee_code, full_name, quickbooks_display_name, department, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
