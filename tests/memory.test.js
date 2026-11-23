// 봄날 짝맞추기 규칙 검사 - 화면 없이 logic.js 만 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import {
  STAGES, MAX_STAGE, THEMES, clampStage, pairsOf, createGame, flip, hideMiss, isFaceUp,
} from '../public/games/memory/logic.js'

test('테마마다 적어 둔 그림 수가 실제 카드 파일 수와 같고, 5단계에 모자라지 않다', () => {
  for (const { key, count } of THEMES) {
    const dir = new URL(`../public/games/memory/cards/${key}/`, import.meta.url)
    const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).sort()
    // 화면은 01.webp … 처럼 번호로 부르니 빠진 번호가 없어야 한다
    assert.deepEqual(files, Array.from({ length: count }, (_, i) => `${String(i + 1).padStart(2, '0')}.webp`), key)
    assert.ok(count >= pairsOf(MAX_STAGE), `${key}: ${count}가지로는 ${pairsOf(MAX_STAGE)}쌍을 못 깐다`)
  }
})

const KINDS = 24

// 같은 그림의 두 장 / 다른 그림의 두 장 찾기
const pairOf = (g, face) => g.cards.flatMap((f, i) => (f === face ? [i] : []))
const missPair = (g) => {
  const a = 0
  const b = g.cards.findIndex((f) => f !== g.cards[0])
  return [a, b]
}

test('단계는 2×2 · 3×4 · 4×5 · 5×6 · 6×7 다섯 개다', () => {
  assert.equal(MAX_STAGE, 5)
  assert.deepEqual(STAGES.map((s) => s.cols * s.rows), [4, 12, 20, 30, 42])
  assert.equal(clampStage(0), 1)
  assert.equal(clampStage(9), 5)
  assert.equal(clampStage('abc'), 1)
})

test('그림마다 꼭 두 장씩 깔린다', () => {
  for (let stage = 1; stage <= MAX_STAGE; stage++) {
    const g = createGame(stage, KINDS)
    assert.equal(g.cards.length, pairsOf(stage) * 2)
    const counts = new Map()
    for (const f of g.cards) counts.set(f, (counts.get(f) ?? 0) + 1)
    assert.equal(counts.size, pairsOf(stage))
    for (const n of counts.values()) assert.equal(n, 2)
    for (const f of counts.keys()) assert.ok(f >= 0 && f < KINDS)
  }
  assert.throws(() => createGame(5, 20)) // 21쌍이 필요하다
})

test('같은 그림 두 장을 뒤집으면 짝이 된다', () => {
  const g = createGame(2, KINDS)
  const [a, b] = pairOf(g, g.cards[0])
  assert.equal(flip(g, a), 'first')
  assert.equal(flip(g, a), 'none') // 이미 열린 카드
  assert.equal(flip(g, b), 'match')
  assert.equal(g.tries, 1)
  assert.equal(g.found, 1)
  assert.ok(isFaceUp(g, a) && isFaceUp(g, b))
  assert.equal(flip(g, a), 'none') // 짝 찾은 카드는 더 못 뒤집는다
})

test('다른 그림이면 둘 다 앞면으로 남았다가, 다음 카드를 누르면 덮인다', () => {
  const g = createGame(2, KINDS)
  const [a, b] = missPair(g)
  flip(g, a)
  assert.equal(flip(g, b), 'miss')
  assert.ok(isFaceUp(g, a) && isFaceUp(g, b))
  const c = g.cards.findIndex((_, i) => i !== a && i !== b)
  assert.equal(flip(g, c), 'first')
  assert.ok(!isFaceUp(g, a) && !isFaceUp(g, b) && isFaceUp(g, c))
  assert.equal(g.tries, 1)
})

test('틀린 두 장 중 하나를 다시 누르면 덮이고 그 카드가 첫 장이 된다', () => {
  const g = createGame(2, KINDS)
  const [a, b] = missPair(g)
  flip(g, a)
  flip(g, b)
  assert.equal(flip(g, a), 'first')
  assert.deepEqual(g.open, [a])
})

test('hideMiss 는 틀린 두 장만 덮는다', () => {
  const g = createGame(2, KINDS)
  const [a, b] = missPair(g)
  flip(g, a)
  assert.equal(hideMiss(g), false) // 한 장만 열려 있으면 그대로
  flip(g, b)
  assert.equal(hideMiss(g), true)
  assert.deepEqual(g.open, [])
})

test('짝을 다 찾으면 끝난다', () => {
  for (let stage = 1; stage <= MAX_STAGE; stage++) {
    const g = createGame(stage, KINDS)
    for (let face = 0; face < KINDS; face++) {
      const idx = pairOf(g, face)
      if (!idx.length) continue
      flip(g, idx[0])
      flip(g, idx[1])
    }
    assert.equal(g.done, true)
    assert.equal(g.tries, pairsOf(stage)) // 한 번도 안 틀렸다
    assert.equal(flip(g, 0), 'none')
  }
})
