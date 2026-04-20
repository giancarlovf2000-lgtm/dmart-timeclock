import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function requireHR(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: hrUser } = await supabase
    .from('hr_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!hrUser) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  return { userId: user.id }
}
