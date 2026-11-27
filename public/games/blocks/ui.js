// 봄날 블록 퍼즐 - 화면·입력·소리 (규칙은 logic.js)
//
// 하던 판과 최고 점수는 이 브라우저(localStorage)에만 남는다.
// (명예의 전당에 이니셜을 남길 때만 이니셜·점수·날짜를 순위표 서버에 보낸다 - /js/scores.js)
import { track, store } from '../../js/browser.js'
import { createSound, bindSoundButton, FANFARE } from '../../js/sound.js'
import { celebrate, calm } from '../../js/celebrate.js'
import { mountAd } from '../../js/ad.js'
import { createHall } from '../../js/scores.js'
import {
  SIZE, TRAY, EMPTY, COMBO_GRACE, SHAPES, at, createGame, canPlace, findSpot, fitsAnywhere, linesIf, lineCells, comboLeft, place, restore, snapshot,
} from './logic.js'

const SAVE_KEY = 'bomnal-blocks-save-v1'
const BEST_KEY = 'bomnal-blocks-best-v1'
const SOUND_KEY = 'bomnal-blocks-sound-v1'
const OVER_HOLD_MS = 700 // 끝난 직후 놓던 손 때문에 바로 새 판이 열리지 않게
const AGAIN_MS = 2500 // 하던 판에서 '새 판'을 한 번 누르면 이만큼 기다리며 한 번 더 누르길 받는다

// 화면 배치 (논리 좌표 - 캔버스 360×466 에 맞춘다. 실제 크기는 CSS 가 정한다)
const W = 360
const H = 466
const CELL = 40
const BX = 20 // 판 왼쪽 위
const BY = 14
const BOARD = CELL * SIZE
const TRAY_Y = BY + BOARD + 14 // 아래 조각 줄
const TRAY_H = H - TRAY_Y - 6
const SLOT_W = W / TRAY
const MINI = 20 // 아래 줄 조각의 칸 크기
const TOUCH_LIFT = 34 // 손가락으로 끌 때 조각을 손가락보다 이만큼 위에 띄운다

// 조각 색 7가지 (logic.js COLORS). 봄날웍스 세이지·베이지·갈색에 흙빛 몇 가지를 더했다
const BLOCK = ['#87977b', '#c9a77c', '#9a7a62', '#c47a5a', '#e0b35a', '#7d97a8', '#a57f9a']
const FONT = 'Pretendard, "Malgun Gothic", sans-serif'
const num = new Intl.NumberFormat('ko-KR') // 1,234 (포맷터를 한 번만 만든다)

const LIGHT = {
  board: '#efe7da', slot: '#e4d9c8', ink: '#3a322c', soft: '#6b5f55', glow: 'rgba(255, 255, 255, 0.55)',
  shade: 'rgba(247, 244, 237, 0.86)', bad: 'rgba(179, 38, 30, 0.55)', gold: '#a8781e',
}
const DARK = {
  board: '#1e1a16', slot: '#322b25', ink: '#ede6da', soft: '#b5a99a', glow: 'rgba(255, 250, 240, 0.32)',
  shade: 'rgba(30, 26, 22, 0.86)', bad: 'rgba(240, 120, 110, 0.7)', gold: '#e0b35a',
}
const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
let LOOK = darkQuery?.matches ? DARK : LIGHT

const TUNES = {
  pick: [[620, 0.025, 0]],
  place: [[392, 0.05, 0]],
  nope: [[180, 0.06, 0]],
  clear: [[660, 0.06, 0], [880, 0.09, 60]],
  best: [[880, 0.06, 0], [1175, 0.06, 70], [1568, 0.14, 140]],
  perfect: FANFARE,
  over: [[330, 0.12, 0], [262, 0.14, 130], [196, 0.3, 260]],
  record: FANFARE,
}

// 콤보 2·3·4…마다 한 음씩 올라가는 소리 (combo2 … combo12). 12를 넘으면 맨 위 소리를 그대로 쓴다
const MAX_COMBO_TUNE = 12
for (let n = 2; n <= MAX_COMBO_TUNE; n++) {
  const f = 523 * 2 ** ((n - 2) / 6) // 반음 두 개씩 오른다
  TUNES[`combo${n}`] = [[f, 0.05, 0], [f * 1.25, 0.05, 50], [f * 1.5, 0.12, 100]]
}
const PRAISE = ['', '', '좋아요!', '멋져요!', '대단해요!'] // 한 번에 지운 줄 수별 (5줄 이상은 맨 끝)

const $ = (sel) => document.querySelector(sel)
const canvas = $('#board')
const ctx = canvas.getContext('2d')
const confetti = $('#confetti')
const scoreBox = $('#score')
const comboBox = $('#combo')
const bestBox = $('#best')
const newBtn = $('#new')
const soundBtn = $('#sound')
const statusBox = $('#status')

const Sound = createSound(SOUND_KEY, TUNES)
const hall = createHall('blocks')
let best = store.read(BEST_KEY, 0) || 0

let game = restore(store.read(SAVE_KEY, null))
if (!game || game.over) game = createGame()
let overAt = 0
let newRecord = false
let drag = null // 끄는 중: { slot, x, y, touch, id } - x·y 는 손가락(마우스) 자리
let keyPick = null // 자판으로 고른 조각: { slot, r, c }
let fx = [] // 지나가는 그림 (지워지는 칸, 놓인 칸, 점수 글자, 가운데 큰 글자)
let parts = [] // 줄을 지울 때 튀는 조각 { x, y, vx, vy, rot, vr, size, color, t0, life }
let shake = null // 판 흔들기 { t0, dur, power }
let shownScore = game.score // 점수판에 보이는 값 - 진짜 점수를 굴러 따라간다
let usable = [] // 아래 조각마다 판에 놓을 데가 있는지 - 판이 바뀔 때만 센다 (그릴 때마다 세지 않게)
const countUsable = () => {
  usable = game.tray.map((p) => Boolean(p) && fitsAnywhere(game.board, p.shape))
}
let passedBest = best > 0 && game.score > best // 이번 판에서 이미 최고 기록을 넘었는지 (한 번만 알린다)
let dirty = true
let againUntil = 0

/* ---------- 좌표 ---------- */

function toLogical(e) {
  const box = canvas.getBoundingClientRect()
  return { x: ((e.clientX - box.left) * W) / box.width, y: ((e.clientY - box.top) * H) / box.height }
}

// 아래 줄 slot 칸에서 조각을 그릴 왼쪽 위
function slotOrigin(slot, shape) {
  const { rows, cols } = SHAPES[shape]
  return { x: slot * SLOT_W + (SLOT_W - cols * MINI) / 2, y: TRAY_Y + (TRAY_H - rows * MINI) / 2 }
}

// 끄는 조각의 왼쪽 위 (판 칸 크기로). 손가락이면 손가락 위로 띄우고, 마우스면 가운데를 잡는다
function dragOrigin(d) {
  const { rows, cols } = SHAPES[game.tray[d.slot].shape]
  const y = d.touch ? d.y - TOUCH_LIFT - rows * CELL : d.y - (rows * CELL) / 2
  return { x: d.x - (cols * CELL) / 2, y }
}

// 끄는 조각이 놓일 판 칸 (놓을 수 없으면 null)
function dragTarget(d) {
  const o = dragOrigin(d)
  const r = Math.round((o.y - BY) / CELL)
  const c = Math.round((o.x - BX) / CELL)
  return canPlace(game.board, game.tray[d.slot].shape, r, c) ? { r, c } : null
}

/* ---------- 손가락·마우스로 끌기 ---------- */

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  canvas.focus({ preventScroll: true })
  if (game.over) {
    if (performance.now() - overAt > OVER_HOLD_MS) newGame()
    return
  }
  const { x, y } = toLogical(e)
  if (y < TRAY_Y - 8) return
  const slot = Math.min(TRAY - 1, Math.max(0, Math.floor(x / SLOT_W)))
  if (!game.tray[slot]) return
  try {
    canvas.setPointerCapture(e.pointerId) // 손가락이 화면 밖으로 나가도 떼는 순간을 받는다
  } catch {
    /* 못 잡아도 화면 안에서는 그대로 된다 */
  }
  keyPick = null
  drag = { slot, x, y, touch: e.pointerType !== 'mouse', id: e.pointerId }
  Sound.play('pick')
  dirty = true
})

canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return
  const { x, y } = toLogical(e)
  drag.x = x
  drag.y = y
  dirty = true
})

function endDrag(e, drop) {
  if (!drag || e.pointerId !== drag.id) return
  const d = drag
  drag = null
  dirty = true
  if (!drop) return
  const target = dragTarget(d)
  if (target) doPlace(d.slot, target.r, target.c)
  else if (dragOrigin(d).y < TRAY_Y - CELL) Sound.play('nope') // 판 위에 놓으려다 못 놓은 경우만
}
canvas.addEventListener('pointerup', (e) => endDrag(e, true))
canvas.addEventListener('pointercancel', (e) => endDrag(e, false))
canvas.addEventListener('lostpointercapture', (e) => endDrag(e, false))
canvas.addEventListener('contextmenu', (e) => e.preventDefault())

/* ---------- 자판: 1·2·3 고르기, 방향키 옮기기, 엔터 놓기 ---------- */

function pickByKey(slot) {
  const piece = game.tray[slot]
  if (!piece || game.over || drag) return // 손가락·마우스로 끄는 중에는 자판을 받지 않는다
  const spot = findSpot(game.board, piece.shape)
  const { rows, cols } = SHAPES[piece.shape]
  keyPick = spot ? { slot, ...spot } : { slot, r: (SIZE - rows) >> 1, c: (SIZE - cols) >> 1 }
  Sound.play('pick')
  dirty = true
}

function moveByKey(dr, dc) {
  const { rows, cols } = SHAPES[game.tray[keyPick.slot].shape]
  keyPick.r = Math.min(SIZE - rows, Math.max(0, keyPick.r + dr))
  keyPick.c = Math.min(SIZE - cols, Math.max(0, keyPick.c + dc))
  dirty = true
}

const MOVES = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const onControl = e.target instanceof Element && e.target.closest('button, a, input')
  if (e.code === 'KeyM' && !e.repeat) return soundBtn.click()
  const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code]
  if (n !== undefined) return pickByKey(n)
  if (!keyPick || drag) return
  if (MOVES[e.code]) {
    e.preventDefault() // 화면이 밀리지 않게
    return moveByKey(...MOVES[e.code])
  }
  if (e.code === 'Escape') {
    keyPick = null
    dirty = true
  }
  if ((e.code === 'Enter' || e.code === 'Space') && !onControl) {
    e.preventDefault()
    const { slot, r, c } = keyPick
    if (canPlace(game.board, game.tray[slot].shape, r, c)) doPlace(slot, r, c)
    else Sound.play('nope')
  }
})

/* ---------- 놓기 ---------- */

function doPlace(slot, r, c) {
  const color = game.tray[slot].color
  const res = place(game, slot, r, c)
  if (!res) return
  keyPick = null
  if (game.moves === 1) track('blocks_start')
  const now = performance.now()
  fx.push({ kind: 'pop', t0: now, dur: 180, cells: res.cells, color })
  if (res.cleared.length) fx.push({ kind: 'clear', t0: now, dur: 380, cells: res.cleared })

  // 점수 글자는 놓은 조각 가운데에서 떠오른다
  const cx = BX + (res.cells.reduce((s, [, cc]) => s + cc, 0) / res.cells.length + 0.5) * CELL
  const cy = BY + (res.cells.reduce((s, [rr]) => s + rr, 0) / res.cells.length + 0.5) * CELL
  const lines = []
  if (res.lines) lines.push([`+${res.gained}`, 22])
  if (res.combo >= 2) lines.push([`콤보 ×${res.combo}`, 16])
  if (lines.length) fx.push({ kind: 'text', t0: now, dur: 950, x: cx, y: cy, lines })

  // 가운데 큰 글자: 판 비움 > 여러 줄. 최고 기록을 처음 넘은 수면 아래에 한 줄 더 (큰 글자가 없으면 그것만)
  const praise = res.perfect ? '판 비움!' : PRAISE[Math.min(res.lines, PRAISE.length - 1)]
  const beatBest = !passedBest && best > 0 && game.score > best
  if (beatBest) passedBest = true
  const bannerText = praise || (beatBest ? '최고 기록 돌파!' : '')
  if (bannerText) fx.push({ kind: 'banner', t0: now, dur: 1100, text: bannerText, sub: praise && beatBest ? '최고 기록 돌파!' : '' })

  if (res.lines) burst(res.cleared, res.lines, now)

  if (res.perfect) {
    Sound.play('perfect')
    celebrate(confetti, { duration: 1800 })
  } else if (res.combo >= 2) Sound.play(`combo${Math.min(res.combo, MAX_COMBO_TUNE)}`)
  else if (res.lines) Sound.play('clear')
  else Sound.play('place')
  if (beatBest && !res.perfect) setTimeout(() => Sound.play('best'), 260)
  // 폰 진동은 소리를 켜 둔 사람에게만 (조용히 하고 싶은 사람은 소리 버튼 하나로 둘 다 끈다)
  if (res.lines && Sound.on) navigator.vibrate?.(res.lines >= 2 || res.combo >= 2 ? [25, 40, 35] : 20)

  const said = [`${res.gained}점`]
  if (res.lines) said.push(`${res.lines}줄 지움`)
  if (res.combo >= 2) said.push(`콤보 ${res.combo}`)
  if (res.dealt) said.push('새 조각 세 개')
  say(said.join(', '))

  if (game.over) finish()
  else store.write(SAVE_KEY, snapshot(game))
  showScore()
  dirty = true
}

// 지운 칸마다 조각 몇 개를 튀기고, 지운 줄 수만큼 판을 흔든다 ('동작 줄이기' 설정이면 둘 다 하지 않는다)
function burst(cells, lines, now) {
  if (calm()) return
  const each = cells.length > 20 ? 3 : 4
  for (const { r, c, color } of cells) {
    for (let k = 0; k < each; k++) {
      const a = Math.random() * Math.PI * 2
      const v = 60 + Math.random() * 160
      parts.push({
        x: BX + (c + 0.5) * CELL, y: BY + (r + 0.5) * CELL,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 10,
        size: 5 + Math.random() * 7, color: BLOCK[color], t0: now, life: 600 + Math.random() * 300,
      })
    }
  }
  shake = { t0: now, dur: 260 + lines * 40, power: Math.min(2 + lines * 1.6, 9) }
}

// 점수판 옆 콤보: "콤보 ×3 ●●○" - 채운 점은 콤보가 끊기기까지 남은 수
function showCombo() {
  if (game.combo < 2 || game.over) {
    comboBox.hidden = true
    return
  }
  const left = comboLeft(game)
  if (comboBox.hidden || comboBox.dataset.combo !== String(game.combo)) {
    comboBox.classList.remove('pop')
    void comboBox.offsetWidth // 같은 글자여도 움직임이 다시 돌게
    comboBox.classList.add('pop')
  }
  comboBox.dataset.combo = String(game.combo)
  comboBox.textContent = `콤보 ×${game.combo} ${'●'.repeat(left)}${'○'.repeat(COMBO_GRACE - left)}`
  comboBox.setAttribute('aria-label', `콤보 ${game.combo}배, 끊기기까지 ${left}수`)
  comboBox.hidden = false
}

function finish() {
  overAt = performance.now()
  drag = null
  keyPick = null
  newRecord = game.score > best
  if (newRecord) {
    best = game.score
    store.write(BEST_KEY, best)
  }
  store.remove(SAVE_KEY) // 끝난 판은 다시 열지 않는다
  track('blocks_over')
  // 마지막 줄 지우는 소리와 겹치지 않게 조금 뒤에
  setTimeout(() => Sound.play(newRecord ? 'record' : 'over'), 350)
  if (newRecord) setTimeout(() => celebrate(confetti, { duration: 2400 }), 350)
  hall.offer('all', game.score) // 1~5등에 들면 이니셜을 받는다
  say(newRecord ? `더 놓을 곳이 없어요. ${game.score}점, 최고 기록입니다` : `더 놓을 곳이 없어요. ${game.score}점, 최고 ${best}점`)
}

function newGame() {
  // 끝나지 않은 판을 '새 판'으로 버려도 그 판에서 넘긴 최고 기록은 남긴다 (화면에는 이미 최고로 보였다)
  if (game.score > best) {
    best = game.score
    store.write(BEST_KEY, best)
  }
  game = createGame()
  drag = null
  keyPick = null
  fx = []
  parts = []
  shake = null
  newRecord = false
  passedBest = false
  shownScore = 0
  againUntil = 0
  store.write(SAVE_KEY, snapshot(game))
  showScore()
  say('새 판입니다')
  dirty = true
}

newBtn.addEventListener('click', () => {
  // 한창인 판을 실수로 버리지 않게 두 번 눌러야 새 판 (창을 띄우지 않는다)
  if (game.moves > 0 && !game.over && performance.now() > againUntil) {
    againUntil = performance.now() + AGAIN_MS
    newBtn.textContent = '한 번 더 누르면 새 판'
    setTimeout(() => {
      if (performance.now() >= againUntil) newBtn.textContent = '새 판'
    }, AGAIN_MS + 50)
    return
  }
  newBtn.textContent = '새 판'
  newGame()
})
bindSoundButton(soundBtn, Sound)

function showScore() {
  bestBox.textContent = `최고 ${num.format(Math.max(best, game.score))}`
  showCombo()
  countUsable()
}

// 매 프레임: 보이는 점수가 진짜 점수를 따라 굴러 올라간다 (새 판이면 바로 0)
let written = -1 // 점수판에 마지막으로 적은 값 - 같으면 건드리지 않는다
function rollScore() {
  if (shownScore < game.score) shownScore = Math.min(game.score, shownScore + Math.max(1, Math.ceil((game.score - shownScore) * 0.18)))
  if (shownScore === written) return
  written = shownScore
  scoreBox.textContent = num.format(shownScore)
}

const say = (text) => {
  statusBox.textContent = text
}

/* ---------- 그리기 ---------- */

let dpr = 0
function resize() {
  const next = Math.min(window.devicePixelRatio || 1, 2) // 다른 게임과 같은 상한 (폰에서 칠할 픽셀이 너무 많아지지 않게)
  if (next === dpr) return
  dpr = next
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  dirty = true
}

// 지금 경로에 둥근 네모를 더한다 (여러 개를 모아 한 번에 칠할 때)
function addRoundRect(x, y, w, h, r) {
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  addRoundRect(x, y, w, h, r)
}

// 블록 한 칸 - 위에 빛, 아래에 그늘
function block(x, y, s, color, alpha = 1) {
  const pad = Math.max(1, s * 0.05)
  const r = s * 0.18
  ctx.globalAlpha = alpha
  roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, r)
  ctx.fillStyle = color
  ctx.fill()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)'
  roundRect(x + pad, y + s * 0.62, s - pad * 2, s * 0.38 - pad, [0, 0, r, r])
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.26)'
  roundRect(x + pad * 2.5, y + pad * 2.5, s - pad * 5, s * 0.22, r * 0.6)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawShape(shape, x, y, s, color, alpha = 1) {
  for (const [r, c] of SHAPES[shape].cells) block(x + c * s, y + r * s, s, color, alpha)
}

function drawBoard(now) {
  roundRect(BX - 6, BY - 6, BOARD + 12, BOARD + 12, 12)
  ctx.fillStyle = LOOK.board
  ctx.fill()
  // 빈 칸 자리는 한 경로로 모아 한 번에 칠한다
  ctx.beginPath()
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (game.board[i] === EMPTY) addRoundRect(BX + (i % SIZE) * CELL + 2, BY + Math.floor(i / SIZE) * CELL + 2, CELL - 4, CELL - 4, 6)
  }
  ctx.fillStyle = LOOK.slot
  ctx.fill()
  // 막 놓인 칸은 조금 작게 시작해 커진다
  const pop = fx.find((f) => f.kind === 'pop')
  const popping = new Map(pop ? pop.cells.map(([r, c]) => [at(r, c), Math.min(1, (now - pop.t0) / pop.dur)]) : [])
  for (let i = 0; i < SIZE * SIZE; i++) {
    const v = game.board[i]
    if (v === EMPTY) continue
    const t = popping.get(i)
    const s = t === undefined ? CELL : CELL * (0.82 + 0.18 * t)
    block(BX + (i % SIZE) * CELL + (CELL - s) / 2, BY + Math.floor(i / SIZE) * CELL + (CELL - s) / 2, s, BLOCK[v])
  }
}

// 놓을 자리 그림자와 지워질 줄 (끄는 중이거나 자판으로 고른 중)
function drawPreview() {
  // 끄는 중이면 놓일 수 있는 칸에만 그림자를, 자판으로 고른 중이면 막힌 자리도 빨간 테두리로 보여 준다
  const spot = drag ? dragTarget(drag) : keyPick
  if (!spot) return
  const { shape, color } = game.tray[(drag ?? keyPick).slot]
  if (!canPlace(game.board, shape, spot.r, spot.c)) {
    // 자판으로 고른 자리가 막혀 있으면 빨간 테두리로만
    ctx.strokeStyle = LOOK.bad
    ctx.lineWidth = 3
    for (const [r, c] of SHAPES[shape].cells) {
      roundRect(BX + (spot.c + c) * CELL + 3, BY + (spot.r + r) * CELL + 3, CELL - 6, CELL - 6, 6)
      ctx.stroke()
    }
    return
  }
  const { rows, cols } = linesIf(game.board, shape, spot.r, spot.c)
  const clears = rows.length + cols.length > 0
  ctx.fillStyle = LOOK.glow
  for (const r of rows) {
    roundRect(BX, BY + r * CELL, BOARD, CELL, 8)
    ctx.fill()
  }
  for (const c of cols) {
    roundRect(BX + c * CELL, BY, CELL, BOARD, 8)
    ctx.fill()
  }
  // 지워질 줄에 이미 있는 블록은 끄는 조각 색으로 물들인다 - 놓으면 터진다는 신호
  if (clears) {
    for (const i of lineCells({ rows, cols })) {
      if (game.board[i] !== EMPTY) block(BX + (i % SIZE) * CELL, BY + Math.floor(i / SIZE) * CELL, CELL, BLOCK[color])
    }
  }
  drawShape(shape, BX + spot.c * CELL, BY + spot.r * CELL, CELL, BLOCK[color], clears ? 0.85 : drag ? 0.35 : 0.6)
}

function drawTray() {
  game.tray.forEach((piece, slot) => {
    if (!piece || drag?.slot === slot) return
    const { x, y } = slotOrigin(slot, piece.shape)
    drawShape(piece.shape, x, y, MINI, BLOCK[piece.color], usable[slot] ? 1 : 0.28)
    if (keyPick?.slot === slot) {
      const { rows, cols } = SHAPES[piece.shape]
      roundRect(x - 6, y - 6, cols * MINI + 12, rows * MINI + 12, 8)
      ctx.strokeStyle = LOOK.soft
      ctx.lineWidth = 2
      ctx.stroke()
    }
  })
  // 자판 번호 (작게)
  ctx.fillStyle = LOOK.soft
  ctx.globalAlpha = 0.5
  ctx.font = `11px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let k = 0; k < TRAY; k++) ctx.fillText(String(k + 1), k * SLOT_W + 8, TRAY_Y + 2)
  ctx.globalAlpha = 1
}

function drawFx(now) {
  for (const f of fx) {
    const t = Math.min(1, (now - f.t0) / f.dur)
    if (f.kind === 'clear') {
      // 지워지는 칸: 밝게 번쩍였다가 작아지며 사라진다
      for (const { r, c, color } of f.cells) {
        const s = CELL * (1 - t * 0.6)
        const x = BX + c * CELL + (CELL - s) / 2
        const y = BY + r * CELL + (CELL - s) / 2
        block(x, y, s, BLOCK[color], 1 - t)
        if (t < 0.35) {
          ctx.globalAlpha = (0.35 - t) * 2
          roundRect(x, y, s, s, 6)
          ctx.fillStyle = '#fff'
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
    } else if (f.kind === 'text') {
      ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const y = Math.min(Math.max(f.y, BY + 30), BY + BOARD - 30) - t * 34
      const x = Math.min(Math.max(f.x, BX + 50), BX + BOARD - 50)
      f.lines.forEach(([text, size], i) => {
        ctx.font = `800 ${size}px ${FONT}`
        ctx.lineWidth = 4
        ctx.strokeStyle = LOOK.board
        ctx.strokeText(text, x, y + i * 24)
        ctx.fillStyle = i ? LOOK.gold : LOOK.ink
        ctx.fillText(text, x, y + i * 24)
      })
      ctx.globalAlpha = 1
    } else if (f.kind === 'banner') {
      // 커지며 튀어나왔다가(처음 15%) 머물고, 끝 25% 동안 옅어진다
      const grow = t < 0.15 ? 0.6 + (t / 0.15) * 0.5 : t < 0.25 ? 1.1 - ((t - 0.15) / 0.1) * 0.1 : 1
      ctx.globalAlpha = t < 0.75 ? 1 : (1 - t) / 0.25
      ctx.save()
      ctx.translate(W / 2, BY + BOARD / 2 - 10)
      ctx.scale(grow, grow)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `900 ${f.text.length > 6 ? 30 : 38}px ${FONT}`
      ctx.lineWidth = 7
      ctx.lineJoin = 'round'
      ctx.strokeStyle = LOOK.board
      ctx.strokeText(f.text, 0, 0)
      ctx.fillStyle = LOOK.gold
      ctx.fillText(f.text, 0, 0)
      if (f.sub) {
        ctx.font = `800 17px ${FONT}`
        ctx.lineWidth = 5
        ctx.strokeText(f.sub, 0, 34)
        ctx.fillStyle = LOOK.ink
        ctx.fillText(f.sub, 0, 34)
      }
      ctx.restore()
      ctx.globalAlpha = 1
    }
  }
}

function drawParts(now) {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, 1 - (now - p.t0) / p.life)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function drawDragged() {
  if (!drag) return
  const piece = game.tray[drag.slot]
  const o = dragOrigin(drag)
  drawShape(piece.shape, o.x, o.y, CELL, BLOCK[piece.color], 0.95)
}

function drawOver(now) {
  roundRect(BX - 6, BY - 6, BOARD + 12, BOARD + 12, 12)
  ctx.fillStyle = LOOK.shade
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const mid = BY + BOARD / 2
  ctx.fillStyle = LOOK.soft
  ctx.font = `15px ${FONT}`
  ctx.fillText('더 놓을 곳이 없어요', W / 2, mid - 52)
  ctx.fillStyle = LOOK.ink
  ctx.font = `800 40px ${FONT}`
  ctx.fillText(`${num.format(game.score)}점`, W / 2, mid - 10)
  ctx.font = `700 16px ${FONT}`
  ctx.fillStyle = newRecord ? LOOK.gold : LOOK.soft
  ctx.fillText(newRecord ? '최고 기록!' : `최고 ${num.format(best)}점`, W / 2, mid + 28)
  if (now - overAt > OVER_HOLD_MS) {
    ctx.fillStyle = LOOK.soft
    ctx.font = `14px ${FONT}`
    ctx.fillText('눌러서 새 판', W / 2, mid + 62)
  }
}

function draw(now) {
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  if (shake) {
    const t = Math.min(1, (now - shake.t0) / shake.dur)
    const amp = shake.power * (1 - t) ** 2
    ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp)
  }
  drawBoard(now)
  if (!game.over) drawPreview()
  drawFx(now)
  ctx.restore()
  drawParts(now)
  drawTray()
  drawDragged()
  if (game.over) drawOver(now)
}

/* ---------- 돌리기 ---------- */

let overShown = false // '눌러서 새 판' 글자를 띄웠는지 (그때 한 번 더 그린다)
let lastFrame = 0
function frame(now) {
  const dt = Math.min((now - (lastFrame || now)) / 1000, 0.05) // 탭을 다시 열었을 때 조각이 한꺼번에 날아가지 않게 자른다
  lastFrame = now
  if (fx.length) fx = fx.filter((f) => now - f.t0 < f.dur)
  if (shake && now - shake.t0 >= shake.dur) {
    shake = null
    dirty = true
  }
  if (parts.length) {
    parts = parts.filter((p) => now - p.t0 < p.life)
    for (const p of parts) {
      p.vy += 520 * dt // 떨어진다
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
    }
    dirty = true
  }
  rollScore()
  const overReady = game.over && now - overAt > OVER_HOLD_MS
  if (overReady !== overShown) {
    overShown = overReady
    dirty = true
  }
  if (dirty) {
    draw(now)
    dirty = fx.length > 0 || parts.length > 0 || shake !== null // 마지막 장면까지 한 번 더 그린다
  }
  requestAnimationFrame(frame)
}

darkQuery?.addEventListener?.('change', (e) => {
  LOOK = e.matches ? DARK : LIGHT
  dirty = true
})
window.addEventListener('resize', resize)
resize()
showScore()
requestAnimationFrame(frame)
hall.show('all')
// 광고는 처음부터 게임과 놀이 방법 사이에 둔다 (/js/ad.js)
mountAd()
