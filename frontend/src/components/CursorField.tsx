import { useEffect, useRef } from 'react'

/*
 * CursorField — a calming "antigravity" aura that trails the cursor, plus a
 * grid that lights up beneath it.
 *
 * Instead of scattered dots, a single cohesive glow follows the pointer with
 * spring physics (inertia + friction) and a soft comet tail. Its color slowly
 * shimmers through the brand spectrum — pink → purple → blue — via time-based
 * RGB interpolation, with a gentle opacity pulse. The copybook grid lines
 * within a radius of the cursor brighten and thicken in harmony with the aura.
 *
 * Everything is drawn in one fixed, pointer-events-none canvas that sits
 * between the base grid (z-0) and the page content (z-2). The field fades out
 * over concrete UI (links, buttons, inputs, [data-cursor-block]) so it never
 * bleeds across cards or hurts readability.
 */

// Shimmer stops the aura cycles through (RGB). Soft pink → purple → blue.
const STOPS: [number, number, number][] = [
  [219, 62, 140], // #de6da5 pink
  [139, 92, 246], // #a887f4 violet
  [119, 88, 163], // #b59ed5 purple
  [88, 132, 246], // blue
]

const GRID = 60 // matches the CSS copybook grid cell size
const GRID_RADIUS = 200 // how far the grid reacts around the cursor
const TRAIL_LEN = 20 // comet-tail length
const BLOCK_SELECTOR =
  'a, button, input, textarea, select, label, [role="button"], [data-cursor-block]'

const smoothstep = (t: number) => t * t * (3 - 2 * t)

// Interpolate the looping palette at phase p (0..1 wraps the whole cycle).
function shimmer(p: number): [number, number, number] {
  const n = STOPS.length
  const f = ((p % 1) + 1) % 1
  const scaled = f * n
  const i = Math.floor(scaled)
  const t = smoothstep(scaled - i)
  const a = STOPS[i % n]
  const b = STOPS[(i + 1) % n]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function CursorField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let width = 0
    let height = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    // Pointer + springy center (inertia/friction) + comet trail history.
    const pointer = { x: width / 2, y: height / 2, active: false }
    const center = { x: width / 2, y: height / 2, vx: 0, vy: 0 }
    const trail: { x: number; y: number }[] = []
    let field = 0 // visibility 0→1 (smoothed; fades out over UI)
    let phase = 0 // shimmer color phase
    let pulse = 0 // opacity-pulse clock

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      const el = document.elementFromPoint(e.clientX, e.clientY)
      pointer.active = !el?.closest(BLOCK_SELECTOR)
    }
    const onLeave = () => {
      pointer.active = false
    }

    // Draw the brand-tinted grid illumination within GRID_RADIUS of the cursor.
    const drawGrid = (cx: number, cy: number, r: number, g: number, b: number, alpha: number) => {
      const R = GRID_RADIUS
      ctx.lineCap = 'round'
      // Vertical lines
      for (let x = Math.ceil((cx - R) / GRID) * GRID; x <= cx + R; x += GRID) {
        const dx = Math.abs(x - cx)
        const prox = 1 - dx / R
        if (prox <= 0) continue
        const grad = ctx.createLinearGradient(x, cy - R, x, cy + R)
        const col = (op: number) => `rgba(${r | 0},${g | 0},${b | 0},${op})`
        grad.addColorStop(0, col(0))
        grad.addColorStop(0.5, col(alpha * prox))
        grad.addColorStop(1, col(0))
        ctx.strokeStyle = grad
        ctx.lineWidth = 0.6 + prox * 1.4
        ctx.beginPath()
        ctx.moveTo(x, cy - R)
        ctx.lineTo(x, cy + R)
        ctx.stroke()
      }
      // Horizontal lines
      for (let y = Math.ceil((cy - R) / GRID) * GRID; y <= cy + R; y += GRID) {
        const dy = Math.abs(y - cy)
        const prox = 1 - dy / R
        if (prox <= 0) continue
        const grad = ctx.createLinearGradient(cx - R, y, cx + R, y)
        const col = (op: number) => `rgba(${r | 0},${g | 0},${b | 0},${op})`
        grad.addColorStop(0, col(0))
        grad.addColorStop(0.5, col(alpha * prox))
        grad.addColorStop(1, col(0))
        ctx.strokeStyle = grad
        ctx.lineWidth = 0.6 + prox * 1.4
        ctx.beginPath()
        ctx.moveTo(cx - R, y)
        ctx.lineTo(cx + R, y)
        ctx.stroke()
      }
    }

    // One soft radial blob with a gaussian falloff (no hard mid-ring → no
    // visible banding) and a gentle two-tone shift: core color `c1` melting
    // into `c2` toward the edge for a richer, retouched gradient aura.
    const EDGE = Math.exp(-3.6) // gaussian value at the rim, subtracted to reach true 0
    const blob = (
      x: number,
      y: number,
      radius: number,
      c1: [number, number, number],
      c2: [number, number, number],
      a: number,
    ) => {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      const STEPS = 12
      for (let s = 0; s <= STEPS; s++) {
        const t = s / STEPS
        const fall = (Math.exp(-3.6 * t * t) - EDGE) / (1 - EDGE)
        const r = c1[0] + (c2[0] - c1[0]) * t
        const g = c1[1] + (c2[1] - c1[1]) * t
        const b = c1[2] + (c2[2] - c1[2]) * t
        grad.addColorStop(t, `rgba(${r | 0},${g | 0},${b | 0},${(a * Math.max(0, fall)).toFixed(4)})`)
      }
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)

      field += ((pointer.active ? 1 : 0) - field) * 0.07
      if (field < 0.01 && !pointer.active) {
        ctx.clearRect(0, 0, width, height)
        trail.length = 0
        return
      }

      // Spring the center toward the pointer with inertia + friction.
      // Low stiffness + high friction → the aura lags well behind the cursor
      // and drifts in slowly rather than snapping to it.
      center.vx = (center.vx + (pointer.x - center.x) * 0.008) * 0.93
      center.vy = (center.vy + (pointer.y - center.y) * 0.008) * 0.93
      center.x += center.vx
      center.y += center.vy

      trail.push({ x: center.x, y: center.y })
      if (trail.length > TRAIL_LEN) trail.shift()

      phase += 0.0016 // slow shimmer
      pulse += 0.03
      const c1 = shimmer(phase) // core tone
      const c2 = shimmer(phase + 0.14) // edge tone (slightly ahead → two-tone gradient)
      const breathe = 0.85 + 0.15 * Math.sin(pulse)
      const vis = field * breathe

      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      // Reactive grid glow under the aura.
      drawGrid(center.x, center.y, c1[0], c1[1], c1[2], 0.22 * vis)

      // Comet tail → cohesive head: many low-alpha gaussian blobs melt into a
      // single soft aura (low alphas keep it colored, not blown white).
      const len = trail.length
      for (let i = 0; i < len; i++) {
        const f = i / (len - 1 || 1) // 0 = oldest tail, 1 = head
        const radius = 88 + f * 320
        const a = (0.015 + f * f * 0.05) * vis
        blob(trail[i].x, trail[i].y, radius, c1, c2, a)
      }
      // Bright soft core at the head for a defined glow.
      blob(center.x, center.y, 150, c1, c2, 0.12 * vis)

      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(tick)
    }

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerout', onLeave)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerout', onLeave)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1]" />
}
