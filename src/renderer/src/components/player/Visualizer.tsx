import { useRef, useEffect, useCallback } from 'react'
import { analyserManager } from '../../lib/analyserManager'
import type { VisualizerStyle } from '../../store/visualizerStore'

interface VisualizerProps {
  enabled: boolean
  style: VisualizerStyle
}

const ACCENT = '#f97316'
const ACCENT_DIM = 'rgba(249, 115, 22, 0.3)'

function drawBars(ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number): void {
  const bins = data.length
  const barW = w / bins
  const gradient = ctx.createLinearGradient(0, h, 0, 0)
  gradient.addColorStop(0, ACCENT_DIM)
  gradient.addColorStop(1, ACCENT)

  ctx.fillStyle = gradient
  for (let i = 0; i < bins; i++) {
    const barH = (data[i] / 255) * h
    ctx.fillRect(i * barW, h - barH, barW - 1, barH)
  }
}

function drawWaveform(ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number): void {
  ctx.lineWidth = 2
  ctx.strokeStyle = ACCENT
  ctx.beginPath()
  const sliceW = w / data.length
  for (let i = 0; i < data.length; i++) {
    const y = (data[i] / 255) * h
    if (i === 0) ctx.moveTo(0, y)
    else ctx.lineTo(i * sliceW, y)
  }
  ctx.stroke()
}

function drawCircular(ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number): void {
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(cx, cy) * 0.4
  const bins = data.length

  ctx.lineWidth = 2
  for (let i = 0; i < bins; i++) {
    const angle = (i / bins) * Math.PI * 2 - Math.PI / 2
    const barH = (data[i] / 255) * (Math.min(cx, cy) - radius)
    const x1 = cx + Math.cos(angle) * radius
    const y1 = cy + Math.sin(angle) * radius
    const x2 = cx + Math.cos(angle) * (radius + barH)
    const y2 = cy + Math.sin(angle) * (radius + barH)
    const alpha = 0.3 + (data[i] / 255) * 0.7
    ctx.strokeStyle = `rgba(249, 115, 22, ${alpha})`
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

export function Visualizer({ enabled, style }: VisualizerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const analyser = analyserManager.getAnalyser()
    if (!analyser) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (style === 'waveform') {
      const data = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(data)
      drawWaveform(ctx, data, w, h)
    } else {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)
      if (style === 'circular') drawCircular(ctx, data, w, h)
      else drawBars(ctx, data, w, h)
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [style])

  useEffect(() => {
    if (!enabled) return

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [enabled, draw])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      canvas.width = width * devicePixelRatio
      canvas.height = height * devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden transition-all duration-300 ${enabled ? 'h-[120px]' : 'h-0'}`}
      style={{
        background: enabled ? 'var(--glass-bg)' : 'transparent',
        backdropFilter: enabled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: enabled ? 'blur(12px)' : 'none',
        borderTop: enabled ? '1px solid var(--glass-border-edge)' : 'none'
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
