import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'

export async function GET(request: NextRequest) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const resolved = searchParams.get('resolved') ?? 'false'
  const employeeId = searchParams.get('employee_id')
  const eventType = searchParams.get('event_type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const supabase = createServiceClient()

  let query = supabase
    .from('employee_events')
    .select('id, employee_id, event_type, leave_hours_owed, leave_type_applied, resolved, hr_notes, details, created_at, resolved_at, resolved_by, employees(full_name, employee_code)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (resolved !== 'all') {
    query = query.eq('resolved', resolved === 'true')
  }
  if (employeeId) query = query.eq('employee_id', employeeId)
  if (eventType) query = query.eq('event_type', eventType)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data ?? [] })
}
