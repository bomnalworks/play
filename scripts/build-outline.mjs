// data/scheme.json + 그해에 나올 수 있는 괘 목록 → data/<연도>/outline.json, public/js/config.js
//
// outline 은 괘마다 "등급 + 이름 + 상징 한 줄"을 규칙으로 정한 것이다. 풀이 문장은 이 윤곽을 보고 사람이 쓴다.
// 등급은 상괘의 기본 등급에 중괘의 gradeShift 를 더해 정한다. (아래로는 scheme.gradeFloor 까지만)
// 규칙 값은 모두 scheme.json 에 있다. 이 파일에는 숫자를 두지 않는다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { reachableGwae } from '../public/js/tojeong.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const scheme = JSON.parse(readFileSync(root + 'public/data/scheme.json', 'utf-8'))
const { year, gradeLadder: LADDER } = scheme

const floor = LADDER.indexOf(scheme.gradeFloor)
if (floor < 0) throw new Error(`gradeFloor "${scheme.gradeFloor}" 가 gradeLadder 에 없습니다.`)
for (const g of Object.keys(scheme.grades)) {
  if (!LADDER.includes(g)) throw new Error(`grades 의 "${g}" 가 gradeLadder 에 없습니다.`)
}

function grade(upper, middle) {
  const base = LADDER.indexOf(upper.grade)
  if (base < 0) throw new Error(`상괘 등급 "${upper.grade}" 가 gradeLadder 에 없습니다.`)
  const shifted = base + middle.gradeShift
  // 내리는 보정은 gradeFloor 아래로 내려가지 않고, 올리는 보정은 사다리 끝을 넘지 않는다.
  // 어느 쪽이든 보정 방향을 거슬러 기본 등급을 넘지는 않는다. (살펴보기 + 내림 = 살펴보기)
  const clamped = middle.gradeShift < 0
    ? Math.min(base, Math.max(shifted, floor))
    : Math.max(base, Math.min(shifted, LADDER.length - 1))
  return LADDER[clamped]
}

const entries = reachableGwae(year).map((gwae) => {
  const [u, m, l] = gwae.split('')
  const U = scheme.upper[u], M = scheme.middle[m], L = scheme.lower[l]
  return {
    gwae,
    name: `${U.name} · ${M.name} · ${L.name}`,
    grade: grade(U, M),
    symbol: `${U.symbol}, ${M.short}, ${L.closing}`,
    peak: M.peak
  }
})

mkdirSync(`${root}data/${year}`, { recursive: true })
writeFileSync(`${root}data/${year}/outline.json`,
  JSON.stringify({ version: scheme.version, year, count: entries.length, entries }, null, 1) + '\n')

// 화면이 쓰는 값(연도·연령대 구분)은 scheme.json 에서 뽑아 한 모듈로 내보낸다. 손으로 적지 않는다.
const groups = Object.entries(scheme.ageGroups).map(([key, g]) => ({ key, label: g.label, maxAge: g.maxAge }))
writeFileSync(`${root}public/js/config.js`,
  `// scripts/build-outline.mjs 가 public/data/scheme.json 에서 만든 파일입니다. 직접 고치지 마세요.\n` +
  `export const YEAR = ${year}\n` +
  `export const GROUPS = ${JSON.stringify(groups)}\n`)

const tally = {}
for (const e of entries) tally[e.grade] = (tally[e.grade] ?? 0) + 1
console.log(`${entries.length}괘`, tally)
