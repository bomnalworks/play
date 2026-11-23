// 순위표 서버를 이 PC 에서 시험으로 띄운다 (Cloudflare 없이). npm run scores → http://localhost:8787
// 진짜 서버(worker/src/index.js)의 처리 함수를 그대로 쓰고, KV 대신 메모리에 둔다 - 끄면 순위가 사라진다.
import { createServer } from 'node:http'
import { handle } from '../worker/src/index.js'
import { memoryKV } from './memory-kv.mjs'

const env = { SCORES: memoryKV() }

const port = +(process.env.PORT ?? 8787)
createServer(async (req, res) => {
  try {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = chunks.length ? Buffer.concat(chunks) : undefined
    const request = new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body })
    const response = await handle(request, env)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (err) {
    res.writeHead(500)
    res.end(String(err))
  }
}).listen(port, () => console.log(`순위표 시험 서버 http://localhost:${port}`))
