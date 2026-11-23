// 오락실 순위표 검사 - 규칙(scores-rules.js)과 서버(worker/src/index.js)를 KV 대신 메모리로 돌려 본다
import test from 'node:test'
import assert from 'node:assert/strict'
import { TOP, GAMES, cleanName, scoreOk, qualifies, insertScore } from '../public/js/scores-rules.js'
import { handle } from '../worker/src/index.js'
import { memoryKV } from '../scripts/memory-kv.mjs'
import { MAX_LEVEL } from '../public/games/sudoku/logic.js'

test('이니셜은 대문자 영문·숫자 1~3글자, 못 쓰는 낱말은 거른다', () => {
  assert.equal(cleanName('abc'), 'ABC')
  assert.equal(cleanName(' k-1 z'), 'K1Z')
  assert.equal(cleanName('abcd'), 'ABC')
  assert.equal(cleanName('봄날'), null)
  assert.equal(cleanName(''), null)
  assert.equal(cleanName('sex'), null)
  assert.equal(cleanName('<b>'), 'B')
})

test('말이 안 되는 점수는 받지 않는다', () => {
  assert.ok(scoreOk('plane', 'all', 523))
  assert.equal(scoreOk('plane', 'all', 0), false)
  assert.equal(scoreOk('plane', 'all', 3.5), false)
  assert.equal(scoreOk('plane', '1', 10), false) // 없는 판
  assert.equal(scoreOk('sudoku', '3', 5000), false) // 5초 만에 스도쿠를 풀 수는 없다
  assert.ok(scoreOk('sudoku', '3', 95_000))
  assert.equal(scoreOk('memory', '5', 3000), false) // 42장을 3초에?
  assert.ok(scoreOk('memory', '1', 1200)) // 1단계(4장)는 미리 보기 뒤 1초 남짓에도 깬다
  assert.ok(scoreOk('memory', '1', 2500))
  assert.equal(scoreOk('tetris', 'all', 10), false)
})

test('스도쿠 레벨 수는 게임 쪽 MAX_LEVEL 과 같다 (규칙 파일에 손으로 적어 둔 값)', () => {
  assert.equal(GAMES.sudoku.boards.length, MAX_LEVEL)
})

test('높을수록 위인 게임과 낮을수록(시간) 위인 게임을 각각 바르게 줄 세운다', () => {
  let list = []
  for (const [name, score] of [['AAA', 300], ['BBB', 500], ['CCC', 100], ['DDD', 400], ['EEE', 200], ['FFF', 450]]) {
    list = insertScore('plane', list, { name, score, at: '2026-11-23' }).list
  }
  assert.equal(list.length, TOP)
  assert.deepEqual(list.map((e) => e.name), ['BBB', 'FFF', 'DDD', 'AAA', 'EEE'])

  let times = []
  for (const [name, score] of [['AAA', 90_000], ['BBB', 60_000], ['CCC', 120_000]]) {
    times = insertScore('sudoku', times, { name, score, at: '2026-11-23' }).list
  }
  assert.deepEqual(times.map((e) => e.name), ['BBB', 'AAA', 'CCC'])
})

test('같은 점수는 먼저 올린 사람이 위이고, 5등 밖이면 순위가 그대로다', () => {
  const full = [500, 400, 300, 200, 100].map((score, i) => ({ name: `A${i}`, score, at: '' }))
  assert.equal(qualifies('plane', full, 100), false) // 5등과 같으면 못 든다
  assert.equal(qualifies('plane', full, 101), true)
  const tie = insertScore('plane', full, { name: 'NEW', score: 300, at: '' })
  assert.equal(tie.rank, 4)
  assert.deepEqual(tie.list.map((e) => e.name), ['A0', 'A1', 'A2', 'NEW', 'A3'])
  const out = insertScore('plane', full, { name: 'LOW', score: 50, at: '' })
  assert.equal(out.rank, 0)
  assert.equal(out.list, full)
  assert.equal(qualifies('plane', [], 1), true) // 빈 순위표에는 누구나 든다
})

/* ---------- 서버 ---------- */

function fakeEnv() {
  const SCORES = memoryKV()
  return { memory: SCORES.map, SCORES }
}
const ORIGIN = 'https://play.bomnalworks.com'
const post = (body, { origin = ORIGIN, ip = '1.1.1.1' } = {}) =>
  new Request('https://scores.example/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const get = (q) => new Request(`https://scores.example/scores?${q}`, { headers: { Origin: ORIGIN } })

test('서버: 올리면 순위에 들고, 읽으면 1~5등을 돌려준다', async () => {
  const env = fakeEnv()
  let res = await handle(post({ game: 'plane', board: 'all', name: 'kim', score: 812 }, { ip: '9.9.9.1' }), env)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.rank, 1)
  assert.equal(body.top[0].name, 'KIM')
  assert.match(body.top[0].at, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)

  res = await handle(get('game=plane&board=all'), env)
  assert.deepEqual((await res.json()).top.map((e) => e.score), [812])
  // 저장된 것은 이니셜·점수·날짜뿐
  const saved = JSON.parse(env.memory.get('lb:plane:all'))
  assert.deepEqual(Object.keys(saved[0]).sort(), ['at', 'name', 'score'])
})

test('서버: 잘못된 판·이니셜·점수·출처는 거절하고 저장하지 않는다', async () => {
  const env = fakeEnv()
  const cases = [
    [{ game: 'plane', board: 'x', name: 'AAA', score: 10 }, 400],
    [{ game: 'plane', board: 'all', name: '!!!', score: 10 }, 400],
    [{ game: 'plane', board: 'all', name: 'AAA', score: 9_999_999 }, 400],
    [{ game: 'plane', board: 'all', name: 'AAA', score: '10' }, 400],
  ]
  let n = 0
  for (const [body, status] of cases) {
    const res = await handle(post(body, { ip: `8.8.8.${n++}` }), env)
    assert.equal(res.status, status, JSON.stringify(body))
  }
  assert.equal((await handle(post('{oops', { ip: '8.8.8.99' }), env)).status, 400)
  assert.equal((await handle(post({ game: 'plane', board: 'all', name: 'AAA', score: 10 }, { origin: 'https://evil.example', ip: '8.8.4.4' }), env)).status, 403)
  assert.equal((await handle(get('game=nope&board=all'), env)).status, 400)
  assert.equal(env.memory.size, 0)
})

test('서버: 같은 곳에서 1분에 너무 많이 올리면 잠시 막는다', async () => {
  const env = fakeEnv()
  const statuses = []
  for (let i = 0; i < 8; i++) {
    const res = await handle(post({ game: 'neoguri', board: 'all', name: 'ZZZ', score: 100 + i }, { ip: '7.7.7.7' }), env, 1_000_000 + i)
    statuses.push(res.status)
  }
  assert.ok(statuses.slice(0, 6).every((s) => s === 200))
  assert.equal(statuses[7], 429)
  // 1분이 지나면 다시 된다
  const later = await handle(post({ game: 'neoguri', board: 'all', name: 'ZZZ', score: 999 }, { ip: '7.7.7.7' }), env, 1_000_000 + 61_000)
  assert.equal(later.status, 200)
})

test('규칙의 모든 게임·판이 서버에서 읽힌다', async () => {
  const env = fakeEnv()
  for (const [game, g] of Object.entries(GAMES)) {
    for (const board of g.boards) {
      const res = await handle(get(`game=${game}&board=${board}`), env)
      assert.equal(res.status, 200, `${game}/${board}`)
    }
  }
})
