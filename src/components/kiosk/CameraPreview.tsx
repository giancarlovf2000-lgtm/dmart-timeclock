'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { CameraOff } from 'lucide-react'

export interface CameraHandle {
  captureSnapshot: () => Promise<Blob | null>
}

interface Props {
  onReady?: () => void
  onError?: (err: string) => void
}

export const CameraPreview = forwardRef<CameraHandle, Props>(({ onReady, onError }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useImperativeHandle(ref, () => ({
    async captureSnapshot(): Promise<Blob | null> {
      const video = videoRef.current
      if (!video) return null
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(video, 0, 0)
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    },
  }))

  useEffect(() => {
    let mounted = true

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => onReady?.()
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Error de cámara')
      }
    }

    startCamera()
    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [onReady, onError])

  return (
    <div className="relative w-full aspect-video bg-zinc-900 rounded-2xl overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <CameraOff className="text-zinc-700 opacity-30" size={48} />
      </div>
    </div>
  )
})

CameraPreview.displayName = 'CameraPreview'
