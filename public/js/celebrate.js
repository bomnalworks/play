// 다 해냈을 때 터지는 폭죽. 그림 파일 없이 캔버스에 직접 그린다.
//
// 겹쳐 놓은 캔버스에만 그리므로 아래 화면은 그대로 보인다. 어느 게임이든 쓸 수 있다.
// "동작을 줄여 주세요"로 기기를 설정해 둔 사람에게는 터뜨리지 않는다.

// 봄날웍스 브랜드 색 + 금색 하나. 어두운 화면에서는 갈색·진한 세이지가 바탕에 묻히니 밝은 색으로 바꾼다
const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
const COLORS = dark
  ? ['#ede6da', '#87977b', '#d8c4a7', '#bcc8b1', '#e0b35a', '#a9b79c']
  : ['#514238', '#87977b', '#d8c4a7', '#5e6d52', '#e0b35a', '#a9b79c']
const GRAVITY = 420 // px/초²
const DRAG = 0.86 // 초당 남는 속도 비율
const BURSTS = 4 // 터지는 발 수

/** 기기에 '동작을 줄여 주세요'가 켜져 있나 (블록 퍼즐의 파편·흔들기도 이것을 본다) */
export const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// 한 점에서 사방으로 터지는 한 발
function burst(parts, x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
    const speed = 90 + Math.random() * 190
    parts.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      w: 3 + Math.random() * 4,
      h: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 1,
      fade: 0.5 + Math.random() * 0.45, // 초당 줄어드는 양
    })
  }
}

// canvas 위에서 duration(ms) 동안 폭죽을 터뜨린다.
export function celebrate(canvas, { duration }) {
  if (calm()) return

  const box = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(box.width))
  const h = Math.max(1, Math.round(box.height))
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const parts = []
  const shots = Array.from({ length: BURSTS }, (_, i) => ({
    at: i * 320,
    x: w * (0.2 + Math.random() * 0.6),
    y: h * (0.2 + Math.random() * 0.4),
  }))

  let start = 0
  let last = 0

  function frame(now) {
    start ||= now
    const elapsed = now - start
    const dt = Math.min((now - (last || now)) / 1000, 0.05)
    last = now

    while (shots.length && shots[0].at <= elapsed) {
      const shot = shots.shift()
      burst(parts, shot.x, shot.y, 26 + ((Math.random() * 12) | 0))
    }

    const keep = Math.pow(DRAG, dt)
    ctx.clearRect(0, 0, w, h)
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      p.vx *= keep
      p.vy = p.vy * keep + GRAVITY * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      p.life -= p.fade * dt
      if (p.life <= 0) {
        parts.splice(i, 1)
        continue
      }

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.min(1, p.life)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }

    if (elapsed < duration) requestAnimationFrame(frame)
    else ctx.clearRect(0, 0, w, h)
  }

  requestAnimationFrame(frame)
}
