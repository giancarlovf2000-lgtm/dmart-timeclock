export const dynamic = 'force-dynamic'

import { HRSidebar } from '@/components/hr/HRSidebar'
import { createServiceClient } from '@/lib/supabase-server'

async function getCurrentPeriodLabel() {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('pay_periods')
      .select('label')
      .eq('is_current', true)
      .single()
    return data?.label ?? null
  } catch {
    return null
  }
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const currentPeriodLabel = await getCurrentPeriodLabel()

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <HRSidebar currentPeriodLabel={currentPeriodLabel} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
