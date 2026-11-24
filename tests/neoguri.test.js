// 봄날 너구리 규칙 검사 - 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import { readSwipe, nextSwipe, swipeKeys, SWIPE_MIN } from '../public/games/neoguri/touch.js'
import {
  BOX, W, H, HUD, WALL, FLOOR_Y, SCORE, LIVES, FRUITS, GAP_EDGE, LADDER_CLEAR, SPIKE_CLEAR,
  createGame, startGame, step, buildStage, boxOn, makeEnemy, ladderCenter, solidAt, hungerSeconds,
} from '../public/games/neoguri/logic.js'

const DT = 1 / 120
const NONE = { left: false, right: false, up: false, down: false, jump: false }

// seconds 초 동안 같은 입력을 누르고 있는다
function hold(game, seconds, input = {}) {
  const keys = { ...NONE, ...input }
  for (let i = 0; i < Math.round(seconds / DT); i++) step(game, DT, keys)
}

// 판 모양 검사는 읽기만 하므로 20판을 한 번 만들어 같이 본다
const STAGES = Array.from({ length: 20 }, (_, i) => buildStage(i + 1))

function fresh() {
  const game = createGame()
  startGame(game)
  game.events.length = 0
  return game
}

// 구멍·적·압정·항아리를 치운 민판. 하나씩 따로 검사하려고 쓴다.
// (항아리를 두면 밟는 순간 뱀이 튀어나와 다른 검사가 흔들린다)
function flat(game) {
  game.stageData.gaps = FLOOR_Y.map(() => [])
  game.stageData.enemies = []
  game.stageData.spikes = []
  game.stageData.pots = []
  return game
}

// 너구리를 floor 층 왼쪽에 세운다
function standAt(game, floor, x = WALL + 20) {
  Object.assign(game.player, { floor, x, y: FLOOR_Y[floor] - BOX.player.h, vy: 0, state: 'walk' })
  return game.player
}

const sandbox = () => flat(fresh())

const spawn = (kind, floor, x) => makeEnemy(kind, floor, null, x)

const enemyAtPlayer = (game, kind = 'snake') => {
  game.stageData.enemies = [spawn(kind, game.player.floor, game.player.x)]
}

// 너구리를 floor 층 왼쪽에 세우고 그 앞 gap 픽셀에 압정 하나를 박는다
function withSpike(floor, gap) {
  const game = sandbox()
  const x = standAt(game, floor).x + gap
  game.stageData.spikes = [{ x, floor, box: boxOn({ x, floor }, BOX.spike) }]
  return { game, spikeX: x }
}

/* ---------- 판 모양 ---------- */

test('한 판에는 칸마다 사다리 2개가 있고, 위아래 칸이 같은 자리에 겹치지 않는다', () => {
  for (const { ladders } of STAGES) {
    assert.equal(ladders.length, (FLOOR_Y.length - 1) * 2)
    for (let gap = 0; gap < FLOOR_Y.length - 1; gap++) {
      const here = ladders.filter((l) => l.top === gap)
      assert.equal(here.length, 2)
      assert.notEqual(here[0].x, here[1].x)
      const above = ladders.filter((l) => l.top === gap - 1)
      for (const l of above) assert.ok(!here.some((h) => h.x === l.x), '바로 위 칸과 자리가 겹쳤다')
    }
  }
})

test('구멍은 맨 아래층에 없고, 사다리를 끊지 않으며, 서로 붙지 않는다', () => {
  for (const data of STAGES) {
    assert.equal(data.gaps[FLOOR_Y.length - 1].length, 0, '맨 아래층에 구멍이 뚫렸다')

    for (let floor = 0; floor < FLOOR_Y.length; floor++) {
      const holes = [...data.gaps[floor]].sort((a, b) => a.x0 - b.x0)
      for (const hole of holes) {
        assert.ok(hole.x0 >= WALL + GAP_EDGE && hole.x1 <= W - WALL - GAP_EDGE, '구멍 옆에 설 자리가 없다')
        for (const l of data.ladders) {
          if (l.top !== floor && l.bottom !== floor) continue
          const c = ladderCenter(l)
          assert.ok(c <= hole.x0 - LADDER_CLEAR || c >= hole.x1 + LADDER_CLEAR, '사다리가 구멍 위에 걸렸다')
        }
      }
      for (let i = 1; i < holes.length; i++) {
        assert.ok(holes[i].x0 - holes[i - 1].x1 >= GAP_EDGE, '구멍끼리 붙어 건널 수 없는 벼랑이 됐다')
      }
    }
  }
})

test('과일·항아리·압정은 구멍 위에 놓이지 않고, 출발 자리를 비워 둔다', () => {
  const start = createGame().player
  for (const data of STAGES) {
    const things = [...data.fruits, ...data.pots, ...data.spikes]
    assert.ok(data.fruits.length >= 10, `과일이 ${data.fruits.length}개뿐이다`)

    for (const thing of things) {
      const mid = thing.box.x + thing.box.w / 2
      assert.ok(solidAt(data, thing.floor, mid), '구멍 위에 놓였다')
      assert.ok(solidAt(data, thing.floor, thing.box.x), '왼쪽 끝이 구멍에 걸쳤다')
      assert.ok(solidAt(data, thing.floor, thing.box.x + thing.box.w), '오른쪽 끝이 구멍에 걸쳤다')
      if (thing.floor !== start.floor) continue
      const onStart = thing.box.x < start.x + BOX.player.w && thing.box.x + thing.box.w > start.x
      assert.ok(!onStart, '출발 자리에 놓였다')
    }
  }
})

test('압정은 사다리 앞을 피하고 한 층에 하나만 있다', () => {
  for (const { spikes, ladders } of STAGES) {
    assert.ok(spikes.length >= 1 && spikes.length <= FLOOR_Y.length)
    const floors = spikes.map((s) => s.floor)
    assert.equal(new Set(floors).size, floors.length, '한 층에 압정이 둘 이상이다')
    for (const spike of spikes) {
      const mid = spike.box.x + BOX.spike.w / 2
      for (const l of ladders) {
        if (l.top !== spike.floor && l.bottom !== spike.floor) continue
        assert.ok(Math.abs(ladderCenter(l) - mid) >= SPIKE_CLEAR, '사다리 앞에 압정이 박혔다')
      }
    }
  }
})

test('과일은 종류마다 정해진 점수를 갖는다', () => {
  const kinds = new Map(FRUITS.map((f) => [f.kind, f.score]))
  for (const fruit of buildStage(3).fruits) assert.equal(fruit.score, kinds.get(fruit.kind))
})

/* ---------- 움직임 ---------- */

test('오른쪽으로 계속 걸으면 오른쪽 벽에서 멈춘다', () => {
  const game = sandbox()
  const x0 = game.player.x
  hold(game, 1, { right: true })
  assert.ok(game.player.x > x0 + 50, '오른쪽으로 가지 않았다')
  hold(game, 4, { right: true })
  assert.equal(game.player.x, W - WALL - BOX.player.w)

  hold(game, 6, { left: true })
  assert.equal(game.player.x, WALL)
})

test('사다리 앞에서 위를 누르면 한 층 올라가고, 아래를 누르면 내려온다', () => {
  const game = sandbox()
  const p = game.player
  const ladder = game.stageData.ladders.find((l) => l.bottom === p.floor)
  assert.ok(ladder, '맨 아래 층으로 이어진 사다리가 있어야 한다')

  p.x = ladderCenter(ladder) - BOX.player.w / 2
  hold(game, 2, { up: true })
  assert.equal(p.floor, ladder.top)
  assert.equal(p.state, 'walk')
  assert.equal(p.y, FLOOR_Y[ladder.top] - BOX.player.h)

  hold(game, 2, { down: true })
  assert.equal(p.floor, ladder.bottom)
  assert.equal(p.y, FLOOR_Y[ladder.bottom] - BOX.player.h)
})

test('뛰면 떴다가 같은 층에 다시 내려선다', () => {
  const game = sandbox()
  const p = game.player
  const ground = p.y
  step(game, DT, { ...NONE, jump: true })
  assert.equal(p.state, 'air')
  hold(game, 0.2)
  assert.ok(p.y < ground - 10, '뛰어오르지 않았다')
  hold(game, 2)
  assert.equal(p.state, 'walk')
  assert.equal(p.y, ground)
})

test('구멍 위로 걸어 나가면 아래층으로 떨어진다', () => {
  const game = sandbox()
  const p = standAt(game, 2)
  game.stageData.gaps[2] = [{ x0: p.x + 20, x1: p.x + 60 }]

  hold(game, 1.2, { right: true })
  assert.equal(p.floor, 3, '아래층으로 떨어지지 않았다')
  assert.equal(p.state, 'walk')
  assert.equal(p.y, FLOOR_Y[3] - BOX.player.h)
  assert.ok(game.events.includes('fall'))
})

test('구멍에 빠지면 한 층만 떨어져도 죽는다', () => {
  const game = sandbox()
  const p = standAt(game, 1)
  game.stageData.gaps[1] = [{ x0: p.x + 20, x1: p.x + 60 }]

  hold(game, 1.5, { right: true })
  assert.equal(game.phase, 'hit', '구멍에 빠졌는데 멀쩡하다')
  assert.equal(game.lives, LIVES - 1)
  assert.ok(game.events.includes('drop'))
})

test('뛰어서 구멍을 넘으면 죽지 않는다', () => {
  const game = sandbox()
  const p = standAt(game, 2)
  game.stageData.gaps[2] = [{ x0: p.x + 26, x1: p.x + 66 }]

  step(game, DT, { ...NONE, right: true, jump: true })
  hold(game, 0.8, { right: true })
  assert.equal(game.lives, LIVES)
  assert.equal(game.phase, 'playing')
  assert.equal(p.floor, 2)
})

test('제자리에서 뛰었다 내려서는 것은 떨어진 게 아니다', () => {
  const game = sandbox()
  step(game, DT, { ...NONE, jump: true })
  hold(game, 1.5)
  assert.equal(game.lives, LIVES)
  assert.equal(game.phase, 'playing')
})

/* ---------- 먹기 ---------- */

test('과일을 먹으면 점수가 오르고 배가 조금 찬다', () => {
  const game = sandbox()
  const fruit = game.stageData.fruits.find((f) => f.floor === game.player.floor)
  standAt(game, fruit.floor, fruit.box.x)
  game.hunger = 0.5

  step(game, DT, NONE)
  assert.ok(fruit.taken)
  assert.equal(game.score, fruit.score)
  assert.ok(game.hunger > 0.5, '과일을 먹었는데 배가 안 찼다')
})

test('과일을 다 먹으면 다음 단계로 넘어간다 (남은 배고픔은 보너스)', () => {
  const game = sandbox()
  const fruit = game.stageData.fruits[0]
  for (const f of game.stageData.fruits) f.taken = f !== fruit
  standAt(game, fruit.floor, fruit.box.x)
  game.hunger = 0.5

  step(game, DT, NONE)
  assert.equal(game.phase, 'cleared')
  assert.ok(game.score >= fruit.score + SCORE.stage, '단계 점수가 안 들어왔다')

  hold(game, 1.5)
  assert.equal(game.phase, 'playing')
  assert.equal(game.stage, 2)
  assert.ok(game.hunger > 0.9, '새 판인데 배가 고픈 채로 시작한다')
  assert.ok(game.stageData.fruits.some((f) => !f.taken))
})

// floor 층에 항아리 하나만 놓고 그 앞에 너구리를 세운다
function withPot(snake) {
  const game = sandbox()
  const floor = 4
  const x = WALL + 60
  const pot = { floor, x, box: boxOn({ x, floor }, BOX.pot), taken: false, snake }
  game.stageData.pots = [pot]
  // 같은 자리의 과일은 치운다. 안 그러면 점수가 섞여 항아리만 보는 검사가 안 된다.
  game.stageData.fruits = game.stageData.fruits.filter(
    (f) => !(f.floor === floor && f.box.x < x + BOX.pot.w + BOX.player.w && f.box.x + f.box.w > x - BOX.player.w)
  )
  standAt(game, floor, x)
  return { game, pot }
}

test('항아리는 보너스 아니면 뱀이다', () => {
  const { game: good, pot: bonus } = withPot(false)
  step(good, DT, NONE)
  assert.ok(bonus.taken)
  assert.ok(good.score >= SCORE.pot)
  assert.equal(good.stageData.enemies.length, 0, '보너스인데 뱀이 나왔다')
  assert.ok(good.events.includes('potBonus'))

  const { game: bad, pot: trap } = withPot(true)
  const before = bad.score
  step(bad, DT, NONE)
  assert.ok(trap.taken)
  assert.equal(bad.score, before, '뱀 항아리인데 점수를 줬다')
  assert.equal(bad.stageData.enemies.length, 1, '뱀이 안 튀어나왔다')
  assert.ok(bad.events.includes('potSnake'))

  // 발밑에서 나오므로 그 자리에서 바로 죽으면 안 된다 - 달아날 틈이 있어야 한다
  assert.equal(bad.lives, LIVES, '항아리를 열자마자 죽었다')
  assert.equal(bad.phase, 'playing')
  assert.ok(bad.invulnLeft > 0)
})

test('항아리에서 나온 뱀은 잠깐 뒤부터 다시 위험하다', () => {
  const { game } = withPot(true)
  step(game, DT, NONE)
  hold(game, 1.2) // 달아날 틈이 지나면
  assert.equal(game.invulnLeft, 0, '무적이 안 풀렸다')
  assert.equal(game.stageData.enemies.length, 1, '뱀이 사라졌다')

  enemyAtPlayer(game) // 그 뱀이 다시 덮치면
  step(game, DT, NONE)
  assert.equal(game.phase, 'hit')
})

test('항아리를 열기 전에는 겉으로 알 수 없다 (판마다 섞여 나온다)', () => {
  let bonus = 0
  let snake = 0
  for (let n = 0; n < 60; n++) {
    for (const pot of buildStage(2).pots) (pot.snake ? snake++ : bonus++)
  }
  assert.ok(bonus > 0 && snake > 0, `보너스 ${bonus} · 뱀 ${snake} - 한쪽만 나온다`)
})

/* ---------- 배고픔 ---------- */

test('단계가 오를수록 주어지는 시간이 짧아진다', () => {
  assert.ok(hungerSeconds(1) > hungerSeconds(5))
  assert.ok(hungerSeconds(5) >= hungerSeconds(20))
  assert.ok(hungerSeconds(20) >= 42)
})

test('배가 다 고프면 목숨을 잃고, 다시 시작할 때는 조금 채워 준다', () => {
  const game = sandbox()
  game.hunger = 0.004
  hold(game, 1)
  assert.equal(game.phase, 'hit')
  assert.equal(game.lives, LIVES - 1)
  assert.ok(game.events.includes('hunger'))

  hold(game, 1.2)
  assert.equal(game.phase, 'playing')
  assert.ok(game.hunger >= 0.3, '다시 시작하자마자 또 굶는다')
})

/* ---------- 부딪힘 ---------- */

test('압정을 밟으면 목숨을 잃고, 뛰면 넘어간다', () => {
  const { game: stepped } = withSpike(4, 25)
  hold(stepped, 0.5, { right: true })
  assert.equal(stepped.phase, 'hit')
  assert.equal(stepped.lives, LIVES - 1)

  const { game: jumped, spikeX } = withSpike(4, 25)
  step(jumped, DT, { ...NONE, right: true, jump: true })
  hold(jumped, 0.5, { right: true })
  assert.equal(jumped.lives, LIVES, '뛰었는데도 압정에 찔렸다')
  assert.ok(jumped.player.x > spikeX + BOX.spike.w, '압정을 넘어가지 못했다')
})

test('뱀이나 전갈에 닿으면 목숨을 잃는다', () => {
  for (const kind of ['snake', 'scorpion']) {
    const game = sandbox()
    enemyAtPlayer(game, kind)
    step(game, DT, NONE)
    assert.equal(game.phase, 'hit', `${kind} 에 닿았는데 멀쩡하다`)
    assert.equal(game.lives, LIVES - 1)
  }
})

test('목숨을 다 쓰면 놀이가 끝난다', () => {
  const game = sandbox()
  for (let i = 0; i < LIVES; i++) {
    game.invulnLeft = 0
    game.stageData.spikes = []
    enemyAtPlayer(game)
    step(game, DT, NONE)
    if (i < LIVES - 1) hold(game, 1.2)
  }
  assert.equal(game.phase, 'over')
  assert.equal(game.lives, 0)
  assert.ok(game.events.includes('over'))
})

test('마지막 과일을 먹은 걸음에 뱀에 닿으면 단계 통과가 아니라 목숨을 잃는다', () => {
  const game = sandbox()
  const last = game.stageData.fruits[0]
  for (const f of game.stageData.fruits) f.taken = f !== last
  standAt(game, last.floor, last.box.x)
  enemyAtPlayer(game)

  step(game, DT, NONE)
  assert.equal(game.phase, 'hit', '단계 통과가 부딪힘을 덮었다')
  assert.equal(game.lives, LIVES - 1)
  assert.ok(last.taken, '과일은 먹은 것으로 남아야 한다')

  hold(game, 1.2)
  step(game, DT, NONE)
  assert.equal(game.phase, 'cleared')
})

/* ---------- 적 ---------- */

test('뱀도 전갈도 사다리를 타지 않고, 둘 다 구멍에 빠지지 않는다', () => {
  const game = sandbox()
  game.stageData.gaps[1] = [{ x0: 150, x1: 190 }] // 1층 한가운데 구멍 하나
  game.stageData.enemies = [spawn('scorpion', 1, 100), spawn('snake', 1, 240)]
  const scorpion = game.stageData.enemies[0]
  let turned = false

  for (let i = 0; i < 3600; i++) {
    const was = scorpion.dir
    game.invulnLeft = 1 // 너구리와 부딪혀 판이 끊기지 않게
    game.hunger = 1
    step(game, DT, NONE)
    if (scorpion.dir !== was) turned = true
    for (const e of game.stageData.enemies) {
      assert.equal(e.floor, 1, `${e.kind} 가 층을 옮겼다`)
      const size = BOX[e.kind]
      assert.ok(solidAt(game.stageData, e.floor, e.x + size.w / 2), `${e.kind} 가 구멍 위에 떠 있다`)
    }
  }
  assert.ok(turned, '전갈이 구멍이나 벽에서 한 번도 돌아서지 않았다')
})

test('아무 버튼이나 마구 눌러도 멈추거나 판 밖으로 나가지 않는다', () => {
  const game = fresh()
  let input = { ...NONE }
  for (let i = 0; i < 24000; i++) {
    if (i % 24 === 0) {
      input = {
        left: Math.random() < 0.3,
        right: Math.random() < 0.3,
        up: Math.random() < 0.3,
        down: Math.random() < 0.3,
        jump: Math.random() < 0.1,
      }
    }
    step(game, DT, input)
    game.events.length = 0
    if (game.phase === 'over') startGame(game)

    const p = game.player
    assert.ok(p.x >= WALL && p.x <= W - WALL - BOX.player.w, `너구리가 좌우 벽을 넘었다 (x=${p.x})`)
    assert.ok(p.y >= HUD && p.y <= H, `너구리가 위아래로 빠져나갔다 (y=${p.y})`)
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
    assert.ok(game.hunger >= 0 && game.hunger <= 1)
    for (const e of game.stageData.enemies) {
      assert.ok(e.x >= WALL && e.x <= W - WALL, `${e.kind} 가 벽을 넘었다 (x=${e.x})`)
      assert.ok(e.floor >= 0 && e.floor < FLOOR_Y.length)
    }
  }
})

/* ---------- 화면 밀기 (touch.js) ---------- */

test('덜 밀면 방향이 없다 (톡 치기로 본다)', () => {
  assert.equal(readSwipe(0, 0), null)
  assert.equal(readSwipe(SWIPE_MIN - 1, 0), null)
})

test('좌우·위아래로 밀면 그 방향, 위쪽 대각선은 그쪽 점프, 아래쪽 대각선은 걷기', () => {
  assert.equal(readSwipe(30, 5), 'right')
  assert.equal(readSwipe(-30, -5), 'left')
  assert.equal(readSwipe(4, -30), 'up')
  assert.equal(readSwipe(-4, 30), 'down')
  assert.equal(readSwipe(25, -25), 'jumpRight')
  assert.equal(readSwipe(-25, -25), 'jumpLeft')
  assert.equal(readSwipe(25, 25), 'right')
  assert.equal(readSwipe(-25, 25), 'left')
})

test('점프 대각선은 그쪽 키를 누른 채 한 번 뛴다', () => {
  assert.deepEqual(swipeKeys('jumpRight'), { hold: { left: false, right: true, up: false, down: false }, jump: true })
  assert.deepEqual(swipeKeys('up'), { hold: { left: false, right: false, up: true, down: false }, jump: false })
})

test('걷던 중 손가락이 살짝 위로 휜 것은 점프가 아니다 - 두 배를 밀어야 뛴다', () => {
  assert.equal(nextSwipe('right', 12, -12), null) // 대각선이지만 짧다 - 아직 걷기
  assert.equal(nextSwipe('right', 25, -25), 'jumpRight')
  assert.equal(nextSwipe(null, 12, -12), 'jumpRight') // 처음부터 비스듬히 밀면 바로 뛴다
  assert.equal(nextSwipe('right', -20, 0), 'left') // 걷기끼리는 그대로 바뀐다
})
