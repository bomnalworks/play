// 봄날 종이비행기 규칙 검사 - 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  W, H, COL, PLANE_X, PASS_MIN, createGame, start, step, wallAt, crashed, meters, gapAt, speedAt,
} from '../public/games/plane/logic.js'

function seeded(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
const DT = 1 / 120

test('시작 전에는 움직이지 않는다', () => {
  const g = createGame(seeded(1))
  step(g, 1, { hold: false })
  assert.equal(g.phase, 'ready')
  assert.equal(g.dist, 0)
})

test('누르고 있으면 오르고, 떼면 내려간다', () => {
  const up = createGame(seeded(1))
  start(up)
  for (let i = 0; i < 30; i++) step(up, DT, { hold: true })
  assert.ok(up.y < H / 2, '누르면 위로')
  const down = createGame(seeded(1))
  start(down)
  for (let i = 0; i < 30; i++) step(down, DT, { hold: false })
  assert.ok(down.y > H / 2, '떼면 아래로')
})

test('손을 놓고 있으면 바닥에 부딪혀 끝난다', () => {
  const g = createGame(seeded(2))
  start(g)
  for (let i = 0; i < 120 * 5 && g.phase === 'playing'; i++) step(g, DT, { hold: false })
  assert.equal(g.phase, 'over')
  assert.ok(crashed(g))
})

test('처음 화면은 곧은 굴이라 바로 부딪히지 않는다', () => {
  const g = createGame(seeded(3))
  const w = wallAt(g, PLANE_X)
  assert.ok(g.y > w.top + 40 && g.y < w.bottom - 40)
  assert.equal(crashed(g), false)
})

// 벽 사이 가운데를 따라가는 자동 조종 - 동굴이 실제로 지나갈 수 있는지 본다
function autopilot(g) {
  const ahead = g.dist + PLANE_X + 30
  const w = wallAt(g, ahead)
  let target = (w.top + w.bottom) / 2
  for (const p of g.pillars) {
    if (p.x + p.w < g.dist + PLANE_X - 20 || p.x > ahead + 160) continue
    const ww = wallAt(g, p.x)
    const above = p.top - ww.top
    const below = ww.bottom - p.bottom
    target = above > below ? (ww.top + p.top) / 2 : (p.bottom + ww.bottom) / 2
  }
  return { hold: g.y + g.vy * 0.25 > target }
}

test('멀리 갈수록 굴이 좁아지고 빨라지지만, 벽 사이와 기둥 옆에는 늘 지나갈 틈이 남는다', () => {
  assert.ok(gapAt(5000) < gapAt(0))
  assert.ok(speedAt(5000) > speedAt(0))
  for (const seed of [1, 2, 3]) {
    const g = createGame(seeded(seed))
    start(g)
    const checked = new Set()
    for (let i = 0; i < 120 * 120 && g.phase === 'playing'; i++) {
      step(g, DT, autopilot(g))
      const c = g.cols[g.cols.length - 1]
      assert.ok(c.bottom - c.top >= gapAt(Infinity) - 0.01 && c.top >= 0 && c.bottom <= H)
      // 기둥이 비행기 옆에 왔을 때(그 둘레 벽이 다 만들어진 뒤) 틈을 잰다
      for (const p of g.pillars) {
        if (checked.has(p) || p.x > g.dist + PLANE_X) continue
        checked.add(p)
        // 기둥 폭 전체에서 가장 좁은 틈을 본다
        let room = Infinity
        for (let x = p.x; x <= p.x + p.w; x += 2) {
          const w = wallAt(g, x)
          room = Math.min(room, Math.max(p.top - w.top, w.bottom - p.bottom))
        }
        assert.ok(room >= PASS_MIN - 0.01, `기둥 옆 틈 ${room}`)
      }
    }
    assert.ok(checked.size > 5, `기둥 ${checked.size}개`)
  }
})

test('자동 조종으로 3000m 넘게 날 수 있다 (판마다 지나갈 수 있는 동굴이다)', () => {
  for (const seed of [11, 12, 13]) {
    const g = createGame(seeded(seed))
    start(g)
    for (let i = 0; i < 120 * 200 && g.phase === 'playing' && meters(g) < 3000; i++) step(g, DT, autopilot(g))
    assert.ok(meters(g) >= 3000, `seed ${seed}: ${meters(g)}m 에서 부딪힘`)
  }
})

test('지나간 벽·기둥은 버려 메모리가 쌓이지 않는다', () => {
  const g = createGame(seeded(5))
  start(g)
  for (let i = 0; i < 120 * 60 && g.phase === 'playing'; i++) step(g, DT, autopilot(g))
  assert.ok(g.cols.length < (W / COL) + 10, `벽 점 ${g.cols.length}개`)
  assert.ok(g.pillars.length < 6)
})
