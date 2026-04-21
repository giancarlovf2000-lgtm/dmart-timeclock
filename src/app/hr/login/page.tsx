'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function HRLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    window.location.href = '/hr/dashboard'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-4">
          <Image
            src="/dmart-logo.png"
            alt="D'mart Institute"
            width={220}
            height={124}
            className="object-contain"
            priority
          />
          <p className="text-zinc-500 text-sm">Portal de Recursos Humanos</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <div>
            <label className="text-sm text-zinc-600 block mb-1.5">Correo electrónico</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hr@dmartinstitute.com"
              required
              autoComplete="email"
              className="bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-600 block mb-1.5">Contraseña</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red hover:bg-brand-red-dark text-white h-11"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </div>
  )
}
