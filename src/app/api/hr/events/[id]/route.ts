import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  // Fetch the event to validate it
  const { data: event, error: fetchErr } = await supabase
    .from('employee_events')
    .select('id, employee_id, event_type, leave_hours_owed, resolved')
    .eq('id', id)
    .single()

  if (fetchErr || !event) {
    return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  }

  if (event.resolved) {
    return NextResponse.json({ error: 'Este evento ya fue resuelto' }, { status: 422 })
  }

  // Handle leave deduction resolution
  if (event.event_type === 'leave_deduction_pending') {
    if (!body.leave_type || !['vacation', 'sick'].includes(body.leave_type)) {
      return NextResponse.json({ error: 'leave_type must be "vacation" or "sick"' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Mark the pending event as resolved
    const { error: updateErr } = await supabase
      .from('employee_events')
      .update({
        resolved: true,
        leave_type_applied: body.leave_type,
        hr_notes: body.hr_notes ?? null,
        resolved_at: now,
        resolved_by: auth.userId,
      })
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Insert companion audit record
    await supabase.from('employee_events').insert({
      employee_id: event.employee_id,
      event_type: 'leave_deduction_applied',
      leave_hours_owed: event.leave_hours_owed,
      leave_type_applied: body.leave_type,
      resolved: true,
      hr_notes: body.hr_notes ?? null,
      resolved_at: now,
      resolved_by: auth.userId,
      details: { source_event_id: id },
    })

    return NextResponse.json({ success: true })
  }

  // For other event types (auto_clockout, overtime warnings): just mark reviewed
  const { error: updateErr } = await supabase
    .from('employee_events')
    .update({
      resolved: true,
      hr_notes: body.hr_notes ?? null,
      resolved_at: new Date().toISOString(),
      resolved_by: auth.userId,
    })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
