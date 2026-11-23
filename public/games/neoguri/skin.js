// 봄날 너구리 - 그림(스킨) 한 곳
//
// ───────────────────────────────────────────────────────────────────────────
// 나중에 이미지(회사 로고 등)로 바꾸려면 이 파일만 고치면 됩니다.
//
//   1. 그림 파일을 `public/games/neoguri/img/` 에 넣습니다. (png·svg·webp 아무거나)
//   2. 아래 SKIN 에서 바꾸고 싶은 항목의 src 에 경로를 적습니다.
//        fruit: { ...BOX.fruit, src: 'img/logo.png', draw: drawFruit }
//   3. 끝입니다. 빌드도, 다른 파일 수정도 필요 없습니다.
//
//   - src 가 null 이면 draw() 로 캔버스에 직접 그립니다(지금 상태).
//   - src 가 있으면 그 그림을 w×h 칸에 맞춰 그립니다. 비율은 유지하고 칸 안에 넣습니다.
//   - 그림을 못 받아오면(경로 오타·파일 없음) 조용히 draw() 로 되돌아갑니다. 게임은 안 멈춥니다.
//   - 칸 크기(w·h)는 충돌 판정에 쓰는 값이라 logic.js 의 BOX 가 갖고 있습니다.
//     그림이 그 칸보다 크든 작든 비율을 지켜 칸 안에 맞춰 그립니다.
// ───────────────────────────────────────────────────────────────────────────
import { BOX, W, H, HUD, WALL, FLOOR_Y, LADDER_W } from './logic.js'

const BROWN = '#8d7a67'
const BROWN_DARK = '#5b4a3c'
const CREAM = '#efe3d3'

/* ---------- 너구리 ---------- */

// t: 0~1 걷기 주기, opts.flip: 왼쪽을 봄, opts.climbing: 사다리 중
function drawRaccoon(ctx, w, h, t, opts = {}) {
  const swing = Math.sin(t * Math.PI * 2)
  const legA = opts.climbing ? swing * 3 : swing * 4
  const cx = w / 2

  // 꼬리 (몸 뒤)
  ctx.save()
  ctx.translate(cx - 9, h * 0.62)
  ctx.rotate(swing * 0.18)
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 ? BROWN_DARK : CREAM
    ctx.beginPath()
    ctx.ellipse(-3 - i * 3.2, 0, 3.4, 4.2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // 다리
  ctx.fillStyle = BROWN_DARK
  ctx.fillRect(cx - 7, h - 6 + legA * 0.2, 5, 6 - legA * 0.2)
  ctx.fillRect(cx + 2, h - 6 - legA * 0.2, 5, 6 + legA * 0.2)

  // 몸통
  ctx.fillStyle = BROWN
  roundRect(ctx, cx - w * 0.42, h * 0.34, w * 0.84, h * 0.5, 6)
  ctx.fill()
  ctx.fillStyle = CREAM
  roundRect(ctx, cx - w * 0.22, h * 0.48, w * 0.44, h * 0.34, 5)
  ctx.fill()

  // 머리
  ctx.fillStyle = BROWN
  ctx.beginPath()
  ctx.ellipse(cx, h * 0.26, w * 0.4, h * 0.26, 0, 0, Math.PI * 2)
  ctx.fill()

  // 귀
  ctx.beginPath()
  ctx.ellipse(cx - w * 0.3, h * 0.1, 3.6, 4.2, -0.3, 0, Math.PI * 2)
  ctx.ellipse(cx + w * 0.3, h * 0.1, 3.6, 4.2, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // 눈가 검은 띠 + 눈
  ctx.fillStyle = BROWN_DARK
  roundRect(ctx, cx - w * 0.36, h * 0.19, w * 0.72, h * 0.13, 3)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx - w * 0.17, h * 0.255, 2.1, 0, Math.PI * 2)
  ctx.arc(cx + w * 0.17, h * 0.255, 2.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#20180f'
  ctx.beginPath()
  ctx.arc(cx - w * 0.17 + 0.6, h * 0.255, 1.1, 0, Math.PI * 2)
  ctx.arc(cx + w * 0.17 + 0.6, h * 0.255, 1.1, 0, Math.PI * 2)
  ctx.fill()

  // 코
  ctx.fillStyle = '#3a2b20'
  ctx.beginPath()
  ctx.ellipse(cx, h * 0.37, 2.4, 1.8, 0, 0, Math.PI * 2)
  ctx.fill()
}

/* ---------- 과일·채소 ---------- */

// opts.kind 로 무엇을 그릴지 고른다 (logic.js 의 FRUITS)
function drawFruit(ctx, w, h, t, opts = {}) {
  const draw = FRUIT_ART[opts.kind] ?? FRUIT_ART.apple
  draw(ctx, w, h)
}

const FRUIT_ART = {
  // 당근
  carrot(ctx, w, h) {
    const cx = w / 2
    ctx.fillStyle = '#e07b2a'
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.22, h * 0.3)
    ctx.lineTo(cx + w * 0.22, h * 0.3)
    ctx.lineTo(cx, h)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1
    for (let i = 1; i <= 2; i++) {
      const y = h * (0.3 + i * 0.2)
      const half = w * 0.2 * (1 - i * 0.3)
      ctx.beginPath()
      ctx.moveTo(cx - half, y)
      ctx.lineTo(cx + half, y)
      ctx.stroke()
    }
    ctx.fillStyle = '#4e8b3a'
    for (const dx of [-0.18, 0, 0.18]) {
      ctx.beginPath()
      ctx.ellipse(cx + w * dx, h * 0.18, 2.2, 4.2, dx * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  },

  // 버섯
  mushroom(ctx, w, h) {
    const cx = w / 2
    ctx.fillStyle = '#efe3d3'
    ctx.fillRect(cx - w * 0.16, h * 0.52, w * 0.32, h * 0.44)
    ctx.fillStyle = '#c9402f'
    ctx.beginPath()
    ctx.ellipse(cx, h * 0.52, w * 0.46, h * 0.36, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = '#f6efe4'
    ctx.beginPath()
    ctx.arc(cx - w * 0.2, h * 0.38, 1.9, 0, Math.PI * 2)
    ctx.arc(cx + w * 0.16, h * 0.3, 2.2, 0, Math.PI * 2)
    ctx.fill()
  },

  // 사과
  apple(ctx, w, h) {
    const cx = w / 2
    ctx.fillStyle = '#cc3b33'
    ctx.beginPath()
    ctx.arc(cx - w * 0.17, h * 0.62, w * 0.3, 0, Math.PI * 2)
    ctx.arc(cx + w * 0.17, h * 0.62, w * 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#4a2f18'
    ctx.fillRect(cx - 1, h * 0.14, 2, h * 0.22)
    ctx.fillStyle = '#4e8b3a'
    ctx.beginPath()
    ctx.ellipse(cx + w * 0.16, h * 0.2, 3.4, 2, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.ellipse(cx - w * 0.2, h * 0.5, 1.6, 2.4, -0.4, 0, Math.PI * 2)
    ctx.fill()
  },

  // 포도
  grape(ctx, w, h) {
    const cx = w / 2
    ctx.fillStyle = '#4e8b3a'
    ctx.fillRect(cx - 1, 0, 2, h * 0.2)
    ctx.fillStyle = '#7c4ea8'
    const rows = [
      [-0.26, 0.34],
      [0, 0.34],
      [0.26, 0.34],
      [-0.14, 0.58],
      [0.14, 0.58],
      [0, 0.8],
    ]
    for (const [dx, y] of rows) {
      ctx.beginPath()
      ctx.arc(cx + w * dx, h * y, w * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.arc(cx - w * 0.24, h * 0.3, 1.3, 0, Math.PI * 2)
    ctx.fill()
  },

  // 수박
  melon(ctx, w, h) {
    const cx = w / 2
    ctx.fillStyle = '#2f7a36'
    ctx.beginPath()
    ctx.arc(cx, h * 0.55, w * 0.44, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#1d4f22'
    ctx.lineWidth = 1.4
    for (const dx of [-0.2, 0.08]) {
      ctx.beginPath()
      ctx.ellipse(cx + w * dx, h * 0.55, w * 0.12, h * 0.42, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = '#3f2a18'
    ctx.fillRect(cx - 1, h * 0.06, 2, h * 0.1)
  },
}

/* ---------- 수수께끼 항아리 ---------- */

function drawPot(ctx, w, h, t) {
  const cx = w / 2
  const wobble = Math.sin(t * Math.PI * 2) * 0.5

  ctx.fillStyle = '#6b4a3a'
  ctx.beginPath()
  ctx.ellipse(cx, h * 0.62, w * 0.42, h * 0.36, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8a6049'
  ctx.beginPath()
  ctx.ellipse(cx - w * 0.12, h * 0.56, w * 0.16, h * 0.2, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // 주둥이
  ctx.fillStyle = '#4e3528'
  roundRect(ctx, cx - w * 0.3, h * 0.14 + wobble, w * 0.6, h * 0.16, 2)
  ctx.fill()
  ctx.fillStyle = '#2b1d16'
  ctx.beginPath()
  ctx.ellipse(cx, h * 0.16 + wobble, w * 0.22, h * 0.06, 0, 0, Math.PI * 2)
  ctx.fill()

  // 물음표 한 점
  ctx.fillStyle = '#e0b35a'
  ctx.beginPath()
  ctx.arc(cx, h * 0.66, 2.2, 0, Math.PI * 2)
  ctx.fill()
}

/* ---------- 뱀 ---------- */

function drawSnake(ctx, w, h, t) {
  const wiggle = Math.sin(t * Math.PI * 2) * 2

  ctx.fillStyle = '#5f8f4a'
  for (let i = 0; i < 5; i++) {
    const x = 3 + (i * (w - 9)) / 4
    const y = h / 2 + Math.sin(t * Math.PI * 2 + i * 0.9) * 1.6
    ctx.beginPath()
    ctx.ellipse(x, y, 4.2, h * 0.38, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#86b85f'
  for (let i = 1; i < 4; i++) {
    const x = 3 + (i * (w - 9)) / 4
    ctx.beginPath()
    ctx.ellipse(x, h / 2 - 1.4, 1.6, 1.4, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 머리는 오른쪽 끝 (움직이는 방향으로 뒤집어 그린다)
  ctx.fillStyle = '#5f8f4a'
  ctx.beginPath()
  ctx.ellipse(w - 4, h / 2 + wiggle * 0.4, 5.2, h * 0.44, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#243a16'
  ctx.beginPath()
  ctx.arc(w - 3, h / 2 - 2 + wiggle * 0.4, 1.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#c5493a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(w - 0.5, h / 2 + 1)
  ctx.lineTo(w + 3 + wiggle, h / 2 + 1)
  ctx.stroke()
}

/* ---------- 전갈 (사다리는 못 타지만 빠르다) ---------- */

function drawScorpion(ctx, w, h, t) {
  const sting = Math.sin(t * Math.PI * 2) * 1.2
  const body = '#8d3f2a'

  // 꼬리 (왼쪽에서 말려 올라간다)
  ctx.strokeStyle = body
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(3, h * 0.6)
  ctx.quadraticCurveTo(-1, h * 0.1 + sting, 5, h * 0.05 + sting)
  ctx.stroke()
  ctx.fillStyle = '#d9b64a'
  ctx.beginPath()
  ctx.arc(6, h * 0.05 + sting, 1.8, 0, Math.PI * 2)
  ctx.fill()

  // 몸통
  ctx.fillStyle = body
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.ellipse(6 + i * (w - 14) / 3, h * 0.62, 3.4, h * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 다리
  ctx.strokeStyle = '#5e2a1b'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 4
    ctx.beginPath()
    ctx.moveTo(x, h * 0.72)
    ctx.lineTo(x - 2, h)
    ctx.moveTo(x + 1, h * 0.72)
    ctx.lineTo(x + 3, h)
    ctx.stroke()
  }

  // 집게
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(w - 4, h * 0.42, 3.4, 2.2, -0.4, 0, Math.PI * 2)
  ctx.ellipse(w - 4, h * 0.8, 3.4, 2.2, 0.4, 0, Math.PI * 2)
  ctx.fill()
}

/* ---------- 압정 (뛰어 넘는 장애물) ---------- */

function drawSpike(ctx, w, h) {
  const base = h - 2.5

  // 바닥에 박힌 받침
  ctx.fillStyle = '#2f2721'
  ctx.fillRect(0, base, w, 2.5)
  ctx.fillStyle = '#5a4b3d'
  ctx.fillRect(0, base, w, 1)

  // 압정 세 개
  for (const [cx, tall] of [
    [w * 0.22, 0.72],
    [w * 0.5, 1],
    [w * 0.78, 0.72],
  ]) {
    const top = base - (base - 1) * tall
    ctx.fillStyle = '#6f777e' // 그늘진 쪽
    ctx.beginPath()
    ctx.moveTo(cx, top)
    ctx.lineTo(cx + 2.6, base)
    ctx.lineTo(cx - 2.6, base)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#dde2e6' // 빛 받는 쪽
    ctx.beginPath()
    ctx.moveTo(cx, top)
    ctx.lineTo(cx + 0.9, base)
    ctx.lineTo(cx - 1.4, base)
    ctx.closePath()
    ctx.fill()
  }
}

/* ---------- 판 (한 단계 동안 안 바뀐다) ---------- */

const PLANK = 8 // 바닥 널 두께

// 바닥 널 한 토막 (너비가 0 이하면 아무것도 안 그린다)
function plank(ctx, x, y, width) {
  if (width <= 0) return
  ctx.fillStyle = '#6d5540'
  ctx.fillRect(x, y, width, PLANK)
  ctx.fillStyle = '#8a6a4e'
  ctx.fillRect(x, y, width, 2)
  ctx.fillStyle = '#3a2f26' // 끊긴 자리를 또렷하게
  ctx.fillRect(x, y, 1.5, PLANK)
  ctx.fillRect(x + width - 1.5, y, 1.5, PLANK)
}

// 하늘·벽·바닥·사다리·압정을 한 번에 그린다. game.js 가 단계마다 한 번만 부른다.
export function drawBackdrop(ctx, stageData) {
  const sky = ctx.createLinearGradient(0, HUD, 0, H)
  sky.addColorStop(0, '#241f1b')
  sky.addColorStop(1, '#16120f')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#3a2f26' // 좌우 벽
  ctx.fillRect(0, HUD, WALL, H - HUD)
  ctx.fillRect(W - WALL, HUD, WALL, H - HUD)

  for (const l of stageData.ladders) {
    const top = FLOOR_Y[l.top]
    const bottom = FLOOR_Y[l.bottom]
    ctx.strokeStyle = '#8a6a44'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(l.x + 2, top)
    ctx.lineTo(l.x + 2, bottom)
    ctx.moveTo(l.x + LADDER_W - 2, top)
    ctx.lineTo(l.x + LADDER_W - 2, bottom)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#a5804f'
    ctx.beginPath()
    for (let y = top + 9; y < bottom; y += 11) {
      ctx.moveTo(l.x + 2, y)
      ctx.lineTo(l.x + LADDER_W - 2, y)
    }
    ctx.stroke()
  }

  // 바닥은 구멍 사이 토막으로
  for (let f = 0; f < FLOOR_Y.length; f++) {
    const holes = [...stageData.gaps[f]].sort((a, b) => a.x0 - b.x0)
    let x = WALL
    for (const hole of holes) {
      plank(ctx, x, FLOOR_Y[f], hole.x0 - x)
      x = hole.x1
    }
    plank(ctx, x, FLOOR_Y[f], W - WALL - x)
  }

  for (const spike of stageData.spikes) paint(ctx, SKIN.spike, spike.box.x, spike.box.y, 0)
}

/* ---------- 스킨 표 ---------- */

// 칸 크기는 logic.js 의 BOX 에서 받고, 이 파일은 "무엇으로 그릴지"만 정한다.
export const SKIN = {
  player: { ...BOX.player, src: null, draw: drawRaccoon },
  fruit: { ...BOX.fruit, src: null, draw: drawFruit },
  pot: { ...BOX.pot, src: null, draw: drawPot },
  snake: { ...BOX.snake, src: null, draw: drawSnake },
  scorpion: { ...BOX.scorpion, src: null, draw: drawScorpion },
  spike: { ...BOX.spike, src: null, draw: drawSpike },
}

/* ---------- 이미지 불러오기 ---------- */

// src 가 적힌 항목만 미리 받아 둔다. 실패하면 img 를 비워 둬서 draw() 로 돌아간다.
export function loadSkinImages() {
  const jobs = Object.values(SKIN)
    .filter((s) => s.src)
    .map(
      (s) =>
        new Promise((done) => {
          const img = new Image()
          img.onload = () => {
            s.img = img
            done()
          }
          img.onerror = () => {
            console.warn(`스킨 그림을 못 받았습니다: ${s.src} - 기본 그림으로 그립니다.`)
            done()
          }
          img.src = s.src
        })
    )
  return Promise.all(jobs)
}

// (x, y) 를 왼쪽 위로 두고 스킨을 그린다. flip 이 true 면 좌우를 뒤집는다.
export function paint(ctx, skin, x, y, t, opts = {}) {
  ctx.save()
  ctx.translate(x + (opts.flip ? skin.w : 0), y)
  if (opts.flip) ctx.scale(-1, 1)
  if (skin.img) fitImage(ctx, skin.img, skin.w, skin.h)
  else skin.draw(ctx, skin.w, skin.h, t, opts)
  ctx.restore()
}

// 비율을 지키면서 w×h 칸 안에 넣는다 (가운데 정렬).
function fitImage(ctx, img, w, h) {
  const scale = Math.min(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
