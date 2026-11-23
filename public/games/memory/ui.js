// 봄날 짝맞추기 - 화면·입력 (규칙은 logic.js)
//
// 기록과 설정은 이 브라우저(localStorage)에만 남는다.
// (명예의 전당에 이니셜을 남길 때만 이니셜·기록·날짜를 순위표 서버에 보낸다 - /js/scores.js)
import { track, store } from '../../js/browser.js'
import { createSound, bindSoundButton, FANFARE } from '../../js/sound.js'
import { celebrate } from '../../js/celebrate.js'
import { mountAd } from '../../js/ad.js'
import { createHall } from '../../js/scores.js'
import { createTimer, startTimer, pauseTimer, timerMs, isRunning, formatTime } from '../../js/timer.js'
import { STAGES, MAX_STAGE, THEMES, clampStage, pairsOf, createGame, flip, hideMiss, isFaceUp } from './logic.js'

const BEST_KEY = 'bomnal-memory-best-v1'
const PREF_KEY = 'bomnal-memory-pref-v1'
const SOUND_KEY = 'bomnal-memory-sound-v1'
const HIDE_AFTER_MS = 900 // 틀린 두 장을 보여 주는 시간
const PEEK_SECONDS = 3 // 판을 깔면 모든 카드를 이만큼 보여 준 뒤 덮는다
const CELEBRATE_MS = 2600
const NEXT_AFTER_MS = 3200

const faceUrl = (theme, face) => `cards/${theme.key}/${String(face + 1).padStart(2, '0')}.webp`

// 단계마다(STAGES 순서대로) 판 최대 너비와 카드 사이. 판이 화면 높이를 넘지 않게 하는 계산은 memory.css 에 있다
const LOOK = [
  { max: '260px', gap: '10px' },
  { max: '340px', gap: '8px' },
  { max: '400px', gap: '7px' },
  { max: '460px', gap: '6px' },
  { max: '460px', gap: '5px' },
]

const TUNES = {
  flip: [[700, 0.03, 0]],
  match: [[784, 0.06, 0], [1047, 0.1, 70]],
  miss: [[300, 0.08, 0]],
  fanfare: FANFARE,
}

const $ = (sel) => document.querySelector(sel)
const boardBox = $('#board')
const stageBox = $('#stages')
const themeBox = $('#themes')
const timerBox = $('#timer')
const statBox = $('#stat')
const noteBox = $('#note')
const pauseBtn = $('#pause')
const newBtn = $('#new')
const soundBtn = $('#sound')
const confetti = $('#confetti')

const Sound = createSound(SOUND_KEY, TUNES)
const hall = createHall('memory')

const pref = { stage: 1, theme: THEMES[0].key, ...store.read(PREF_KEY, {}) }
pref.stage = clampStage(pref.stage)
if (!THEMES.some((t) => t.key === pref.theme)) pref.theme = THEMES[0].key
const themeOf = () => THEMES.find((t) => t.key === pref.theme)
const bests = store.read(BEST_KEY, {}) // { 단계: { ms, tries } } - 시간과 횟수는 따로 가장 좋은 값

const view = {
  game: null,
  timer: createTimer(),
  paused: false,
  peeking: false, // 처음 몇 초 모든 카드를 보여 주는 중 - 이때는 누를 수 없고 시계도 안 간다
  peekTimer: 0,
  started: false, // 이번 판에 카드를 한 장이라도 뒤집었는지
  hideTimer: 0, // 틀린 두 장을 덮으려고 걸어 둔 예약
  nextTimer: 0, // 다 찾은 뒤 다음 단계로 넘어가려고 걸어 둔 예약
  cards: [], // 지금 판의 카드 버튼들
}

/* ---------- 단계 버튼 (한 번만) ---------- */

const stageButtons = STAGES.map(({ cols, rows }, k) => {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'opt mm-lv'
  btn.innerHTML = `${k + 1}단계<small>${cols}×${rows}</small>`
  btn.setAttribute('aria-label', `${k + 1}단계 ${cols}×${rows}`)
  btn.addEventListener('click', () => newGame(k + 1))
  stageBox.appendChild(btn)
  return btn
})

const themeButtons = THEMES.map((theme) => {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'opt mm-theme'
  btn.innerHTML = `<img src="${faceUrl(theme, 0)}" alt="" width="20" height="30" />${theme.name}`
  btn.addEventListener('click', () => {
    pref.theme = theme.key
    newGame(pref.stage)
  })
  themeBox.appendChild(btn)
  return btn
})

/* ---------- 판 깔기 ---------- */

function newGame(stage) {
  clearTimeout(view.hideTimer)
  clearTimeout(view.nextTimer)
  clearTimeout(view.peekTimer)
  pref.stage = clampStage(stage)
  store.write(PREF_KEY, pref)
  const theme = themeOf()
  view.game = createGame(pref.stage, theme.count)
  view.timer = createTimer()
  view.paused = false
  view.started = false
  hall.show(pref.stage)

  const look = LOOK[pref.stage - 1]
  boardBox.style.setProperty('--cols', String(view.game.cols))
  boardBox.style.setProperty('--rows', String(view.game.rows))
  boardBox.style.setProperty('--max', look.max)
  boardBox.style.setProperty('--gap', look.gap)
  boardBox.replaceChildren()
  // 앞면 그림은 뒷면에 가려 있어도 판을 깔 때 바로 받는다 - 뒤집는 순간 빈 카드가 보이지 않게
  view.cards = view.game.cards.map((face, i) => {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'mm-card'
    card.innerHTML = `<span class="mm-inner"><span class="mm-side mm-back"></span><span class="mm-side mm-front"><img src="${faceUrl(theme, face)}" alt="" draggable="false" /></span></span>`
    card.addEventListener('click', () => pickCard(i))
    boardBox.appendChild(card)
    return card
  })

  render()
  peek(PEEK_SECONDS)
}

// 모든 카드를 앞면으로 보여 주며 초를 센다. 다 세면 덮고 시작
function peek(left) {
  view.peeking = left > 0
  if (view.peeking) {
    note(`잘 봐 두세요 - ${left}초 뒤에 덮습니다`)
    view.peekTimer = setTimeout(() => peek(left - 1), 1000)
  } else {
    note(hintLine())
  }
  render()
}

const hintLine = () => {
  const best = bests[pref.stage]
  return best
    ? `${pref.stage}단계 최고 기록 ${formatTime(best.ms)} · 최소 ${best.tries}번`
    : `${pref.stage}단계 - 첫 기록을 남겨 보세요`
}

/* ---------- 뒤집기 ---------- */

function pickCard(i) {
  const game = view.game
  if (!game || view.paused || view.peeking) return
  clearTimeout(view.hideTimer) // 틀린 두 장이 열려 있으면 flip() 이 먼저 덮는다
  const res = flip(game, i)
  if (res === 'none') return

  if (!view.started) {
    view.started = true
    track('memory_start')
  }
  startTimer(view.timer, Date.now()) // 이미 가고 있으면 그대로

  if (res === 'match') Sound.play('match')
  else if (res === 'miss') {
    Sound.play('miss')
    view.hideTimer = setTimeout(() => {
      if (hideMiss(game)) render()
    }, HIDE_AFTER_MS)
  } else Sound.play('flip')

  render()
  if (game.done) finish()
}

function finish() {
  const game = view.game
  pauseTimer(view.timer, Date.now())
  const ms = timerMs(view.timer, Date.now())
  const old = bests[pref.stage]
  const fastest = !old || ms < old.ms
  const fewest = !old || game.tries < old.tries
  if (fastest || fewest) {
    bests[pref.stage] = { ms: fastest ? ms : old.ms, tries: fewest ? game.tries : old.tries }
    store.write(BEST_KEY, bests)
  }
  const praise = fastest && fewest ? ' - 시간·횟수 모두 최고 기록' : fastest ? ' - 최고 기록' : fewest ? ' - 최소 횟수 기록' : ''
  const next = Math.min(pref.stage + 1, MAX_STAGE)
  note(`다 찾았어요! ${formatTime(ms)} · ${game.tries}번${praise} · 곧 ${next}단계`)
  track('memory_clear')
  Sound.play('fanfare')
  celebrate(confetti, { duration: CELEBRATE_MS })
  // 1~5등에 들면 이니셜을 받고, 창을 닫은 뒤에 다음 단계로 넘어간다 (그사이 다른 판을 골랐으면 넘기지 않는다)
  hall.offer(pref.stage, ms).then(() => {
    if (view.game === game) view.nextTimer = setTimeout(() => newGame(next), NEXT_AFTER_MS)
  })
  render() // 시계가 멈췄으니 '잠깐 멈춤'을 끈다
}

/* ---------- 그리기 ---------- */

function render() {
  const game = view.game
  if (!game) return
  boardBox.classList.toggle('paused', view.paused)
  const missed = game.open.length === 2 ? new Set(game.open) : new Set()

  view.cards.forEach((card, i) => {
    const up = view.peeking || isFaceUp(game, i)
    card.classList.toggle('up', up)
    card.classList.toggle('got', game.matched[i])
    card.classList.toggle('miss', missed.has(i))
    card.disabled = game.matched[i] || view.peeking
    card.setAttribute('aria-label', `${i + 1}번 카드 ${up ? `그림 ${game.cards[i] + 1}` : '뒤집힘'}${game.matched[i] ? ' · 짝 찾음' : ''}`)
  })

  statBox.textContent = `짝 ${game.found}/${pairsOf(pref.stage)} · ${game.tries}번`
  stageButtons.forEach((btn, k) => btn.classList.toggle('on', k + 1 === pref.stage))
  themeButtons.forEach((btn, k) => btn.classList.toggle('on', THEMES[k].key === pref.theme))
  pauseBtn.textContent = view.paused ? '이어서 하기' : '잠깐 멈춤'
  pauseBtn.disabled = !isRunning(view.timer) && !view.paused
}

const note = (text) => {
  noteBox.textContent = text
}

/* ---------- 타이머 ---------- */

setInterval(() => {
  const shown = formatTime(timerMs(view.timer, Date.now()))
  if (timerBox.textContent !== shown) timerBox.textContent = shown
}, 250)

function togglePause() {
  if (!view.game) return
  if (view.paused) {
    view.paused = false
    startTimer(view.timer, Date.now())
    note(hintLine())
  } else {
    if (!isRunning(view.timer)) return
    pauseTimer(view.timer, Date.now())
    view.paused = true
    note('멈춰 두었어요. 이어서 하기를 누르세요.')
  }
  render()
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isRunning(view.timer) && !view.paused) togglePause()
})

/* ---------- 버튼·자판 ---------- */

pauseBtn.addEventListener('click', togglePause)
newBtn.addEventListener('click', () => newGame(pref.stage))
bindSoundButton(soundBtn, Sound)

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return
  if (e.code === 'KeyP') togglePause()
  if (e.code === 'KeyN') newGame(pref.stage)
  if (e.code === 'KeyM') soundBtn.click()
})

/* ---------- 시작 ---------- */

newGame(pref.stage)
// 광고는 처음부터 게임과 놀이 방법 사이에 둔다 (/js/ad.js)
mountAd()
