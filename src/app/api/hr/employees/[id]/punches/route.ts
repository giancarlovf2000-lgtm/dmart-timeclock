import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireHR } from '@/lib/require-hr'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireHR()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { data: punches, error } = await supabase
    .from('punch_records')
    .select('id, punch_type, punched_at, photo_path, device_location, locations(name)')
    .eq('employee_id', id)
    .order('punched_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Generate signed URLs for photos
  const punchesWithUrls = await Promise.all(
    (punches || []).map(async (punch) => {
      let photo_url: string | null = null
      if (punch.photo_path) {
        const { data } = await supabase.storage
          .from('punch-photos')
          .createSignedUrl(punch.photo_path, 3600)
        photo_url = data?.signedUrl ?? null
      }
      return { ...punch, photo_url }
    })
  )

  return NextResponse.json(punchesWithUrls)
}
