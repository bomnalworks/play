// 봄날 종이비행기 - 화면·입력·소리 (규칙은 logic.js)
//
// 최고 기록과 설정은 이 브라우저(localStorage)에만 남고, 서버로 아무것도 보내지 않습니다.
import { track, store } from '../../js/browser.js'
import { createSound, bindSoundButton, FANFARE } from '../../js/sound.js'
import { mountAd } from '../../js/ad.js'
import { W, H, COL, PLANE_X, PLANE, createGame, start, step, meters } from './logic.js'

const BEST_KEY = 'bomnal-plane-best-v1'
const SOUND_KEY = 'bomnal-plane-sound-v1'
const STEP = 1 / 120
const OVER_HOLD_MS = 700 // 부딪힌 직후 누르고 있던 손 때문에 바로 새 판이 열리지 않게

const TUNES = {
  start: [[523, 0.06, 0], [784, 0.08, 70]],
  crash: [[220, 0.12, 0], [150, 0.25, 90]],
  record: FANFARE,
}

const FONT = 'Pretendard, "Malgun Gothic", sans-serif'

const COLORS = {
  sky: '#1c1714',
  wall: '#6b5240',
  wallEdge: '#9a7656',
  pillar: '#7d5f48',
  plane: '#fbf7f0',
  planeFold: '#d9cfc0',
  trail: 'rgba(251, 247, 240, 0.25)',
  hud: '#f3ece2',
  hudSoft: 'rgba(243, 236, 226, 0.7)',
  shade: 'rgba(20, 16, 13, 0.62)',
}

const $ = (sel) => document.querySelector(sel)
const canvas = $('#board')
const ctx = canvas.getContext('2d')
const startBtn = $('#start')
const soundBtn = $('#sound')
const statusBox = $('#status')

const Sound = createSound(SOUND_KEY, TUNES)
let best = store.read(BEST_KEY, 0) || 0

let game = createGame()
let overAt = 0
let newRecord = false
const trail = [] // 지나온 자리 (그리기만, 판정 없음)

/* ---------- 입력: 누르고 있는지만 본다 ---------- */

const pressing = new Set() // 지금 누르고 있는 것들 (손가락·마우스·키). 하나라도 있으면 오른다
const holding = () => pressing.size > 0

function press(id) {
  if (pressing.has(id)) return
  pressing.add(id)
  if (game.phase === 'ready') begin()
  else if (game.phase === 'over' && performance.now() - overAt > OVER_HOLD_MS) {
    reset()
    begin()
  }
}
const release = (id) => pressing.delete(id)

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  try {
    canvas.setPointerCapture(e.pointerId) // 손가락이 화면 밖으로 나가도 떼는 순간을 받는다
  } catch {
    /* 못 잡아도 화면 안에서는 그대로 된다 */
  }
  press(`p${e.pointerId}`)
})
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, (e) => release(`p${e.pointerId}`))
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault())

const FLY_KEYS = new Set(['Space', 'ArrowUp', 'KeyW'])
window.addEventListener('keydown', (e) => {
  const onControl = e.target instanceof Element && e.target.closest('button, a, input')
  if (onControl && (e.code === 'Space' || e.code === 'Enter')) return // 버튼 위의 스페이스는 그 버튼 몫
  if (FLY_KEYS.has(e.code)) {
    e.preventDefault()
    press(e.code)
  }
  if (e.code === 'KeyM') soundBtn.click()
})
window.addEventListener('keyup', (e) => release(e.code))
window.addEventListener('blur', () => pressing.clear())

/* ---------- 한 판 ---------- */

function reset() {
  game = createGame()
  trail.length = 0
  lastTrail = 0
  newRecord = false
  say()
}

function begin() {
  start(game)
  track('plane_start')
  Sound.play('start')
  canvas.focus({ preventScroll: true })
  say()
}

function finish() {
  overAt = performance.now()
  const m = meters(game)
  newRecord = m > best
  if (newRecord) {
    best = m
    store.write(BEST_KEY, best)
  }
  track('plane_over')
  Sound.play(newRecord ? 'record' : 'crash')
  say(newRecord ? `${m}m, 최고 기록입니다` : `${m}m 에서 부딪혔어요. 최고 ${best}m`)
}

startBtn.addEventListener('click', () => {
  if (game.phase !== 'ready') reset()
  begin()
})
bindSoundButton(soundBtn, Sound)

function say(text = '') {
  startBtn.textContent = game.phase === 'ready' ? '시작' : '다시'
  if (text) statusBox.textContent = text
}

/* ---------- 그리기 ---------- */

let dpr = 0
function resize() {
  const next = Math.min(window.devicePixelRatio || 1, 2)
  if (next === dpr) return
  dpr = next
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function drawCave() {
  const off = game.dist
  const cols = game.cols
  // 위 벽: 화면 위 끝에서 벽 아랫선까지, 아래 벽: 벽 윗선에서 화면 아래 끝까지
  for (const [edge, end] of [['top', 0], ['bottom', H]]) {
    ctx.beginPath()
    ctx.moveTo(cols[0].x - off, end)
    for (const c of cols) ctx.lineTo(c.x - off, c[edge])
    ctx.lineTo(cols[cols.length - 1].x - off, end)
    ctx.closePath()
    ctx.fillStyle = COLORS.wall
    ctx.fill()
    ctx.beginPath()
    cols.forEach((c, i) => (i ? ctx.lineTo(c.x - off, c[edge]) : ctx.moveTo(c.x - off, c[edge])))
    ctx.strokeStyle = COLORS.wallEdge
    ctx.lineWidth = 3
    ctx.stroke()
  }
  for (const p of game.pillars) {
    const x = p.x - off
    if (x > W || x + p.w < 0) continue
    ctx.fillStyle = COLORS.pillar
    ctx.fillRect(x, p.top, p.w, p.bottom - p.top)
    ctx.strokeStyle = COLORS.wallEdge
    ctx.lineWidth = 2
    ctx.strokeRect(x + 1, p.top + 1, p.w - 2, p.bottom - p.top - 2)
  }
}

function drawPlane() {
  // 지나온 자리 - 점 몇 개가 뒤로 흘러간다 (한 번에 칠한다)
  ctx.beginPath()
  for (const t of trail) {
    const x = PLANE_X - (game.dist - t.d)
    if (x < 0) continue
    ctx.moveTo(x + 1.6, t.y)
    ctx.arc(x, t.y, 1.6, 0, Math.PI * 2)
  }
  ctx.fillStyle = COLORS.trail
  ctx.fill()
  ctx.save()
  ctx.translate(PLANE_X, game.y)
  ctx.rotate(game.tilt)
  const L = PLANE.len / 2
  // 종이비행기: 위 날개(밝게)와 아래 접힌 면(어둡게)
  ctx.beginPath()
  ctx.moveTo(L, 0)
  ctx.lineTo(-L, -PLANE.half - 2)
  ctx.lineTo(-L * 0.45, 0)
  ctx.closePath()
  ctx.fillStyle = COLORS.plane
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(L, 0)
  ctx.lineTo(-L * 0.45, 0)
  ctx.lineTo(-L * 0.8, PLANE.half)
  ctx.closePath()
  ctx.fillStyle = COLORS.planeFold
  ctx.fill()
  ctx.restore()
}

function drawHud() {
  ctx.fillStyle = COLORS.hud
  ctx.font = `700 18px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(`${meters(game)}m`, 12, 10)
  ctx.font = `13px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillStyle = COLORS.hudSoft
  ctx.fillText(`최고 ${best}m`, W - 12, 12)
}

function drawCenter(lines) {
  ctx.fillStyle = COLORS.shade
  ctx.fillRect(0, H / 2 - 54, W, 108)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach(([text, size, color], i) => {
    ctx.font = `${size >= 20 ? 700 : 400} ${size}px ${FONT}`
    ctx.fillStyle = color
    ctx.fillText(text, W / 2, H / 2 - 22 + i * 28)
  })
}

function draw() {
  ctx.fillStyle = COLORS.sky
  ctx.fillRect(0, 0, W, H)
  drawCave()
  drawPlane()
  drawHud()
  if (game.phase === 'ready') {
    drawCenter([['봄날 종이비행기', 22, COLORS.hud], ['누르고 있으면 올라요', 14, COLORS.hudSoft], ['눌러서 시작', 14, COLORS.hudSoft]])
  } else if (game.phase === 'over') {
    const again = performance.now() - overAt > OVER_HOLD_MS ? '눌러서 다시' : ''
    drawCenter([
      [`${meters(game)}m`, 26, COLORS.hud],
      [newRecord ? '최고 기록!' : `최고 ${best}m`, 14, newRecord ? '#e0b35a' : COLORS.hudSoft],
      [again, 14, COLORS.hudSoft],
    ])
  }
}

/* ---------- 돌리기 ---------- */

let acc = 0
let last = 0
let lastTrail = 0
let lastStill = '' // 시작·끝 화면은 그림이 그대로다 - 바뀐 게 있을 때만 다시 칠한다
function frame(ts) {
  if (!last) last = ts
  acc += Math.min((ts - last) / 1000, 0.1) // 탭을 다시 열었을 때 한꺼번에 계산하지 않게 자른다
  last = ts
  while (acc >= STEP) {
    const was = game.phase
    step(game, STEP, { hold: holding() })
    if (was === 'playing' && game.phase === 'over') finish()
    acc -= STEP
  }
  if (game.phase === 'playing' && game.dist - lastTrail > COL) {
    lastTrail = game.dist
    trail.push({ d: game.dist, y: game.y })
    if (trail.length > 12) trail.shift()
  }
  const still = game.phase === 'playing' ? '' : `${game.phase}|${best}|${performance.now() - overAt > OVER_HOLD_MS}`
  if (!still || still !== lastStill) draw()
  lastStill = still
  requestAnimationFrame(frame)
}

// 다른 탭으로 가면 손을 뗀 것으로 본다 (돌아왔을 때 혼자 계속 오르지 않게)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pressing.clear()
  last = 0
})

resize()
window.addEventListener('resize', resize)
say()
requestAnimationFrame(frame)
// 광고는 처음부터 게임과 놀이 방법 사이에 둔다 (/js/ad.js)
mountAd()
