// 봄날 스도쿠 규칙 검사 — 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  UNITS, PEERS, MAX_LEVEL, LEVELS, TECH,
  countSolutions, hasUniqueSolution, fullSolution, rate, generate,
  createBoard, legalMask, openMask, maskToDigits, has, place, erase, toggleMark, undo,
  isFull, checkDone, wrongCells, stuckCells, canErase, canUndo, pressableMask,
} from '../public/games/sudoku/logic.js'
import {
  createTimer, startTimer, pauseTimer, timerMs, isRunning, formatTime,
} from '../public/js/timer.js'

const isValidFull = (grid) =>
  grid.length === 81 &&
  [...grid].every((v) => v >= 1 && v <= 9) &&
  UNITS.every((unit) => new Set(unit.map((i) => grid[i])).size === 9)

test('완성된 판은 가로·세로·상자에 1~9가 한 번씩 들어간다', () => {
  for (let n = 0; n < 5; n++) assert.ok(isValidFull(fullSolution()))
})

test('이웃은 칸마다 20개다', () => {
  for (let i = 0; i < 81; i++) assert.equal(PEERS[i].length, 20)
})

test('만든 문제는 답이 하나뿐이고, 그 답이 실제로 맞는다', () => {
  for (const level of [1, 5, 10]) {
    const made = generate(level)
    assert.ok(hasUniqueSolution(made.puzzle), `${level}레벨 문제의 답이 하나가 아니다`)
    assert.ok(isValidFull(made.solution))
    // 주어진 숫자는 답과 같아야 한다
    for (let i = 0; i < 81; i++) {
      if (made.puzzle[i]) assert.equal(made.puzzle[i], made.solution[i])
    }
    const { count } = countSolutions(made.puzzle, 2)
    assert.equal(count, 1)
  }
})

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
// 문제는 매번 새로 만들어지므로 한 판만 보고 판단하지 않는다 (이웃 레벨은 난이도 폭이 겹친다)
const sample = (level, n = 5) => Array.from({ length: n }, () => generate(level))

test('레벨이 오를수록 어려워진다', () => {
  const med = {}
  for (let lv = 1; lv <= MAX_LEVEL; lv++) med[lv] = median(sample(lv).map((p) => p.difficulty))

  // 이웃 레벨은 난이도 폭이 겹칠 수 있다. 두 칸씩 떨어진 레벨은 확실히 벌어져야 한다.
  for (let lv = 3; lv <= MAX_LEVEL; lv++) {
    assert.ok(med[lv] > med[lv - 2], `${lv}레벨(${med[lv]})이 ${lv - 2}레벨(${med[lv - 2]})보다 쉽다`)
  }
  assert.ok(med[1] < med[2], '1레벨이 2레벨보다 어렵다')
})

test('각 레벨은 목표 난이도 언저리에 떨어진다', () => {
  for (let lv = 1; lv <= MAX_LEVEL - 1; lv++) {
    // 한 판씩 보면 이웃 레벨과 겹칠 수 있다. "두 레벨 아래 목표쯤은 넘는다"를 하한으로 본다
    // (문제는 매번 새로 만들어지니 경계에서 몇 점 모자란 판은 통과시킨다)
    const floor = lv >= 3 ? LEVELS[lv - 2].target * 0.9 : 0
    for (const made of sample(lv, 2)) {
      assert.ok(made.difficulty >= floor, `${lv}레벨이 ${lv - 2}레벨 목표(${Math.round(floor)})보다 쉽다 (${made.difficulty})`)
      if (lv <= 4) {
        assert.ok(Math.abs(made.difficulty - LEVELS[lv].target) <= 6, `${lv}레벨이 목표에서 멀다`)
      }
    }
  }
})

test('낮은 레벨은 숫자를 넉넉히 주고, 높은 레벨은 적게 준다', () => {
  for (const made of sample(1, 2)) assert.ok(made.givens >= 40, `1레벨에 숫자가 ${made.givens}개뿐이다`)
  for (const made of sample(10, 2)) assert.ok(made.givens <= 34, `10레벨에 숫자가 ${made.givens}개나 있다`)
})

test('10레벨은 기본 기법(싱글·걸치기·짝·X윙)만으로는 풀리지 않는다', () => {
  for (let n = 0; n < 3; n++) {
    const made = generate(10)
    assert.equal(made.rating.hardest, TECH.BEYOND)
    assert.equal(made.rating.solved, false)
  }
})

test('쉬운 레벨은 싱글(한 칸에 하나·한 줄에 하나)만으로 끝까지 풀린다', () => {
  for (const level of [1, 2, 3]) {
    const made = generate(level)
    assert.equal(made.rating.solved, true)
    assert.ok(made.rating.hardest <= TECH.HIDDEN_SINGLE, `${level}레벨에 어려운 기법이 필요하다`)
  }
})

test('넣을 수 있는 숫자만 나온다 — 같은 줄·칸·상자에 있는 숫자는 빠진다', () => {
  const made = generate(4)
  const board = createBoard(made)
  for (let i = 0; i < 81; i++) {
    if (board.grid[i]) continue
    const open = maskToDigits(legalMask(board, i))
    assert.ok(open.includes(made.solution[i]), '정답이 후보에서 빠졌다')
    for (const d of open) {
      for (const j of PEERS[i]) assert.notEqual(board.grid[j], d, `${d} 는 넣을 수 없는 수다`)
    }
  }
})

test('넣을 수 없는 숫자는 넣어지지 않고, 주어진 숫자는 못 바꾼다', () => {
  const made = generate(4)
  const board = createBoard(made)
  const empty = [...board.grid].findIndex((v) => !v)
  const blocked = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !has(legalMask(board, empty), d))
  assert.equal(place(board, empty, blocked), false)
  assert.equal(board.grid[empty], 0)

  const fixed = [...board.grid].findIndex((v) => v)
  const before = board.grid[fixed]
  assert.equal(place(board, fixed, 1), false)
  assert.equal(erase(board, fixed), false)
  assert.equal(board.grid[fixed], before)
})

test('X 표시를 하면 그 숫자는 못 넣고, 풀면 다시 넣을 수 있다', () => {
  const made = generate(4)
  const board = createBoard(made)
  const i = [...board.grid].findIndex((v) => !v)
  const d = made.solution[i]

  assert.ok(has(openMask(board, i), d))
  assert.equal(toggleMark(board, i, d), true)
  assert.equal(has(openMask(board, i), d), false, 'X 친 숫자가 후보에 남아 있다')
  assert.equal(place(board, i, d), false, 'X 친 숫자가 들어갔다')

  assert.equal(toggleMark(board, i, d), true) // 풀기
  assert.ok(has(openMask(board, i), d))
  assert.equal(place(board, i, d), true)
  assert.equal(board.grid[i], d)

  // 숫자가 들어간 칸에는 X 를 못 친다
  assert.equal(toggleMark(board, i, 1), false)
})

test('되돌리기는 숫자와 X 표시를 모두 한 단계씩 돌린다', () => {
  const made = generate(4)
  const board = createBoard(made)
  // 후보가 둘 이상인 칸이라야 정답 말고 다른 수에 X 를 쳐 볼 수 있다
  const i = [...board.grid].findIndex((v, k) => !v && maskToDigits(legalMask(board, k)).length >= 2)
  const d = made.solution[i]
  const other = maskToDigits(legalMask(board, i)).find((x) => x !== d)

  assert.equal(toggleMark(board, i, other), true)
  const marksAfter = board.marks[i]
  place(board, i, d)
  assert.equal(board.grid[i], d)

  assert.equal(undo(board), true)
  assert.equal(board.grid[i], 0)
  assert.equal(board.marks[i], marksAfter)
  assert.equal(undo(board), true)
  assert.equal(board.marks[i], 0)
  assert.equal(undo(board), false)
})

test('답대로 채우면 완성이 되고, 틀리게 채우면 틀린 칸을 짚어 준다', () => {
  const made = generate(2)
  const board = createBoard(made)
  for (let i = 0; i < 81; i++) if (!board.grid[i]) place(board, i, made.solution[i])
  assert.ok(isFull(board))
  assert.equal(checkDone(board), true)
  assert.deepEqual(wrongCells(board), [])
  assert.equal(place(board, [...board.puzzle].findIndex((v) => !v), 1), false, '완성한 뒤에는 못 고친다')

  // 일부러 두 칸을 바꿔 넣어 본다
  const other = createBoard(made)
  const empties = [...other.grid].map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
  for (const i of empties) place(other, i, made.solution[i])
  other.done = false
  const [a, b] = empties
  other.grid[a] = made.solution[b]
  other.grid[b] = made.solution[a]
  assert.equal(checkDone(other), false)
  assert.deepEqual(wrongCells(other).sort(), [a, b].sort())
})

test('잘못 넣어 막힌 칸이 생기면 알려 준다', () => {
  const made = generate(3)
  const board = createBoard(made)
  const i = [...board.grid].findIndex((v) => !v)
  const wrong = maskToDigits(legalMask(board, i)).find((d) => d !== made.solution[i])
  if (wrong === undefined) return // 후보가 하나뿐인 칸이면 이 검사는 건너뛴다

  place(board, i, wrong)
  // 틀린 수를 넣으면 언젠가는 어떤 칸이 막힌다. 끝까지 규칙대로 채워 본다.
  for (let k = 0; k < 81; k++) {
    if (board.grid[k]) continue
    const open = maskToDigits(openMask(board, k))
    if (open.length) place(board, k, open[0])
  }
  assert.ok(stuckCells(board).length > 0 || wrongCells(board).length > 0)
})

test('타이머는 멈춘 동안 흐르지 않는다', () => {
  const t = createTimer()
  assert.equal(isRunning(t), false)
  assert.equal(timerMs(t, 1000), 0)

  startTimer(t, 1000)
  assert.equal(isRunning(t), true)
  assert.equal(timerMs(t, 4000), 3000)

  pauseTimer(t, 4000)
  assert.equal(isRunning(t), false)
  assert.equal(timerMs(t, 99000), 3000, '멈춘 동안 시간이 흘렀다')

  startTimer(t, 100000)
  assert.equal(timerMs(t, 102000), 5000)
  startTimer(t, 150000) // 이미 돌고 있으면 다시 눌러도 그대로다
  assert.equal(timerMs(t, 103000), 6000)
})

test('버튼 상태 판정은 규칙 쪽이 내놓는다', () => {
  const made = generate(2)
  const board = createBoard(made)
  const empty = [...board.grid].findIndex((v) => !v)
  const fixed = [...board.grid].findIndex((v) => v)

  assert.equal(canUndo(board), false)
  assert.equal(canErase(board, empty), false, '빈칸은 지울 게 없다')
  assert.equal(canErase(board, fixed), false, '주어진 숫자는 못 지운다')
  assert.ok(pressableMask(board, empty, false) > 0)
  assert.equal(pressableMask(board, fixed, false), 0, '주어진 칸에는 못 넣는다')

  place(board, empty, made.solution[empty])
  assert.equal(canUndo(board), true)
  assert.equal(canErase(board, empty), true)
  assert.equal(pressableMask(board, empty, false), 0, '이미 채운 칸에는 못 넣는다')

  // 다 풀고 나면 아무것도 못 한다
  for (let i = 0; i < 81; i++) if (!board.grid[i]) place(board, i, made.solution[i])
  checkDone(board)
  assert.equal(canUndo(board), false)
  assert.equal(canErase(board, empty), false)
  assert.equal(pressableMask(board, empty, false), 0)
})

test('시간 표시는 분:초 꼴이다', () => {
  assert.equal(formatTime(0), '00:00')
  assert.equal(formatTime(61000), '01:01')
  assert.equal(formatTime(3599000), '59:59')
  assert.equal(formatTime(-5), '00:00')
})

test('기법 판정: 단순한 판은 싱글만으로, 어려운 판은 기본 기법 밖으로 나온다', () => {
  const solution = fullSolution()
  assert.equal(rate(solution).solved, true)
  assert.equal(rate(solution).hardest, TECH.NAKED_SINGLE)

  const empty = new Int8Array(81)
  assert.equal(rate(empty).hardest, TECH.BEYOND) // 빈 판은 답이 여러 개라 논리로 못 푼다
})
