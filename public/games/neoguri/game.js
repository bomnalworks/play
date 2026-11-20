// 봄날 너구리 — 화면·소리·입력 (게임 규칙은 logic.js, 그림은 skin.js)
//
// 최고 점수와 소리 설정은 이 브라우저(localStorage)에만 남고, 서버로 아무것도 보내지 않습니다.
import { track, store } from '../../js/browser.js'
import { mountAd } from '../../js/ad.js'
import { createSound, bindSoundButton } from '../../js/sound.js'
import { SKIN, loadSkinImages, paint, drawBackdrop } from './skin.js'
import { W, H, HUD, WALL, SCORE, createGame, startGame, togglePause, step } from './logic.js'

const BEST_KEY = 'bomnal-neoguri-best-v1'
const SOUND_KEY = 'bomnal-neoguri-sound-v1'
const FACE = "'Pretendard Variable', Pretendard, -apple-system, 'Malgun Gothic', sans-serif"
const FONT = `600 12px ${FACE}`
const BIG = `700 20px ${FACE}`

/* ---------- 소리 ---------- */

const TUNES = {
  pick: [[1040, 0.06, 0]],
  jump: [[620, 0.09, 0]],
  fall: [[520, 0.08, 0], [380, 0.1, 70]],
  potBonus: [[700, 0.07, 0], [900, 0.07, 70], [1200, 0.14, 140]],
  potSnake: [[300, 0.1, 0], [240, 0.16, 90]],
  hit: [[380, 0.14, 0], [250, 0.2, 130]],
  starve: [[420, 0.14, 0], [330, 0.14, 130], [240, 0.26, 260]],
  crash: [[300, 0.06, 0], [200, 0.22, 60]],
  clear: [[700, 0.1, 0], [900, 0.1, 110], [1100, 0.1, 220], [1400, 0.22, 330]],
  over: [[500, 0.16, 0], [380, 0.16, 150], [280, 0.3, 300]],
}

const Sound = createSound(SOUND_KEY, TUNES)

// logic.js 가 알리는 일 → 무슨 소리를 내고, 읽어 줄지, 통계를 보낼지.
// 이벤트를 늘릴 때 고칠 곳은 여기 하나다.
const EVENTS = {
  start: { say: true, track: 'game_start' },
  pick: { tune: 'pick' },
  jump: { tune: 'jump' },
  fall: { tune: 'fall' },
  potBonus: { tune: 'potBonus' },
  potSnake: { tune: 'potSnake' },
  enemy: { tune: 'hit', say: true },
  spike: { tune: 'hit', say: true },
  hunger: { tune: 'starve', say: true },
  drop: { tune: 'crash', say: true },
  clear: { tune: 'clear', say: true },
  over: { tune: 'over', say: true, track: 'game_over', record: true, ad: true },
}

/* ---------- 입력 ---------- */

const keys = new Set()
const pad = { left: false, right: false, up: false, down: false }
let jumpEdge = false // 한 번 누름 = 한 번 점프

const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
}
const held = (name) => pad[name] || KEYS[name].some((code) => keys.has(code))

/* ---------- 상태 ---------- */

let best = store.read(BEST_KEY, 0) || 0

const game = createGame()

function drainEvents() {
  for (const name of game.events) {
    const event = EVENTS[name]
    if (!event) continue
    if (event.tune) Sound.play(event.tune)
    if (event.record && game.score > best) {
      best = game.score
      store.write(BEST_KEY, best)
    }
    if (event.track) track(event.track)
    // 놀이 중에는 광고를 띄우지 않는다. 한 판이 끝난 뒤에 판 아래로 한 번만 붙는다.
    if (event.ad) mountAd()
    if (event.say) say()
  }
  game.events.length = 0
}

/* ---------- 그리기 ---------- */

const canvas = document.getElementById('board')
const ctx = canvas.getContext('2d')

let dpr = 0
function resize() {
  const next = Math.min(window.devicePixelRatio || 1, 2)
  if (next === dpr) return // 크기가 그대로면 백버퍼를 다시 잡지 않는다 (잡으면 화면이 지워진다)
  dpr = next
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // 해상도가 바뀌었으니 그려 둔 사본을 모두 버린다
  backdrop.stage = null
  fruitSprites.clear()
  lastStill = ''
}

// 판 그림(하늘·벽·바닥·사다리·압정)은 한 단계 동안 안 바뀐다.
// 한 번 그려 두고 프레임마다 복사만 한다. 그림 자체는 skin.js 몫이다.
const backdrop = { stage: null, canvas: null }
function backdropFor(stageData) {
  if (backdrop.stage === stageData) return backdrop.canvas
  const bg = backdrop.canvas ?? document.createElement('canvas')
  bg.width = canvas.width
  bg.height = canvas.height
  const g = bg.getContext('2d')
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawBackdrop(g, stageData)
  backdrop.stage = stageData
  backdrop.canvas = bg
  return bg
}

// 과일은 흔들리지 않는 그림이라 종류마다 한 번만 그려 두고 복사한다
// (판에 30~40개가 있어서 프레임마다 그리면 제일 비싼 일이 된다).
const fruitSprites = new Map()
function fruitSprite(kind) {
  let sprite = fruitSprites.get(kind)
  if (!sprite) {
    sprite = document.createElement('canvas')
    sprite.width = Math.round(SKIN.fruit.w * dpr)
    sprite.height = Math.round(SKIN.fruit.h * dpr)
    const g = sprite.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(g, SKIN.fruit, 0, 0, 0, { kind })
    fruitSprites.set(kind, sprite)
  }
  return sprite
}

function draw() {
  if (!game.stageData) {
    ctx.fillStyle = '#16120f'
    ctx.fillRect(0, 0, W, H)
    drawHud()
    drawOverlay(OVERLAYS.ready())
    return
  }
  ctx.drawImage(backdropFor(game.stageData), 0, 0, W, H)
  drawHud()

  // 과일 · 항아리
  for (const fruit of game.stageData.fruits) {
    if (fruit.taken) continue
    ctx.drawImage(fruitSprite(fruit.kind), fruit.box.x, fruit.box.y, SKIN.fruit.w, SKIN.fruit.h)
  }
  for (const pot of game.stageData.pots) {
    if (pot.taken) continue
    paint(ctx, SKIN.pot, pot.box.x, pot.box.y, game.t)
  }

  // 뱀 · 전갈
  for (const e of game.stageData.enemies) {
    paint(ctx, e.kind === 'snake' ? SKIN.snake : SKIN.scorpion, e.x, e.y, game.t * 3, { flip: e.dir < 0 })
  }

  // 너구리 (부딪힌 뒤 잠깐은 깜빡인다)
  const p = game.player
  const blink = game.invulnLeft > 0 && Math.floor(game.invulnLeft * 10) % 2 === 0
  if (!blink && game.phase !== 'hit') {
    paint(ctx, SKIN.player, p.x, p.y, p.step, { flip: p.facing < 0, climbing: p.state === 'climb' })
  }

  const overlay = OVERLAYS[game.phase]
  if (overlay) drawOverlay(overlay())
}

const OVERLAYS = {
  ready: () => ['봄날 너구리', '시작을 누르세요'],
  paused: () => ['잠깐 멈춤', '계속하려면 다시 누르세요'],
  hit: () => ['앗!', `남은 목숨 ${game.lives}`],
  cleared: () => [`${game.stage}단계 통과!`, `+${SCORE.stage}점`],
  over: () => ['놀이 끝', `점수 ${num(game.score)} · 최고 ${num(best)}`],
}

// 포매터를 한 번만 만든다 (toLocaleString 은 부를 때마다 새로 만든다)
const commas = new Intl.NumberFormat('ko-KR')
const num = (value) => commas.format(value)

function drawHud() {
  ctx.fillStyle = '#17130f'
  ctx.fillRect(0, 0, W, HUD)
  ctx.font = FONT
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#efe3d3'
  ctx.fillText(`점수 ${num(game.score)}`, 12, 12)
  ctx.fillStyle = '#b3aa9e'
  ctx.fillText(`${game.stage}단계`, 12, 26)
  ctx.textAlign = 'right'
  ctx.fillText(`최고 ${num(best)}`, W - 12, 12)
  ctx.fillStyle = '#e0906f'
  ctx.fillText('♥'.repeat(Math.max(0, game.lives)), W - 12, 26)

  // 배고픔 — 다 줄기 전에 한 판을 끝내야 한다
  const left = Math.max(0, Math.min(1, game.hunger))
  ctx.fillStyle = '#2a211a'
  ctx.fillRect(WALL, HUD - 7, W - WALL * 2, 5)
  ctx.fillStyle = left > 0.3 ? '#7fae54' : '#c5493a'
  ctx.fillRect(WALL, HUD - 7, (W - WALL * 2) * left, 5)
}

function drawOverlay(lines) {
  ctx.fillStyle = 'rgba(12, 9, 7, 0.72)'
  ctx.fillRect(0, HUD, W, H - HUD)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#efe3d3'
  ctx.font = BIG
  ctx.fillText(lines[0], W / 2, H / 2 - 12)
  ctx.font = FONT
  ctx.fillStyle = '#d6c9b6'
  ctx.fillText(lines[1] ?? '', W / 2, H / 2 + 16)
}

/* ---------- 화면 밖 안내 (읽어 주는 기기용) ---------- */

const statusBox = document.getElementById('status')
const startBtn = document.getElementById('start')
const pauseBtn = document.getElementById('pause')
const soundBtn = document.getElementById('sound')

const SPOKEN = {
  over: () => `놀이 끝. 점수 ${game.score}점, 최고 ${best}점.`,
  paused: () => '잠깐 멈춤.',
  ready: () => '시작을 기다리고 있습니다.',
}

function say() {
  const line = SPOKEN[game.phase]
  statusBox.textContent = line
    ? line()
    : `${game.stage}단계, 점수 ${game.score}점, 남은 목숨 ${game.lives}.`
  startBtn.textContent = game.phase === 'ready' || game.phase === 'over' ? '시작' : '처음부터'
  pauseBtn.disabled = !(game.phase === 'playing' || game.phase === 'paused')
  pauseBtn.textContent = game.phase === 'paused' ? '계속하기' : '잠깐 멈춤'
}

/* ---------- 버튼 ---------- */

function begin() {
  startGame(game)
  drainEvents()
  canvas.focus()
}

startBtn.addEventListener('click', begin)
pauseBtn.addEventListener('click', () => {
  togglePause(game)
  say()
})
bindSoundButton(soundBtn, Sound)

/* ---------- 키보드 ---------- */

const GAME_KEYS = new Set([...Object.values(KEYS).flat(), 'Space'])

window.addEventListener('keydown', (e) => {
  // 버튼에 포커스가 있을 때 스페이스·엔터는 그 버튼 몫이다 (가로채면 자판으로 버튼을 못 누른다).
  // 화살표·P·M 까지 넘기면 버튼을 한 번 누른 뒤로 조작이 통째로 먹통이 된다.
  const onControl = e.target instanceof Element && e.target.closest('button, a, input')
  if (onControl && (e.code === 'Space' || e.code === 'Enter')) return
  if (GAME_KEYS.has(e.code)) e.preventDefault() // 화살표·스페이스로 화면이 밀리지 않게
  if (e.code === 'Space') {
    if (game.phase === 'ready' || game.phase === 'over') begin()
    else if (!keys.has('Space')) jumpEdge = true
  }
  if (e.code === 'KeyP') pauseBtn.click()
  if (e.code === 'KeyM') soundBtn.click()
  keys.add(e.code)
})
window.addEventListener('keyup', (e) => keys.delete(e.code))
window.addEventListener('blur', () => {
  keys.clear()
  for (const k of Object.keys(pad)) pad[k] = false
})

/* ---------- 터치 조작판 ---------- */

for (const btn of document.querySelectorAll('[data-key]')) {
  const key = btn.dataset.key
  const press = (on) => (e) => {
    e.preventDefault()
    if (key === 'jump') {
      if (!on) return
      if (game.phase === 'ready' || game.phase === 'over') begin()
      else jumpEdge = true
      return
    }
    pad[key] = on
  }
  btn.addEventListener('pointerdown', press(true))
  btn.addEventListener('pointerup', press(false))
  btn.addEventListener('pointercancel', press(false))
  btn.addEventListener('pointerleave', press(false))
  btn.addEventListener('contextmenu', (e) => e.preventDefault())
}

/* ---------- 돌리기 ---------- */

let lastPhase = ''
const STEP = 1 / 120
const STILL = new Set(['ready', 'paused', 'over']) // 움직이는 게 없는 화면
let acc = 0
let last = 0
let lastStill = ''

function frame(ts) {
  if (!last) last = ts
  acc += Math.min((ts - last) / 1000, 0.1) // 탭을 다시 열었을 때 한꺼번에 계산하지 않게 자른다
  last = ts
  while (acc >= STEP) {
    step(game, STEP, { left: held('left'), right: held('right'), up: held('up'), down: held('down'), jump: jumpEdge })
    jumpEdge = false
    acc -= STEP
  }
  drainEvents()
  // 단계 통과·되살아남은 알림 없이 넘어간다. 버튼 상태를 여기서 맞춘다.
  if (game.phase !== lastPhase) {
    lastPhase = game.phase
    say()
  }
  // 시작·멈춤·끝 화면은 그림이 그대로다. 바뀐 게 없으면 다시 칠하지 않는다.
  const still = STILL.has(game.phase) ? `${game.phase}|${game.score}|${game.lives}|${game.stage}|${best}` : ''
  if (!still || still !== lastStill) draw()
  lastStill = still
  requestAnimationFrame(frame)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'playing') {
    togglePause(game)
    say()
  }
  last = 0
})

resize()
window.addEventListener('resize', resize)
say()
loadSkinImages().then(() => requestAnimationFrame(frame))
