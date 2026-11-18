// 봄날 너구리 — 게임 규칙만 담은 부분 (화면·소리·입력은 game.js)
//
// 여기에는 DOM 이 없습니다. 그래서 브라우저 없이도 그대로 돌려 볼 수 있고,
// tests/neoguri.test.js 가 이 파일만 불러 사다리·구멍·충돌·단계 넘김을 검사합니다.
//
// 1982년 오락실 너구리(ポンポコ)의 규칙을 따릅니다 — 층마다 뚫린 구멍을 뛰어넘고,
// 과일을 다 먹어야 다음 판으로 가며, 배가 고파지기 전에 끝내야 합니다.
// 그림·소리·판 모양은 전부 새로 만든 것이고 원작 자료는 쓰지 않았습니다.

/* ---------- 판 크기와 규칙값 ---------- */

// 움직이는 것들의 칸 크기. 충돌 판정에 쓰는 값이라 규칙 쪽이 갖는다.
// skin.js 는 이 크기를 받아 그림만 그린다 (그림을 바꿔도 판정은 그대로).
export const BOX = {
  player: { w: 22, h: 26 },
  fruit: { w: 15, h: 15 },
  pot: { w: 16, h: 17 },
  snake: { w: 26, h: 15 },
  scorpion: { w: 22, h: 13 },
  spike: { w: 16, h: 12 },
}

export const W = 360
export const H = 460
export const HUD = 44 // 위쪽 점수판 높이 (배고픔 막대까지)
export const WALL = 10 // 좌우 벽 두께
export const FLOOR_Y = [116, 195, 274, 353, 432] // 각 층 발 닿는 높이
export const LADDER_W = 20
const LADDER_XS = [40, 88, 136, 184, 232, 280, 320]
const SPOT_XS = [36, 72, 108, 144, 180, 216, 252, 288, 324] // 과일·항아리·압정 자리
const GAP_W = 40 // 구멍 너비. 한 번 뛰면 60px 쯤 가므로 여유를 둔다
export const GAP_EDGE = 56 // 구멍 양옆에 남겨 두는 발판
export const LADDER_CLEAR = 18 // 사다리와 구멍 사이 여유
export const SPIKE_CLEAR = 26 // 압정과 사다리 사이 여유

const SAFE_DROP = 0 // 한 층만 떨어져도 죽는다. 구멍은 반드시 뛰어서 넘어야 한다
// 자리 하나에 올려 두는 것 중 가장 넓은 것 (항아리·압정이 과일보다 넓다)
const WIDEST = Math.max(BOX.fruit.w, BOX.pot.w, BOX.spike.w)
const SPEED = 98 // 너구리 걷기 (px/초)
const CLIMB = 70 // 사다리
const JUMP = 290 // 뛸 때 솟는 속도
const GRAV = 940
export const LIVES = 3
const INVULN = 1.6 // 부딪힌 뒤 무적 (초)
const POT_GRACE = 0.9 // 항아리에서 뱀이 나왔을 때 달아날 틈 (초)

// 과일마다 점수가 다르다
export const FRUITS = [
  { kind: 'carrot', score: 50 },
  { kind: 'mushroom', score: 60 },
  { kind: 'apple', score: 70 },
  { kind: 'grape', score: 80 },
  { kind: 'melon', score: 100 },
]
export const SCORE = { pot: 300, stage: 500, hungerBonus: 600 }

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const randInt = (n) => Math.floor(Math.random() * n)
const pickOne = (arr) => arr[randInt(arr.length)]

// 배가 다 고파지기까지 걸리는 시간. 단계가 오를수록 짧다.
export const hungerSeconds = (stage) => Math.max(42, 78 - stage * 5)
const FRUIT_FEED = 0.045 // 과일 하나를 먹으면 이만큼 배가 찬다
const POT_FEED = 0.1

const pullAt = (arr, i) => arr.splice(i, 1)[0]

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/* ---------- 한 판 만들기 ---------- */

export const ladderCenter = (l) => l.x + LADDER_W / 2

// 맨 아래층은 구멍을 뚫지 않는다. 떨어질 곳이 없기도 하고, 출발 자리라서.
function makeGaps(stage, ladders) {
  const gaps = FLOOR_Y.map(() => [])
  const wanted = stage < 2 ? 1 : 2 // 첫 판만 하나, 그 뒤로는 두 개

  for (let floor = 0; floor < FLOOR_Y.length - 1; floor++) {
    const blocked = ladders
      .filter((l) => l.top === floor || l.bottom === floor)
      .map((l) => ladderCenter(l))
    for (let n = 0; n < wanted; n++) {
      for (let attempt = 0; attempt < 14; attempt++) {
        // 구멍 양옆에 발판을 남긴다 (자리가 너무 좁으면 건널 수가 없다)
        const x0 = WALL + GAP_EDGE + randInt(W - 2 * WALL - 2 * GAP_EDGE - GAP_W)
        const x1 = x0 + GAP_W
        // 사다리를 끊어 놓으면 오르내릴 수가 없다
        if (blocked.some((c) => c > x0 - LADDER_CLEAR && c < x1 + LADDER_CLEAR)) continue
        // 구멍끼리 붙으면 건널 수 없는 벼랑이 된다
        if (gaps[floor].some((g) => x0 < g.x1 + GAP_EDGE && x1 > g.x0 - GAP_EDGE)) continue
        gaps[floor].push({ x0, x1 })
        break
      }
    }
  }
  return gaps
}

// 그 층 그 자리에 발 디딜 바닥이 있나
export function solidAt(stageData, floor, x) {
  if (floor < 0 || floor >= FLOOR_Y.length) return false
  if (x < WALL || x > W - WALL) return false
  return !stageData.gaps[floor].some((g) => x > g.x0 && x < g.x1)
}

// 폭 w 짜리가 그 자리에 통째로 올라설 수 있나 (구멍 가장자리는 넉넉히 피한다)
const standable = (gaps, floor, x, w) =>
  x >= WALL && x + w <= W - WALL && !gaps[floor].some((g) => x < g.x1 + 4 && x + w > g.x0 - 4)

export const boxOn = (spot, size) => ({ x: spot.x, y: FLOOR_Y[spot.floor] - size.h, w: size.w, h: size.h })

export function buildStage(stage) {
  // 층마다 사다리 2개. 바로 위 칸과 자리가 겹치지 않게 골라서 걸어 다닐 일이 생기게 한다.
  const ladders = []
  let used = []
  for (let gap = 0; gap < FLOOR_Y.length - 1; gap++) {
    const pool = LADDER_XS.filter((x) => !used.includes(x))
    const picked = []
    while (picked.length < 2) picked.push(pullAt(pool, randInt(pool.length)))
    used = picked
    for (const x of picked) ladders.push({ x, top: gap, bottom: gap + 1 })
  }

  const gaps = makeGaps(stage, ladders)
  const start = startSpot()

  // 설 수 있는 자리를 모아 압정 → 항아리 → 과일 순으로 나눠 쓴다
  const open = []
  for (let floor = 0; floor < FLOOR_Y.length; floor++) {
    for (const x of SPOT_XS) {
      if (!standable(gaps, floor, x, WIDEST)) continue
      if (floor === start.floor && x < start.x + BOX.player.w + 8 && x + BOX.fruit.w > start.x - 8) continue
      open.push({ x, floor })
    }
  }
  shuffle(open)

  const take = (n, ok = () => true) => {
    const out = []
    for (let i = open.length - 1; i >= 0 && out.length < n; i--) {
      if (!ok(open[i], out)) continue
      out.push(pullAt(open, i))
    }
    return out
  }

  // 압정: 한 층에 하나. 사다리 앞은 피한다 (내려서자마자 죽으면 놀이가 안 된다)
  const spikes = take(Math.min(1 + stage, FLOOR_Y.length), (spot, chosen) => {
    if (chosen.some((s) => s.floor === spot.floor)) return false
    const mid = spot.x + BOX.spike.w / 2
    return !ladders.some(
      (l) => (l.top === spot.floor || l.bottom === spot.floor) && Math.abs(ladderCenter(l) - mid) < SPIKE_CLEAR
    )
  }).map((spot) => ({ ...spot, box: boxOn(spot, BOX.spike) }))

  // 수수께끼 항아리: 열어 봐야 안다 (보너스 아니면 뱀). 겉모습은 똑같다.
  const pots = take(stage > 3 ? 3 : 2).map((spot) => ({
    ...spot,
    box: boxOn(spot, BOX.pot),
    taken: false,
    snake: Math.random() < 0.4,
  }))

  // 남은 자리는 전부 과일
  const fruits = open.map((spot) => {
    const type = pickOne(FRUITS)
    return { ...spot, kind: type.kind, score: type.score, box: boxOn(spot, BOX.fruit), taken: false }
  })

  const speed = Math.min(50 + stage * 9, 112)
  const enemies = []
  for (let i = 0; i < Math.min(1 + stage, 4); i++) enemies.push(makeEnemy('snake', enemyFloor(i), gaps))
  if (stage >= 3) for (let i = 0; i < Math.min(stage - 2, 2); i++) enemies.push(makeEnemy('scorpion', enemyFloor(i + 1), gaps))

  return { gaps, ladders, fruits, pots, spikes, enemies, speed, hungerFor: hungerSeconds(stage) }
}

// floor 를 안 주면 층을 돌아가며 고르고, x 를 안 주면 구멍을 피해 뽑는다.
// ladder 가 null 이면 걷는 중, 값이 있으면 그 사다리를 타는 중이다.
export function makeEnemy(kind, floor, gaps, x) {
  const size = BOX[kind]
  const randX = () => WALL + 20 + randInt(W - 2 * WALL - 40 - size.w)
  if (x === undefined) {
    x = randX()
    // 구멍 위에서 시작하면 허공에 떠 있게 된다
    for (let attempt = 0; attempt < 12 && !standable(gaps, floor, x, size.w); attempt++) x = randX()
  }
  return {
    kind,
    floor,
    x,
    y: FLOOR_Y[floor] - size.h,
    dir: Math.random() < 0.5 ? -1 : 1,
    ladder: null,
    cool: 0.6 + Math.random(),
  }
}

// 맨 아래(너구리 출발 층)에는 두지 않는다
const enemyFloor = (i) => i % (FLOOR_Y.length - 1)

function startSpot() {
  const floor = FLOOR_Y.length - 1
  return { floor, x: Math.round(W / 2 - BOX.player.w / 2), y: FLOOR_Y[floor] - BOX.player.h }
}

/* ---------- 상태 ---------- */

export function createGame() {
  const game = {
    phase: 'ready', // ready · playing · paused · hit · cleared · over
    t: 0, // 그림 흔들림용 시간
    stageData: null,
    player: { ...startSpot(), vy: 0, state: 'walk', facing: 1, ladder: null, step: 0 },
    events: [], // 소리·통계용. game.js 가 읽고 비운다
  }
  return Object.assign(game, blankRun())
}

// 한 판을 처음부터 시작할 때의 숫자들
const blankRun = () => ({ timer: 0, stage: 1, score: 0, lives: LIVES, invulnLeft: 0, hunger: 1 })

const emit = (g, name) => g.events.push(name)

function resetPlayer(g) {
  Object.assign(g.player, startSpot(), { vy: 0, state: 'walk', facing: 1, ladder: null, step: 0 })
}

export function startGame(g) {
  Object.assign(g, blankRun())
  g.stageData = buildStage(1)
  resetPlayer(g)
  g.phase = 'playing'
  emit(g, 'start')
}

export function togglePause(g) {
  if (g.phase === 'playing') g.phase = 'paused'
  else if (g.phase === 'paused') g.phase = 'playing'
}

function nextStage(g) {
  g.stage += 1
  g.invulnLeft = INVULN
  g.hunger = 1
  g.stageData = buildStage(g.stage)
  resetPlayer(g)
  g.phase = 'playing'
}

// reason: enemy · spike · hunger · drop. 소리와 읽어 주기는 game.js 가 정한다.
function loseLife(g, reason) {
  g.lives -= 1
  if (g.lives <= 0) {
    g.phase = 'over'
    emit(g, 'over')
  } else {
    g.phase = 'hit'
    g.timer = 1.1
    emit(g, reason)
  }
}

/* ---------- 사다리 ---------- */

const centerOf = (e, size) => e.x + size.w / 2

// dir = -1 올라가기(지금 층이 사다리 아래쪽) · +1 내려가기(지금 층이 사다리 위쪽)
function ladderAt(ladders, cx, floor, dir) {
  return ladders.find(
    (l) => Math.abs(ladderCenter(l) - cx) < 10 && (dir < 0 ? l.bottom === floor : l.top === floor)
  )
}

/* ---------- 한 걸음 ---------- */

// input: { left, right, up, down, jump } — jump 은 "이번 걸음에 새로 눌렸다"는 뜻
export function step(g, dt, input) {
  g.t += dt

  if (g.phase === 'hit' || g.phase === 'cleared') {
    g.timer -= dt
    if (g.timer <= 0) {
      if (g.phase === 'hit') {
        resetPlayer(g)
        g.stageData.enemies = g.stageData.enemies.map((e, i) => makeEnemy(e.kind, enemyFloor(i), g.stageData.gaps))
        g.invulnLeft = INVULN
        g.hunger = Math.max(g.hunger, 0.35) // 굶어 죽은 자리에서 또 굶지 않게
        g.phase = 'playing'
      } else {
        nextStage(g)
      }
    }
    return
  }
  if (g.phase !== 'playing') return

  g.invulnLeft = Math.max(0, g.invulnLeft - dt)
  g.hunger = Math.max(0, g.hunger - dt / g.stageData.hungerFor)

  movePlayer(g, dt, input)
  for (const e of g.stageData.enemies) moveEnemy(g, e, dt)
  collect(g)

  if (g.hunger === 0) {
    loseLife(g, 'hunger')
    return
  }
  if (g.invulnLeft === 0) checkSpikes(g)
  if (g.invulnLeft === 0 && g.phase === 'playing') checkEnemies(g)

  // 부딪힌 걸음에는 단계 통과로 덮지 않는다
  if (g.phase !== 'playing') return

  if (g.stageData.fruits.every((f) => f.taken)) {
    g.score += SCORE.stage + Math.round(g.hunger * SCORE.hungerBonus)
    g.phase = 'cleared'
    g.timer = 1.4
    emit(g, 'clear')
  }
}

function movePlayer(g, dt, input) {
  const p = g.player
  const size = BOX.player
  const minX = WALL
  const maxX = W - WALL - size.w
  const { ladders } = g.stageData

  if (p.state === 'climb') {
    const dir = input.up ? -1 : input.down ? 1 : 0
    p.y += dir * CLIMB * dt
    if (dir) p.step += dt * 3
    const top = FLOOR_Y[p.ladder.top] - size.h
    const bottom = FLOOR_Y[p.ladder.bottom] - size.h
    if (p.y <= top) {
      p.y = top
      p.floor = p.ladder.top
      p.state = 'walk'
      p.ladder = null
    } else if (p.y >= bottom) {
      p.y = bottom
      p.floor = p.ladder.bottom
      p.state = 'walk'
      p.ladder = null
    }
    return
  }

  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (move) {
    p.x = clamp(p.x + move * SPEED * dt, minX, maxX)
    p.facing = move
    p.step += dt * 6
  } else if (p.state === 'walk') {
    p.step = 0
  }

  if (p.state === 'walk') {
    const cx = centerOf(p, size)
    const up = input.up && ladderAt(ladders, cx, p.floor, -1)
    const down = input.down && ladderAt(ladders, cx, p.floor, 1)
    const l = up || down
    if (l) {
      p.ladder = l
      p.state = 'climb'
      p.x = clamp(ladderCenter(l) - size.w / 2, minX, maxX)
      p.y += up ? -1 : 1 // 바로 사다리 안으로 들여보낸다
      return
    }
    if (input.jump) {
      p.vy = -JUMP
      p.state = 'air'
      emit(g, 'jump')
    } else if (!solidAt(g.stageData, p.floor, cx)) {
      p.vy = 0 // 구멍 위로 걸어 나갔다 — 아래층으로 떨어진다
      p.state = 'air'
      emit(g, 'fall')
    } else {
      p.y = FLOOR_Y[p.floor] - size.h
    }
  }

  if (p.state === 'air') {
    const wasFeet = p.y + size.h
    p.vy += GRAV * dt
    p.y += p.vy * dt
    p.y = Math.max(p.y, HUD + 4) // 점수판 위로는 못 올라간다
    const feet = p.y + size.h
    if (p.vy > 0) {
      const cx = centerOf(p, size)
      for (let f = 0; f < FLOOR_Y.length; f++) {
        if (wasFeet > FLOOR_Y[f] || feet < FLOOR_Y[f]) continue // 그 층 바닥을 지나는 중인가
        if (!solidAt(g.stageData, f, cx)) continue
        const dropped = f - p.floor // p.floor 는 아직 떠난 층이다
        p.y = FLOOR_Y[f] - size.h
        p.vy = 0
        p.floor = f
        p.state = 'walk'
        // 떨어지면 죽는다 (뛰어서 같은 층에 내려서는 것은 괜찮다)
        if (dropped > SAFE_DROP) loseLife(g, 'drop')
        break
      }
    }
  }
}

function moveEnemy(g, e, dt) {
  const size = BOX[e.kind]
  const speed = g.stageData.speed * (e.kind === 'scorpion' ? 1.35 : 1)
  const minX = WALL
  const maxX = W - WALL - size.w
  const { ladders } = g.stageData
  e.cool -= dt

  if (e.ladder) {
    const up = e.ladder.bottom === e.floor ? -1 : 1 // 타는 동안 층은 안 바뀐다
    e.y += up * speed * 0.8 * dt
    const top = FLOOR_Y[e.ladder.top] - size.h
    const bottom = FLOOR_Y[e.ladder.bottom] - size.h
    if (e.y <= top || e.y >= bottom) {
      e.floor = e.y <= top ? e.ladder.top : e.ladder.bottom
      e.y = FLOOR_Y[e.floor] - size.h
      e.ladder = null
      e.cool = 1.2
    }
    return
  }

  e.y = FLOOR_Y[e.floor] - size.h
  const nextX = clamp(e.x + e.dir * speed * dt, minX, maxX)
  const ahead = e.dir > 0 ? nextX + size.w : nextX
  // 벽이나 구멍을 만나면 돌아선다 (벌레는 떨어지지 않는다)
  if (nextX === e.x || !solidAt(g.stageData, e.floor, ahead)) e.dir = -e.dir
  else e.x = nextX

  // 뱀만 사다리를 탄다
  if (e.kind === 'snake' && e.cool <= 0) {
    const cx = centerOf(e, size)
    const near = ladders.filter(
      (l) => Math.abs(ladderCenter(l) - cx) < 4 && (l.top === e.floor || l.bottom === e.floor)
    )
    if (near.length && Math.random() < 0.45) {
      const l = near[randInt(near.length)]
      e.ladder = l
      e.x = clamp(ladderCenter(l) - size.w / 2, minX, maxX)
      e.y += l.bottom === e.floor ? -1 : 1 // 바로 사다리 안으로 들여보낸다
    } else {
      e.cool = 0.4
    }
  }
}

/* ---------- 먹기·부딪힘 ---------- */

const boxOf = (e, size, pad) => ({ x: e.x + pad, y: e.y + pad, w: size.w - pad * 2, h: size.h - pad * 2 })
const hits = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function collect(g) {
  const pb = boxOf(g.player, BOX.player, 2)

  for (const fruit of g.stageData.fruits) {
    if (fruit.taken || !hits(pb, fruit.box)) continue
    fruit.taken = true
    g.score += fruit.score
    g.hunger = Math.min(1, g.hunger + FRUIT_FEED)
    emit(g, 'pick')
  }

  for (const pot of g.stageData.pots) {
    if (pot.taken || !hits(pb, pot.box)) continue
    pot.taken = true
    if (pot.snake) {
      // 뱀이 튀어나온다 — 항아리가 있던 자리에서 바로.
      // 발밑에서 나오니 잠깐 달아날 틈을 주지 않으면 그 자리에서 바로 죽는다.
      const x = clamp(pot.x, WALL, W - WALL - BOX.snake.w)
      g.stageData.enemies.push({ ...makeEnemy('snake', pot.floor, g.stageData.gaps, x), cool: 1 })
      g.invulnLeft = Math.max(g.invulnLeft, POT_GRACE)
      emit(g, 'potSnake')
    } else {
      g.score += SCORE.pot
      g.hunger = Math.min(1, g.hunger + POT_FEED)
      emit(g, 'potBonus')
    }
  }
}

// 압정은 뛰어서 넘는 것
function checkSpikes(g) {
  const pb = boxOf(g.player, BOX.player, 3)
  for (const spike of g.stageData.spikes) {
    if (!hits(pb, spike.box)) continue
    loseLife(g, 'spike')
    return
  }
}

function checkEnemies(g) {
  const pb = boxOf(g.player, BOX.player, 3)
  for (const e of g.stageData.enemies) {
    if (!hits(pb, boxOf(e, BOX[e.kind], 2))) continue
    loseLife(g, 'enemy')
    return
  }
}
