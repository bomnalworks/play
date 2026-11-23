// 봄날 리버시 규칙 검사 - 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY, BLACK, WHITE, other, startBoard, flipsFor, legalMoves, hasMove, score,
  createGame, play, undoTo, canUndoTo, winner, chooseMove, LEVELS,
} from '../public/games/reversi/logic.js'

// 글자로 판 그리기: . 빈칸 · X 흑 · O 백 (8줄 × 8칸)
const parse = (rows) => rows.join('').replace(/\s/g, '').split('').map((ch) => (ch === 'X' ? BLACK : ch === 'O' ? WHITE : EMPTY))

// 고정된 난수 - 테스트가 매번 같은 판을 둔다
function seeded(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

test('처음 판은 가운데 네 칸이고 흑이 둘 곳은 넷이다', () => {
  const b = startBoard()
  assert.deepEqual(score(b), { black: 2, white: 2 })
  assert.deepEqual(legalMoves(b, BLACK), [19, 26, 37, 44])
  assert.deepEqual(legalMoves(b, WHITE), [20, 29, 34, 43])
})

test('두면 사이에 낀 상대 돌이 뒤집힌다', () => {
  const g = createGame()
  assert.ok(play(g, 19))
  assert.equal(g.board[27], BLACK)
  assert.deepEqual(score(g.board), { black: 4, white: 1 })
  assert.equal(g.turn, WHITE)
  assert.equal(g.last, 19)
  assert.deepEqual(g.flipped, [27])
})

test('못 두는 자리는 거절하고 판을 건드리지 않는다', () => {
  const g = createGame()
  const before = g.board.slice()
  assert.equal(play(g, 0), false)
  assert.equal(play(g, 27), false) // 이미 돌이 있다
  assert.deepEqual(g.board, before)
  assert.equal(g.history.length, 0)
})

test('여러 방향을 한 번에 뒤집는다', () => {
  const b = parse([
    'X.X.X...',
    '.OOO....',
    'XO.OX...',
    '.OOO....',
    'X.X.X...',
    '........',
    '........',
    '........',
  ])
  assert.equal(flipsFor(b, 18, BLACK).length, 8)
})

test('상대가 둘 곳이 없으면 같은 쪽이 한 번 더 둔다', () => {
  // 흑이 a1 에 두면 백 돌이 하나도 안 남는 건 아니지만, 백은 둘 곳이 없다
  const g = createGame()
  g.board = parse([
    '.OX.....',
    '........',
    '........',
    '........',
    '........',
    '........',
    '.......X',
    '......OX',
  ])
  g.turn = BLACK
  assert.ok(play(g, 0)) // a1 → b1 뒤집힘
  assert.equal(g.over, false)
  assert.equal(g.turn, BLACK)
  assert.equal(g.passed, WHITE)
})

test('둘 다 둘 곳이 없으면 끝나고 이긴 쪽을 알려 준다', () => {
  const g = createGame()
  g.board = parse([
    'XO......',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
  ])
  g.board[2] = EMPTY
  g.turn = BLACK
  assert.ok(play(g, 2)) // c1 → b1 뒤집혀 백 돌이 사라진다
  assert.equal(g.over, true)
  assert.equal(winner(g), BLACK)
})

test('되돌리면 내 차례였던 때로 돌아간다', () => {
  const g = createGame()
  play(g, 19) // 흑
  play(g, legalMoves(g.board, WHITE)[0]) // 백
  assert.ok(canUndoTo(g, BLACK))
  assert.ok(undoTo(g, BLACK))
  assert.deepEqual(g.board, startBoard())
  assert.equal(g.turn, BLACK)
  assert.equal(g.history.length, 0)
  assert.equal(undoTo(g, BLACK), false)
})

test('어느 난이도든 둘 수 있는 자리를 고르고, 판은 그대로 둔다', () => {
  const g = createGame()
  for (const level of LEVELS) {
    const before = g.board.slice()
    const m = chooseMove(g.board, BLACK, level, { rng: seeded(1), budgetMs: 200 })
    assert.ok(legalMoves(g.board, BLACK).includes(m), level)
    assert.deepEqual(g.board, before)
  }
  assert.equal(chooseMove(parse(Array(8).fill('XXXXXXXX')), WHITE, 'hard'), -1)
})

test('고급은 귀를 잡을 수 있으면 잡는다', () => {
  const b = parse([
    '........',
    '.O......',
    '..X.....',
    '...XO...',
    '...OX...',
    '........',
    '........',
    '........',
  ])
  assert.equal(chooseMove(b, BLACK, 'hard', { budgetMs: Infinity, maxDepth: 4 }), 0)
})

test('고급은 끝판을 끝까지 읽어 이기는 수를 찾는다', () => {
  // 빈칸 넷. 아무 데나 두면 지고, 한 수만 이긴다 - 수를 하나씩 둬 보고 끝까지 둔 결과와 맞춰 본다
  const b = parse([
    'XXXXXXXO',
    'XXXXXXOO',
    'XXXXXOOO',
    'XXXXOOOO',
    'OOOOOOOO',
    'OOOOOOOO',
    'OOOOOO..',
    'OOOOOO..',
  ])
  const moves = legalMoves(b, BLACK)
  const pickMove = chooseMove(b, BLACK, 'hard', { budgetMs: Infinity })
  assert.ok(moves.includes(pickMove))
  // 완벽하게 두는 두 쪽이 끝까지 두었을 때 고른 수가 가장 좋은 결과여야 한다
  const outcome = (board, color) => {
    const ms = legalMoves(board, color)
    if (!ms.length) {
      if (!hasMove(board, other(color))) {
        const s = score(board)
        return color === BLACK ? s.black - s.white : s.white - s.black
      }
      return -outcome(board, other(color))
    }
    let best = -Infinity
    for (const m of ms) {
      const nb = board.slice()
      nb[m] = color
      for (const f of flipsFor(board, m, color)) nb[f] = color
      best = Math.max(best, -outcome(nb, other(color)))
    }
    return best
  }
  const after = (m) => {
    const nb = b.slice()
    nb[m] = BLACK
    for (const f of flipsFor(b, m, BLACK)) nb[f] = BLACK
    return -outcome(nb, WHITE)
  }
  const bestPossible = Math.max(...moves.map(after))
  assert.equal(Math.sign(after(pickMove)), Math.sign(bestPossible))
})

// 한 판을 끝까지 둔다. 돌려주는 값은 흑 기준 돌 차이
function duel(blackLevel, whiteLevel, seed) {
  const rng = seeded(seed)
  const g = createGame()
  const opts = { rng, budgetMs: Infinity, maxDepth: 3 }
  while (!g.over) {
    const level = g.turn === BLACK ? blackLevel : whiteLevel
    assert.ok(play(g, chooseMove(g.board, g.turn, level, opts)))
  }
  const s = score(g.board)
  assert.equal(s.black + s.white <= 64, true)
  return s.black - s.white
}

test('난이도가 높을수록 이긴다', () => {
  let normalWins = 0
  let hardWins = 0
  for (let seed = 1; seed <= 6; seed++) {
    // 색을 번갈아 쥔다
    const a = seed % 2 ? duel('normal', 'easy', seed) : -duel('easy', 'normal', seed)
    const b = seed % 2 ? duel('hard', 'normal', seed) : -duel('normal', 'hard', seed)
    if (a > 0) normalWins++
    if (b > 0) hardWins++
  }
  assert.ok(normalWins >= 5, `중급이 초급을 6판 중 ${normalWins}판 이김`)
  assert.ok(hardWins >= 4, `고급이 중급을 6판 중 ${hardWins}판 이김`)
})
