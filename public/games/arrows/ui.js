// 봄날 화살 퍼즐 - 화면·입력·소리 (규칙은 logic.js)
//
// 지금 단계와 하던 판(뺀 화살·남은 하트), 최고 기록은 이 브라우저(localStorage)에만 남는다.
import { track, store } from '../../js/browser.js'
import { createSound, bindSoundButton, FANFARE } from '../../js/sound.js'
import { celebrate, calm } from '../../js/celebrate.js'
import { mountAd } from '../../js/ad.js'
import { createTimer, startTimer, pauseTimer, timerMs } from '../../js/timer.js'
import {
  MAX_LEVEL, SHAPES, DR, DC, inBoard, levelSpec, secondsPerArrow, createGame, restart, arrowAt, headOf, tap, useHint, restore, snapshot, freshSnapshot,
  timeLimit, bonusSeconds, expire, prepare,
} from './logic.js'

// 보통·전문가는 단계를 따로 센다. 시계가 도는 판(전문가, 보통 21단계부터)은 창을 닫았다 오면 그 단계를 처음부터 (시간을 멈춰 두는 꼼수를 막는다)
const SAVE_KEYS = { normal: 'bomnal-arrows-save-v1', expert: 'bomnal-arrows-expert-v1' }
const MODE_KEY = 'bomnal-arrows-mode-v1'
const BEST_KEY = 'bomnal-arrows-best-v1' // 모드별로 깬 가장 높은 단계 { normal, expert } - 1단계부터 다시 해도 남는다
const SOUND_KEY = 'bomnal-arrows-sound-v1'
const HOLD_MS = 700 // 통과·끝 직후 누르던 손 때문에 바로 넘어가지 않게
const AGAIN_MS = 2500 // 하던 판에서 '다시'를 한 번 누르면 이만큼 기다리며 한 번 더 누르길 받는다
const HINT_MS = 2600 // 힌트 화살이 깜빡이는 시간

// 화면 배치 (논리 좌표 - 캔버스 360×468. 실제 크기는 CSS 가 정한다). 판은 단계마다 크기가 달라 가운데에 놓는다
const W = 360
const H = 468
const PAD = 16
const TAIL = 0.3 // 꼬리를 칸 가운데보다 이만큼(칸 단위) 뒤에서 시작한다
const LINE = 0.1 // 화살 굵기 (칸 단위) - 얇아야 꺾인 곳과 나란한 화살 사이가 잘 보인다
const ZOOM_CELL = 56 // 확대하면 칸이 이만큼(논리 px)까지 커진다 - 판이 작으면 확대하지 않는다
const TAP_SLOP = 9 // 이만큼(논리 px) 넘게 움직이면 누르기가 아니라 끌기
const RESET_BTN = { x: W - 86, y: 8, w: 78, h: 28 } // 확대했을 때 오른쪽 위 '전체 보기'
const FLY_SPEED = 26 // 빠지는 화살 빠르기 (칸/초, 끝날 때쯤)
const BUMP_SPEED = 16 // 부딪히러 가는 빠르기 (칸/초)

// 화살 색 7가지 - 블록 퍼즐과 같은 봄날웍스 흙빛. 높은 단계는 가짓수를 줄인다 (logic.js levelSpec.colors)
const COLORS = ['#87977b', '#c9a77c', '#9a7a62', '#c47a5a', '#d9a94a', '#7d97a8', '#a57f9a']
const PALETTES = { 7: COLORS, 4: [COLORS[0], COLORS[1], COLORS[2], COLORS[5]], 2: [COLORS[2], COLORS[0]], 1: [COLORS[2]] }
const colorOf = (i) => {
  const set = PALETTES[game.colors] ?? COLORS
  return set[i % set.length]
}
const FONT = 'Pretendard, "Malgun Gothic", sans-serif'

const LIGHT = { board: '#efe7da', tile: '#e6dccb', dot: '#cfc2ad', ink: '#3a322c', soft: '#6b5f55', shade: 'rgba(247, 244, 237, 0.88)', bad: '#b3261e', gold: '#a8781e', glow: 'rgba(168, 120, 30, 0.35)' }
const DARK = { board: '#1e1a16', tile: '#2a241f', dot: '#4a4038', ink: '#ede6da', soft: '#b5a99a', shade: 'rgba(30, 26, 22, 0.88)', bad: '#f0786e', gold: '#e0b35a', glow: 'rgba(224, 179, 90, 0.4)' }
const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
let LOOK = darkQuery?.matches ? DARK : LIGHT

const TUNES = {
  fly: [[660, 0.04, 0], [990, 0.06, 40]],
  bump: [[150, 0.09, 0], [110, 0.12, 70]],
  hint: [[784, 0.05, 0], [1047, 0.08, 80]],
  clear: FANFARE,
  over: [[330, 0.12, 0], [262, 0.14, 130], [196, 0.3, 260]],
}
// 연달아 뺄수록 한 음씩 오른다 (fly2 … fly12)
const MAX_RUN_TUNE = 12
for (let n = 2; n <= MAX_RUN_TUNE; n++) {
  const f = 523 * 2 ** ((n - 2) / 12)
  TUNES[`fly${n}`] = [[f, 0.04, 0], [f * 1.5, 0.07, 40]]
}

const $ = (sel) => document.querySelector(sel)
const canvas = $('#board')
const ctx = canvas.getContext('2d')
const confetti = $('#confetti')
const levelBox = $('#level')
const heartsBox = $('#hearts')
const hintBtn = $('#hint')
const againBtn = $('#again')
const soundBtn = $('#sound')
const statusBox = $('#status')
const modeBtns = { normal: $('#mode-normal'), expert: $('#mode-expert') }
const clockBox = $('#clock')
const askBox = $('#ask')
const askContinue = $('#ask-continue')
const askRestart = $('#ask-restart')

const Sound = createSound(SOUND_KEY, TUNES)

let mode = store.read(MODE_KEY, 'normal') === 'expert' ? 'expert' : 'normal'
const modeTag = () => (mode === 'expert' ? '전문가 ' : '')
// 방문 통계 이벤트 - 전문가 모드는 이름에 expert 를 넣는다 (arrows_start / arrows_expert_start …)
const logEvent = (name) => track(mode === 'expert' ? `arrows_expert_${name}` : `arrows_${name}`)

// 저장한 판이 맞지 않으면(판 만드는 법이 바뀐 경우 등) 그 단계를 새로 연다.
// 시계가 도는 판은 save() 가 단계만 남기므로 되살려도 그 단계의 처음이다
function load(m) {
  const saved = store.read(SAVE_KEYS[m], null)
  return restore(saved) ?? createGame(saved?.level ?? 1)
}
// 주소에 ?level=20 처럼 붙이면 지금 모드의 그 단계부터 새로 시작한다 (해 보기·공유용). 한 번 쓰면 주소에서 level 만 지운다
const params = new URLSearchParams(location.search)
const asked = Number(params.get('level'))
const jumped = Number.isInteger(asked) && asked >= 1 && asked <= MAX_LEVEL // 그러면 '이어서 할까요?'를 묻지 않는다
if (params.has('level')) {
  params.delete('level')
  const rest = params.toString()
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash)
}
// 저장된 단계보다 낮은 단계 링크(친구가 보낸 링크 등)는 '체험' - 저장된 단계를 넘어설 때까지 저장하지 않는다 (하던 단계를 지우지 않게)
const savedLevel = store.read(SAVE_KEYS[mode], null)?.level ?? 1
let trial = jumped && savedLevel > asked
let game = jumped ? createGame(asked) : load(mode)

// 시계: 시간 제한이 있는 판을 처음 보여 줄 때는 '눌러서 시작'을 띄우고, 누른 때부터 잰다 (탭을 가리면 멈춘다)
/** 지금 판의 제한 시간(초). 시계가 없으면 0 */
function limit() {
  return timeLimit(game, mode === 'expert')
}
function timed() {
  return limit() > 0
}
let started = !timed()
let clock = createTimer() // 이 판에서 흐른 시간
let bonusMs = 0 // 이 판에서 화살을 빼며 더 받은 시간
let shownClock = '' // 시계 칸에 마지막으로 적은 글자 - 같으면 건드리지 않는다
let cell = 0 // 칸 크기와 판 왼쪽 위 - 단계마다 다시 잰다 (layout)
let bx = 0
let by = 0
let anims = new Map() // 화살 번호 → 움직임 { kind: 'fly'|'bump', t0, dur, reach }
let fx = [] // 지나가는 그림 { kind: 'text'|'banner', … }
let hintAt = { i: -1, t0: 0 } // 깜빡이는 힌트 화살
let pick = -1 // 자판으로 고른 화살
let run = 0 // 실수 없이 연달아 뺀 수 (소리가 오른다)
let endAt = 0 // 통과하거나 하트를 다 쓴 때
let againUntil = 0
let dirty = true
let wasMoving = false // 지난 프레임에 움직이던 게 있었는지 - 멈춘 첫 프레임을 한 번 더 그린다
// 확대·이동: 화면 좌표 = 판 좌표 × z + (tx, ty). 단계가 바뀌면 전체 보기로 돌아간다
const view = { z: 1, tx: 0, ty: 0 }
let zMax = 1
const pointers = new Map() // 화면에 닿은 손가락(마우스) id → { x, y } 화면 논리 좌표
let gesture = null // { kind: 'tap'|'pan'|'pinch'|'none', … }

function layout() {
  cell = Math.min((W - PAD * 2) / game.cols, (H - PAD * 2) / game.rows)
  bx = (W - cell * game.cols) / 2
  by = (H - cell * game.rows) / 2
  zMax = Math.max(1, Math.min(4, ZOOM_CELL / cell))
  setView(1, 0, 0)
}

// 판 테두리가 화면을 벗어나 빈 곳만 보이지 않게 맞춘다 (판이 화면보다 작은 쪽은 가운데로)
function setView(z, tx, ty) {
  view.z = Math.min(zMax, Math.max(1, z))
  const fit = (t, lo, size, span) => {
    const a = (lo - 8) * view.z
    const b = (lo + size + 8) * view.z
    if (b - a <= span) return (span - (b - a)) / 2 - a
    return Math.min(-a, Math.max(span - b, t))
  }
  view.tx = fit(tx, bx, cell * game.cols, W)
  view.ty = fit(ty, by, cell * game.rows, H)
  dirty = true
}

// 화면의 (x, y) 를 그대로 두고 z 배로 키운다
function zoomAt(z, x, y) {
  const px = (x - view.tx) / view.z
  const py = (y - view.ty) / view.z
  const nz = Math.min(zMax, Math.max(1, z))
  setView(nz, x - px * nz, y - py * nz)
}

// 확대해 있을 때 이 화살 머리가 화면 밖이면 보이게 옮긴다 (자판·힌트)
function showArrow(i) {
  if (view.z <= 1) return
  const [hr, hc] = headOf(game.arrows[i])
  const x = (bx + (hc + 0.5) * cell) * view.z + view.tx
  const y = (by + (hr + 0.5) * cell) * view.z + view.ty
  const m = cell * view.z * 1.5
  if (x < m || x > W - m || y < m || y > H - m) setView(view.z, view.tx + W / 2 - x, view.ty + H / 2 - y)
}

/* ---------- 화살 길 (칸 단위) ---------- */

// 화살이 지나는 길의 i 번째 칸 - 0 꼬리 … L-1 머리, 그 뒤는 머리 앞으로 곧게, 음수는 꼬리 뒤로
function trackCell(a, i) {
  const L = a.cells.length
  if (i >= 0 && i < L) return a.cells[i]
  if (i >= L) {
    const [hr, hc] = a.cells[L - 1]
    const k = i - L + 1
    return [hr + DR[a.dir] * k, hc + DC[a.dir] * k]
  }
  const [r0, c0] = a.cells[0]
  const [r1, c1] = L > 1 ? a.cells[1] : [r0 + DR[a.dir], c0 + DC[a.dir]]
  return [r0 + (r0 - r1) * -i, c0 + (c0 - c1) * -i]
}

// 길 위 t(소수) 지점의 화면 좌표
function pointAt(a, t) {
  const i = Math.floor(t)
  const f = t - i
  const [r1, c1] = trackCell(a, i)
  const [r2, c2] = trackCell(a, i + 1)
  return [bx + (c1 + (c2 - c1) * f + 0.5) * cell, by + (r1 + (r2 - r1) * f + 0.5) * cell]
}

/** 지금 얼마나 앞으로 나가 있는지 (칸) */
function offsetOf(i, now) {
  const m = anims.get(i)
  if (!m) return 0
  const t = Math.min(1, (now - m.t0) / m.dur)
  if (m.kind === 'fly') return m.reach * (0.35 * t + 0.65 * t * t) // 점점 빨라진다
  return m.reach * (t < 0.5 ? Math.sin(t * Math.PI) : Math.sin(t * Math.PI) ** 2) // 갔다가 돌아온다
}

/* ---------- 누르기 ---------- */

function toLogical(e) {
  const box = canvas.getBoundingClientRect()
  return { x: ((e.clientX - box.left) * W) / box.width, y: ((e.clientY - box.top) * H) / box.height }
}

// 누른 자리(판 좌표)의 화살. 빈칸이면 가까운 칸(대각선 이웃까지)의 화살을 고른다 - 손가락이 조금 빗나가도 되게
function arrowNear(x, y) {
  const fc = (x - bx) / cell
  const fr = (y - by) / cell
  const r = Math.floor(fr)
  const c = Math.floor(fc)
  const hit = arrowAt(game, r, c)
  if (hit !== -1) return hit
  let best = -1
  let bestD = 0.75 ** 2 // 칸 가운데에서 이만큼(칸 단위) 안이어야 한다
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const i = arrowAt(game, r + dr, c + dc)
      if (i === -1) continue
      const d = (r + dr + 0.5 - fr) ** 2 + (c + dc + 0.5 - fc) ** 2
      if (d < bestD) [best, bestD] = [i, d]
    }
  }
  return best
}

const inBox = ({ x, y }, b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
const spread = () => {
  const [a, b] = [...pointers.values()]
  return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
// 두 손가락: 벌리고 오므려 키우고 줄이며, 가운데를 따라 판이 움직인다
const startPinch = () => {
  const s0 = spread()
  gesture = { kind: 'pinch', ...s0, z: view.z, tx: view.tx, ty: view.ty }
}
const startPan = (id, p) => {
  gesture = { kind: 'pan', id, x: p.x, y: p.y, tx: view.tx, ty: view.ty }
}

// 화살은 손을 뗄 때 뺀다 - 그래야 누른 건지 끌거나 벌린 건지 가릴 수 있다
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  canvas.focus({ preventScroll: true })
  const p = toLogical(e)
  if (proceed()) return
  if (view.z > 1 && pointers.size === 0 && inBox(p, RESET_BTN)) return setView(1, 0, 0)
  try {
    canvas.setPointerCapture(e.pointerId) // 손가락이 화면 밖으로 나가도 떼는 순간을 받는다
  } catch {
    /* 못 잡아도 화면 안에서는 그대로 된다 */
  }
  pointers.set(e.pointerId, p)
  if (pointers.size === 1) gesture = { kind: 'tap', id: e.pointerId, x: p.x, y: p.y, tx: view.tx, ty: view.ty }
  else if (pointers.size === 2 && zMax > 1) startPinch()
  else gesture = { kind: 'none' } // 세 손가락이거나 확대할 수 없는 판이면 아무것도 안 한다
})

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return
  const p = toLogical(e)
  pointers.set(e.pointerId, p)
  if (!gesture) return
  if (gesture.kind === 'tap' && Math.hypot(p.x - gesture.x, p.y - gesture.y) > TAP_SLOP) {
    gesture = view.z > 1 ? { ...gesture, kind: 'pan' } : { kind: 'none' }
  }
  if (gesture.kind === 'pan' && e.pointerId === gesture.id) setView(view.z, gesture.tx + p.x - gesture.x, gesture.ty + p.y - gesture.y)
  if (gesture.kind === 'pinch' && pointers.size === 2) {
    const now = spread()
    const z = Math.min(zMax, Math.max(1, (gesture.z * now.d) / gesture.d))
    // 처음 두 손가락 사이에 있던 판 자리가 지금 두 손가락 사이에 오게
    const px = (gesture.x - gesture.tx) / gesture.z
    const py = (gesture.y - gesture.ty) / gesture.z
    setView(z, now.x - px * z, now.y - py * z)
  }
})

function endPointer(e, lift) {
  if (!pointers.has(e.pointerId)) return
  const g = gesture
  pointers.delete(e.pointerId)
  if (lift && g?.kind === 'tap' && g.id === e.pointerId) {
    const i = arrowNear((g.x - view.tx) / view.z, (g.y - view.ty) / view.z)
    if (i !== -1) shoot(i)
  }
  // 두 손가락 중 하나를 떼면 남은 손가락으로 이어서 끈다 (그 손가락으로 화살을 빼지는 않는다)
  if (pointers.size === 1 && g?.kind === 'pinch') {
    const [[id, p]] = [...pointers]
    startPan(id, p)
  } else if (pointers.size === 0) gesture = null
}
canvas.addEventListener('pointerup', (e) => endPointer(e, true))
canvas.addEventListener('pointercancel', (e) => endPointer(e, false))
canvas.addEventListener('lostpointercapture', (e) => endPointer(e, false))
canvas.addEventListener('contextmenu', (e) => e.preventDefault())

// PC: 터치패드로 벌리기(브라우저가 ctrl+휠로 보낸다)나 ctrl+휠로 확대, 확대한 동안은 휠로 판을 옮긴다
canvas.addEventListener('wheel', (e) => {
  if (zMax <= 1 || game.won || game.over) return
  const p = toLogical(e)
  if (e.ctrlKey) {
    e.preventDefault()
    zoomAt(view.z * Math.exp(-e.deltaY * 0.01), p.x, p.y)
  } else if (view.z > 1) {
    e.preventDefault()
    setView(view.z, view.tx - e.deltaX * 0.6, view.ty - e.deltaY * 0.6)
  }
}, { passive: false })

// 끝난 판이면 다음 단계(또는 처음부터)로, 시작 전이면 시작. 그런 판이었으면 true (화면 누르기·엔터가 같이 쓴다)
function proceed() {
  if (game.won || game.over) {
    if (performance.now() - endAt > HOLD_MS) (game.won ? nextLevel : retry)()
    return true
  }
  if (!started) {
    begin()
    return true
  }
  return false
}

// 시계가 도는 판: '눌러서 시작'을 누르면 시계가 돈다
function begin() {
  started = true
  startTimer(clock, performance.now())
  Sound.play('hint')
  showBar()
  announce()
  say(`시작! ${limit()}초 안에 화살 ${game.arrows.length}개를 빼세요`)
  dirty = true
}

function shoot(i) {
  if (anims.get(i)?.kind === 'bump') return // 부딪혀 돌아오는 중에 또 누르면 하트를 두 번 잃지 않게
  const a = game.arrows[i]
  const res = tap(game, i)
  if (!res) return
  if (game.moves === 1) logEvent('start')
  const now = performance.now()
  if (hintAt.i === i) hintAt = { i: -1, t0: 0 }
  if (res.ok) {
    // 꼬리까지 판 밖으로 나갈 만큼 간다
    const reach = res.steps + a.cells.length + 1
    animate(i, { kind: 'fly', t0: now, dur: Math.max(220, (reach / FLY_SPEED) * 1000 * 1.6), reach })
    run += 1
    // 시계가 도는 판이면 시간을 조금 더 받는다 - 뺀 화살 머리 쪽에 "+0.1초"
    const bonus = bonusSeconds(game.level, mode === 'expert')
    if (bonus > 0 && !game.won) {
      bonusMs += bonus * 1000
      const [hr, hc] = headOf(a)
      const shown = bonus.toFixed(2).replace(/0$/, '')
      fx.push({ kind: 'text', t0: now, dur: 700, x: bx + (hc + 0.5) * cell, y: by + (hr + 0.5) * cell, text: `+${shown}초`, color: LOOK.gold })
    }
    Sound.play(run >= 2 ? `fly${Math.min(run, MAX_RUN_TUNE)}` : 'fly')
    if (pick === i) pick = -1
    if (game.won) win(now)
    else say(`화살 하나 뺐어요. ${game.left}개 남음`)
  } else {
    // 막는 화살에 머리가 닿을 때까지 갔다가 돌아온다
    const reach = res.steps - 1 + 0.18
    animate(i, { kind: 'bump', t0: now, dur: Math.max(300, (reach / BUMP_SPEED) * 2000 + 140), reach, by: res.by })
    run = 0
    Sound.play('bump')
    if (Sound.on) navigator.vibrate?.(40)
    const [hr, hc] = headOf(a)
    fx.push({ kind: 'text', t0: now, dur: 900, x: bx + (hc + 0.5) * cell, y: by + (hr + 0.5) * cell, text: game.over ? '' : '−♥' })
    if (game.over) lose(now)
    else say(`막혔어요. 하트 ${game.hearts}개 남음`)
  }
  showBar()
  save()
  dirty = true
}

// '동작 줄이기' 설정이면 화살이 미끄러지지 않고 바로 사라지고, 부딪힐 때도 짧게 빨개지기만 한다
function animate(i, m) {
  anims.set(i, calm() ? { ...m, dur: m.kind === 'fly' ? 1 : 260, reach: m.kind === 'fly' ? m.reach : 0 } : m)
}

function win(now) {
  const best = store.read(BEST_KEY, {}) ?? {}
  if (!(best[mode] >= game.level)) store.write(BEST_KEY, { ...best, [mode]: game.level })
  endAt = now
  pick = -1
  pauseTimer(clock, now) // 통과 화면에 남은 시간을 그대로 보여 준다
  logEvent('clear')
  const perfect = game.mistakes === 0 && game.hints === game.maxHints
  fx.push({ kind: 'banner', t0: now + 250, dur: 1300, text: perfect ? '완벽해요!' : '통과!' })
  setTimeout(() => {
    Sound.play('clear')
    celebrate(confetti, { duration: perfect ? 2200 : 1500 })
  }, 280)
  say(`${game.level}단계 통과! 화면을 누르면 다음 단계`)
}

function lose(now) {
  endAt = now
  pick = -1
  pauseTimer(clock, now)
  logEvent('over')
  setTimeout(() => Sound.play('over'), 300)
  say(`${game.timeUp ? '시간이 다 됐어요' : '하트를 다 썼어요'}. 화면을 누르면 이 단계를 처음부터`)
}

const shapeName = () => SHAPES.find((sh) => sh.key === game.shape)?.name ?? ''

// 이 단계부터 바뀌는 규칙 - 단계 규칙(logic.js levelSpec·secondsPerArrow)을 바로 앞 단계와 견줘서 찾는다
const COLOR_NEWS = { 4: '화살 색이 줄어요', 2: '화살 색이 더 줄어요', 1: '모든 화살이 한 색이에요' }
function news(level) {
  if (level <= 1) return ''
  if (mode === 'normal' && secondsPerArrow(level) > 0 && !secondsPerArrow(level - 1)) return '이제 시간 제한이 있어요'
  const now = levelSpec(level)
  const before = levelSpec(level - 1)
  if (now.colors !== before.colors) return COLOR_NEWS[now.colors] ?? ''
  if (now.hearts !== before.hearts) return `하트가 ${now.hearts}개예요`
  if (now.hints !== before.hints) return '이제 힌트가 없어요'
  return ''
}

// 단계가 열리면 가운데에 잠깐 알린다 - 모양 판이면 "하트 판", 이 단계부터 바뀌는 규칙이 있으면 그것도
function announce() {
  if (!started) return
  const sub = news(game.level)
  const text = shapeName() ? `${shapeName()} 판` : sub ? `${game.level}단계` : ''
  if (text) fx.push({ kind: 'banner', t0: performance.now() + 150, dur: sub ? 1900 : 1200, text, sub })
}

function nextLevel() {
  start(createGame(game.level + 1))
  sayLevel()
}

function retry() {
  start(restart(game))
  say(`${game.level}단계 처음부터${started ? '' : '. 화면을 누르면 시작'}`)
}

// 새 판을 연다. 시계가 도는 판은 '눌러서 시작' 화면부터 (알림 글자가 판을 가리는 동안 시간이 흐르지 않게)
function start(next) {
  game = next
  started = !timed()
  clock = createTimer()
  bonusMs = 0
  anims = new Map()
  fx = []
  hintAt = { i: -1, t0: 0 }
  pick = -1
  run = 0
  endAt = 0
  againUntil = 0
  againBtn.textContent = '다시'
  layout()
  save()
  showBar()
  showMode()
  announce()
  dirty = true
  // 다음 단계 판은 화면이 쉬는 동안 미리 만들어 둔다 (단계를 넘길 때 멈칫하지 않게)
  const level = game.level + 1
  ;(window.requestIdleCallback ?? setTimeout)(() => prepare(level))
}

// 다 뺀 판은 다음 단계를, 하트·시간을 다 쓴 판은 같은 단계를 처음부터로 저장한다 (창을 닫았다 와도 그 자리에서).
// 시계가 도는 판은 하던 판을 저장하지 않고 단계만 남긴다
function save() {
  if (trial) {
    if ((game.won ? game.level + 1 : game.level) <= savedLevel) return
    trial = false // 원래 하던 단계를 넘어섰다 - 이제부터는 저장한다
  }
  const key = SAVE_KEYS[mode]
  if (game.won) store.write(key, freshSnapshot(game.level + 1))
  else if (game.over || timed()) store.write(key, freshSnapshot(game.level))
  else store.write(key, snapshot(game))
}

function setMode(next) {
  if (next === mode) return
  save()
  mode = next
  store.write(MODE_KEY, mode)
  trial = false
  start(load(mode))
  askBox.hidden = true // 다른 모드에서 띄운 창이 남지 않게 (이 모드에서 물을 게 있으면 아래에서 다시 띄운다)
  if (askResume()) return
  sayLevel()
}

// "전문가 12단계. 화면을 누르면 시작" 처럼 지금 단계를 읽어 준다
const sayLevel = () => say(`${modeTag()}${game.level}단계${started ? '' : '. 화면을 누르면 시작'}`)

/* ---------- 다시 왔을 때: 지난번 단계부터 이어서 할지 묻기 ---------- */

// 2단계 이상까지 갔던 사람에게만 묻는다. 물었으면 true
function askResume() {
  if (game.level <= 1) return false
  const best = (store.read(BEST_KEY, {}) ?? {})[mode] ?? 0
  $('#ask-title').textContent = `${modeTag()}지난번 ${game.level}단계까지 했어요`
  $('#ask-best').textContent = best ? `지금까지 최고 ${best}단계 통과` : ''
  askContinue.textContent = `${game.level}단계부터 이어서`
  fx = [] // 판 위 알림 글자는 고른 뒤에 띄운다
  askBox.hidden = false
  askContinue.focus({ preventScroll: true })
  say(`지난번 ${game.level}단계까지 했어요. 이어서 할지, 1단계부터 다시 할지 고르세요`)
  return true
}
function closeAsk() {
  askBox.hidden = true
  canvas.focus({ preventScroll: true })
}
askContinue.addEventListener('click', () => {
  closeAsk()
  announce()
  sayLevel()
  dirty = true
})
askRestart.addEventListener('click', () => {
  closeAsk()
  trial = false
  start(createGame(1))
  say('1단계부터 다시 합니다')
})
modeBtns.normal.addEventListener('click', () => setMode('normal'))
modeBtns.expert.addEventListener('click', () => setMode('expert'))

function showMode() {
  for (const [m, btn] of Object.entries(modeBtns)) btn.setAttribute('aria-pressed', String(m === mode))
  clockBox.hidden = !timed()
  shownClock = ''
}

// 남은 시간 (ms). 시작 전에는 제한 시간 그대로, 끝난 판은 멈춘 그때 그대로
const timeLeft = (now) => Math.max(0, limit() * 1000 + bonusMs - timerMs(clock, now))
function showClock(now) {
  if (!timed()) return
  const left = timeLeft(now) / 1000
  const text = left < 10 ? left.toFixed(1) : String(Math.ceil(left))
  if (text === shownClock) return
  shownClock = text
  clockBox.textContent = `⏱ ${text}초`
  clockBox.classList.toggle('low', left < 5 && started && !game.won)
}
// 탭을 가리면 시계를 멈추고, 돌아오면 이어서 잰다
document.addEventListener('visibilitychange', () => {
  if (!timed() || !started || game.won || game.over) return
  if (document.hidden) pauseTimer(clock, performance.now())
  else startTimer(clock, performance.now())
})

/* ---------- 버튼과 자판 ---------- */

const asking = () => !askBox.hidden // '이어서 할까요?' 창이 떠 있다 - 그동안은 그 창의 버튼만 받는다

function hint() {
  if (!started || asking()) return
  const i = useHint(game)
  if (i === -1) return
  hintAt = { i, t0: performance.now() }
  pick = i
  showArrow(i)
  Sound.play('hint')
  say('깜빡이는 화살은 지금 뺄 수 있어요')
  showBar()
  save()
  dirty = true
}
hintBtn.addEventListener('click', hint)

againBtn.addEventListener('click', () => {
  if (asking()) return
  // 한창인 판을 실수로 버리지 않게 두 번 눌러야 처음부터 (창을 띄우지 않는다)
  if (game.moves > 0 && !game.won && !game.over && performance.now() > againUntil) {
    againUntil = performance.now() + AGAIN_MS
    againBtn.textContent = '한 번 더'
    setTimeout(() => {
      if (performance.now() >= againUntil) againBtn.textContent = '다시'
    }, AGAIN_MS + 50)
    return
  }
  if (game.won) nextLevel()
  else retry()
})
bindSoundButton(soundBtn, Sound)

// 자판: 방향키로 남은 화살을 차례로 고르고, 엔터(스페이스)로 뺀다
function remaining() {
  const list = game.arrows.flatMap((a, i) => (game.gone[i] ? [] : [i]))
  return list.sort((i, j) => {
    const [r1, c1] = headOf(game.arrows[i])
    const [r2, c2] = headOf(game.arrows[j])
    return r1 - r2 || c1 - c2
  })
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || asking()) return
  const onControl = e.target instanceof Element && e.target.closest('button, a, input')
  if (e.code === 'KeyM' && !e.repeat) return soundBtn.click()
  if (e.code === 'KeyH' && !e.repeat) return hint()
  // + − 0 : 확대 · 축소 · 전체 보기
  if (['Equal', 'NumpadAdd'].includes(e.code)) return zoomAt(view.z * 1.4, W / 2, H / 2)
  if (['Minus', 'NumpadSubtract'].includes(e.code)) return zoomAt(view.z / 1.4, W / 2, H / 2)
  if (['Digit0', 'Numpad0'].includes(e.code)) return setView(1, 0, 0)
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.code]
  if (step && started && !game.won && !game.over) {
    e.preventDefault() // 화면이 밀리지 않게
    const list = remaining()
    const k = list.indexOf(pick)
    pick = list[k === -1 ? (step > 0 ? 0 : list.length - 1) : (k + step + list.length) % list.length]
    showArrow(pick)
    const [hr, hc] = headOf(game.arrows[pick])
    say(`${hr + 1}줄 ${hc + 1}칸 화살, ${['위', '오른쪽', '아래', '왼쪽'][game.arrows[pick].dir]}쪽`)
    dirty = true
    return
  }
  if (e.code === 'Escape') {
    pick = -1
    dirty = true
  }
  if ((e.code === 'Enter' || e.code === 'Space') && !onControl) {
    e.preventDefault()
    if (!proceed() && pick !== -1) shoot(pick)
  }
})

function showBar() {
  levelBox.textContent = `${game.level}단계${shapeName() ? ` · ${shapeName()}` : ''}`
  heartsBox.textContent = '♥'.repeat(game.hearts) + '♡'.repeat(game.maxHearts - game.hearts)
  heartsBox.setAttribute('aria-label', `하트 ${game.hearts}개`)
  hintBtn.textContent = game.maxHints ? `힌트 ${game.hints}` : '힌트 없음'
  hintBtn.disabled = game.hints <= 0 || game.won || game.over || !started
}

const say = (text) => {
  statusBox.textContent = text
}

/* ---------- 그리기 ---------- */

let dpr = 0
function resize() {
  const next = Math.min(window.devicePixelRatio || 1, 2) // 다른 게임과 같은 상한
  if (next === dpr) return
  dpr = next
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  dirty = true
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

// 화살 하나: 꼬리부터 머리까지 얇은 선 + 머리 끝 세모. 꺾인 곳은 각지게 (둥글리면 꺾임이 흐려진다)
function drawArrow(a, s, color, width = LINE) {
  const L = a.cells.length
  const t0 = s - TAIL
  const t1 = s + L - 1
  ctx.beginPath()
  ctx.moveTo(...pointAt(a, t0))
  for (let i = Math.floor(t0) + 1; i < t1; i++) ctx.lineTo(...pointAt(a, i))
  const [hx, hy] = pointAt(a, t1)
  ctx.lineTo(hx, hy)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(cell * width, 1.5)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'miter'
  ctx.miterLimit = 4
  ctx.stroke()
  const dx = DC[a.dir]
  const dy = DR[a.dir]
  const tip = cell * 0.36
  const back = cell * 0.08
  const half = cell * 0.2 + ctx.lineWidth * 0.5
  ctx.beginPath()
  ctx.moveTo(hx + dx * tip, hy + dy * tip)
  ctx.lineTo(hx - dx * back - dy * half, hy - dy * back + dx * half)
  ctx.lineTo(hx - dx * back + dy * half, hy - dy * back - dx * half)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawBoard() {
  roundRect(bx - 8, by - 8, cell * game.cols + 16, cell * game.rows + 16, 14)
  ctx.fillStyle = LOOK.board
  ctx.fill()
  // 화살을 놓는 칸(모양 판이면 모양 안)만 바탕을 조금 짙게 + 가운데 작은 점 - 모양과 화살이 빠진 자리가 보이게.
  // 모양 밖 칸은 판 바탕 그대로다 (화살이 그 위를 지나 나간다)
  const inside = (r, c) => inBoard(game.rows, game.cols, r, c) && game.mask[r * game.cols + c]
  ctx.fillStyle = LOOK.tile
  ctx.beginPath()
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      // 이웃 칸과 이어지게 반 픽셀 겹쳐 칠한다 (칸 사이에 실금이 보이지 않게)
      if (inside(r, c)) ctx.rect(bx + c * cell - 0.25, by + r * cell - 0.25, cell + 0.5, cell + 0.5)
    }
  }
  ctx.fill()
  ctx.fillStyle = LOOK.dot
  ctx.beginPath()
  const dot = Math.max(cell * 0.06, 1)
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      if (!inside(r, c)) continue
      const x = bx + (c + 0.5) * cell
      const y = by + (r + 0.5) * cell
      ctx.moveTo(x + dot, y)
      ctx.arc(x, y, dot, 0, Math.PI * 2)
    }
  }
  ctx.fill()
}

function drawArrows(now) {
  const bumpedBy = new Set([...anims.values()].filter((m) => m.kind === 'bump').map((m) => m.by))
  // 고른 화살·힌트 화살 뒤에 빛
  const glowFor = (i) => {
    if (i === hintAt.i && now - hintAt.t0 < HINT_MS) return 0.5 + 0.5 * Math.sin(((now - hintAt.t0) / 260) * Math.PI)
    return i === pick ? 1 : 0
  }
  game.arrows.forEach((a, i) => {
    if (game.gone[i]) return
    const glow = glowFor(i)
    if (glow > 0) {
      ctx.globalAlpha = glow
      drawArrow(a, offsetOf(i, now), LOOK.glow, 0.42)
      ctx.globalAlpha = 1
    }
  })
  game.arrows.forEach((a, i) => {
    const m = anims.get(i)
    if (game.gone[i] && m?.kind !== 'fly') return
    const s = offsetOf(i, now)
    let color = colorOf(i)
    if (m?.kind === 'bump') color = LOOK.bad
    else if (bumpedBy.has(i)) color = LOOK.ink // 막은 화살을 잠깐 짙게
    if (m?.kind === 'fly') ctx.globalAlpha = Math.max(0, 1 - Math.max(0, (now - m.t0) / m.dur - 0.55) / 0.45)
    drawArrow(a, s, color)
    ctx.globalAlpha = 1
  })
}

// 지나가는 글자. 'text'(−♥)는 판 위 자리에(확대를 따라간다), 'banner' 는 화면 가운데에
function drawFx(now, kind) {
  for (const f of fx) {
    const t = (now - f.t0) / f.dur
    if (t < 0 || f.kind !== kind) continue
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    if (f.kind === 'text' && f.text) {
      ctx.globalAlpha = t < 0.6 ? 1 : (1 - t) / 0.4
      ctx.font = `800 ${20 / view.z}px ${FONT}`
      ctx.lineWidth = 4 / view.z
      ctx.strokeStyle = LOOK.board
      const y = f.y - (14 + t * 30) / view.z
      ctx.strokeText(f.text, f.x, y)
      ctx.fillStyle = f.color ?? LOOK.bad
      ctx.fillText(f.text, f.x, y)
    } else if (f.kind === 'banner') {
      const grow = t < 0.15 ? 0.6 + (t / 0.15) * 0.5 : t < 0.25 ? 1.1 - ((t - 0.15) / 0.1) * 0.1 : 1
      ctx.globalAlpha = t < 0.75 ? 1 : (1 - t) / 0.25
      ctx.save()
      ctx.translate(W / 2, H / 2 - 60)
      ctx.scale(grow, grow)
      ctx.font = `900 38px ${FONT}`
      ctx.lineWidth = 7
      ctx.strokeStyle = LOOK.board
      ctx.strokeText(f.text, 0, 0)
      ctx.fillStyle = LOOK.gold
      ctx.fillText(f.text, 0, 0)
      if (f.sub) {
        ctx.font = `800 17px ${FONT}`
        ctx.lineWidth = 5
        ctx.strokeText(f.sub, 0, 36)
        ctx.fillStyle = LOOK.ink
        ctx.fillText(f.sub, 0, 36)
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
}

// 화면 위에 뜨는 작은 알약 글씨 (전체 보기 버튼, 확대 안내)
function pill(text, x, y, w, h, strong = false) {
  roundRect(x, y, w, h, h / 2)
  ctx.fillStyle = LOOK.shade
  ctx.fill()
  ctx.strokeStyle = LOOK.dot
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = strong ? LOOK.ink : LOOK.soft
  ctx.font = `${strong ? 700 : 400} 13px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2 + 1)
}

// 가운데 큰 글자 판 (통과·끝·시작 전). 화면 전체를 덮는다
function cover(alpha, title, note, action, actionColor) {
  ctx.globalAlpha = alpha
  roundRect(4, 4, W - 8, H - 8, 12)
  ctx.fillStyle = LOOK.shade
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const mid = H / 2
  ctx.fillStyle = LOOK.ink
  ctx.font = `800 ${title.length > 9 ? 28 : 34}px ${FONT}`
  ctx.fillText(title, W / 2, mid - 16)
  ctx.font = `15px ${FONT}`
  ctx.fillStyle = LOOK.soft
  ctx.fillText(note, W / 2, mid + 20)
  if (action) {
    ctx.font = `700 15px ${FONT}`
    ctx.fillStyle = actionColor
    ctx.fillText(action, W / 2, mid + 56)
  }
  ctx.globalAlpha = 1
}

// 통과·끝 화면 (판이 다 비었거나 하트·시간을 다 썼을 때)
function drawEnd(now) {
  const since = now - endAt
  if (game.won && since < 600) return // 마지막 화살이 빠지는 걸 먼저 보여 준다
  const fade = Math.min(1, (since - (game.won ? 600 : 350)) / 250)
  if (fade <= 0) return
  let note = game.mistakes ? `부딪힌 횟수 ${game.mistakes}` : '한 번도 안 부딪혔어요'
  if (game.won && timed()) note = `${(timeLeft(now) / 1000).toFixed(1)}초 남기고 · ${note}`
  if (!game.won) note = '같은 판을 처음부터 다시 합니다'
  const title = game.won ? `${game.level}단계 통과` : game.timeUp ? '시간이 다 됐어요' : '하트를 다 썼어요'
  const ready = since > HOLD_MS
  cover(fade, title, note, ready && (game.won ? '눌러서 다음 단계 →' : '눌러서 다시'), game.won ? LOOK.gold : LOOK.soft)
}

function draw(now) {
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  ctx.translate(view.tx, view.ty)
  ctx.scale(view.z, view.z)
  drawBoard()
  if (started) drawArrows(now)
  drawFx(now, 'text')
  ctx.restore()
  if (!started) {
    // 시계가 도는 판 시작 전: 판을 가리고 몇 초인지 알려 준다
    cover(1, `${modeTag()}${game.level}단계`, `화살 ${game.arrows.length}개 · ${limit()}초 안에 다 빼기`, '눌러서 시작', LOOK.gold)
    return
  }
  if (game.won || game.over) drawEnd(now)
  else if (view.z > 1.01) pill('전체 보기', RESET_BTN.x, RESET_BTN.y, RESET_BTN.w, RESET_BTN.h, true)
  else if (zMax > 1.3 && game.moves === 0) pill('두 손가락으로 벌리면 크게 보여요', W / 2 - 112, H - 34, 224, 26)
  drawFx(now, 'banner')
}

/* ---------- 돌리기 ---------- */

function frame(now) {
  for (const [i, m] of anims) if (now - m.t0 >= m.dur) anims.delete(i)
  if (fx.length) fx = fx.filter((f) => now - f.t0 < f.dur)
  if (timed() && started && timeLeft(now) <= 0 && expire(game)) {
    lose(now)
    run = 0
    showBar()
    save()
    dirty = true
  }
  showClock(now)
  const hinting = hintAt.i !== -1 && now - hintAt.t0 < HINT_MS
  const ending = (game.won || game.over) && now - endAt < 1000 + HOLD_MS
  // 움직이는 게 있으면 매번, 없으면 바뀐 때만 그린다. 움직임이 막 끝난 프레임도 한 번 더 그린다
  // (안 그러면 사라지던 글자·힌트 빛이 흐린 채로 화면에 남는다)
  const moving = anims.size > 0 || fx.length > 0 || hinting || ending
  if (dirty || moving || wasMoving) {
    draw(now)
    dirty = false
  }
  wasMoving = moving
  requestAnimationFrame(frame)
}

darkQuery?.addEventListener?.('change', (e) => {
  LOOK = e.matches ? DARK : LIGHT
  dirty = true
})
window.addEventListener('resize', resize)
resize()
start(game)
if (!jumped) askResume()
requestAnimationFrame(frame)
mountAd()
