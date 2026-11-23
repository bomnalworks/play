// 봄날 스도쿠 - 화면·입력 (규칙과 문제 만들기는 logic.js)
//
// 기록과 설정은 이 브라우저(localStorage)에만 남고, 서버로 아무것도 보내지 않습니다.
import { track, store } from '../../js/browser.js'
import { createSound, bindSoundButton, FANFARE } from '../../js/sound.js'
import { celebrate } from '../../js/celebrate.js'
import { mountAd } from '../../js/ad.js'
import { createTimer, startTimer, pauseTimer, timerMs, isRunning, formatTime } from '../../js/timer.js'
import {
  MAX_LEVEL, clampLevel, generateAsync, createBoard, isFixed, legalMask, openMask, has,
  place, erase, toggleMark, undo, isFull, checkDone, wrongCells, stuckCells,
  canErase, canUndo, pressableMask,
  ROW_OF, COL_OF, BOX_OF,
} from './logic.js'

const BEST_KEY = 'bomnal-sudoku-best-v1'
const PREF_KEY = 'bomnal-sudoku-pref-v1'
const SOUND_KEY = 'bomnal-sudoku-sound-v1'
const CELEBRATE_MS = 2600 // 폭죽이 터지는 동안
const NEXT_AFTER_MS = 3200 // 그 뒤 새 문제로 넘어간다

const TUNES = {
  place: [[880, 0.05, 0]],
  mark: [[520, 0.05, 0]],
  erase: [[420, 0.05, 0]],
  // 빵빠레
  fanfare: FANFARE,
}

const $ = (sel) => document.querySelector(sel)
const boardBox = $('#board')
const numpad = $('#numpad')
const levelBox = $('#levels')
const timerBox = $('#timer')
const leftBox = $('#left')
const noteBox = $('#note')
const pauseBtn = $('#pause')
const newBtn = $('#new')
const markBtn = $('#markmode')
const eraseBtn = $('#erase')
const undoBtn = $('#undo')
const candBtn = $('#cands')
const soundBtn = $('#sound')
const confetti = $('#confetti')

const Sound = createSound(SOUND_KEY, TUNES)

// 다음에 와도 그대로이길 바라는 설정은 pref, 이번 판에만 쓰는 것은 view
const pref = { level: 3, candidates: true, ...store.read(PREF_KEY, {}) }
pref.level = clampLevel(pref.level)
const bests = store.read(BEST_KEY, {})

const view = {
  board: null,
  timer: createTimer(),
  selected: -1,
  markMode: false,
  busy: false,
  paused: false,
  nextPuzzle: 0, // 다 푼 뒤 새 문제로 넘어가려고 걸어 둔 예약
}

/* ---------- 칸·숫자판 만들기 (한 번만) ---------- */

const cells = []
const baseClass = []  // 칸마다 안 바뀌는 클래스 (3×3 경계선)
const candTags = []   // 칸마다 후보 숫자 9개. 다시 만들지 않고 보이고 숨기기만 한다
const faces = []      // 칸 안의 큰 숫자

for (let i = 0; i < 81; i++) {
  const cell = document.createElement('button')
  cell.type = 'button'
  const edges =
    (COL_OF[i] % 3 === 2 && COL_OF[i] !== 8 ? ' edge-right' : '') +
    (ROW_OF[i] % 3 === 2 && ROW_OF[i] !== 8 ? ' edge-bottom' : '')
  baseClass.push('cell' + edges)
  cell.className = baseClass[i]

  const face = document.createElement('span')
  face.className = 'face'
  const notes = document.createElement('span')
  notes.className = 'cands'
  const tags = []
  for (let d = 1; d <= 9; d++) {
    const tag = document.createElement('i')
    tag.style.gridArea = `${Math.ceil(d / 3)} / ${((d - 1) % 3) + 1}`
    tag.textContent = String(d)
    tag.hidden = true // 첫 render 전까지 1~9가 전부 보이지 않게
    notes.appendChild(tag)
    tags.push(tag)
  }
  cell.append(face, notes)
  cell.addEventListener('click', () => select(i))
  boardBox.appendChild(cell)
  cells.push(cell)
  faces.push(face)
  candTags.push(tags)
}

const padKeys = []
for (let d = 1; d <= 9; d++) {
  const key = document.createElement('button')
  key.type = 'button'
  key.className = 'num'
  key.textContent = String(d)
  key.addEventListener('click', () => useDigit(d))
  numpad.appendChild(key)
  padKeys.push(key)
}

const levelButtons = []
levelBox.style.setProperty('--levels', String(MAX_LEVEL))
for (let lv = 1; lv <= MAX_LEVEL; lv++) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'lv'
  btn.textContent = String(lv)
  btn.setAttribute('aria-label', `난이도 ${lv}레벨`)
  btn.addEventListener('click', () => newPuzzle(lv))
  levelBox.appendChild(btn)
  levelButtons.push(btn)
}

/* ---------- 문제 내기 ---------- */

async function newPuzzle(level) {
  if (view.busy) return
  clearTimeout(view.nextPuzzle) // 자동으로 넘어가려던 예약이 있으면 거둔다
  view.busy = true
  pref.level = clampLevel(level)
  view.selected = -1
  view.paused = false
  view.timer = createTimer()
  store.write(PREF_KEY, pref)

  note(`${pref.level}레벨 문제를 만드는 중…`)
  lockButtons(true)

  const made = await generateAsync(pref.level)
  view.board = createBoard(made)

  lockButtons(false)
  view.busy = false
  track('sudoku_start')
  note(hintLine())
  render()
}

function lockButtons(locked) {
  for (const btn of levelButtons) btn.disabled = locked
  newBtn.disabled = locked
}

const hintLine = () => {
  const best = bests[pref.level]
  return best ? `${pref.level}레벨 최고 기록 ${formatTime(best)}` : `${pref.level}레벨 - 첫 기록을 남겨 보세요`
}

/* ---------- 고르기·넣기 ---------- */

function select(i) {
  if (!view.board || view.paused) return
  view.selected = view.selected === i ? -1 : i
  render()
}

function useDigit(d) {
  const board = view.board
  const i = view.selected
  if (!board || view.paused || !has(pressableMask(board, i, view.markMode), d)) return

  const ok = view.markMode ? toggleMark(board, i, d) : place(board, i, d)
  if (!ok) return // 못 넣는 수였다면 시계도 건드리지 않는다
  Sound.play(view.markMode ? 'mark' : 'place')
  startTimer(view.timer, Date.now())
  if (!view.markMode) finishCheck()
  render()
}

function eraseCell() {
  if (!view.board || view.paused) return
  if (!erase(view.board, view.selected)) return
  Sound.play('erase')
  render()
}

function finishCheck() {
  const board = view.board
  if (!isFull(board)) return
  if (checkDone(board)) {
    pauseTimer(view.timer, Date.now())
    const ms = timerMs(view.timer, Date.now())
    const best = bests[pref.level]
    const record = !best || ms < best
    if (record) {
      bests[pref.level] = ms
      store.write(BEST_KEY, bests)
    }
    note(`완성! ${formatTime(ms)}${record ? ' - 최고 기록이에요' : ` · 최고 ${formatTime(best)}`} · 곧 새 문제로 넘어갑니다`)
    track('sudoku_clear')
    Sound.play('fanfare')
    celebrate(confetti, { duration: CELEBRATE_MS })
    view.nextPuzzle = setTimeout(() => newPuzzle(pref.level), NEXT_AFTER_MS)
  } else {
    note('다 채웠지만 틀린 칸이 있어요. 빨간 칸을 다시 보세요.')
  }
}

/* ---------- 그리기 ---------- */

function render() {
  const board = view.board
  boardBox.classList.toggle('paused', view.paused)
  if (!board) return

  const sel = view.selected
  const selDigit = sel >= 0 ? board.grid[sel] : 0
  // 넣자마자 빨개지면 찍어 보고 지우는 식으로 풀 수 있다. 다 채운 뒤에만 짚어 준다.
  const wrong = new Set(!board.done && isFull(board) ? wrongCells(board) : [])
  const stuck = new Set(board.done ? [] : stuckCells(board))

  for (let i = 0; i < 81; i++) {
    const cell = cells[i]
    const value = board.grid[i]
    const fixed = isFixed(board, i)

    let klass = baseClass[i]
    if (fixed) klass += ' fixed'
    if (i === sel) klass += ' on'
    else if (sel >= 0 && (ROW_OF[i] === ROW_OF[sel] || COL_OF[i] === COL_OF[sel] || BOX_OF[i] === BOX_OF[sel])) {
      klass += ' near'
    }
    if (value && selDigit && value === selDigit) klass += ' same'
    if (wrong.has(i)) klass += ' wrong'
    if (stuck.has(i)) klass += ' stuck'
    if (cell.className !== klass) cell.className = klass

    const label = `${ROW_OF[i] + 1}행 ${COL_OF[i] + 1}열 ${value || '빈칸'}`
    if (cell.getAttribute('aria-label') !== label) cell.setAttribute('aria-label', label)

    const face = value ? String(value) : ''
    if (faces[i].textContent !== face) faces[i].textContent = face
    // 빈칸에는 넣을 수 있는 수(내가 X 친 것은 빼고)를 작게 보여 준다
    const notes = !value && pref.candidates ? openMask(board, i) : 0
    const tags = candTags[i]
    for (let d = 1; d <= 9; d++) {
      const hide = !has(notes, d)
      if (tags[d - 1].hidden !== hide) tags[d - 1].hidden = hide
    }
  }

  // 무엇을 누를 수 있는지는 규칙 쪽(logic.js)이 정한다
  const open = pressableMask(board, sel, view.markMode)
  const legal = sel < 0 ? 0 : legalMask(board, sel)
  for (let d = 1; d <= 9; d++) {
    const key = padKeys[d - 1]
    const marked = has(board.marks[sel] ?? 0, d)
    key.disabled = !has(open, d)
    key.classList.toggle('marked', marked && has(legal, d))
    key.classList.toggle('blocked', sel >= 0 && !has(legal, d))
    key.setAttribute('aria-pressed', String(marked))
  }

  const left = board.grid.reduce((n, v) => (v ? n : n + 1), 0)
  leftBox.textContent = board.done ? '완성' : `빈칸 ${left}`
  for (let lv = 1; lv <= MAX_LEVEL; lv++) levelButtons[lv - 1].classList.toggle('on', lv === pref.level)
  markBtn.classList.toggle('on', view.markMode)
  markBtn.setAttribute('aria-pressed', String(view.markMode))
  candBtn.classList.toggle('on', pref.candidates)
  candBtn.setAttribute('aria-pressed', String(pref.candidates))
  undoBtn.disabled = !canUndo(board)
  eraseBtn.disabled = !canErase(board, sel)
  pauseBtn.textContent = view.paused ? '이어서 하기' : '잠깐 멈춤'
  pauseBtn.disabled = !isRunning(view.timer) && !view.paused
}

const note = (text) => {
  noteBox.textContent = text
}

/* ---------- 타이머 ---------- */

setInterval(() => {
  const shown = formatTime(timerMs(view.timer, Date.now()))
  if (timerBox.textContent !== shown) timerBox.textContent = shown // 4번 중 3번은 같은 글자다
}, 250)

function togglePause() {
  if (!view.board) return
  if (view.paused) {
    view.paused = false
    startTimer(view.timer, Date.now())
    note(hintLine())
  } else {
    if (!isRunning(view.timer)) return
    pauseTimer(view.timer, Date.now())
    view.paused = true
    view.selected = -1
    note('멈춰 두었어요. 이어서 하기를 누르세요.')
  }
  render()
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isRunning(view.timer) && !view.paused) togglePause()
})

/* ---------- 버튼 ---------- */

pauseBtn.addEventListener('click', togglePause)
newBtn.addEventListener('click', () => newPuzzle(pref.level))
eraseBtn.addEventListener('click', eraseCell)
undoBtn.addEventListener('click', () => {
  if (view.board && canUndo(view.board) && undo(view.board)) render()
})
markBtn.addEventListener('click', () => {
  view.markMode = !view.markMode
  note(view.markMode ? 'X 표시 모드 - 숫자를 누르면 X 를 켜고 끕니다.' : '숫자 넣기 모드')
  render()
})
bindSoundButton(soundBtn, Sound)

candBtn.addEventListener('click', () => {
  pref.candidates = !pref.candidates
  store.write(PREF_KEY, pref)
  render()
})

/* ---------- 키보드 ---------- */

const MOVES = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }

window.addEventListener('keydown', (e) => {
  if (!view.board) return
  if (e.ctrlKey && e.code === 'KeyZ') {
    if (canUndo(view.board) && undo(view.board)) render()
    return
  }
  if (e.ctrlKey || e.altKey || e.metaKey) return

  if (e.code in MOVES) {
    e.preventDefault()
    if (view.paused) return
    if (view.selected < 0) {
      view.selected = e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? 80 : 0
      render()
      return
    }
    const from = view.selected
    const next = from + MOVES[e.code]
    if (next < 0 || next > 80) return
    if (Math.abs(MOVES[e.code]) === 1 && ROW_OF[next] !== ROW_OF[from]) return // 좌우가 줄을 넘지 않게
    view.selected = next
    render()
    return
  }

  const digit = e.code.match(/^(?:Digit|Numpad)([1-9])$/)
  if (digit) {
    e.preventDefault()
    useDigit(+digit[1])
    return
  }
  if (e.code === 'Backspace' || e.code === 'Delete' || e.code === 'Digit0' || e.code === 'Numpad0') {
    e.preventDefault()
    eraseCell()
    return
  }
  if (e.code === 'KeyX') markBtn.click()
  if (e.code === 'KeyM') soundBtn.click()
  if (e.code === 'KeyP') togglePause()
  if (e.code === 'KeyN') newBtn.click()
})

/* ---------- 시작 ---------- */

newPuzzle(pref.level)
// 광고는 처음부터 게임과 놀이 방법 사이에 둔다 (/js/ad.js)
mountAd()
