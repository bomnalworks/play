// 봄날 틱택토 - 규칙과 컴퓨터 상대. DOM 이 없다 (테스트가 화면 없이 이 파일만 불러 돌린다)
//
// 판은 길이 9 배열(왼쪽 위부터 가로로), 0 빈칸 · 1 ○ · 2 ✕. 사람은 늘 ○, 컴퓨터는 ✕ 다.

export const EMPTY = 0
export const O = 1
export const X = 2
export const other = (mark) => 3 - mark

export const LEVELS = ['easy', 'normal', 'hard']
export const LEVEL_NAME = { easy: '초급', normal: '중급', hard: '고급' }

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export const emptyBoard = () => new Array(9).fill(EMPTY)
export const openCells = (board) => board.flatMap((v, i) => (v === EMPTY ? [i] : []))

/** 세 줄을 이룬 쪽과 그 줄. 없으면 null. */
export function winLine(board) {
  for (const line of LINES) {
    const [a, b, c] = line
    if (board[a] !== EMPTY && board[a] === board[b] && board[a] === board[c]) return { mark: board[a], line }
  }
  return null
}

/** 이긴 표시(O·X), 비기면 0, 아직이면 null */
export function outcome(board) {
  const win = winLine(board)
  if (win) return win.mark
  return board.includes(EMPTY) ? null : 0
}

/* ---------- 한 판 ---------- */

export function createGame(first = O) {
  return { board: emptyBoard(), turn: first, over: false, result: null, line: null }
}

/** 지금 차례인 쪽이 i 에 둔다. 못 두는 자리면 false. */
export function play(game, i) {
  if (game.over || game.board[i] !== EMPTY) return false
  game.board[i] = game.turn
  const win = winLine(game.board)
  if (win || !game.board.includes(EMPTY)) {
    game.over = true
    game.result = win ? win.mark : 0
    game.line = win?.line ?? null
  } else {
    game.turn = other(game.turn)
  }
  return true
}

/* ---------- 컴퓨터 상대 ---------- */

// mark 쪽에서 본 이 판의 값. 빨리 이길수록, 늦게 질수록 좋다.
// 알파베타 가지치기 - 창을 (-∞, ∞)로 부르면 값은 그대로 정확하고, 빈 판에서도 금방 끝난다.
function minimax(board, mark, depth, alpha = -Infinity, beta = Infinity) {
  const result = outcome(board)
  if (result === mark) return 10 - depth
  if (result === other(mark)) return depth - 10
  if (result === 0) return 0
  let best = -Infinity
  for (let i = 0; i < 9; i++) {
    if (board[i] !== EMPTY) continue
    board[i] = mark
    const v = -minimax(board, other(mark), depth + 1, -beta, -alpha)
    board[i] = EMPTY
    if (v > best) best = v
    if (v > alpha) alpha = v
    if (alpha >= beta) break
  }
  return best
}

/** 지금 두면 바로 이기는 자리들 */
function winningCells(board, mark) {
  return openCells(board).filter((i) => {
    board[i] = mark
    const won = winLine(board)?.mark === mark
    board[i] = EMPTY
    return won
  })
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)]

/**
 * mark 쪽이 둘 자리를 고른다. 둘 곳이 없으면 -1. 판은 그대로 둔다.
 * 초급: 이길 자리도 반쯤은 놓친다 · 중급: 이길 자리는 잡고 질 자리는 막지만 두 갈래 함정은 못 본다
 * 고급: 끝까지 읽어 절대 지지 않는다
 */
export function chooseMove(board, mark, level, rng = Math.random) {
  const work = board.slice()
  const open = openCells(work)
  if (!open.length) return -1

  if (level === 'easy') {
    const win = winningCells(work, mark)
    if (win.length && rng() < 0.5) return pick(win, rng)
    return pick(open, rng)
  }

  if (level === 'normal') {
    const win = winningCells(work, mark)
    if (win.length) return pick(win, rng)
    const block = winningCells(work, other(mark))
    if (block.length) return pick(block, rng)
    if (work[4] === EMPTY && rng() < 0.5) return 4
    return pick(open, rng)
  }

  // 고급: 가장 좋은 수가 여럿이면 그중 아무거나 - 매판 똑같이 두지 않게
  let bestV = -Infinity
  let best = []
  for (const i of open) {
    work[i] = mark
    const v = -minimax(work, other(mark), 1)
    work[i] = EMPTY
    if (v > bestV) { bestV = v; best = [i] } else if (v === bestV) best.push(i)
  }
  return pick(best, rng)
}
