// 봄날 틱택토 - 화면·입력 (규칙과 컴퓨터 상대는 logic.js)
//
// 전적과 설정은 이 브라우저(localStorage)에만 남고, 서버로 아무것도 보내지 않습니다.
import { track, store } from '../../js/browser.js'
import { createSound, bindSoundButton, FANFARE } from '../../js/sound.js'
import { celebrate } from '../../js/celebrate.js'
import { mountAd } from '../../js/ad.js'
import { createRecord } from '../../js/record.js'
import { EMPTY, O, X, LEVELS, LEVEL_NAME, createGame, play, chooseMove } from './logic.js'

const PREF_KEY = 'bomnal-ttt-pref-v1'
const RECORD_KEY = 'bomnal-ttt-record-v1'
const SOUND_KEY = 'bomnal-ttt-sound-v1'
const CPU_WAIT_MS = 420 // 컴퓨터가 바로 두면 내 수가 그려지는 걸 볼 틈이 없다
const NEXT_AFTER_MS = { win: 3000, other: 1800 } // 판이 끝나고 새 판이 저절로 시작될 때까지
const CELEBRATE_MS = 2200

const HUMAN = O
const CPU = X

const TUNES = {
  o: [[660, 0.05, 0]],
  x: [[440, 0.05, 0]],
  win: FANFARE,
  lose: [[392, 0.15, 0], [330, 0.15, 170], [262, 0.3, 340]],
  draw: [[523, 0.1, 0], [523, 0.16, 140]],
}

const SVG = {
  [O]: '<svg viewBox="0 0 100 100" class="o" aria-hidden="true"><circle cx="50" cy="50" r="36"/></svg>',
  [X]: '<svg viewBox="0 0 100 100" class="x" aria-hidden="true"><path d="M20 20 80 80"/><path d="M80 20 20 80"/></svg>',
}
const MARK_NAME = { [O]: '○', [X]: '✕' }

const $ = (sel) => document.querySelector(sel)
const boardBox = $('#board')
const levelBox = $('#levels')
const sideBox = $('#sides')
const noteBox = $('#note')
const recordBox = $('#record')
const newBtn = $('#new')
const soundBtn = $('#sound')
const confetti = $('#confetti')
const sessionBox = { w: $('#s-win'), d: $('#s-draw'), l: $('#s-lose') }

const Sound = createSound(SOUND_KEY, TUNES)

const pref = { level: 'normal', first: 'me', ...store.read(PREF_KEY, {}) }
if (!LEVELS.includes(pref.level)) pref.level = 'normal'
if (pref.first !== 'cpu') pref.first = 'me'
const record = createRecord(RECORD_KEY, LEVELS, LEVEL_NAME) // 난이도별 전적·연승 (/js/record.js)

const view = {
  game: null,
  shown: new Array(9).fill(EMPTY), // 칸마다 지금 그려 둔 표시 - 바뀐 칸만 다시 그린다
  thinking: false,
  timer: 0, // 컴퓨터 수나 다음 판 예약
  started: false, // 이번 판에 내가 한 수라도 뒀는지
  session: { w: 0, d: 0, l: 0 }, // 이 페이지를 연 뒤 연달아 한 판들 (저장하지 않는다)
}

/* ---------- 판·버튼 만들기 (한 번만) ---------- */

const cells = []
for (let i = 0; i < 9; i++) {
  const cell = document.createElement('button')
  cell.type = 'button'
  cell.className = 'ttt-cell'
  cell.addEventListener('click', () => humanMove(i))
  boardBox.appendChild(cell)
  cells.push(cell)
}

function optionButtons(box, items, onPick) {
  return items.map(([value, label]) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'opt ttt-opt'
    btn.textContent = label
    btn.addEventListener('click', () => onPick(value))
    box.appendChild(btn)
    return { value, btn }
  })
}

// 난이도나 먼저 두기를 바꾸면 연달아 한 판들도 새로 센다
function resetSession() {
  view.session = { w: 0, d: 0, l: 0 }
}
const levelButtons = optionButtons(levelBox, LEVELS.map((lv) => [lv, LEVEL_NAME[lv]]), (lv) => {
  pref.level = lv
  store.write(PREF_KEY, pref)
  resetSession()
  newGame()
})
const sideButtons = optionButtons(sideBox, [['me', '내가 먼저'], ['cpu', '컴퓨터 먼저']], (first) => {
  pref.first = first
  store.write(PREF_KEY, pref)
  resetSession()
  newGame()
})

/* ---------- 한 판 흐름 ---------- */

function newGame() {
  clearTimeout(view.timer)
  // 한 수라도 둔 판을 끝내지 않고 버리면 그 판 난이도의 연승을 끊는다 (난이도를 바꿔 새 판이 열릴 때도)
  if (view.started && view.game && !view.game.over) record.quit(view.level)
  view.level = pref.level
  view.game = createGame(pref.first === 'me' ? HUMAN : CPU)
  view.thinking = false
  view.started = false
  note(`${LEVEL_NAME[pref.level]} · ${pref.first === 'me' ? '먼저 두세요' : '컴퓨터가 먼저 둡니다'}`)
  render()
  if (view.game.turn === CPU) cpuTurn()
}

function humanMove(i) {
  const game = view.game
  if (!game || game.over || view.thinking || game.turn !== HUMAN) return
  if (!play(game, i)) return
  if (!view.started) {
    view.started = true
    track('ttt_start')
  }
  Sound.play('o')
  render()
  if (game.over) finish()
  else cpuTurn()
}

function cpuTurn() {
  const game = view.game
  view.thinking = true
  render()
  view.timer = setTimeout(() => {
    if (view.game !== game) return
    play(game, chooseMove(game.board, CPU, pref.level))
    view.thinking = false
    Sound.play('x')
    render()
    if (game.over) finish()
    else note('')
  }, CPU_WAIT_MS)
}

function finish() {
  const game = view.game
  const result = game.result === 0 ? 'd' : game.result === HUMAN ? 'w' : 'l'
  view.session[result]++
  if (view.started) {
    record.add(pref.level, result)
    track('ttt_end')
  }
  if (result === 'w') {
    note('이겼어요! 곧 다음 판')
    Sound.play('win')
    celebrate(confetti, { duration: CELEBRATE_MS })
  } else if (result === 'l') {
    note('졌어요. 곧 다음 판')
    Sound.play('lose')
  } else {
    note(pref.level === 'hard' ? '비겼어요 - 고급과 비기면 잘한 거예요. 곧 다음 판' : '비겼어요. 곧 다음 판')
    Sound.play('draw')
  }
  render()
  view.timer = setTimeout(newGame, result === 'w' ? NEXT_AFTER_MS.win : NEXT_AFTER_MS.other)
}

/* ---------- 그리기 ---------- */

function render() {
  const game = view.game
  if (!game) return
  const myTurn = !game.over && !view.thinking && game.turn === HUMAN
  const win = new Set(game.line ?? [])

  for (let i = 0; i < 9; i++) {
    const v = game.board[i]
    const cell = cells[i]
    if (view.shown[i] !== v) {
      cell.innerHTML = v ? SVG[v] : ''
      cell.firstElementChild?.classList.add('draw')
      view.shown[i] = v
    }
    cell.disabled = !myTurn || v !== EMPTY
    cell.classList.toggle('win', win.has(i))
    cell.setAttribute('aria-label', `${Math.floor(i / 3) + 1}행 ${(i % 3) + 1}열 ${v ? MARK_NAME[v] : '빈칸'}`)
  }
  boardBox.classList.toggle('over', game.over && win.size > 0)

  for (const key of ['w', 'd', 'l']) sessionBox[key].textContent = String(view.session[key])
  for (const { value, btn } of levelButtons) btn.classList.toggle('on', value === pref.level)
  for (const { value, btn } of sideButtons) btn.classList.toggle('on', value === pref.first)

  recordBox.textContent = record.show(pref.level)
}

const note = (text) => {
  noteBox.textContent = text
}

/* ---------- 버튼·자판 ---------- */

newBtn.addEventListener('click', newGame)
bindSoundButton(soundBtn, Sound)

// 숫자 자판 배치 그대로: 7 8 9 이 윗줄
const KEY_CELL = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 }
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return
  const digit = e.code.match(/^(?:Digit|Numpad)([1-9])$/)
  if (digit) {
    e.preventDefault()
    humanMove(KEY_CELL[digit[1]])
    return
  }
  if (e.code === 'KeyN') newGame()
  if (e.code === 'KeyM') soundBtn.click()
})

/* ---------- 시작 ---------- */

newGame()
// 광고는 처음부터 게임과 놀이 방법 사이에 둔다 (/js/ad.js)
mountAd()
