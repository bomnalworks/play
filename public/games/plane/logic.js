// 봄날 종이비행기 - 규칙만. DOM 이 없다 (테스트가 화면 없이 이 파일만 불러 돌린다)
//
// 누르고 있으면 오르고, 떼면 내려간다. 구불구불한 동굴 벽과 기둥에 닿지 않고 멀리 날면 이긴다.
// 좌표는 논리 크기 W×H 기준. 비행기는 화면 왼쪽 PLANE_X 에 머물고 동굴이 왼쪽으로 흐른다.

export const W = 360
export const H = 480
export const COL = 12 // 동굴 벽을 이 폭마다 한 점씩 만든다
export const PLANE_X = 90
export const PLANE = { len: 22, half: 6 } // 비행기 몸통 길이와 날개 반폭 (판정용)

const GRAV = 640 // 손을 떼면 아래로 (단위/초²)
const LIFT = 1320 // 누르고 있으면 위로 (중력을 이기고 남는 만큼 오른다)
const VY_MAX = 260
const SPEED_START = 130 // 동굴이 흐르는 빠르기 (단위/초)
const SPEED_MAX = 260
const SPEED_GAIN = 0.035 // 날아간 거리 1 마다 빨라지는 양
const GAP_START = 300 // 동굴 위아래 벽 사이
const GAP_MIN = 140
const GAP_SHRINK = 0.045 // 거리 1 마다 좁아지는 양
const EDGE = 16 // 벽이 화면 끝에 붙지 않게 남기는 두께
const PILLAR_FROM = 600 // 이 거리부터 기둥이 나온다
const PILLAR_W = 26
export const PASS_MIN = 78 // 기둥 옆으로 반드시 남기는 틈 (비행기가 지나갈 수 있게)
const METER = 10 // 거리 10 = 1m

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const gapAt = (dist) => Math.max(GAP_MIN, GAP_START - dist * GAP_SHRINK)
export const speedAt = (dist) => Math.min(SPEED_MAX, SPEED_START + dist * SPEED_GAIN)
export const meters = (g) => Math.floor(g.dist / METER)

/* ---------- 동굴 만들기 ---------- */

function addColumn(g) {
  const last = g.cols[g.cols.length - 1]
  const x = last ? last.x + COL : 0
  const gap = gapAt(x)
  // 가운데 줄이 천천히 굽이친다. 기울기를 조금씩 바꾸고, 끝에 닿으면 되돌린다
  // 빨라질수록 굽이를 완만하게 - 벽이 오르내리는 빠르기가 비행기가 오르내릴 수 있는 빠르기(VY_MAX)의 절반을 넘지 않게.
  // 화면 끝에 닿아 굽이가 한 번에 뒤집혀도, 그 반만큼(130/초)을 되돌리는 데 드는 거리(약 25)가
  // 가장 좁은 굴(GAP_MIN 140)에서 비행기 위아래로 남는 틈(약 59)보다 작아 따라갈 수 있다.
  const steepest = (0.5 * VY_MAX) / speedAt(x)
  g.slope += (g.rng() - 0.5) * 0.3
  g.slope = clamp(g.slope, -steepest, steepest) * 0.97
  let mid = (last ? (last.top + last.bottom) / 2 : H / 2) + g.slope * COL
  const lo = EDGE + gap / 2
  const hi = H - EDGE - gap / 2
  if (mid < lo) { mid = lo; g.slope = Math.abs(g.slope) }
  if (mid > hi) { mid = hi; g.slope = -Math.abs(g.slope) }
  g.cols.push({ x, top: mid - gap / 2, bottom: mid + gap / 2 })
}

// x0~x1 사이에서 벽이 가장 안쪽으로 들어온 높이 (굽은 곳에서는 한 점만 보면 틈을 넉넉하게 잘못 본다)
// 벽은 점과 점을 곧게 이은 꺾은선이라, 양 끝과 그 사이의 꺾이는 점만 보면 된다
function narrowest(g, x0, x1) {
  const ends = [wallAt(g, x0), wallAt(g, x1), ...g.cols.filter((c) => c.x > x0 && c.x < x1)]
  return { top: Math.max(...ends.map((w) => w.top)), bottom: Math.min(...ends.map((w) => w.bottom)) }
}

function addPillar(g, x) {
  // 기둥 폭에 비행기 길이만큼 앞뒤를 더한 구간 - 비행기가 기둥 옆을 지나는 동안 벽이 가장 좁아지는 곳 기준
  const col = narrowest(g, x - PLANE.len, x + PILLAR_W + PLANE.len)
  const gap = col.bottom - col.top
  const h = Math.min(gap - PASS_MIN, gap * (0.3 + g.rng() * 0.25))
  if (h < 24) return // 너무 좁은 곳에는 세우지 않는다
  // 위에 매달리거나, 아래에서 솟거나, 가운데 떠 있다. 기둥 말고 남는 틈(room)은 늘 PASS_MIN 이상이다
  const room = gap - h
  const kind = g.rng()
  let top
  if (kind < 0.4) top = col.top // 위에 매달림 - 아래로 room 만큼 빈다
  else if (kind < 0.8 || room / 2 < PASS_MIN) top = col.bottom - h // 아래서 솟음 (가운데로 띄울 틈이 모자랄 때도)
  else top = col.top + room / 2 // 가운데 - 위아래로 room/2 씩 빈다
  g.pillars.push({ x, w: PILLAR_W, top, bottom: top + h })
}

/** 세계 좌표 x 에서 위아래 벽 높이 (두 점 사이는 곧게 잇는다) */
export function wallAt(g, x) {
  const first = g.cols[0]
  const i = clamp(Math.floor((x - first.x) / COL), 0, g.cols.length - 2)
  const a = g.cols[i]
  const b = g.cols[i + 1]
  const t = clamp((x - a.x) / COL, 0, 1)
  return { top: a.top + (b.top - a.top) * t, bottom: a.bottom + (b.bottom - a.bottom) * t }
}

const lastX = (g) => g.cols[g.cols.length - 1].x

// 화면 오른쪽 끝 너머까지 미리 만들고, 왼쪽으로 지나간 것은 버린다
function extend(g) {
  const ahead = g.dist + W + COL * 2
  while (lastX(g) < ahead) addColumn(g)
  while (g.nextPillar < ahead - PILLAR_W) {
    if (g.nextPillar >= PILLAR_FROM) {
      // 기둥 옆 틈을 재는 구간(기둥 뒤 비행기 길이까지) 끝까지 벽을 먼저 만든다 - 아직 없는 벽을 재면 틈을 잘못 본다
      while (lastX(g) < g.nextPillar + PILLAR_W + PLANE.len + COL) addColumn(g)
      addPillar(g, g.nextPillar)
    }
    g.nextPillar += 230 + g.rng() * 200
  }
  const behind = g.dist - COL * 3
  while (g.cols.length > 2 && g.cols[1].x < behind) g.cols.shift()
  while (g.pillars.length && g.pillars[0].x + g.pillars[0].w < behind) g.pillars.shift()
}

/* ---------- 한 판 ---------- */

export function createGame(rng = Math.random) {
  const g = {
    rng,
    phase: 'ready', // ready → playing → over
    dist: 0,
    y: H / 2, // 비행기 높이 (가운데)
    vy: 0,
    tilt: 0, // 그릴 때 기울기
    cols: [],
    pillars: [],
    slope: 0,
    nextPillar: PILLAR_FROM,
  }
  // 처음 화면은 곧은 굴로 시작해 바로 부딪히지 않게 한다
  for (let x = 0; x <= W + COL * 2; x += COL) g.cols.push({ x, top: H / 2 - GAP_START / 2, bottom: H / 2 + GAP_START / 2 })
  extend(g)
  return g
}

export function start(g) {
  if (g.phase === 'ready') g.phase = 'playing'
}

// 판정점: 코·꼬리 위·꼬리 아래 (세계 좌표)
function hitPoints(g) {
  const nose = g.dist + PLANE_X + PLANE.len / 2
  const tail = g.dist + PLANE_X - PLANE.len / 2
  const dy = g.tilt * PLANE.len / 2
  return [
    [nose, g.y + dy],
    [tail, g.y - dy - PLANE.half],
    [tail, g.y - dy + PLANE.half],
  ]
}

export function crashed(g) {
  for (const [x, y] of hitPoints(g)) {
    const w = wallAt(g, x) // 벽은 화면 끝에서 EDGE 만큼 안쪽이라 화면 밖으로 나가기 전에 벽에 닿는다
    if (y <= w.top || y >= w.bottom) return true
    for (const p of g.pillars) if (x >= p.x && x <= p.x + p.w && y >= p.top && y <= p.bottom) return true
  }
  return false
}

/** dt 초만큼 움직인다. input.hold: 누르고 있는지. 부딪히면 phase 가 'over' 가 된다 */
export function step(g, dt, input) {
  if (g.phase !== 'playing') return
  g.vy = clamp(g.vy + (input.hold ? GRAV - LIFT : GRAV) * dt, -VY_MAX, VY_MAX)
  g.y += g.vy * dt
  g.dist += speedAt(g.dist) * dt
  g.tilt = (g.vy / VY_MAX) * 0.5
  extend(g)
  if (crashed(g)) g.phase = 'over'
}
