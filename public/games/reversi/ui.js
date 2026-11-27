// 봄날 리버시 - 화면·입력 (규칙과 컴퓨터 상대는 logic.js)
//
// 전적과 설정은 이 브라우저(localStorage)에만 남고, 서버로 아무것도 보내지 않습니다.
import { track, store } from '../../js/browser.js'
import { createSound, bindSoundButton, FANFARE } from '../../js/sound.js'
import { celebrate } from '../../js/celebrate.js'
import { mountAd } from '../../js/ad.js'
import { createRecord } from '../../js/record.js'
import {
  BLACK, WHITE, other, LEVELS, LEVEL_NAME,
  createGame, play, legalMoves, score, undoTo, canUndoTo, winner, chooseMove,
} from './logic.js'

const PREF_KEY = 'bomnal-reversi-pref-v1'
const RECORD_KEY = 'bomnal-reversi-record-v1'
const SOUND_KEY = 'bomnal-reversi-sound-v1'
// 컴퓨터가 바로 두면 무엇이 뒤집혔는지 볼 틈이 없다. 고급은 생각하는 데 이미 시간이 걸려 짧게 둔다.
const WAIT_MS = { easy: 500, normal: 500, hard: 150 }
const CELEBRATE_MS = 2600

const TUNES = {
  place: [[660, 0.05, 0]],
  cpu: [[440, 0.05, 0]],
  pass: [[330, 0.08, 0], [262, 0.1, 100]],
  win: FANFARE,
  lose: [[392, 0.15, 0], [330, 0.15, 170], [262, 0.32, 340]],
}

const COLOR_NAME = { [BLACK]: '흑', [WHITE]: '백' }

const $ = (sel) => document.querySelector(sel)
const boardBox = $('#board')
const levelBox = $('#levels')
const sideBox = $('#sides')
const countBlack = $('#count-black')
const countWhite = $('#count-white')
const turnBox = $('#turn')
const noteBox = $('#note')
const recordBox = $('#record')
const newBtn = $('#new')
const undoBtn = $('#undo')
const hintBtn = $('#hints')
const soundBtn = $('#sound')
const confetti = $('#confetti')

const Sound = createSound(SOUND_KEY, TUNES)

const pref = { level: 'normal', side: BLACK, hints: true, ...store.read(PREF_KEY, {}) }
if (!LEVELS.includes(pref.level)) pref.level = 'normal'
if (pref.side !== WHITE) pref.side = BLACK
const record = createRecord(RECORD_KEY, LEVELS, LEVEL_NAME) // 난이도별 전적·연승 (/js/record.js)

const view = {
  game: null,
  thinking: false,
  cpuTimer: 0,
  started: false, // 이번 판에 내가 한 수라도 뒀는지 - 안 뒀으면 전적에 넣지 않는다
}

const cpu = () => other(pref.side)

/* ---------- 판·버튼 만들기 (한 번만) ---------- */

const cells = []
const discs = []
const shown = new Array(64).fill(-1) // 칸마다 지금 그려 둔 돌 색 - 색이 바뀐 칸만 다시 칠한다
for (let i = 0; i < 64; i++) {
  const cell = document.createElement('button')
  cell.type = 'button'
  cell.className = 'rv-cell'
  const disc = document.createElement('span')
  disc.hidden = true
  cell.appendChild(disc)
  cell.addEventListener('click', () => humanMove(i))
  boardBox.appendChild(cell)
  cells.push(cell)
  discs.push(disc)
}

function optionButtons(box, items, onPick) {
  return items.map(([value, label]) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'opt rv-opt'
    btn.textContent = label
    btn.addEventListener('click', () => onPick(value))
    box.appendChild(btn)
    return { value, btn }
  })
}

const levelButtons = optionButtons(levelBox, LEVELS.map((lv) => [lv, LEVEL_NAME[lv]]), (lv) => {
  pref.level = lv
  store.write(PREF_KEY, pref)
  newGame()
})
const sideButtons = optionButtons(sideBox, [[BLACK, '흑 (먼저)'], [WHITE, '백 (나중)']], (side) => {
  pref.side = side
  store.write(PREF_KEY, pref)
  newGame()
})

/* ---------- 한 판 흐름 ---------- */

function newGame() {
  clearTimeout(view.cpuTimer)
  // 한 수라도 둔 판을 끝내지 않고 버리면 그 판 난이도의 연승을 끊는다 (난이도를 바꿔 새 판이 열릴 때도)
  if (view.started && view.game && !view.game.over) record.quit(view.level)
  view.level = pref.level
  view.game = createGame()
  view.thinking = false
  view.started = false
  note(`${LEVEL_NAME[pref.level]} 컴퓨터와 한 판 · 나는 ${COLOR_NAME[pref.side]}${pref.side === BLACK ? ' - 먼저 두세요' : ''}`)
  render()
  if (view.game.turn === cpu()) cpuTurn()
}

function humanMove(i) {
  const game = view.game
  if (!game || game.over || view.thinking || game.turn !== pref.side) return
  if (!play(game, i)) return
  if (!view.started) {
    view.started = true
    track('reversi_start')
  }
  Sound.play('place')
  render(true)
  next()
}

// 한 수 둔 뒤 다음 차례를 정한다. 넘긴 차례가 있으면 알린다.
function next() {
  const game = view.game
  if (game.over) {
    finish()
    return
  }
  if (game.turn === pref.side) {
    if (game.passed === cpu()) {
      Sound.play('pass')
      note('컴퓨터가 둘 곳이 없어요. 한 번 더 두세요.')
    } else {
      note('')
    }
    render()
  } else {
    if (game.passed === pref.side) {
      Sound.play('pass')
      note('둘 곳이 없어 차례를 넘깁니다.')
    }
    cpuTurn()
  }
}

function cpuTurn() {
  const game = view.game
  view.thinking = true
  render()
  // 생각 중이라는 글자가 먼저 그려지도록 한 박자 쉬고 계산한다
  view.cpuTimer = setTimeout(() => {
    if (view.game !== game || game.turn !== cpu()) return // 그사이 새 판·되돌리기
    play(game, chooseMove(game.board, game.turn, pref.level))
    view.thinking = false
    Sound.play('cpu')
    render(true)
    next()
  }, WAIT_MS[pref.level])
}

function finish() {
  const game = view.game
  view.thinking = false
  const { black, white } = score(game.board)
  const mine = pref.side === BLACK ? black : white
  const theirs = pref.side === BLACK ? white : black
  const w = winner(game)
  const result = w === 0 ? 'd' : w === pref.side ? 'w' : 'l'

  if (view.started) {
    record.add(pref.level, result)
    track('reversi_end')
  }

  if (result === 'w') {
    note(`이겼어요! ${mine} : ${theirs}`)
    Sound.play('win')
    celebrate(confetti, { duration: CELEBRATE_MS })
  } else if (result === 'l') {
    note(`졌어요. ${mine} : ${theirs} - 새 판으로 다시 해 보세요.`)
    Sound.play('lose')
  } else {
    note(`비겼어요. ${mine} : ${theirs}`)
  }
  render()
}

function undoMove() {
  const game = view.game
  // 끝난 판은 무르지 않는다 - 전적에 이미 들어갔다
  if (!game || game.over || !canUndoTo(game, pref.side)) return
  clearTimeout(view.cpuTimer)
  undoTo(game, pref.side)
  view.thinking = false
  note('한 수 물렀어요.')
  render()
}

/* ---------- 그리기 ---------- */

function render(moved = false) {
  const game = view.game
  if (!game) return
  const myTurn = !game.over && !view.thinking && game.turn === pref.side
  const open = new Set(myTurn ? legalMoves(game.board, pref.side) : [])
  const flipped = new Set(moved ? game.flipped : [])
  const animate = []

  for (let i = 0; i < 64; i++) {
    const v = game.board[i]
    const disc = discs[i]
    const anim = moved && (i === game.last || flipped.has(i))
    // 수를 둔 직후가 아닌 다시 그리기(차례 표시 등)에서는 돌고 있는 움직임(flip·drop)을 건드리지 않는다
    if (anim || shown[i] !== v) {
      disc.className = v ? `rv-disc ${v === BLACK ? 'black' : 'white'}` : '' // 지난 움직임도 같이 벗겨진다
      shown[i] = v
    }
    disc.hidden = !v
    if (anim) animate.push(i)

    const cell = cells[i]
    cell.classList.toggle('can', open.has(i) && pref.hints)
    cell.classList.toggle('last', i === game.last)
    const label = `${(i >> 3) + 1}행 ${(i & 7) + 1}열 ${v ? COLOR_NAME[v] : '빈칸'}${open.has(i) && pref.hints ? ' · 둘 수 있음' : ''}`
    if (cell.getAttribute('aria-label') !== label) cell.setAttribute('aria-label', label)
  }
  if (animate.length) {
    // 같은 칸이 연달아 뒤집혀도 움직임이 다시 돌도록, 벗긴 상태를 한 번 그리게 한 뒤(레이아웃 한 번) 붙인다
    void boardBox.offsetWidth
    for (const i of animate) discs[i].classList.add(i === game.last ? 'drop' : 'flip')
  }

  const { black, white } = score(game.board)
  countBlack.querySelector('b').textContent = String(black)
  countWhite.querySelector('b').textContent = String(white)
  countBlack.classList.toggle('now', !game.over && game.turn === BLACK)
  countWhite.classList.toggle('now', !game.over && game.turn === WHITE)
  countBlack.setAttribute('aria-label', `흑${pref.side === BLACK ? '(나)' : '(컴퓨터)'} ${black}개`)
  countWhite.setAttribute('aria-label', `백${pref.side === WHITE ? '(나)' : '(컴퓨터)'} ${white}개`)
  turnBox.textContent = game.over ? '판 끝' : view.thinking ? '컴퓨터가 생각 중…' : myTurn ? '내 차례' : ''

  for (const { value, btn } of levelButtons) btn.classList.toggle('on', value === pref.level)
  for (const { value, btn } of sideButtons) btn.classList.toggle('on', value === pref.side)
  undoBtn.disabled = game.over || !canUndoTo(game, pref.side)
  hintBtn.classList.toggle('on', pref.hints)
  hintBtn.setAttribute('aria-pressed', String(pref.hints))

  recordBox.textContent = record.show(pref.level)
}

const note = (text) => {
  noteBox.textContent = text
}

/* ---------- 버튼·자판 ---------- */

newBtn.addEventListener('click', newGame)
undoBtn.addEventListener('click', undoMove)
hintBtn.addEventListener('click', () => {
  pref.hints = !pref.hints
  store.write(PREF_KEY, pref)
  render()
})
bindSoundButton(soundBtn, Sound)

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'KeyZ') {
    e.preventDefault()
    undoMove()
    return
  }
  if (e.ctrlKey || e.altKey || e.metaKey) return
  if (e.code === 'KeyN') newGame()
  if (e.code === 'KeyM') soundBtn.click()
})

/* ---------- 시작 ---------- */

newGame()
// 광고는 처음부터 게임과 놀이 방법 사이에 둔다 (/js/ad.js)
mountAd()
