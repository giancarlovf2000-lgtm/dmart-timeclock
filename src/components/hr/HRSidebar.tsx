'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, CalendarRange, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/hr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hr/employees', label: 'Empleados', icon: Users },
  { href: '/hr/pay-periods', label: 'Períodos de Pago', icon: CalendarRange },
]

interface Props {
  currentPeriodLabel?: string | null
}

export function HRSidebar({ currentPeriodLabel }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/hr/login')
  }

  return (
    <aside className="w-64 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-zinc-800">
        <h1 className="text-white font-bold text-lg">D&apos;mart Institute</h1>
        <p className="text-zinc-500 text-xs mt-1">Portal RR.HH.</p>
      </div>

      {/* Current period */}
      {currentPeriodLabel && (
        <div className="px-4 py-3 mx-3 mt-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Período Actual</p>
          <p className="text-white text-sm font-semibold mt-1">{currentPeriodLabel}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
