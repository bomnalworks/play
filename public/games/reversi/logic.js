// 봄날 리버시 - 규칙과 컴퓨터 상대. DOM 이 없다 (테스트가 화면 없이 이 파일만 불러 돌린다)
//
// 판은 길이 64 배열(왼쪽 위부터 가로로), 0 빈칸 · 1 흑 · 2 백. 흑이 먼저 둔다.
// 이름에 "오셀로"를 쓰지 않는다 - 상표다. 규칙(리버시)은 누구나 쓸 수 있다.

export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2
export const other = (color) => 3 - color

export const LEVELS = ['easy', 'normal', 'hard']
export const LEVEL_NAME = { easy: '초급', normal: '중급', hard: '고급' }

// 칸마다 여덟 방향으로 뻗는 줄을 미리 만들어 둔다. 두 칸이 안 되는 줄로는 뒤집을 수 없어 뺀다.
const RAYS = []
for (let i = 0; i < 64; i++) {
  const rays = []
  for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
    const ray = []
    for (let r = (i >> 3) + dr, c = (i & 7) + dc; r >= 0 && r < 8 && c >= 0 && c < 8; r += dr, c += dc) {
      ray.push(r * 8 + c)
    }
    if (ray.length >= 2) rays.push(ray)
  }
  RAYS.push(rays)
}

export function startBoard() {
  const board = new Array(64).fill(EMPTY)
  board[27] = WHITE
  board[28] = BLACK
  board[35] = BLACK
  board[36] = WHITE
  return board
}

/** i 에 color 를 두면 뒤집히는 칸들. 둘 수 없으면 빈 배열. */
export function flipsFor(board, i, color) {
  if (board[i] !== EMPTY) return []
  const opp = other(color)
  const out = []
  for (const ray of RAYS[i]) {
    let k = 0
    while (k < ray.length && board[ray[k]] === opp) k++
    if (k > 0 && k < ray.length && board[ray[k]] === color) {
      for (let j = 0; j < k; j++) out.push(ray[j])
    }
  }
  return out
}

function canPlay(board, i, color) {
  if (board[i] !== EMPTY) return false
  const opp = other(color)
  for (const ray of RAYS[i]) {
    if (board[ray[0]] !== opp) continue
    let k = 1
    while (k < ray.length && board[ray[k]] === opp) k++
    if (k < ray.length && board[ray[k]] === color) return true
  }
  return false
}

export function legalMoves(board, color) {
  const moves = []
  for (let i = 0; i < 64; i++) if (canPlay(board, i, color)) moves.push(i)
  return moves
}

function countMoves(board, color) {
  let n = 0
  for (let i = 0; i < 64; i++) if (canPlay(board, i, color)) n++
  return n
}

export function hasMove(board, color) {
  for (let i = 0; i < 64; i++) if (canPlay(board, i, color)) return true
  return false
}

export function score(board) {
  let black = 0
  let white = 0
  for (const v of board) {
    if (v === BLACK) black++
    else if (v === WHITE) white++
  }
  return { black, white }
}

/* ---------- 한 판 ---------- */

// passed: 방금 수 때문에 둘 곳이 없어 차례를 건너뛴 쪽(없으면 0). 화면이 "넘깁니다"를 알리는 데 쓴다.
export function createGame() {
  return { board: startBoard(), turn: BLACK, last: -1, flipped: [], passed: 0, over: false, history: [] }
}

const snapshot = (g) => ({
  board: g.board.slice(), turn: g.turn, last: g.last, flipped: g.flipped, passed: g.passed, over: g.over,
})

/** 지금 차례인 쪽이 i 에 둔다. 못 두는 자리면 false 이고 판은 그대로다. */
export function play(game, i) {
  if (game.over) return false
  const flips = flipsFor(game.board, i, game.turn)
  if (!flips.length) return false

  game.history.push(snapshot(game))
  game.board[i] = game.turn
  for (const f of flips) game.board[f] = game.turn
  game.last = i
  game.flipped = flips

  const next = other(game.turn)
  if (hasMove(game.board, next)) {
    game.turn = next
    game.passed = 0
  } else if (hasMove(game.board, game.turn)) {
    game.passed = next // 상대가 둘 곳이 없어 같은 쪽이 한 번 더 둔다
  } else {
    game.over = true // 둘 다 둘 곳이 없으면 끝 (판이 다 찼을 때 포함)
    game.passed = 0
  }
  return true
}

/** color 가 마지막으로 둘 차례였던 때로 되돌린다. 그런 때가 없으면 false. */
export function undoTo(game, color) {
  let at = game.history.length - 1
  while (at >= 0 && game.history[at].turn !== color) at--
  if (at < 0) return false
  const s = game.history[at]
  game.history.length = at
  Object.assign(game, { ...s, board: s.board.slice() })
  return true
}

export const canUndoTo = (game, color) => game.history.some((s) => s.turn === color)

/** 이긴 쪽 색, 비기면 0. 끝나지 않았으면 null. */
export function winner(game) {
  if (!game.over) return null
  const { black, white } = score(game.board)
  return black === white ? 0 : black > white ? BLACK : WHITE
}

/* ---------- 컴퓨터 상대 ---------- */

// 자리 값. 귀(모서리)가 가장 좋고, 귀 옆(X·C 자리)은 귀를 내주기 쉬워 나쁘다.
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
]
// 귀가 이미 차 있으면 그 옆자리는 더 이상 위험하지 않다
const CORNER_NEIGHBORS = [[0, [1, 8, 9]], [7, [6, 15, 14]], [56, [57, 48, 49]], [63, [62, 55, 54]]]
// 뒤져 볼 순서. 좋은 수를 먼저 보면 가지치기가 잘 된다
const ORDER = [...Array(64).keys()].sort((a, b) => WEIGHTS[b] - WEIGHTS[a])

const WIN = 100000 // 끝까지 읽은 결과는 어떤 어림값보다 크게

// mine: color 가 둘 수 있는 자리 수 (부르는 쪽이 방금 셌다 - 끝 마디가 대부분이라 두 번 세지 않는다)
function evaluate(board, color, mine) {
  const opp = other(color)
  let pos = 0
  let empties = 0
  for (let i = 0; i < 64; i++) {
    const v = board[i]
    if (v === color) pos += WEIGHTS[i]
    else if (v === opp) pos -= WEIGHTS[i]
    else empties++
  }
  for (const [corner, near] of CORNER_NEIGHBORS) {
    if (board[corner] === EMPTY) continue
    for (const n of near) {
      if (board[n] === color) pos -= WEIGHTS[n]
      else if (board[n] === opp) pos += WEIGHTS[n]
    }
  }
  const mobility = (mine - countMoves(board, opp)) * (empties > 20 ? 10 : 5)
  return pos + mobility
}

function finalValue(board, color) {
  const { black, white } = score(board)
  const diff = color === BLACK ? black - white : white - black
  return diff === 0 ? 0 : (diff > 0 ? WIN : -WIN) + diff
}

// 판을 직접 바꾸고 되돌린다 (복사보다 훨씬 빠르다)
function apply(board, i, color) {
  const flips = flipsFor(board, i, color)
  board[i] = color
  for (const f of flips) board[f] = color
  return flips
}
function revert(board, i, flips, color) {
  board[i] = EMPTY
  const opp = other(color)
  for (const f of flips) board[f] = opp
}

const ABORT = Symbol('abort')

function orderedMoves(board, color) {
  const moves = []
  for (const i of ORDER) if (canPlay(board, i, color)) moves.push(i)
  return moves
}

function negamax(board, color, depth, alpha, beta, ctx) {
  if ((++ctx.nodes & 1023) === 0 && ctx.now() > ctx.deadline) throw ABORT
  // 끝 마디에서는 수 목록이 필요 없다 - 개수만 세어 차례 넘김 판단과 어림값에 같이 쓴다
  const moves = depth <= 0 ? null : orderedMoves(board, color)
  const count = moves ? moves.length : countMoves(board, color)
  if (!count) {
    if (!hasMove(board, other(color))) return finalValue(board, color)
    return -negamax(board, other(color), depth, -beta, -alpha, ctx) // 차례 넘김은 수를 쓰지 않는다
  }
  if (!moves) {
    ctx.cut = true
    return evaluate(board, color, count)
  }
  let best = -Infinity
  for (const m of moves) {
    const flips = apply(board, m, color)
    const v = -negamax(board, other(color), depth - 1, -beta, -alpha, ctx)
    revert(board, m, flips, color)
    if (v > best) best = v
    if (v > alpha) alpha = v
    if (alpha >= beta) break
  }
  return best
}

// 첫 수마다 점수를 매긴다. first 를 맨 앞에 두면 이전 깊이에서 고른 수를 먼저 본다.
function rootSearch(board, color, depth, ctx, first = -1) {
  let moves = orderedMoves(board, color)
  if (first >= 0) moves = [first, ...moves.filter((m) => m !== first)]
  let alpha = -Infinity
  let bestMove = moves[0]
  for (const m of moves) {
    // 시간이 다 돼 중간에 빠져나가면 판이 어지러진 채 남는다. 부르는 쪽이 넘긴 사본이라 버리면 그만이다.
    const flips = apply(board, m, color)
    const v = -negamax(board, other(color), depth - 1, -Infinity, -alpha, ctx)
    revert(board, m, flips, color)
    if (v > alpha) {
      alpha = v
      bestMove = m
    }
  }
  return { move: bestMove, value: alpha }
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)]
}

/**
 * color 가 둘 수를 고른다. 둘 곳이 없으면 -1.
 * opts: rng(0~1 난수) · now(지금 ms) · budgetMs(고급이 생각할 시간) · maxDepth(고급이 읽을 최대 깊이)
 * 판은 잠깐 바꿨다가 그대로 돌려놓는다.
 */
export function chooseMove(board, color, level, opts = {}) {
  const { rng = Math.random, now = Date.now, budgetMs = 700, maxDepth = 12 } = opts
  const moves = legalMoves(board, color)
  if (moves.length <= 1) return moves.length ? moves[0] : -1
  const work = board.slice()

  if (level === 'easy') {
    // 반은 아무 데나, 반은 가장 많이 뒤집는 곳 - 귀를 노리지도, 피하지도 않는다
    if (rng() < 0.5) return pick(moves, rng)
    let most = 0
    let best = []
    for (const m of moves) {
      const n = flipsFor(work, m, color).length
      if (n > most) { most = n; best = [m] } else if (n === most) best.push(m)
    }
    return pick(best, rng)
  }

  if (level === 'normal') {
    // 두 수 앞까지 본다. 비슷한 수 사이에서는 조금씩 흔들려 매번 같은 판이 되지 않게
    const ctx = { nodes: 0, now, deadline: Infinity, cut: false }
    let bestV = -Infinity
    let best = moves[0]
    for (const m of moves) {
      const flips = apply(work, m, color)
      const v = -negamax(work, other(color), 1, -Infinity, Infinity, ctx) + rng() * 12
      revert(work, m, flips, color)
      if (v > bestV) { bestV = v; best = m }
    }
    return best
  }

  // 고급: 시간이 허락하는 만큼 깊이를 하나씩 늘린다. 끝까지 읽었으면(어림값을 안 썼으면) 거기서 멈춘다.
  const ctx = { nodes: 0, now, deadline: now() + budgetMs, cut: false }
  let best = orderedMoves(work, color)[0]
  for (let depth = 1; depth <= maxDepth; depth++) {
    ctx.cut = false
    try {
      best = rootSearch(work, color, depth, ctx, best).move
    } catch (e) {
      if (e !== ABORT) throw e
      break // 다 못 본 깊이는 버리고 앞 깊이의 수를 쓴다
    }
    if (!ctx.cut) break
  }
  return best
}
