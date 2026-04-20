import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: "D'mart Institute - Ponchador",
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-hidden">
      {children}
    </div>
  )
}
