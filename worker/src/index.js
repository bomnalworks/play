// 봄날 오락실 순위표 서버 - Cloudflare Worker + KV
//
//   GET  /scores?game=plane&board=all      → { top: [{ name, score, at }, …] }   (1~5등)
//   POST /scores  { game, board, name, score } → { top, rank }   (rank 0 = 순위에 못 듦)
//
// KV 열쇠 하나에 게임·판 하나의 1~5등을 JSON 으로 둔다 (lb:<game>:<board>).
// 저장하는 것은 이니셜 3글자 · 점수 · 날짜뿐이다. IP 는 잠깐 횟수를 세는 데만 쓰고 어디에도 남기지 않는다.
import { cleanName, boardOk, scoreOk, insertScore } from '../../public/js/scores-rules.js'

const ORIGINS = new Set([
  'https://play.bomnalworks.com',
  'http://localhost:4173',
  'http://localhost:4174',
])
const POSTS_PER_MINUTE = 6 // 같은 곳에서 1분에 올릴 수 있는 횟수 (일꾼 하나 안에서만 센다 - 느슨한 막이)

const recent = new Map() // ip → [올린 시각들]. 메모리에만 있고 일꾼이 내려가면 사라진다

function cors(request) {
  const origin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': ORIGINS.has(origin) ? origin : 'https://play.bomnalworks.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

const json = (request, body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(request), ...extra },
  })

const keyOf = (game, board) => `lb:${game}:${board}`

async function readTop(env, game, board) {
  return (await env.SCORES.get(keyOf(game, board), 'json')) ?? []
}

function tooMany(ip, now) {
  const times = (recent.get(ip) ?? []).filter((t) => now - t < 60_000)
  times.push(now)
  recent.set(ip, times)
  if (recent.size > 5000) recent.clear() // 끝없이 쌓이지 않게
  return times.length > POSTS_PER_MINUTE
}

export async function handle(request, env, now = Date.now()) {
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) })
  if (url.pathname !== '/scores') return json(request, { error: 'not found' }, 404)

  if (request.method === 'GET') {
    const game = url.searchParams.get('game')
    const board = url.searchParams.get('board')
    if (!boardOk(game, board)) return json(request, { error: 'bad board' }, 400)
    return json(request, { top: await readTop(env, game, board) }, 200, { 'Cache-Control': 'public, max-age=10' })
  }

  if (request.method === 'POST') {
    if (!ORIGINS.has(request.headers.get('Origin'))) return json(request, { error: 'origin' }, 403) // 이 사이트에서 온 것만
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
    if (tooMany(ip, now)) return json(request, { error: 'slow down' }, 429)

    let body
    try {
      body = await request.json()
    } catch {
      return json(request, { error: 'bad json' }, 400)
    }
    const game = String(body?.game ?? '')
    const board = String(body?.board ?? '')
    const name = cleanName(body?.name)
    const score = body?.score
    if (!boardOk(game, board)) return json(request, { error: 'bad board' }, 400)
    if (!name) return json(request, { error: 'bad name' }, 400)
    if (!scoreOk(game, board, score)) return json(request, { error: 'bad score' }, 400)

    const at = new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10) // 한국 날짜
    const { list, rank } = insertScore(game, await readTop(env, game, board), { name, score, at })
    if (rank) await env.SCORES.put(keyOf(game, board), JSON.stringify(list))
    return json(request, { top: list, rank })
  }

  return json(request, { error: 'method' }, 405)
}

export default { fetch: (request, env) => handle(request, env) }
