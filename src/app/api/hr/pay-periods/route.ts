import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'
import { getNextPeriodDates, formatPeriodLabel } from '@/lib/pay-periods'

export async function GET(request: NextRequest) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pay_periods')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { start_date, period_type, set_current } = await request.json()

  if (!start_date || !period_type) {
    return NextResponse.json({ error: 'start_date y period_type son requeridos' }, { status: 400 })
  }

  const startDate = new Date(start_date + 'T00:00:00Z')
  const { start, end } = getNextPeriodDates(startDate, period_type)
  const label = formatPeriodLabel(start, end)

  const supabase = createServiceClient()

  // If setting as current, unset previous current
  if (set_current) {
    await supabase
      .from('pay_periods')
      .update({ is_current: false })
      .eq('is_current', true)
  }

  const { data, error } = await supabase
    .from('pay_periods')
    .insert({
      label,
      period_type,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      is_current: Boolean(set_current),
    })
    .select('*')
    .single()

  if (error) {
    if (error.message.includes('pay_periods_no_overlap')) {
      return NextResponse.json({ error: 'Este período se superpone con uno existente' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
