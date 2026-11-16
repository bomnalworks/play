// node_modules/kor-lunar → public/vendor (브라우저가 import map 으로 쓰는 사본)
// 테스트는 node_modules 를, 방문자는 이 사본을 쓰므로 둘이 달라지면 안 된다.
// 배포 워크플로가 이 스크립트를 돌린 뒤 git diff 로 사본이 최신인지 확인한다.
import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const from = root + 'node_modules/kor-lunar/'
const to = root + 'public/vendor/'

mkdirSync(to, { recursive: true })
copyFileSync(from + 'dist/kor-lunar.esm.js', to + 'kor-lunar.esm.js')
copyFileSync(from + 'LICENSE', to + 'kor-lunar-LICENSE.txt')
console.log('public/vendor 를 node_modules/kor-lunar 와 맞췄습니다.')
