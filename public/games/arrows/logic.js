// 봄날 화살 퍼즐 - 규칙만. DOM 이 없다 (테스트가 화면 없이 이 파일만 불러 돌린다)
//
// 판에 화살이 엉켜 있다. 화살을 누르면 머리가 가리키는 쪽으로 몸통째 미끄러져 판 밖으로 빠진다.
// 머리 앞(판 끝까지 곧게)에 다른 화살이 하나라도 있으면 부딪혀 제자리로 돌아오고, 하트를 하나 잃는다.
// 화살을 다 빼면 다음 단계. 하트를 다 잃으면 같은 단계를 처음부터.
//
// 화살 하나는 { cells: [[줄, 칸]…] 꼬리 → 머리 순, dir: 머리 방향 } 이다. dir 은 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽이고,
// 마지막 두 칸이 이어지는 방향과 같다 (머리 앞으로 곧게 나간다). 한 칸짜리 화살도 있다.
//
// 화살을 빼면 자리가 비기만 하므로, 지금 빠질 수 있는 화살은 나중에도 빠질 수 있다.
// 그래서 "빠질 수 있는 것부터 아무거나 뺀다"를 되풀이해 다 빠지면 풀리는 판이다 (solveOrder).
// 단계마다 판은 정해져 있다 - 같은 단계는 누구에게나 같은 판이다 (단계 번호로 난수를 시작한다).

export const HEARTS = 3 // 한 단계에서 부딪혀도 되는 횟수 (30단계부터 2, 60단계부터 1 - levelSpec)
export const HINTS = 1 // 한 단계에서 쓸 수 있는 힌트 (40단계부터 0)
// 시간 제한. 전문가는 1단계부터, 보통은 판이 더 커지지 않는 21단계부터 시계가 돈다.
// 시계가 붙는 첫 단계에서 화살 하나에 2초, 한 단계마다 TIME_DROP 만큼 줄고(3%면 23단계 뒤 1초), 0.5초에서 멈춘다.
// 화살을 하나 뺄 때마다 '화살 하나 몫 시간'의 TIME_BONUS 만큼을 더 받는다 (1초면 0.1초, 0.9초면 0.09초)
export const TIMER_FROM = { normal: 21, expert: 1 } // 모드별로 시계가 붙는 단계
export const START_SECONDS = 2
export const TIME_DROP = 0.03 // 한 단계마다 줄어드는 몫 - 2% 로 늦추려면 0.02
export const MIN_SECONDS = 0.5
export const TIME_BONUS = 0.1 // 화살 하나를 빼면 더 받는 몫
export const DR = [-1, 0, 1, 0]
export const DC = [0, 1, 0, -1]
export const MAX_LEVEL = 9999

export const MAX_COLS = 15
export const MAX_ROWS = 20
export const SHAPE_FROM = 6 // 이 단계부터 짝수 단계는 모양 판

/* ---------- 모양 판 ---------- */
// 판 칸 중 모양 안의 칸에만 화살을 놓는다. 모양 밖은 빈칸이라 화살이 그 위를 지나 판 밖으로 나간다
// (도넛 구멍·하트 골짜기 너머까지 따라가 봐야 해서 더 헷갈린다).
// 모양은 판 가운데를 (0, 0) 으로, 가로 끝을 ±1 로 잰 좌표의 수식이다 (세로는 ±1.34 쯤). 판 크기가 달라도 같은 모양이 나온다.
// 사칙연산만 쓴다 - cos·sin·hypot 은 브라우저마다 끝자리가 다를 수 있어, 경계 칸 하나 차이로 "같은 단계는 같은 판"이 깨진다

function inPoly(pts, x, y) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
// 별 꼭짓점 10개 (바깥 반지름 1.1, 안쪽 0.56, 세로 1.15배, 0.1 아래로) - 미리 계산해 숫자로 적어 둔다
const STAR = [
  [0, -1.165], [0.3292, -0.421], [1.0462, -0.2909], [0.5326, 0.299], [0.6466, 1.1234],
  [0, 0.744], [-0.6466, 1.1234], [-0.5326, 0.299], [-1.0462, -0.2909], [-0.3292, -0.421],
]
// 가운데 (cx, cy) 에서 세로를 1.3 배 늘린 원 기준 거리의 제곱
const dist2 = (x, y, cx = 0, cy = 0) => (x - cx) * (x - cx) + ((y - cy) / 1.3) * ((y - cy) / 1.3)
// 트리 한 층: top 에서 bottom 까지 아래로 넓어지는 세모
const tier = (x, y, top, bottom, half) => y >= top && y <= bottom && Math.abs(x) <= (half * (y - top)) / (bottom - top) + 0.08

export const SHAPES = [
  {
    key: 'heart', name: '하트',
    inside: (x, y) => {
      const X = x * 1.12
      const Y = 0.18 - y
      const q = X * X + Y * Y - 1
      return q * q * q - X * X * Y * Y * Y <= 0
    },
  },
  {
    key: 'tree', name: '트리',
    inside: (x, y) => tier(x, y, -1.3, -0.45, 0.6) || tier(x, y, -0.8, 0.2, 0.85) || tier(x, y, -0.3, 0.9, 1.05) || (Math.abs(x) <= 0.22 && y >= 0.85 && y <= 1.3),
  },
  { key: 'star', name: '별', inside: (x, y) => inPoly(STAR, x, y) },
  {
    key: 'ring', name: '도넛',
    inside: (x, y) => dist2(x, y) <= 1.04 * 1.04 && dist2(x, y) >= 0.45 * 0.45,
  },
  {
    key: 'house', name: '집',
    inside: (x, y) => {
      const roof = y >= -1.3 && y <= -0.25 && Math.abs(x) <= y + 1.3
      const body = Math.abs(x) <= 0.82 && y >= -0.25 && y <= 1.3
      const door = Math.abs(x) <= 0.22 && y >= 0.55
      return (roof || body) && !door
    },
  },
  { key: 'moon', name: '달', inside: (x, y) => dist2(x, y) <= 1.04 * 1.04 && dist2(x, y, 0.55, -0.2) > 0.8 * 0.8 },
  { key: 'diamond', name: '다이아', inside: (x, y) => Math.abs(x) + Math.abs(y) / 1.32 <= 1.04 },
]

/** 이 단계가 모양 판이면 그 모양, 아니면 null. 6단계부터 짝수 단계마다 하트 → 트리 → 별 → 도넛 → 집 → 달 → 다이아 */
export function shapeOf(level) {
  if (level < SHAPE_FROM || level % 2) return null
  return SHAPES[((level - SHAPE_FROM) / 2) % SHAPES.length]
}

/** 칸마다 화살을 놓을 수 있는지 (1 모양 안, 0 밖). 모양이 없으면 판 전체 */
export function maskOf(rows, cols, shape) {
  const mask = new Uint8Array(rows * cols).fill(1)
  if (!shape) return mask
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      mask[r * cols + c] = shape.inside((c + 0.5 - cols / 2) / (cols / 2), (r + 0.5 - rows / 2) / (cols / 2)) ? 1 : 0
    }
  }
  return mask
}

/**
 * 단계별 판 크기와 화살 길이. 5×7 에서 시작해 두 단계마다 한 칸씩 넓어지고, 21단계부터 15×20 판이다.
 * 판이 커지면 칸이 작아지니 화면에서 두 손가락으로 키워 본다 (ui.js).
 * 판이 더 커지지 않는 뒤로는 계단식으로 어려워진다:
 * 25 색 4가지 · 30 하트 2 · 35 색 2가지 · 40 힌트 없음 · 50 한 색 · 60 하트 1, 그리고 판을 더 많이 만들어 보고 가장 어려운 것을 고른다
 */
export function levelSpec(level) {
  const n = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)))
  const shape = shapeOf(n)
  // 모양 판은 칸의 절반 남짓만 쓰니 판을 두 칸 넓힌다 (작은 판에서는 모양이 뭉개진다)
  const cols = Math.min(MAX_COLS, 5 + Math.floor((n - 1) / 2) + (shape ? 2 : 0))
  const rows = Math.min(MAX_ROWS, Math.round(cols * 1.34))
  return {
    rows,
    cols,
    shape,
    maxLen: Math.min(20, 6 + Math.floor(n / 2)), // 화살 하나의 가장 긴 길이(칸)
    seg: 2, // 곧게 가는 구간의 가장 긴 길이(칸) - 이만큼 가면 꺾는다
    tangle: Math.min(0.97, 0.6 + n * 0.03), // 막는 자리를 골라 놓으려는 몫 - 클수록 순서가 길게 얽힌다
    tries: n <= 2 ? 2 : Math.min(10, 6 + Math.max(0, Math.floor((n - 21) / 5))), // 판을 이만큼 만들어 보고 가장 어려운 것을 낸다
    hearts: n >= 60 ? 1 : n >= 30 ? 2 : HEARTS,
    hints: n >= 40 ? 0 : HINTS,
    colors: n >= 50 ? 1 : n >= 35 ? 2 : n >= 25 ? 4 : 7, // 화살 색 가짓수 - 적을수록 엉킨 화살을 눈으로 가르기 어렵다
    seed: (Math.imul(n, 2654435761) ^ 0x5bd1e995) >>> 0,
  }
}

// 같은 seed 면 어느 브라우저에서나 같은 순서로 나오는 난수 (mulberry32)
function makeRand(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

export const headOf = (arrow) => arrow.cells[arrow.cells.length - 1]

/** (r, c) 가 rows×cols 판 안인가 */
export const inBoard = (rows, cols, r, c) => r >= 0 && c >= 0 && r < rows && c < cols

/** 머리 앞 칸들 (판 끝까지, 가까운 것부터) */
export function rayOf(rows, cols, arrow) {
  const [hr, hc] = headOf(arrow)
  const out = []
  for (let r = hr + DR[arrow.dir], c = hc + DC[arrow.dir]; inBoard(rows, cols, r, c); r += DR[arrow.dir], c += DC[arrow.dir]) out.push([r, c])
  return out
}

/** 판 칸마다 그 칸을 차지한 화살 번호 (-1 빈칸) */
function ownerOf(rows, cols, arrows, gone = null) {
  const owner = new Int16Array(rows * cols).fill(-1)
  arrows.forEach((a, i) => {
    if (!gone?.[i]) for (const [r, c] of a.cells) owner[r * cols + c] = i
  })
  return owner
}

// 머리 앞을 처음 막는 것 { steps: 몇 칸 앞, by: 화살 번호 }. 막힌 데가 없으면 null. 제 몸통도 막는 것으로 친다
function firstBlock(rows, cols, owner, arrow) {
  const [hr, hc] = headOf(arrow)
  let steps = 0
  for (let r = hr + DR[arrow.dir], c = hc + DC[arrow.dir]; inBoard(rows, cols, r, c); r += DR[arrow.dir], c += DC[arrow.dir]) {
    steps += 1
    const by = owner[r * cols + c]
    if (by >= 0) return { steps, by } // -1 빈칸, -2 모양 밖 (둘 다 지나간다)
  }
  return null
}

/** 다 빼낼 수 있는 순서 (화살 번호 목록). 못 빼는 화살이 남으면 null */
export function solveOrder(rows, cols, arrows) {
  const owner = ownerOf(rows, cols, arrows)
  let left = arrows.map((_, i) => i)
  const order = []
  while (left.length) {
    const stuck = []
    for (const i of left) {
      if (firstBlock(rows, cols, owner, arrows[i])) stuck.push(i)
      else {
        for (const [r, c] of arrows[i].cells) owner[r * cols + c] = -1
        order.push(i)
      }
    }
    if (stuck.length === left.length) return null
    left = stuck
  }
  return order
}

/* ---------- 판 만들기 ---------- */

// start 칸에서 빈칸을 따라 want 칸까지 걷는다. 곧게 1~seg 칸 가면 옆으로 꺾는다 (옆이 막혔으면 곧게 더 간다).
// 꺾은 뒤 구간은 2칸 이상이라 계단처럼 자잘하게 꺾이지 않고 ㄱ·ㄴ·ㄷ 모양이 또렷하다
function walk(rows, cols, owner, start, want, seg, rand) {
  const path = [start]
  const used = new Set(path)
  let dir = Math.floor(rand() * 4)
  let run = 1 + Math.floor(rand() * seg) // 꺾기 전까지 곧게 갈 칸 수
  while (path.length < want) {
    const cur = path[path.length - 1]
    const r = Math.floor(cur / cols)
    const c = cur % cols
    // 꺾을 때는 빈 이웃이 적은 쪽(벽·다른 화살 쪽)으로 - 빈 곳을 잘게 쪼개지 않아 뒤에 놓는 화살도 길어진다
    const roomAt = (d) => {
      const nr = r + DR[d]
      const nc = c + DC[d]
      let n = 0
      for (let k = 0; k < 4; k++) {
        const rr = nr + DR[k]
        const cc = nc + DC[k]
        if (inBoard(rows, cols, rr, cc) && owner[rr * cols + cc] === -1 && !used.has(rr * cols + cc)) n += 1
      }
      return n + rand() * 1.5
    }
    const side = [(dir + 1) % 4, (dir + 3) % 4].map((d) => [roomAt(d), d]).sort((x, y) => x[0] - y[0]).map(([, d]) => d)
    const tries = run > 0 ? [dir, ...side] : [...side, dir]
    let moved = false
    for (const d of tries) {
      const nr = r + DR[d]
      const nc = c + DC[d]
      const next = nr * cols + nc
      if (!inBoard(rows, cols, nr, nc) || owner[next] !== -1 || used.has(next)) continue
      path.push(next)
      used.add(next)
      if (d === dir) run -= 1
      else run = 1 + Math.floor(rand() * (seg - 1))
      dir = d
      moved = true
      break
    }
    if (!moved) break
  }
  return path
}

/** 화살이 꺾이는 횟수 */
export function bendsOf(arrow) {
  let n = 0
  for (let k = 2; k < arrow.cells.length; k++) {
    const [r0, c0] = arrow.cells[k - 2]
    const [r1, c1] = arrow.cells[k - 1]
    const [r2, c2] = arrow.cells[k]
    if (r1 - r0 !== r2 - r1 || c1 - c0 !== c2 - c1) n += 1
  }
  return n
}

// 걸은 길로 만들 수 있는 화살 후보 - 앞뒤 두 방향 (한 칸이면 네 방향)
function candidates(path, cols) {
  const cells = path.map((i) => [Math.floor(i / cols), i % cols])
  if (cells.length === 1) return [0, 1, 2, 3].map((dir) => ({ cells, dir }))
  return [cells, cells.slice().reverse()].map((cs) => {
    const [r1, c1] = cs[cs.length - 2]
    const [r2, c2] = cs[cs.length - 1]
    return { cells: cs, dir: DR.findIndex((dr, d) => dr === r2 - r1 && DC[d] === c2 - c1) }
  })
}

function build(spec, mask, rand) {
  const { rows, cols, maxLen, seg, tangle } = spec
  const minLen = Math.max(3, Math.floor(maxLen / 3)) // 막히지 않으면 이만큼은 길게 걷는다
  const owner = new Int16Array(rows * cols).fill(-1)
  for (let i = 0; i < owner.length; i++) if (!mask[i]) owner[i] = -2 // 모양 밖 - 화살을 놓지 않는다 (걷기·시작 칸에서 빠진다)
  const arrows = []
  const put = (a, v) => {
    for (const [r, c] of a.cells) owner[r * cols + c] = v
  }
  const cover = new Int16Array(rows * cols) // 칸마다 그 칸을 머리 앞 줄로 지나는 "지금 빠질 수 있는" 화살 수
  for (const start of shuffle(Array.from({ length: rows * cols }, (_, i) => i), rand)) {
    if (owner[start] !== -1) continue
    const cands = []
    for (let t = 0; t < 3; t++) cands.push(...candidates(walk(rows, cols, owner, start, minLen + Math.floor(rand() * (maxLen - minLen + 1)), seg, rand), cols))
    if (rand() < tangle) {
      // 지금 빠질 수 있는 화살의 앞을 많이 막을수록, 제 앞이 막힐수록, 길고 많이 꺾일수록 먼저 해 본다.
      // 빠질 수 있는 화살이 적고 "이걸 빼야 저게 빠진다"가 길게 이어지는 판이 된다
      cover.fill(0)
      for (const a of arrows) if (!firstBlock(rows, cols, owner, a)) for (const [r, c] of rayOf(rows, cols, a)) cover[r * cols + c] += 1
      const value = (a) => a.cells.reduce((n, [r, c]) => n + cover[r * cols + c], 0) * 2 + (firstBlock(rows, cols, owner, a) ? 1.5 : 0) + a.cells.length * 0.5 + bendsOf(a) * 0.8 + rand()
      const scored = cands.map((a) => [value(a), a])
      scored.sort((x, y) => y[0] - x[0])
      cands.splice(0, cands.length, ...scored.map(([, a]) => a))
    } else shuffle(cands, rand)
    for (const a of cands) {
      put(a, arrows.length)
      arrows.push(a)
      // 앞이 비어 있으면 이 화살부터 빼면 되니 늘 풀린다. 막혀 있을 때만 다 풀리는지 따져 본다
      const block = firstBlock(rows, cols, owner, a)
      if ((!block || (block.by !== arrows.length - 1 && solveOrder(rows, cols, arrows)))) break
      arrows.pop()
      put(a, -1)
    }
  }
  return mergeShort(rows, cols, arrows, maxLen)
}

// 짧은 화살(한 칸~SHORT 칸)은 눈에 잘 안 띄고 쉽다 - 옆 화살 꼬리에 이어 붙여 길고 구불구불하게 만든다.
// 짧은 화살의 어느 끝이든 다른 화살 꼬리와 맞닿으면 그 화살의 새 꼬리가 된다 (머리와 방향은 그대로). 다 풀리는 판일 때만
const SHORT = 3
function mergeShort(rows, cols, arrows, maxLen) {
  let list = arrows
  const touch = ([r1, c1], [r2, c2]) => Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1
  for (let len = 1; len <= SHORT; len++) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      if (a.cells.length !== len) continue
      let joined = false
      for (let j = 0; j < list.length && !joined; j++) {
        const b = list[j]
        // 한 칸짜리 뒤에 붙이면 머리 방향이 몸통과 어긋날 수 있다
        if (j === i || b.cells.length < 2 || b.cells.length + len > maxLen) continue
        for (const body of [a.cells, a.cells.slice().reverse()]) {
          if (!touch(body[body.length - 1], b.cells[0])) continue
          const next = list.map((x, k) => (k === j ? { cells: [...body, ...x.cells], dir: x.dir } : x)).filter((_, k) => k !== i)
          if (solveOrder(rows, cols, next)) {
            list = next
            i -= 1
            joined = true
            break
          }
        }
      }
    }
  }
  return list
}

/** 판이 얼마나 어려운지: 처음에 빠질 수 있는 화살 수(free), 다 빼는 데 걸리는 차례 수(depth) */
export function difficulty(rows, cols, arrows) {
  const owner = ownerOf(rows, cols, arrows)
  let left = arrows.map((_, i) => i)
  let free = -1
  let depth = 0
  while (left.length) {
    const out = left.filter((i) => !firstBlock(rows, cols, owner, arrows[i]))
    if (!out.length) return null
    if (free < 0) free = out.length
    for (const i of out) for (const [r, c] of arrows[i].cells) owner[r * cols + c] = -1
    left = left.filter((i) => !out.includes(i))
    depth += 1
  }
  return { free, depth }
}

// 만든 판을 몇 개 기억해 둔다 (판은 단계 번호로 정해지고, 만든 뒤에는 아무도 고치지 않는다)
const made = new Map()
const MADE_KEEP = 3

/** 이 단계의 판. 여러 번 만들어 보고 가장 어려운 것을 낸다 - 같은 난수를 이어 쓰므로 같은 단계면 늘 같은 판이다 */
export function generate(level) {
  if (!made.has(level)) {
    made.set(level, makeBoard(level))
    if (made.size > MADE_KEEP) made.delete(made.keys().next().value)
  }
  return made.get(level)
}

/** 다음에 쓸 판을 미리 만들어 둔다 (화면이 쉬는 동안 부르면 단계를 넘길 때 멈칫하지 않는다) */
export const prepare = (level) => {
  if (level >= 1 && level <= MAX_LEVEL) generate(level)
}

function makeBoard(level) {
  const spec = levelSpec(level)
  const rand = makeRand(spec.seed)
  const mask = maskOf(spec.rows, spec.cols, spec.shape)
  const room = mask.reduce((n, v) => n + v, 0)
  let best = null
  for (let k = 0; k < spec.tries; k++) {
    const arrows = build(spec, mask, rand)
    const filled = arrows.reduce((n, a) => n + a.cells.length, 0) / room
    const { free, depth } = difficulty(spec.rows, spec.cols, arrows)
    const bends = arrows.reduce((n, a) => n + bendsOf(a), 0) / arrows.length
    // 빠질 수 있는 화살이 적을수록, 순서가 길수록, 판이 꽉 찰수록 어렵고, 많이 꺾일수록 눈으로 따라가기 어렵다
    const score = depth * 2 - free * 3 + filled * 10 + bends * 2
    if (!best || score > best.score) best = { score, arrows }
  }
  return { rows: spec.rows, cols: spec.cols, arrows: best.arrows, mask, shape: spec.shape?.key ?? null }
}

/* ---------- 한 판 ---------- */

function fresh(level, layout = generate(level)) {
  const { rows, cols, arrows, mask, shape } = layout
  const { hearts, hints, colors } = levelSpec(level)
  return {
    level, rows, cols, arrows, mask, shape, colors, maxHearts: hearts, maxHints: hints,
    owner: ownerOf(rows, cols, arrows),
    gone: arrows.map(() => false),
    left: arrows.length,
    hearts, hints, mistakes: 0, moves: 0,
    won: false, over: false, timeUp: false,
  }
}

export const createGame = (level = 1) => fresh(Math.min(MAX_LEVEL, Math.max(1, Math.floor(level) || 1)))

/** 같은 단계를 처음부터 (판은 다시 만들지 않는다) */
export const restart = (game) => fresh(game.level, game)

/** (r, c) 칸을 차지한 남은 화살 번호, 없으면 -1 */
export const arrowAt = (game, r, c) => (inBoard(game.rows, game.cols, r, c) ? game.owner[r * game.cols + c] : -1)

/** 이 화살 앞을 막는 것. 막힌 데가 없으면 null */
export const blocker = (game, i) => firstBlock(game.rows, game.cols, game.owner, game.arrows[i])

/** 지금 빠질 수 있는 남은 화살 번호들 */
export const freeArrows = (game) => game.arrows.flatMap((_, i) => (!game.gone[i] && !blocker(game, i) ? [i] : []))

/**
 * i 번 화살을 누른다. 끝난 판이나 이미 빠진 화살이면 null.
 * 빠지면 { ok: true, steps: 판 끝까지 칸 수 }, 막히면 { ok: false, steps: 막힌 칸까지, by: 막은 화살 } (하트 하나를 잃는다)
 */
export function tap(game, i) {
  if (game.won || game.over || !game.arrows[i] || game.gone[i]) return null
  game.moves += 1
  const block = blocker(game, i)
  if (block) {
    game.hearts -= 1
    game.mistakes += 1
    if (game.hearts <= 0) game.over = true
    return { ok: false, ...block }
  }
  removeArrow(game, i)
  if (game.left === 0) game.won = true
  return { ok: true, steps: rayOf(game.rows, game.cols, game.arrows[i]).length }
}

// i 번 화살을 판에서 뺀다 (자리를 비우고 빠졌다고 적는다)
function removeArrow(game, i) {
  for (const [r, c] of game.arrows[i].cells) game.owner[r * game.cols + c] = -1
  game.gone[i] = true
  game.left -= 1
}

/** 화살 하나에 주는 시간(초). 시계가 없는 단계면 0 */
export function secondsPerArrow(level, expert = false) {
  const from = expert ? TIMER_FROM.expert : TIMER_FROM.normal
  if (level < from) return 0
  return Math.max(MIN_SECONDS, START_SECONDS * (1 - TIME_DROP) ** (level - from))
}

/** 화살 하나를 빼면 더 받는 시간(초). 시계가 없는 단계면 0 */
export const bonusSeconds = (level, expert = false) => secondsPerArrow(level, expert) * TIME_BONUS

/** 이 판의 제한 시간(초, 올림). 시계가 없는 단계면 0 */
export const timeLimit = (game, expert = false) => Math.ceil(game.arrows.length * secondsPerArrow(game.level, expert))

/** 시간이 다 됐다. 이미 끝난 판이면 false */
export function expire(game) {
  if (game.won || game.over) return false
  game.over = true
  game.timeUp = true
  return true
}

/** 힌트 하나를 써서 지금 빠질 수 있는 화살 하나를 알려 준다. 힌트가 없거나 끝난 판이면 -1 */
export function useHint(game) {
  if (game.hints <= 0 || game.won || game.over) return -1
  const free = freeArrows(game)
  if (!free.length) return -1
  game.hints -= 1
  // 빼면 다른 화살이 가장 많이 풀리는 것을 알려 준다 (어디서부터 풀지 감을 잡게)
  let best = free[0]
  let bestGain = -1
  for (const i of free) {
    const gain = game.arrows.filter((a, j) => !game.gone[j] && blocker(game, j)?.by === i).length
    if (gain > bestGain) [best, bestGain] = [i, gain]
  }
  return best
}

/** 이 브라우저에 저장해 둔 판을 되살린다. 모양이 맞지 않으면 null */
export function restore(saved) {
  if (!saved || typeof saved !== 'object') return null
  const { level, gone, hearts, hints, mistakes, moves } = saved
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi
  if (!int(level, 1, MAX_LEVEL)) return null
  const spec = levelSpec(level)
  if (!int(hearts, 1, spec.hearts) || !int(hints, 0, spec.hints)) return null
  if (!int(mistakes, 0, spec.hearts - 1) || !int(moves, 0, Number.MAX_SAFE_INTEGER) || !Array.isArray(gone)) return null
  const game = createGame(level)
  for (const i of gone) {
    if (!int(i, 0, game.arrows.length - 1) || game.gone[i]) return null
    removeArrow(game, i)
  }
  if (game.left === 0) return null // 다 뺀 판은 다음 단계로 넘어갔어야 한다
  Object.assign(game, { hearts, hints, mistakes, moves })
  return game
}

/** 이 단계를 처음부터 할 때의 저장값 - 판을 만들지 않고 단계 규칙만으로 (판 자체는 단계 번호로 다시 만든다) */
export function freshSnapshot(level) {
  const { hearts, hints } = levelSpec(level)
  return { level, gone: [], hearts, hints, mistakes: 0, moves: 0 }
}

/** 저장할 몫만 (판 자체는 단계 번호로 다시 만든다) */
export const snapshot = (game) => ({
  level: game.level,
  gone: game.gone.flatMap((g, i) => (g ? [i] : [])),
  hearts: game.hearts, hints: game.hints, mistakes: game.mistakes, moves: game.moves,
})
