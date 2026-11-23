// 봄날 스도쿠 - 규칙·문제 만들기·난이도 판정 (화면은 ui.js)
//
// 여기에는 DOM 이 없습니다. 브라우저 없이 그대로 돌려 볼 수 있고,
// tests/sudoku.test.js 가 이 파일만 불러 "답이 하나뿐인가"·"난이도가 레벨에 맞는가"를 검사합니다.
//
// 칸은 0~80 번, 값은 0(빈칸)~9. 후보는 9비트 숫자로 다룹니다 (1<<(d-1)).

const ALL = 0b111111111

const rowOf = (i) => (i / 9) | 0
const colOf = (i) => i % 9
const boxOf = (i) => ((i / 27) | 0) * 3 + (((i % 9) / 3) | 0)

export const ROW_OF = Int8Array.from({ length: 81 }, (_, i) => rowOf(i))
export const COL_OF = Int8Array.from({ length: 81 }, (_, i) => colOf(i))
export const BOX_OF = Int8Array.from({ length: 81 }, (_, i) => boxOf(i))

// 27개 줄(가로 9 · 세로 9 · 3×3 상자 9)
export const UNITS = []
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c))
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c))
for (let b = 0; b < 9; b++) {
  const r0 = ((b / 3) | 0) * 3
  const c0 = (b % 3) * 3
  UNITS.push(Array.from({ length: 9 }, (_, k) => (r0 + ((k / 3) | 0)) * 9 + c0 + (k % 3)))
}

// 같은 줄·칸·상자에 있는 이웃 20칸
const ROWS = UNITS.slice(0, 9)
const COLS = UNITS.slice(9, 18)

export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const set = new Set()
  for (const unit of UNITS) if (unit.includes(i)) for (const j of unit) if (j !== i) set.add(j)
  return [...set]
})

export const bit = (d) => 1 << (d - 1)
const popcount = (m) => {
  let n = 0
  while (m) {
    m &= m - 1
    n++
  }
  return n
}
// 마스크에 들어 있는 숫자들
export const maskToDigits = (m) => {
  const out = []
  for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d)
  return out
}
// 마스크에 그 숫자가 들어 있나
export const has = (mask, d) => !!(mask & bit(d))
const lowestDigit = (m) => 32 - Math.clz32(m & -m)

const shuffle = (arr, rnd) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/* ---------- 푸는 쪽 (답이 하나뿐인지 셀 때 쓴다) ---------- */

// limit 개를 찾으면 바로 멈춘다. 답 개수를 돌려준다.
export function countSolutions(grid, limit = 2, rnd = null) {
  const rows = new Uint16Array(9)
  const cols = new Uint16Array(9)
  const boxes = new Uint16Array(9)
  const work = Int8Array.from(grid)
  for (let i = 0; i < 81; i++) {
    const d = work[i]
    if (!d) continue
    const b = bit(d)
    rows[ROW_OF[i]] |= b
    cols[COL_OF[i]] |= b
    boxes[BOX_OF[i]] |= b
  }

  let found = 0
  let first = null

  const search = () => {
    // 후보가 가장 적은 칸부터 - 이게 있어야 빠르다
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let i = 0; i < 81; i++) {
      if (work[i]) continue
      const mask = ALL & ~(rows[ROW_OF[i]] | cols[COL_OF[i]] | boxes[BOX_OF[i]])
      const count = popcount(mask)
      if (count === 0) return false
      if (count < bestCount) {
        best = i
        bestMask = mask
        bestCount = count
        if (count === 1) break
      }
    }
    if (best === -1) {
      found++
      first ??= Int8Array.from(work)
      return found >= limit
    }

    const digits = maskToDigits(bestMask)
    if (rnd) shuffle(digits, rnd)
    for (const d of digits) {
      const b = bit(d)
      work[best] = d
      rows[ROW_OF[best]] |= b
      cols[COL_OF[best]] |= b
      boxes[BOX_OF[best]] |= b
      const stop = search()
      work[best] = 0
      rows[ROW_OF[best]] &= ~b
      cols[COL_OF[best]] &= ~b
      boxes[BOX_OF[best]] &= ~b
      if (stop) return true
    }
    return false
  }

  search()
  return { count: found, solution: first }
}

export const hasUniqueSolution = (grid) => countSolutions(grid, 2).count === 1

/* ---------- 기법별 풀이 (난이도 판정용) ---------- */

export const TECH = {
  NAKED_SINGLE: 1, // 한 칸에 들어갈 수 있는 수가 하나
  HIDDEN_SINGLE: 2, // 한 줄에서 그 수가 들어갈 자리가 하나
  LOCKED: 3, // 상자↔줄 걸치기
  NAKED_PAIR: 4,
  HIDDEN_PAIR: 5,
  NAKED_TRIPLE: 6,
  X_WING: 7,
  BEYOND: 8, // 위 기법으로는 못 푼다 (사슬·시행착오가 필요)
}

function candidatesOf(grid) {
  const cand = new Uint16Array(81)
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue
    let used = 0
    for (const j of PEERS[i]) if (grid[j]) used |= bit(grid[j])
    cand[i] = ALL & ~used
  }
  return cand
}

function assign(grid, cand, i, d) {
  grid[i] = d
  cand[i] = 0
  for (const j of PEERS[i]) cand[j] &= ~bit(d)
}

function nakedSingle(grid, cand) {
  for (let i = 0; i < 81; i++) {
    if (grid[i] || popcount(cand[i]) !== 1) continue
    assign(grid, cand, i, lowestDigit(cand[i]))
    return true
  }
  return false
}

function hiddenSingle(grid, cand) {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d)
      let spot = -1
      let n = 0
      let already = false
      for (const i of unit) {
        if (grid[i] === d) {
          already = true
          break
        }
        if (cand[i] & b) {
          spot = i
          n++
        }
      }
      if (!already && n === 1) {
        assign(grid, cand, spot, d)
        return true
      }
    }
  }
  return false
}

// 상자 안에서 어떤 수의 자리가 한 줄에만 있으면, 그 줄의 상자 밖에서는 그 수를 지운다 (반대도 같다)
function lockedCandidates(cand) {
  let changed = false
  for (let u = 0; u < UNITS.length; u++) {
    const unit = UNITS[u]
    for (let d = 1; d <= 9; d++) {
      const b = bit(d)
      const spots = unit.filter((i) => cand[i] & b)
      if (spots.length < 2 || spots.length > 3) continue

      const sameRow = spots.every((i) => ROW_OF[i] === ROW_OF[spots[0]])
      const sameCol = spots.every((i) => COL_OF[i] === COL_OF[spots[0]])
      const sameBox = spots.every((i) => BOX_OF[i] === BOX_OF[spots[0]])

      const targets = []
      if (u >= 18 && sameRow) targets.push(UNITS[ROW_OF[spots[0]]])
      if (u >= 18 && sameCol) targets.push(UNITS[9 + COL_OF[spots[0]]])
      if (u < 18 && sameBox) targets.push(UNITS[18 + BOX_OF[spots[0]]])

      for (const target of targets) {
        for (const i of target) {
          if (spots.includes(i) || !(cand[i] & b)) continue
          cand[i] &= ~b
          changed = true
        }
      }
    }
  }
  return changed
}

// n개 칸이 쓸 수 있는 수가 딱 n개면, 그 줄의 나머지 칸에서는 그 수들을 지운다
function nakedSubset(grid, cand, n) {
  let changed = false
  for (const unit of UNITS) {
    const open = unit.filter((i) => !grid[i] && popcount(cand[i]) >= 2 && popcount(cand[i]) <= n)
    const combos = combinations(open, n)
    for (const combo of combos) {
      let mask = 0
      for (const i of combo) mask |= cand[i]
      if (popcount(mask) !== n) continue
      for (const i of unit) {
        if (combo.includes(i) || !(cand[i] & mask)) continue
        cand[i] &= ~mask
        changed = true
      }
    }
  }
  return changed
}

// 두 수가 한 줄에서 같은 두 칸에만 들어갈 수 있으면, 그 두 칸은 그 두 수만 남는다
function hiddenPair(cand) {
  let changed = false
  for (const unit of UNITS) {
    for (let d1 = 1; d1 <= 8; d1++) {
      for (let d2 = d1 + 1; d2 <= 9; d2++) {
        const b = bit(d1) | bit(d2)
        const spots1 = unit.filter((i) => cand[i] & bit(d1))
        const spots2 = unit.filter((i) => cand[i] & bit(d2))
        if (spots1.length !== 2 || spots2.length !== 2) continue
        if (spots1[0] !== spots2[0] || spots1[1] !== spots2[1]) continue
        for (const i of spots1) {
          if (cand[i] === (cand[i] & b)) continue
          cand[i] &= b
          changed = true
        }
      }
    }
  }
  return changed
}

// 어떤 수가 두 가로줄에서 똑같은 두 세로줄에만 들어갈 수 있으면, 그 세로줄의 다른 칸에서 지운다.
// 한 번이라도 지우면 바로 물러난다 - 자리 목록을 패스 시작에 한 번만 모으므로,
// 계속 돌면 이미 지운 후보를 세어 엉뚱한 칸을 지울 수 있다.
const X_WING_AXES = [
  [ROWS, COL_OF, ROW_OF],
  [COLS, ROW_OF, COL_OF],
]

function xWing(cand) {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d)
    for (const [lines, crossOf, lineOf] of X_WING_AXES) {
      const spotsByLine = lines.map((unit) => unit.filter((i) => cand[i] & b))
      for (let a = 0; a < 9; a++) {
        if (spotsByLine[a].length !== 2) continue
        for (let c = a + 1; c < 9; c++) {
          if (spotsByLine[c].length !== 2) continue
          const [a1, a2] = spotsByLine[a].map((i) => crossOf[i])
          const [c1, c2] = spotsByLine[c].map((i) => crossOf[i])
          if (a1 !== c1 || a2 !== c2) continue
          const keep = new Set([...spotsByLine[a], ...spotsByLine[c]])
          for (const cross of [a1, a2]) {
            for (let k = 0; k < 81; k++) {
              if (crossOf[k] !== cross || keep.has(k) || !(cand[k] & b)) continue
              if (lineOf[k] === a || lineOf[k] === c) continue
              cand[k] &= ~b
              return true
            }
          }
        }
      }
    }
  }
  return false
}

function combinations(arr, n) {
  if (n > arr.length) return []
  const out = []
  const pick = (start, acc) => {
    if (acc.length === n) return out.push([...acc])
    for (let i = start; i < arr.length; i++) {
      acc.push(arr[i])
      pick(i + 1, acc)
      acc.pop()
    }
  }
  pick(0, [])
  return out
}

// 기법마다 "머리를 얼마나 쓰는가"에 매긴 품. 점수 = 쓴 기법의 품을 모두 더한 값.
const EFFORT = {
  [TECH.NAKED_SINGLE]: 1,
  [TECH.HIDDEN_SINGLE]: 3,
  [TECH.LOCKED]: 18,
  [TECH.NAKED_PAIR]: 35,
  [TECH.HIDDEN_PAIR]: 50,
  [TECH.NAKED_TRIPLE]: 70,
  [TECH.X_WING]: 110,
  [TECH.BEYOND]: 420, // 여기까지 오면 사슬·가정이 필요하다
}

// 사람이 쓰는 기법만으로 풀어 보고, 어디까지·얼마나 썼는지 돌려준다.
export function rate(puzzle) {
  const grid = Int8Array.from(puzzle)
  const cand = candidatesOf(grid)
  let hardest = 0
  let score = 0
  const steps = [
    [TECH.NAKED_SINGLE, () => nakedSingle(grid, cand)],
    [TECH.HIDDEN_SINGLE, () => hiddenSingle(grid, cand)],
    [TECH.LOCKED, () => lockedCandidates(cand)],
    [TECH.NAKED_PAIR, () => nakedSubset(grid, cand, 2)],
    [TECH.HIDDEN_PAIR, () => hiddenPair(cand)],
    [TECH.NAKED_TRIPLE, () => nakedSubset(grid, cand, 3)],
    [TECH.X_WING, () => xWing(cand)],
  ]

  for (;;) {
    if (grid.every((v) => v)) {
      return { solved: true, hardest: hardest || TECH.NAKED_SINGLE, score }
    }
    let moved = false
    for (const [tech, run] of steps) {
      if (!run()) continue
      hardest = Math.max(hardest, tech)
      score += EFFORT[tech]
      moved = true
      break // 쉬운 기법부터 다시 본다
    }
    if (!moved) {
      const left = grid.reduce((n, v) => n + (v ? 0 : 1), 0)
      // 남은 칸이 많을수록 더 멀리 막힌 것이다
      return { solved: false, hardest: TECH.BEYOND, score: score + EFFORT[TECH.BEYOND] + left * 6 }
    }
  }
}

/* ---------- 난이도 ---------- */

// 빈칸 하나를 채우는 데 드는 품이 1점이므로, 빈칸 수를 넘는 몫이 "머리 쓴 양"이다.
// 품이 드는 기법은 그 몫에 크게 얹히므로 3배로 쳐서 레벨 점수를 만든다.
const difficultyOf = (empty, score) => empty + (score - empty) * 3

// 레벨별 목표 점수(target)와 "적어도 이 기법은 필요하다"는 하한(tech).
// 점수만 보면 히든 싱글만 잔뜩 나오는 판도 상위 레벨에 들어오므로, 위쪽은 기법 하한을 같이 건다.
// 10레벨은 기본 기법으로는 안 풀리는 판(사슬·가정이 필요)이다.
export const LEVELS = [
  null,
  { target: 36, tech: 0 },
  { target: 41, tech: 0 },
  { target: 46, tech: 0 },
  { target: 52, tech: 0 },
  { target: 62, tech: 0 },
  { target: 78, tech: 0 },
  { target: 150, tech: TECH.LOCKED },
  { target: 200, tech: TECH.LOCKED },
  { target: 280, tech: TECH.NAKED_PAIR },
  { target: Infinity, tech: TECH.BEYOND },
]
export const MAX_LEVEL = LEVELS.length - 1
export const clampLevel = (level) => Math.min(Math.max(level | 0, 1), MAX_LEVEL)

/* ---------- 문제 만들기 ---------- */

export function fullSolution(rnd = Math.random) {
  const { solution } = countSolutions(new Int8Array(81), 1, rnd)
  return solution
}

// 한 번 시도 = 난이도 사다리 하나.
// 더 못 팔 때까지 판 다음(= 그 답에서 가장 어려운 판), 한 칸씩 되돌리며 단계별 판을 모아 둔다.
// 숫자를 되돌릴수록 쉬워지므로, 이 사다리에서 원하는 난이도의 판을 고르면 된다.
function ladder(rnd, level) {
  const solution = fullSolution(rnd)
  const grid = Int8Array.from(solution)
  const order = shuffle([...Array(81).keys()], rnd)
  const removed = []

  for (const i of order) {
    const keep = grid[i]
    grid[i] = 0
    if (hasUniqueSolution(grid)) removed.push(i)
    else grid[i] = keep
  }

  const rungs = []
  const addRung = () => {
    const givens = grid.reduce((n, v) => n + (v ? 1 : 0), 0)
    const rating = rate(grid)
    const rung = { puzzle: Int8Array.from(grid), givens, rating }
    rung.difficulty = difficultyOf(81 - givens, rating.score)
    rungs.push(rung)
    return rung
  }

  // 요청한 레벨보다 충분히 쉬워지면 더 내려가 봐야 고를 일이 없다
  const floor = Math.max(LEVELS[1].target, LEVELS[clampLevel(level)].target * 0.7)
  let rung = addRung()
  while (removed.length) {
    if (rung.difficulty <= floor) break
    const i = removed.pop()
    grid[i] = solution[i]
    rung = addRung()
  }

  return { solution, rungs }
}

// 사다리에서 레벨에 가장 가까운 판을 고른다. 기법 하한을 못 넘기면 크게 깎는다.
function pickRung(rungs, level) {
  const want = LEVELS[clampLevel(level)]
  let best = null
  for (const rung of rungs) {
    const gap = want.target === Infinity ? -rung.difficulty : Math.abs(rung.difficulty - want.target)
    // 목표보다 한참 어려운 판은 피한다. 5레벨을 눌렀는데 8레벨이 나오면 안 된다.
    const over = want.target === Infinity ? 0 : Math.max(0, rung.difficulty - want.target * 1.3) * 2
    // 기법 하한을 못 넘기면 깎되, 목표에서 한참 먼 판을 억지로 고르지는 않는다
    // (무조건 하한을 지키게 하면 7레벨이 9레벨보다 어려운 판을 내놓는다)
    const penalty = want.target === Infinity ? 1000 : want.target * 0.9
    const miss = gap + over + (rung.rating.hardest < want.tech ? penalty : 0)
    if (!best || miss < best.miss) best = { ...rung, miss }
  }
  return best
}

// 목표에 이만큼까지 가까우면 더 안 찾는다 (쉬운 레벨은 거의 한 번에 맞는다)
function closeEnough(level, best) {
  const want = LEVELS[clampLevel(level)]
  if (want.target === Infinity) return best.rating.hardest === TECH.BEYOND
  // 레벨 사이 간격이 5~6점이라 느슨하게 잡으면 옆 레벨과 뒤집힌다
  return best.miss <= Math.max(2, want.target * 0.05)
}

// 10레벨은 "기본 기법으로 안 풀리는" 판이 나올 때까지 더 찾는다 (사다리 하나가 싸게 끝난다)
const triesFor = (level) => (clampLevel(level) === MAX_LEVEL ? 24 : clampLevel(level) >= 7 ? 10 : 5)

function pack(level, best, solution) {
  return {
    level: clampLevel(level),
    puzzle: best.puzzle,
    solution,
    givens: best.givens,
    difficulty: best.difficulty,
    rating: best.rating,
  }
}

// 사다리를 여러 개 만들어 목표에 가장 가까운 판을 고른다.
// yield 는 "여기서 숨 돌려도 된다"는 표시 - 화면 쪽(generateAsync)만 실제로 쉰다.
function* search(level, tries, rnd) {
  let best = null
  let solution = null
  for (let n = 0; n < tries; n++) {
    yield
    const made = ladder(rnd, level)
    const pick = pickRung(made.rungs, level)
    if (!best || pick.miss < best.miss) {
      best = pick
      solution = made.solution
    }
    if (closeEnough(level, best)) break
  }
  return pack(level, best, solution)
}

// level 1~10 짜리 문제 하나 (한 번에 만든다. 테스트가 쓴다)
export function generate(level, { tries = triesFor(level), rnd = Math.random } = {}) {
  const run = search(level, tries, rnd)
  let next = run.next()
  while (!next.done) next = run.next()
  return next.value
}

// 같은 일을, 사다리 사이사이 화면에 숨을 돌려 가며. ui.js 가 쓴다.
export async function generateAsync(level, { tries = triesFor(level), rnd = Math.random, breathe } = {}) {
  const wait = breathe ?? (() => new Promise((r) => setTimeout(r, 0)))
  const run = search(level, tries, rnd)
  let next = run.next()
  while (!next.done) {
    await wait()
    next = run.next()
  }
  return next.value
}

/* ---------- 한 판의 상태 ---------- */

export function createBoard({ level, puzzle, solution }) {
  return {
    level,
    puzzle: Int8Array.from(puzzle),
    solution: Int8Array.from(solution),
    grid: Int8Array.from(puzzle),
    marks: new Uint16Array(81), // 사용자가 직접 X 표시한 수
    history: [],
    done: false,
  }
}

export const isFixed = (board, i) => board.puzzle[i] !== 0

// 규칙상 지금 넣을 수 있는 수 (같은 줄·칸·상자에 없는 수)
export function legalMask(board, i) {
  if (isFixed(board, i)) return 0
  let used = 0
  for (const j of PEERS[i]) if (board.grid[j]) used |= bit(board.grid[j])
  return ALL & ~used
}

// 실제로 눌러서 넣을 수 있는 수 = 규칙상 가능 − 내가 X 표시한 수
export const openMask = (board, i) => legalMask(board, i) & ~board.marks[i]

export function place(board, i, d) {
  if (board.done || isFixed(board, i)) return false
  if (!(openMask(board, i) & bit(d))) return false
  board.history.push({ type: 'cell', i, value: board.grid[i] })
  board.grid[i] = d
  return true
}

export function erase(board, i) {
  if (board.done || isFixed(board, i) || !board.grid[i]) return false
  board.history.push({ type: 'cell', i, value: board.grid[i] })
  board.grid[i] = 0
  return true
}

// X 표시 켜고 끄기. 이미 숫자가 들어간 칸과 규칙상 못 넣는 수에는 표시하지 않는다.
export function toggleMark(board, i, d) {
  if (board.done || isFixed(board, i) || board.grid[i]) return false
  if (!(legalMask(board, i) & bit(d))) return false
  board.history.push({ type: 'mark', i, value: board.marks[i] })
  board.marks[i] ^= bit(d)
  return true
}

// 지금 이 칸에 손댈 수 있나 (화면이 버튼을 켜고 끌 때 쓴다 - 규칙은 여기 한 곳)
export const canErase = (board, i) => !board.done && i >= 0 && !isFixed(board, i) && !!board.grid[i]
export const canUndo = (board) => !board.done && board.history.length > 0

// 지금 눌러서 넣을 수 있는 수. X 표시 모드에서는 규칙상 가능한 수를 눌러 켜고 끈다.
export function pressableMask(board, i, markMode) {
  if (board.done || i < 0 || isFixed(board, i) || board.grid[i]) return 0
  return markMode ? legalMask(board, i) : openMask(board, i)
}

export function undo(board) {
  const last = board.history.pop()
  if (!last) return false
  if (last.type === 'cell') board.grid[last.i] = last.value
  else board.marks[last.i] = last.value
  board.done = false
  return true
}

export const isFull = (board) => board.grid.every((v) => v !== 0)

// 다 채웠고 답과 같은가
export function checkDone(board) {
  const ok = isFull(board) && board.grid.every((v, i) => v === board.solution[i])
  board.done = ok
  return ok
}

// 다 채웠는데 답과 다른 칸들 (중간에 길을 잘못 든 자리)
export const wrongCells = (board) =>
  [...board.grid].map((v, i) => (v && v !== board.solution[i] ? i : -1)).filter((i) => i >= 0)

// 빈칸인데 넣을 수 있는 수가 하나도 없는 칸 (막힌 자리 - 앞에서 잘못 넣었다는 뜻)
export const stuckCells = (board) =>
  [...board.grid].map((v, i) => (!v && legalMask(board, i) === 0 ? i : -1)).filter((i) => i >= 0)
