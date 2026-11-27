// 봄날 블록 퍼즐 - 규칙만. DOM 이 없다 (테스트가 화면 없이 이 파일만 불러 돌린다)
//
// 8×8 판 아래에 조각 세 개가 나온다. 조각을 끌어다 판 빈 곳에 놓는다 - 위에서 떨어지지 않으니 서두를 일이 없다.
// 가로 한 줄이나 세로 한 줄이 다 차면 그 줄이 지워진다 (가로·세로가 같이 차면 같이 지워진다).
// 세 개를 다 놓으면 새 세 개가 나오고, 남은 조각 어느 것도 놓을 데가 없으면 끝이다. 조각은 돌릴 수 없다.
//
// 판은 길이 64 배열(왼쪽 위부터 가로로), -1 빈칸 · 0~COLORS-1 그 칸 블록의 색 번호.
// 조각은 { shape: SHAPES 번호, color: 색 번호 }. 놓고 나면 그 자리는 null 이다.

export const SIZE = 8
export const TRAY = 3 // 한 번에 나오는 조각 수
export const COLORS = 7 // 조각 색 가짓수 (색 자체는 ui.js)
export const EMPTY = -1
export const COMBO_GRACE = 3 // 이만큼 연달아 한 줄도 못 지우면 콤보가 끊긴다
export const PERFECT_BONUS = 300 // 판을 싹 비우면 더 주는 점수
const DEAL_TRIES = 30 // 새 세 개가 하나도 안 들어가면 다시 뽑는 횟수

// 기본 모양 - '#' 칸, '.' 빈 곳, '/' 줄바꿈. 돌린 모양(mirror 면 뒤집은 모양까지)은 아래에서 만든다.
// weight 는 그 모양이 나올 몫이고, 돌린 모양끼리 똑같이 나눠 갖는다
const BASES = [
  { art: '#', weight: 2 },
  { art: '##', weight: 3 },
  { art: '###', weight: 3 },
  { art: '####', weight: 2 },
  { art: '#####', weight: 1.2 },
  { art: '##/##', weight: 3 },
  { art: '###/###', weight: 2 },
  { art: '###/###/###', weight: 1 },
  { art: '##/#.', weight: 3 },
  { art: '#./#./##', weight: 3, mirror: true },
  { art: '###/.#.', weight: 2 },
  { art: '.##/##.', weight: 1.5, mirror: true },
  { art: '#../#../###', weight: 2 },
]

const parse = (art) => art.split('/').flatMap((line, r) => [...line].flatMap((ch, c) => (ch === '#' ? [[r, c]] : [])))
const rotate = (cells) => cells.map(([r, c]) => [c, -r])
const mirror = (cells) => cells.map(([r, c]) => [r, -c])
// 왼쪽 위로 붙이고 줄·칸 순으로 늘어놓는다 - 같은 모양이면 같은 꼴이 된다
function normalize(cells) {
  const r0 = Math.min(...cells.map(([r]) => r))
  const c0 = Math.min(...cells.map(([, c]) => c))
  return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
}
const keyOf = (cells) => cells.map(([r, c]) => `${r},${c}`).join(' ')

/** 나올 수 있는 모든 조각 모양. { cells: [[줄, 칸]…], rows, cols, weight } */
export const SHAPES = BASES.flatMap(({ art, weight, mirror: both }) => {
  const seen = new Map()
  const first = parse(art)
  for (const start of both ? [first, mirror(first)] : [first]) {
    let cells = normalize(start)
    for (let k = 0; k < 4; k++) {
      seen.set(keyOf(cells), cells)
      cells = normalize(rotate(cells))
    }
  }
  const variants = [...seen.values()]
  return variants.map((cells) => ({
    cells,
    rows: Math.max(...cells.map(([r]) => r)) + 1,
    cols: Math.max(...cells.map(([, c]) => c)) + 1,
    weight: weight / variants.length,
  }))
})
const TOTAL_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0)

/** (줄, 칸) → 판 배열 번호 */
export const at = (r, c) => r * SIZE + c

/** 한 번에 n 줄을 지울 때의 점수 (콤보를 곱하기 전). 1줄 10 · 2줄 30 · 3줄 60 · 4줄 100 … */
export const lineScore = (n) => (10 * n * (n + 1)) / 2

export const emptyBoard = () => new Array(SIZE * SIZE).fill(EMPTY)

/** 이 모양을 판의 (r, c) 를 왼쪽 위로 해서 놓을 수 있나 */
export function canPlace(board, shape, r, c) {
  const s = SHAPES[shape]
  if (!s) return false
  for (const [dr, dc] of s.cells) {
    const rr = r + dr
    const cc = c + dc
    if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE || board[at(rr, cc)] !== EMPTY) return false
  }
  return true
}

/** 판 어딘가에 놓을 수 있는 자리 하나 ({ r, c }). 없으면 null */
export function findSpot(board, shape) {
  const { rows, cols } = SHAPES[shape]
  for (let r = 0; r + rows <= SIZE; r++) {
    for (let c = 0; c + cols <= SIZE; c++) if (canPlace(board, shape, r, c)) return { r, c }
  }
  return null
}
export const fitsAnywhere = (board, shape) => findSpot(board, shape) !== null

/** 다 찬 가로줄·세로줄 번호 */
export function fullLines(board) {
  const rows = []
  const cols = []
  for (let i = 0; i < SIZE; i++) {
    let row = true
    let col = true
    for (let j = 0; j < SIZE; j++) {
      if (board[at(i, j)] === EMPTY) row = false
      if (board[at(j, i)] === EMPTY) col = false
    }
    if (row) rows.push(i)
    if (col) cols.push(i)
  }
  return { rows, cols }
}

/** 다 찬 줄들이 덮는 칸 번호 (가로·세로가 겹치는 칸은 한 번). place 와 화면 미리 보기가 같이 쓴다 */
export function lineCells({ rows, cols }) {
  const cells = new Set()
  for (const r of rows) for (let j = 0; j < SIZE; j++) cells.add(at(r, j))
  for (const c of cols) for (let j = 0; j < SIZE; j++) cells.add(at(j, c))
  return cells
}

/** 콤보가 끊기기까지 남은 수 (콤보가 없으면 0) */
export const comboLeft = (game) => (game.combo ? Math.max(0, COMBO_GRACE - game.idle) : 0)

/** (r, c) 에 놓는다면 지워질 줄 (미리 보기용). 못 놓는 자리면 빈 목록 */
export function linesIf(board, shape, r, c) {
  if (!canPlace(board, shape, r, c)) return { rows: [], cols: [] }
  const next = board.slice()
  for (const [dr, dc] of SHAPES[shape].cells) next[at(r + dr, c + dc)] = 0
  return fullLines(next)
}

function pickShape(rand) {
  let roll = rand() * TOTAL_WEIGHT
  for (let i = 0; i < SHAPES.length; i++) {
    roll -= SHAPES[i].weight
    if (roll < 0) return i
  }
  return SHAPES.length - 1
}

// 세 조각의 색은 서로 다르게 - 아래 줄에서 조각끼리 헷갈리지 않게
function pickColors(rand) {
  const all = Array.from({ length: COLORS }, (_, i) => i)
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, TRAY)
}

/** 새 조각 세 개를 낸다. 지금 판에 하나라도 들어가는 묶음이 나올 때까지 몇 번 다시 뽑는다 (그래도 안 되면 끝) */
export function deal(game, rand = Math.random) {
  let tray = []
  for (let k = 0; k < DEAL_TRIES; k++) {
    const colors = pickColors(rand)
    tray = colors.map((color) => ({ shape: pickShape(rand), color }))
    if (tray.some((p) => fitsAnywhere(game.board, p.shape))) break
  }
  game.tray = tray
}

const checkOver = (game) => !game.tray.some((p) => p && fitsAnywhere(game.board, p.shape))

export function createGame(rand = Math.random) {
  const game = { board: emptyBoard(), tray: [], score: 0, combo: 0, idle: 0, moves: 0, over: false }
  deal(game, rand)
  game.over = checkOver(game)
  return game
}

/**
 * 아래 줄 slot 번째 조각을 (r, c) 를 왼쪽 위로 해서 놓는다. 못 놓으면 null.
 * 돌려주는 것: 얻은 점수, 놓인 칸, 지운 줄과 칸(지우기 전 색 포함), 콤보, 판을 비웠는지, 새 세 개가 나왔는지
 */
export function place(game, slot, r, c, rand = Math.random) {
  const piece = game.tray[slot]
  if (game.over || !piece || !canPlace(game.board, piece.shape, r, c)) return null
  const shape = SHAPES[piece.shape]
  const cells = shape.cells.map(([dr, dc]) => [r + dr, c + dc])
  for (const [rr, cc] of cells) game.board[at(rr, cc)] = piece.color
  game.tray[slot] = null

  let gained = cells.length
  const { rows, cols } = fullLines(game.board)
  const lines = rows.length + cols.length
  const cleared = [] // 지운 칸 [{ r, c, color }] - 가로·세로가 겹치는 칸은 한 번만
  if (lines) {
    for (const i of lineCells({ rows, cols })) {
      cleared.push({ r: Math.floor(i / SIZE), c: i % SIZE, color: game.board[i] })
      game.board[i] = EMPTY
    }
    game.combo += 1
    game.idle = 0
    gained += lineScore(lines) * game.combo
  } else {
    game.idle += 1
    if (game.idle >= COMBO_GRACE) game.combo = 0
  }
  const perfect = lines > 0 && game.board.every((v) => v === EMPTY)
  if (perfect) gained += PERFECT_BONUS

  game.score += gained
  game.moves += 1
  const dealt = game.tray.every((p) => !p)
  if (dealt) deal(game, rand)
  game.over = checkOver(game)
  return { gained, cells, rows, cols, lines, cleared, combo: lines ? game.combo : 0, perfect, dealt }
}

/** 이 브라우저에 저장해 둔 판을 되살린다. 모양이 맞지 않으면 null */
export function restore(saved) {
  if (!saved || typeof saved !== 'object') return null
  const { board, tray, score, combo, idle, moves } = saved
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi
  if (!Array.isArray(board) || board.length !== SIZE * SIZE || !board.every((v) => int(v, EMPTY, COLORS - 1))) return null
  if (!Array.isArray(tray) || tray.length !== TRAY) return null
  if (!tray.every((p) => p === null || (p && int(p.shape, 0, SHAPES.length - 1) && int(p.color, 0, COLORS - 1)))) return null
  if (tray.every((p) => p === null)) return null
  if (![score, combo, idle, moves].every((v) => int(v, 0, Number.MAX_SAFE_INTEGER))) return null
  if (combo > 0 && idle >= COMBO_GRACE) return null // 이러면 콤보가 이미 끊겼어야 한다
  const game = {
    board: board.slice(),
    tray: tray.map((p) => (p ? { shape: p.shape, color: p.color } : null)),
    score, combo, idle, moves, over: false,
  }
  game.over = checkOver(game)
  return game
}

/** 저장할 몫만 (over 는 되살릴 때 다시 센다) */
export const snapshot = ({ board, tray, score, combo, idle, moves }) => ({ board, tray, score, combo, idle, moves })
