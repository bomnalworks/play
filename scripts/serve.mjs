// 로컬 확인용 정적 서버. npm run serve → http://localhost:4173
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../public/', import.meta.url))
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
}
const port = +(process.env.PORT ?? 4173)

createServer(async (req, res) => {
  // 이상한 요청 하나에 서버가 죽지 않도록 주소 해석까지 전부 감싼다.
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const parts = (path.endsWith('/') ? path + 'index.html' : path).split('/').filter(Boolean)
    const file = resolve(root, ...parts)
    // public 밖(상위 폴더의 .env 등)을 읽지 못하게 막는다. '..' 과 인코딩된 역슬래시 모두 여기서 걸린다.
    if (file !== resolve(root) && !file.startsWith(resolve(root) + sep)) throw new Error('범위 밖')
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(parts.at(-1) ?? '')] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('404')
  }
}).listen(port, () => console.log(`http://localhost:${port}`))
