'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, CalendarRange, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { cn } from '@/lib/utils'
import Image from 'next/image'

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
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/hr/login'
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-zinc-200 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-200 flex flex-col items-start gap-1">
        <Image
          src="/dmart-logo.png"
          alt="D'mart Institute"
          width={160}
          height={90}
          className="object-contain"
          priority
        />
        <p className="text-zinc-400 text-xs">Portal RR.HH.</p>
      </div>

      {/* Current period */}
      {currentPeriodLabel && (
        <div className="px-4 py-3 mx-3 mt-4 rounded-lg bg-brand-red/10 border border-brand-red/30">
          <p className="text-brand-red text-xs font-medium uppercase tracking-wide">Período Actual</p>
          <p className="text-zinc-800 text-sm font-semibold mt-1">{currentPeriodLabel}</p>
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
                  ? 'bg-brand-red/10 text-brand-red border-l-2 border-brand-red pl-[10px]'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
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
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
