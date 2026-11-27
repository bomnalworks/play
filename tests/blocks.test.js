// 봄날 블록 퍼즐 규칙 검사 - 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SIZE, TRAY, COLORS, EMPTY, COMBO_GRACE, PERFECT_BONUS, SHAPES,
  emptyBoard, comboLeft, canPlace, findSpot, fullLines, linesIf, lineScore, deal, createGame, place, restore, snapshot,
} from '../public/games/blocks/logic.js'

// 늘 같은 순서로 나오는 난수 (테스트가 매번 같게 돌도록 - plane·reversi 테스트와 같은 식)
function seeded(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
const shapeOf = (art) => {
  const want = art.split('/').flatMap((line, r) => [...line].flatMap((ch, c) => (ch === '#' ? [`${r},${c}`] : []))).join(' ')
  const i = SHAPES.findIndex((s) => s.cells.map(([r, c]) => `${r},${c}`).join(' ') === want)
  assert.ok(i >= 0, `모양 ${art} 이 없다`)
  return i
}
const at = (r, c) => r * SIZE + c
const blankGame = (tray) => ({ board: emptyBoard(), tray, score: 0, combo: 0, idle: 0, moves: 0, over: false })

test('모양은 서로 다르고, 칸이 이어져 있고, 5×5 안에 든다', () => {
  const keys = new Set()
  for (const s of SHAPES) {
    const key = s.cells.map(([r, c]) => `${r},${c}`).join(' ')
    assert.ok(!keys.has(key), `겹치는 모양 ${key}`)
    keys.add(key)
    assert.ok(s.rows <= 5 && s.cols <= 5 && s.cells.length <= 9)
    // 한 칸에서 출발해 이웃으로 다 닿는가
    const set = new Set(s.cells.map(([r, c]) => `${r},${c}`))
    const seen = new Set([key.split(' ')[0]])
    const todo = [...seen]
    while (todo.length) {
      const [r, c] = todo.pop().split(',').map(Number)
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${r + dr},${c + dc}`
        if (set.has(k) && !seen.has(k)) seen.add(k), todo.push(k)
      }
    }
    assert.equal(seen.size, set.size, `끊긴 모양 ${key}`)
  }
  // 돌린 모양: 막대 1×4 와 4×1, ㄱ자 4칸은 뒤집은 것까지 8가지
  shapeOf('####')
  shapeOf('#/#/#/#')
  // 4칸 조각: 막대 2 + 네모 1 + ㄱ자 8 + ㅗ자 4 + 번개 4 = 19
  assert.equal(SHAPES.filter((s) => s.cells.length === 4).length, 19)
})

test('판 밖이나 찬 칸에는 못 놓는다', () => {
  const board = emptyBoard()
  const bar = shapeOf('###')
  assert.ok(canPlace(board, bar, 0, 0))
  assert.ok(canPlace(board, bar, 0, SIZE - 3))
  assert.equal(canPlace(board, bar, 0, SIZE - 2), false)
  assert.equal(canPlace(board, bar, -1, 0), false)
  board[at(3, 4)] = 2
  assert.equal(canPlace(board, bar, 3, 2), false)
  assert.ok(canPlace(board, bar, 3, 5))
  assert.equal(canPlace(board, 999, 0, 0), false)
})

test('가로줄을 채우면 지워지고 점수가 붙는다', () => {
  const g = blankGame([{ shape: shapeOf('####'), color: 0 }, { shape: shapeOf('####'), color: 1 }, { shape: shapeOf('#'), color: 2 }])
  assert.equal(place(g, 0, 7, 0).lines, 0)
  assert.equal(g.score, 4)
  assert.equal(place(g, 0, 7, 4), null) // 이미 쓴 조각
  const res = place(g, 1, 7, 4)
  assert.deepEqual(res.rows, [7])
  assert.equal(res.lines, 1)
  assert.equal(res.cleared.length, SIZE)
  assert.equal(res.perfect, true) // 판이 비었다
  assert.equal(res.gained, 4 + lineScore(1) * 1 + PERFECT_BONUS)
  assert.ok(g.board.every((v) => v === EMPTY))
})

test('가로·세로가 같이 차면 같이 지우고, 겹친 칸은 한 번만 센다', () => {
  const g = blankGame([{ shape: shapeOf('#'), color: 3 }, null, null])
  for (let j = 0; j < SIZE; j++) {
    if (j !== 4) g.board[at(2, j)] = 0
    if (j !== 2) g.board[at(j, 4)] = 1
  }
  assert.deepEqual(linesIf(g.board, g.tray[0].shape, 2, 4), { rows: [2], cols: [4] })
  const res = place(g, 0, 2, 4)
  assert.equal(res.lines, 2)
  assert.equal(res.cleared.length, SIZE * 2 - 1)
  assert.equal(res.gained, 1 + lineScore(2) + PERFECT_BONUS)
  assert.equal(res.dealt, true) // 세 개를 다 썼으니 새로 나온다
  assert.equal(g.tray.filter(Boolean).length, TRAY)
})

test(`콤보는 연달아 지울수록 커지고, ${COMBO_GRACE}번 연달아 못 지우면 끊긴다`, () => {
  const one = shapeOf('#')
  const g = blankGame([{ shape: one, color: 0 }, { shape: one, color: 1 }, { shape: one, color: 2 }])
  g.board[at(0, 0)] = 0 // 판 비움 보너스가 끼지 않게 한 칸 남겨 둔다
  const fillRowBut = (r, c) => { for (let j = 0; j < SIZE; j++) if (j !== c) g.board[at(r, j)] = 0 }
  fillRowBut(5, 0)
  assert.equal(place(g, 0, 5, 0).combo, 1)
  assert.equal(comboLeft(g), COMBO_GRACE)
  fillRowBut(6, 0)
  const second = place(g, 1, 6, 0)
  assert.equal(second.combo, 2)
  assert.equal(second.gained, 1 + lineScore(1) * 2)
  // 이제 못 지우는 수를 COMBO_GRACE 번
  for (let k = 0; k < COMBO_GRACE; k++) {
    g.tray = [{ shape: one, color: 0 }, { shape: one, color: 1 }, null]
    place(g, 0, 3, k + 2)
    assert.equal(g.combo, k + 1 < COMBO_GRACE ? 2 : 0)
    assert.equal(comboLeft(g), k + 1 < COMBO_GRACE ? COMBO_GRACE - k - 1 : 0)
  }
})

test('남은 조각이 하나도 안 들어가면 끝난다', () => {
  const g = blankGame([{ shape: shapeOf('#'), color: 0 }, { shape: shapeOf('###/###/###'), color: 1 }, null])
  // 체스판처럼 한 칸 건너 채운다 - 큰 네모는 못 들어가고 한 칸짜리만 들어간다
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2) g.board[at(r, c)] = 0
  assert.equal(findSpot(g.board, g.tray[1].shape), null)
  const res = place(g, 0, 0, 0)
  assert.ok(res)
  assert.equal(g.over, true)
  assert.equal(place(g, 1, 0, 0), null)
})

test('새 세 개는 색이 서로 다르고, 들어갈 데가 있으면 적어도 하나는 들어간다', () => {
  const rand = seeded(7)
  for (let k = 0; k < 200; k++) {
    const g = blankGame([])
    // 판을 무작위로 채우되 1칸 자리는 하나 남긴다
    for (let i = 0; i < SIZE * SIZE; i++) g.board[i] = rand() < 0.6 ? 0 : EMPTY
    g.board[0] = EMPTY
    deal(g, rand)
    assert.equal(g.tray.length, TRAY)
    assert.equal(new Set(g.tray.map((p) => p.color)).size, TRAY)
    for (const p of g.tray) assert.ok(p.color >= 0 && p.color < COLORS)
    assert.ok(g.tray.some((p) => findSpot(g.board, p.shape)), `${k}번째: 하나도 안 들어간다`)
  }
})

test('무작위로 끝까지 두어도 규칙이 깨지지 않는다', () => {
  const rand = seeded(42)
  for (let round = 0; round < 20; round++) {
    const g = createGame(rand)
    let last = 0
    while (!g.over && g.moves < 2000) {
      const slot = g.tray.findIndex((p) => p && findSpot(g.board, p.shape))
      const { r, c } = findSpot(g.board, g.tray[slot].shape)
      const res = place(g, slot, r, c, rand)
      assert.ok(res)
      assert.ok(g.score > last)
      last = g.score
      assert.deepEqual(fullLines(g.board), { rows: [], cols: [] }) // 다 찬 줄이 남아 있으면 안 된다
    }
    assert.ok(g.over)
  }
})

test('저장한 판을 그대로 되살리고, 망가진 저장은 버린다', () => {
  const rand = seeded(3)
  const g = createGame(rand)
  const { r, c } = findSpot(g.board, g.tray[0].shape)
  place(g, 0, r, c, rand)
  const back = restore(JSON.parse(JSON.stringify(snapshot(g))))
  assert.deepEqual(snapshot(back), snapshot(g))
  assert.equal(restore(null), null)
  assert.equal(restore({ ...snapshot(g), board: [1, 2] }), null)
  assert.equal(restore({ ...snapshot(g), tray: [null, null, null] }), null)
  assert.equal(restore({ ...snapshot(g), tray: [{ shape: 9999, color: 0 }, null, null] }), null)
  assert.equal(restore({ ...snapshot(g), score: -5 }), null)
  assert.equal(restore({ ...snapshot(g), combo: 2, idle: COMBO_GRACE }), null) // 콤보가 끊겼어야 할 값
})
