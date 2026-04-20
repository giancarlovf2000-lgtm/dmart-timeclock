'use client'

interface Props {
  length: number
  maxLength?: number
}

export function PinDisplay({ length, maxLength = 3 }: Props) {
  return (
    <div className="flex gap-4 justify-center" aria-label="Código ingresado">
      {Array.from({ length: maxLength }).map((_, i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
            i < length
              ? 'bg-white border-white scale-110'
              : 'bg-transparent border-zinc-500'
          }`}
        />
      ))}
    </div>
  )
}
