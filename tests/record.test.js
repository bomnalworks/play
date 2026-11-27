// 내 전적(js/record.js) 검사 - 화면 없이, 이 브라우저 저장소 대신 메모리로
import test from 'node:test'
import assert from 'node:assert/strict'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
}
const { createRecord } = await import('../public/js/record.js')

const LEVELS = ['easy', 'normal', 'hard']
const NAMES = { easy: '초급', normal: '중급', hard: '고급' }

test('"몇 전 몇 승"과 "몇 연승 중"으로 적고, 지거나 비기면 연승이 끊긴다', () => {
  mem.clear()
  const r = createRecord('t1', LEVELS, NAMES)
  assert.equal(r.show('normal'), '중급 - 아직 전적이 없어요')
  r.add('normal', 'w')
  assert.equal(r.show('normal'), '중급 1전 1승') // 1승은 아직 연승이라 부르지 않는다
  r.add('normal', 'w')
  r.add('normal', 'w')
  assert.equal(r.show('normal'), '중급 3전 3승 · 3연승 중')
  r.add('normal', 'd')
  assert.equal(r.show('normal'), '중급 4전 3승 1무')
  r.add('normal', 'w')
  r.add('normal', 'l')
  assert.equal(r.show('normal'), '중급 6전 4승 1무 1패')
  assert.equal(r.show('easy'), '초급 - 아직 전적이 없어요') // 난이도마다 따로

  r.add('normal', 'w')
  r.add('normal', 'w')
  r.quit('normal') // 끝내지 않고 버린 판: 전적에는 안 들어가고 연승만 끊긴다
  assert.equal(r.show('normal'), '중급 8전 6승 1무 1패')
  r.quit('nowhere')

  const saved = JSON.parse(mem.get('t1'))
  assert.deepEqual(saved.normal, { w: 6, d: 1, l: 1, streak: 0, best: 3 })
})

test('예전 저장(w·d·l 만)과 망가진 값도 읽는다', () => {
  mem.clear()
  mem.set('t2', JSON.stringify({ hard: { w: 0, d: 7, l: 2 }, easy: { w: -3, d: 'x' }, normal: null }))
  const r = createRecord('t2', LEVELS, NAMES)
  assert.equal(r.show('hard'), '고급 9전 0승 7무 2패')
  assert.equal(r.show('easy'), '초급 - 아직 전적이 없어요')
  assert.equal(r.show('normal'), '중급 - 아직 전적이 없어요') // null 로 저장돼 있어도 멈추지 않는다
  r.add('easy', 'w')
  r.add('easy', 'w')
  assert.equal(r.show('easy'), '초급 2전 2승 · 2연승 중')
  r.add('easy', 'nope') // 모르는 결과는 넣지 않는다
  r.add('nowhere', 'w')
  assert.equal(r.show('easy'), '초급 2전 2승 · 2연승 중')
})
