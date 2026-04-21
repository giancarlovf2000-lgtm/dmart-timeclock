'use client'

import { Delete } from 'lucide-react'

interface Props {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled?: boolean
}

export function NumericKeypad({ onDigit, onBackspace, onClear, disabled }: Props) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del']

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {keys.map((key) => {
        if (key === 'del') {
          return (
            <button
              key="del"
              onClick={onBackspace}
              disabled={disabled}
              className="h-16 rounded-2xl bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-white flex items-center justify-center text-xl font-semibold transition-colors disabled:opacity-40 select-none"
              aria-label="Borrar"
            >
              <Delete size={22} />
            </button>
          )
        }
        if (key === 'clear') {
          return (
            <button
              key="clear"
              onClick={onClear}
              disabled={disabled}
              className="h-16 rounded-2xl bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-zinc-300 text-sm font-semibold transition-colors disabled:opacity-40 select-none"
            >
              Limpiar
            </button>
          )
        }
        return (
          <button
            key={key}
            onClick={() => onDigit(key)}
            disabled={disabled}
            className="h-16 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-brand-red/80 text-white text-2xl font-bold transition-colors disabled:opacity-40 select-none"
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}
