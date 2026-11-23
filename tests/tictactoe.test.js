// 봄날 틱택토 규칙 검사 - 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY, O, X, other, emptyBoard, openCells, winLine, outcome, createGame, play, chooseMove, LEVELS,
} from '../public/games/tictactoe/logic.js'

const parse = (s) => s.replace(/\s/g, '').split('').map((ch) => (ch === 'O' ? O : ch === 'X' ? X : EMPTY))

test('세 줄을 이으면 이기고, 다 차면 비긴다', () => {
  assert.deepEqual(winLine(parse('OOO X.X ...')), { mark: O, line: [0, 1, 2] })
  assert.equal(winLine(parse('X.. .X. ..X')).mark, X)
  assert.equal(outcome(parse('OXO OXX XOO')), 0)
  assert.equal(outcome(parse('O.. ... ...')), null)
})

test('번갈아 두고, 끝나면 더 둘 수 없다', () => {
  const g = createGame(O)
  assert.ok(play(g, 0))
  assert.equal(g.turn, X)
  assert.equal(play(g, 0), false) // 이미 찬 칸
  play(g, 3); play(g, 1); play(g, 4); play(g, 2)
  assert.equal(g.over, true)
  assert.equal(g.result, O)
  assert.deepEqual(g.line, [0, 1, 2])
  assert.equal(play(g, 8), false)
})

test('컴퓨터가 먼저 둘 수도 있다', () => {
  const g = createGame(X)
  assert.equal(g.turn, X)
})

test('어느 난이도든 빈칸을 고르고 판은 그대로 둔다', () => {
  const b = parse('OX. .O. ...')
  for (const level of LEVELS) {
    const before = b.slice()
    for (let n = 0; n < 20; n++) assert.ok(openCells(b).includes(chooseMove(b, X, level)))
    assert.deepEqual(b, before)
  }
  assert.equal(chooseMove(parse('OXO OXX XOO'), X, 'hard'), -1)
})

test('중급은 이길 자리를 잡고, 질 자리를 막는다', () => {
  for (let n = 0; n < 30; n++) {
    assert.equal(chooseMove(parse('XX. OO. ...'), X, 'normal'), 2) // 이기기가 막기보다 먼저
    assert.equal(chooseMove(parse('OO. X.. ...'), X, 'normal'), 2) // 막기
  }
})

// 사람이 둘 수 있는 모든 수를 다 둬 본다. 고급이 한 번이라도 지면 실패
function hardNeverLoses(turn, board) {
  const result = outcome(board)
  if (result !== null) return result !== O
  if (turn === X) {
    // 고급이 고를 수 있는 가장 좋은 수가 여럿이라 난수로 갈린다 - 난수 몇 개를 다 해 본다
    for (const r of [0, 0.34, 0.67, 0.99]) {
      const m = chooseMove(board, X, 'hard', () => r)
      const nb = board.slice()
      nb[m] = X
      if (!hardNeverLoses(O, nb)) return false
    }
    return true
  }
  return openCells(board).every((i) => {
    const nb = board.slice()
    nb[i] = O
    return hardNeverLoses(X, nb)
  })
}

test('고급은 어떻게 둬도 지지 않는다 (먼저 두든 나중에 두든)', () => {
  assert.ok(hardNeverLoses(O, emptyBoard()))
  assert.ok(hardNeverLoses(X, emptyBoard()))
})

test('중급은 두 갈래 함정에 걸릴 수 있다 - 고급과 차이가 난다', () => {
  // ○ 가 귀 두 곳을 쥐고 ✕ 가 가운데에 있을 때, 변이 아닌 귀를 두면 ○ 가 두 갈래를 만든다
  let fell = false
  for (let n = 0; n < 200 && !fell; n++) {
    const m = chooseMove(parse('O.. .X. ..O'), X, 'normal')
    if ([2, 6].includes(m)) fell = true
  }
  assert.ok(fell)
  for (let n = 0; n < 50; n++) assert.ok([1, 3, 5, 7].includes(chooseMove(parse('O.. .X. ..O'), X, 'hard')))
  assert.equal(other(O), X)
})
