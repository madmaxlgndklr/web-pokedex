'use client'
import { useRef, useEffect } from 'react'

interface Props { onComplete: () => void }

export function LaunchAnimation({ onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => onComplete())  // autoplay blocked → skip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      onClick={onComplete}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <video
        ref={videoRef}
        src="/web_dex_openanim.mp4"
        onEnded={onComplete}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        playsInline
        muted
      />
    </div>
  )
}
