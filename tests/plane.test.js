// 봄날 종이비행기 규칙 검사 - 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  W, H, COL, PLANE, PLANE_X, PASS_MIN, SQUEEZE_GAP, createGame, start, step, wallAt, crashed, meters, gapAt, speedAt,
  stoneHits,
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

// x 에서 벽과 종유석(밑동 폭 전체를 네모로 넉넉히 잡아) 사이에 남는 가장 큰 빈칸 { lo, hi }
function freeAt(g, x, stones) {
  const w = wallAt(g, x)
  const cuts = stones
    .filter((p) => x >= p.x && x <= p.x + p.w)
    .map((p) => (p.hang === 'top' ? [-Infinity, p.bottom] : [p.top, Infinity]))
  let best = { lo: w.top, hi: w.top }
  let lo = w.top
  for (const [a, b] of [...cuts, [w.bottom, Infinity]].sort((m, n) => m[0] - n[0])) {
    if (a - lo > best.hi - best.lo) best = { lo, hi: a }
    lo = Math.max(lo, b)
  }
  return best
}

// 가장 큰 빈칸 가운데를 따라가는 자동 조종 - 동굴이 실제로 지나갈 수 있는지 본다
function autopilot(g) {
  const ahead = g.dist + PLANE_X + 30
  const w = wallAt(g, ahead)
  let target = (w.top + w.bottom) / 2
  const near = g.pillars.filter((p) => p.x + p.w >= g.dist + PLANE_X - 20 && p.x <= ahead + 160)
  if (near.length) {
    const p = near[0]
    const f = freeAt(g, p.x + p.w / 2, near)
    target = (f.lo + f.hi) / 2
  }
  return { hold: g.y + g.vy * 0.25 > target }
}

test('종유석은 밑동에서 끝으로 가늘어지는 삼각형으로 부딪힌다', () => {
  // 천장이 왼쪽 50, 오른쪽 70 에 붙은 종유석, 끝은 150
  const hang = { x: 100, w: 40, hang: 'top', baseL: 50, baseR: 70, tip: 150, top: 50, bottom: 150 }
  assert.ok(stoneHits(hang, 120, 149)) // 가운데는 끝까지
  assert.equal(stoneHits(hang, 102, 140), false) // 가장자리 아래쪽은 비어 있다
  assert.ok(stoneHits(hang, 102, 55)) // 왼쪽 밑동 (50 에서 시작)
  assert.equal(stoneHits(hang, 138, 80), false) // 오른쪽 밑동은 70 에서 시작해 여기서는 78 까지만 내려온다
  assert.ok(stoneHits(hang, 138, 76))
  assert.ok(stoneHits(hang, 102, 20)) // 밑동 위(벽 쪽)는 막혀 있다
  assert.equal(stoneHits(hang, 99, 60), false) // 폭 밖
  const rise = { x: 100, w: 40, hang: 'bottom', baseL: 420, baseR: 420, tip: 300, top: 300, bottom: 420 }
  assert.ok(stoneHits(rise, 120, 301))
  assert.equal(stoneHits(rise, 104, 310), false)
})

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
      assert.ok(c.bottom - c.top >= SQUEEZE_GAP - 0.01 && c.top >= 0 && c.bottom <= H)
      // 종유석이 비행기 옆에 왔을 때(그 둘레 벽이 다 만들어진 뒤) 틈을 잰다
      for (const p of g.pillars) {
        if (checked.has(p) || p.x > g.dist + PLANE_X) continue
        checked.add(p)
        // 종유석 폭 전체에서 가장 좁은 틈을 본다 (위아래 한 쌍이면 두 끝 사이)
        let room = Infinity
        for (let x = p.x; x <= p.x + p.w; x += 2) {
          const f = freeAt(g, x, g.pillars)
          room = Math.min(room, f.hi - f.lo)
        }
        assert.ok(room >= PASS_MIN - 0.01, `종유석 옆 틈 ${room}`)
      }
    }
    assert.ok(checked.size > 5, `종유석 ${checked.size}개`)
  }
})

test('굴 높이가 넓어졌다 좁아졌다 하고, 1~2분에 한 번 비행기 길이 3배까지 좁아지는 굴을 지나갈 수 있다', () => {
  assert.equal(SQUEEZE_GAP, PLANE.len * 3)
  for (const seed of [21, 22, 23]) {
    const g = createGame(seeded(seed))
    start(g)
    const narrow = [] // 가장 좁은 곳을 지난 시각 (초)
    let t = 0
    let wasNarrow = false
    let wide = 0
    let tight = Infinity
    for (let i = 0; i < 120 * 260 && g.phase === 'playing' && narrow.length < 2; i++) {
      step(g, DT, autopilot(g))
      t += DT
      const w = wallAt(g, g.dist + PLANE_X)
      const gap = w.bottom - w.top
      const now = gap < SQUEEZE_GAP + 1
      if (now && !wasNarrow) narrow.push(t)
      wasNarrow = now
      if (t > 25) {
        wide = Math.max(wide, gap)
        if (!now) tight = Math.min(tight, gap)
      }
    }
    assert.equal(g.phase, 'playing', `seed ${seed}: ${meters(g)}m 에서 부딪힘`)
    assert.equal(narrow.length, 2, `seed ${seed}: 좁은 굴 ${narrow.length}번`)
    assert.ok(narrow[0] > 50 && narrow[0] < 130, `첫 좁은 굴 ${narrow[0]}초`)
    assert.ok(narrow[1] - narrow[0] > 55 && narrow[1] - narrow[0] < 130, `사이 ${narrow[1] - narrow[0]}초`)
    // 빨라진 뒤(25초 뒤)에도 굴 높이가 한 가지가 아니다
    assert.ok(wide - tight > 50, `넓을 때 ${wide}, 좁을 때 ${tight}`)
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
