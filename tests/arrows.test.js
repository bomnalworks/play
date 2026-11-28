// 봄날 화살 퍼즐 규칙 검사 - 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HEARTS, HINTS, TIMER_FROM, START_SECONDS, TIME_DROP, MIN_SECONDS, TIME_BONUS, secondsPerArrow, bonusSeconds, MAX_COLS, MAX_ROWS, DR, DC, levelSpec, generate, solveOrder, difficulty, bendsOf, shapeOf, maskOf, SHAPES, SHAPE_FROM, rayOf, createGame, restart, arrowAt, blocker, freeArrows, tap, useHint, restore, snapshot, freshSnapshot, timeLimit, expire,
} from '../public/games/arrows/logic.js'

const LEVELS = Array.from({ length: 40 }, (_, i) => i + 1).concat([60, 99, 250, 1000, 9999])

test('판은 꽉 차고, 화살은 이어진 칸이고, 머리는 마지막 칸 방향을 본다', () => {
  for (const level of LEVELS) {
    const { rows, cols, arrows, mask } = generate(level)
    const spec = levelSpec(level)
    assert.deepEqual([rows, cols], [spec.rows, spec.cols])
    const room = mask.reduce((n, v) => n + v, 0)
    const seen = new Set()
    for (const a of arrows) {
      assert.ok(a.cells.length >= 1 && a.cells.length <= spec.maxLen, `${level}단계 화살 길이 ${a.cells.length}`)
      assert.ok(Number.isInteger(a.dir) && a.dir >= 0 && a.dir < 4)
      a.cells.forEach(([r, c], k) => {
        assert.ok(r >= 0 && c >= 0 && r < rows && c < cols, '판 밖 칸')
        assert.equal(mask[r * cols + c], 1, `${level}단계 모양 밖에 화살이 있다`)
        assert.ok(!seen.has(`${r},${c}`), `${level}단계 칸이 겹친다`)
        seen.add(`${r},${c}`)
        if (k) {
          const [pr, pc] = a.cells[k - 1]
          assert.equal(Math.abs(r - pr) + Math.abs(c - pc), 1, '끊긴 화살')
        }
      })
      if (a.cells.length > 1) {
        const [r1, c1] = a.cells.at(-2)
        const [r2, c2] = a.cells.at(-1)
        assert.deepEqual([r2 - r1, c2 - c1], [DR[a.dir], DC[a.dir]], '머리가 몸통과 다른 쪽을 본다')
      }
      // 머리 앞에 제 몸통이 있으면 영영 못 빠진다
      const own = new Set(a.cells.map(([r, c]) => `${r},${c}`))
      assert.ok(rayOf(rows, cols, a).every(([r, c]) => !own.has(`${r},${c}`)), '제 몸통을 향한 화살')
    }
    assert.ok(seen.size >= room * 0.8, `${level}단계 판이 비었다 ${seen.size}/${room}`)
  }
})

test('모든 단계는 풀 수 있고, 2단계부터는 처음부터 막힌 화살이 있다', () => {
  for (const level of LEVELS) {
    const { rows, cols, arrows } = generate(level)
    const order = solveOrder(rows, cols, arrows)
    assert.ok(order, `${level}단계를 못 푼다`)
    assert.equal(new Set(order).size, arrows.length)
    if (level >= 2) assert.ok(freeArrows(createGame(level)).length < arrows.length, `${level}단계는 한 번에 다 빠진다`)
  }
})

test('같은 단계는 늘 같은 판, 다른 단계는 다른 판', () => {
  assert.deepEqual(generate(17), generate(17))
  assert.notDeepEqual(generate(17).arrows, generate(18).arrows)
  // 5×7 에서 커지다가 21단계부터 15×20 에서 멈춘다
  assert.deepEqual([levelSpec(1).cols, levelSpec(1).rows], [5, 7])
  assert.deepEqual([levelSpec(21).cols, levelSpec(21).rows], [MAX_COLS, MAX_ROWS])
  assert.deepEqual([levelSpec(500).cols, levelSpec(500).rows], [MAX_COLS, MAX_ROWS])
  // 네모 판(홀수 단계·초반)끼리는 작아지지 않는다 - 모양 판은 두 칸 넓다
  const plain = Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => !shapeOf(n))
  for (let k = 1; k < plain.length; k++) assert.ok(levelSpec(plain[k]).cols >= levelSpec(plain[k - 1]).cols, '판이 작아지면 안 된다')
})

test('어려운 판: 처음에 뺄 수 있는 화살은 적고, 다 빼려면 여러 차례가 걸린다', () => {
  for (const level of [3, 11, 21, 41, 99]) {
    const { rows, cols, arrows } = generate(level)
    const { free, depth } = difficulty(rows, cols, arrows)
    assert.ok(free <= 6, `${level}단계 처음에 뺄 수 있는 화살 ${free}개`)
    assert.ok(depth >= (level >= 10 ? 12 : 5), `${level}단계 차례 수 ${depth}`)
  }
  // 모양 판은 칸이 적어 차례 수가 짧지만 그래도 여러 차례
  for (const level of [10, 20, 40]) {
    const { rows, cols, arrows } = generate(level)
    const { free, depth } = difficulty(rows, cols, arrows)
    assert.ok(free <= 8 && depth >= 6, `${level}단계 모양 판 free ${free} depth ${depth}`)
  }
  // 21단계부터는 화살이 평균 6칸 넘게 길고, 한 칸짜리는 드물고, 화살 하나가 평균 2.5번 넘게 꺾인다
  for (const level of [21, 31, 61]) { // 네모 판(홀수 단계)
    const { arrows } = generate(level)
    assert.ok(arrows.reduce((n, a) => n + a.cells.length, 0) / arrows.length > 6, `${level}단계 화살이 짧다`)
    assert.ok(arrows.filter((a) => a.cells.length === 1).length < arrows.length / 4, `${level}단계 한 칸짜리가 많다`)
    assert.ok(arrows.reduce((n, a) => n + bendsOf(a), 0) / arrows.length > 2.5, `${level}단계 꺾임이 적다`)
  }
})

test('모양 판: 6단계부터 짝수 단계마다 하트 → 트리 → 별 … 차례로', () => {
  assert.equal(shapeOf(SHAPE_FROM - 1), null)
  assert.equal(shapeOf(SHAPE_FROM + 1), null, '홀수 단계는 네모 판')
  assert.equal(shapeOf(6).key, 'heart')
  assert.equal(shapeOf(8).key, 'tree')
  assert.equal(shapeOf(6 + SHAPES.length * 2).key, 'heart', '한 바퀴 돌면 다시 하트')
  for (const sh of SHAPES) {
    // 큰 판에서 모양이 판의 3분의 1 이상을 차지하고, 판 전체는 아니다
    const mask = maskOf(MAX_ROWS, MAX_COLS, sh)
    const n = mask.reduce((a, v) => a + v, 0)
    assert.ok(n > (MAX_ROWS * MAX_COLS) / 3 && n < MAX_ROWS * MAX_COLS * 0.9, `${sh.name} ${n}칸`)
  }
  // 도넛은 가운데가 비어 있다
  const ring = maskOf(MAX_ROWS, MAX_COLS, SHAPES.find((sh) => sh.key === 'ring'))
  assert.equal(ring[Math.floor(MAX_ROWS / 2) * MAX_COLS + Math.floor(MAX_COLS / 2)], 0)
  assert.equal(generate(20).shape, 'heart')
  assert.equal(generate(21).shape, null)
})

test('판이 더 안 커지는 뒤로는 계단식으로 어려워진다', () => {
  const at = (n) => levelSpec(n)
  assert.deepEqual([at(24).colors, at(25).colors, at(35).colors, at(50).colors], [7, 4, 2, 1])
  assert.deepEqual([at(29).hearts, at(30).hearts, at(60).hearts], [3, 2, 1])
  assert.deepEqual([at(39).hints, at(40).hints], [1, 0])
  assert.ok(at(60).tries > at(21).tries)
  const game = createGame(60)
  assert.deepEqual([game.hearts, game.maxHearts, game.hints, game.colors], [1, 1, 0, 1])
  assert.equal(useHint(game), -1, '힌트 없는 단계')
  const stuck = game.arrows.findIndex((_, i) => blocker(game, i))
  tap(game, stuck)
  assert.equal(game.over, true, '하트 1개 단계는 한 번 부딪히면 끝')
  // 되살릴 때도 그 단계의 하트·힌트 수를 넘지 못한다
  assert.equal(restore({ level: 30, gone: [], hearts: 3, hints: 1, mistakes: 0, moves: 0 }), null)
  assert.ok(restore({ level: 30, gone: [], hearts: 2, hints: 1, mistakes: 0, moves: 0 }))
  // 판을 만들지 않고 만든 '처음부터' 저장값은 그 단계를 처음부터 연 판과 같다
  for (const level of [1, 30, 60]) assert.deepEqual(freshSnapshot(level), snapshot(createGame(level)))
})

test('시간 제한: 보통은 21단계부터, 전문가는 1단계부터 화살 하나에 2초, 한 단계마다 TIME_DROP 씩 줄고 0.5초에서 멈춘다', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9
  assert.equal(START_SECONDS, 2)
  assert.equal(TIME_DROP, 0.03)
  assert.equal(secondsPerArrow(TIMER_FROM.normal - 1), 0, '20단계까지 보통은 시계 없음')
  assert.equal(secondsPerArrow(TIMER_FROM.normal), 2)
  assert.ok(near(secondsPerArrow(TIMER_FROM.normal + 1), 2 * 0.97))
  assert.ok(Math.abs(secondsPerArrow(44) - 1) < 0.02, '보통 44단계쯤 1초')
  assert.equal(secondsPerArrow(1, true), 2, '전문가는 1단계부터 2초')
  assert.ok(near(secondsPerArrow(11, true), 2 * 0.97 ** 10))
  assert.equal(secondsPerArrow(500), MIN_SECONDS)
  assert.equal(secondsPerArrow(500, true), MIN_SECONDS)
  const g = createGame(10)
  assert.equal(timeLimit(g), 0)
  assert.equal(timeLimit(g, true), Math.ceil(g.arrows.length * secondsPerArrow(10, true)))
  const big = createGame(25)
  assert.equal(timeLimit(big), Math.ceil(big.arrows.length * secondsPerArrow(25)))
})

test('화살 하나를 빼면 화살 하나 몫 시간의 10% 를 더 받는다 (1초면 0.1초)', () => {
  assert.equal(TIME_BONUS, 0.1)
  assert.equal(bonusSeconds(5), 0, '시계 없는 단계는 없음')
  assert.ok(Math.abs(bonusSeconds(TIMER_FROM.normal) - 0.2) < 1e-9)
  assert.ok(Math.abs(bonusSeconds(500) - 0.05) < 1e-9, '0.5초면 0.05초')
  for (const n of [1, 10, 30]) assert.ok(Math.abs(bonusSeconds(n, true) - secondsPerArrow(n, true) / 10) < 1e-9)
})

test('시간이 다 되면 끝', () => {
  const game = createGame(10)
  assert.equal(expire(game), true)
  assert.equal(game.over, true)
  assert.equal(game.timeUp, true)
  assert.equal(tap(game, freeArrows(game)[0]), null, '시간이 다 된 판은 더 못 누른다')
  assert.equal(expire(game), false, '이미 끝난 판')
  assert.equal(restart(game).timeUp, false)
})

test('풀이 순서대로 누르면 하트를 잃지 않고 통과한다', () => {
  for (const level of [1, 5, 16, 40]) {
    const game = createGame(level)
    for (const i of solveOrder(game.rows, game.cols, game.arrows)) {
      const res = tap(game, i)
      assert.equal(res.ok, true)
    }
    assert.equal(game.won, true)
    assert.equal(game.hearts, game.maxHearts)
    assert.equal(game.left, 0)
    assert.equal(tap(game, 0), null, '끝난 판은 더 못 누른다')
  }
})

test('막힌 화살을 누르면 하트를 잃고 그대로 남는다, 세 번이면 끝', () => {
  const game = createGame(16)
  const stuck = game.arrows.findIndex((_, i) => blocker(game, i))
  const block = blocker(game, stuck)
  const res = tap(game, stuck)
  assert.deepEqual(res, { ok: false, ...block })
  assert.equal(game.gone[stuck], false)
  assert.equal(game.hearts, HEARTS - 1)
  // 막은 화살은 머리 앞 줄에 있다
  const ray = rayOf(game.rows, game.cols, game.arrows[stuck])
  const [r, c] = ray[res.steps - 1]
  assert.equal(arrowAt(game, r, c), res.by)
  tap(game, stuck)
  assert.equal(game.over, false)
  tap(game, stuck)
  assert.equal(game.over, true)
  assert.equal(tap(game, freeArrows(game)[0]), null, '끝난 판은 더 못 누른다')
  // 처음부터: 같은 판, 하트는 다시 셋
  const again = restart(game)
  assert.deepEqual(again.arrows, game.arrows)
  assert.equal(again.hearts, HEARTS)
  assert.equal(again.left, again.arrows.length)
})

test('빠진 화살 자리는 비고, 그 뒤에 막혀 있던 화살이 풀린다', () => {
  const game = createGame(20)
  const stuck = game.arrows.findIndex((_, i) => blocker(game, i) && !blocker(game, blocker(game, i).by))
  assert.ok(stuck >= 0, '앞 화살 하나만 빼면 풀리는 화살이 있어야 한다')
  const { by } = blocker(game, stuck)
  assert.equal(tap(game, by).ok, true)
  for (const [r, c] of game.arrows[by].cells) assert.equal(arrowAt(game, r, c), -1)
  // 앞을 막던 화살이 빠졌으니 그 자리는 비었다 (다른 화살이 더 앞에 있을 수는 있다)
  assert.notEqual(blocker(game, stuck)?.by, by)
})

test('힌트는 단계마다 한 번, 지금 뺄 수 있는 화살을 알려 준다', () => {
  const game = createGame(12)
  const i = useHint(game)
  assert.ok(freeArrows(game).includes(i))
  assert.equal(game.hints, HINTS - 1)
  assert.equal(useHint(game), -1)
})

test('저장한 판을 되살린다, 맞지 않는 값은 버린다', () => {
  const game = createGame(9)
  const order = solveOrder(game.rows, game.cols, game.arrows)
  tap(game, order[0])
  tap(game, order[1])
  const stuck = game.arrows.findIndex((_, i) => !game.gone[i] && blocker(game, i))
  tap(game, stuck)
  const back = restore(JSON.parse(JSON.stringify(snapshot(game))))
  assert.deepEqual(back.gone, game.gone)
  assert.deepEqual([...back.owner], [...game.owner])
  assert.equal(back.left, game.left)
  assert.equal(back.hearts, HEARTS - 1)
  assert.equal(back.mistakes, 1)

  const good = snapshot(game)
  assert.equal(restore(null), null)
  assert.equal(restore({ ...good, level: 0 }), null)
  assert.equal(restore({ ...good, hearts: 0 }), null)
  assert.equal(restore({ ...good, hints: 5 }), null)
  assert.equal(restore({ ...good, gone: [order[0], order[0]] }), null)
  assert.equal(restore({ ...good, gone: [999] }), null)
  assert.equal(restore({ ...good, gone: game.arrows.map((_, i) => i) }), null, '다 뺀 판은 되살리지 않는다')
})
