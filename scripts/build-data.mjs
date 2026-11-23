// data/<연도>/<연령대>/<상괘>.json (손으로 쓴 풀이) + outline
//   → public/data/<연도>/<연령대>/<괘>.json (화면이 읽는, 괘 하나짜리 파일)
//
// 방문자는 자기 괘 하나만 보니 괘마다 파일을 따로 둔다. 120괘를 통째로 받지 않아도 된다.
// 합치면서 검사도 한다. 어긋나면 파일을 쓰지 않고 멈춘다.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { checkEntries } from './check-entries.mjs'
import { root, scheme, outline, groups, loadGroup } from './load-entries.mjs'

const year = scheme.year
let failed = 0

for (const group of groups) {
  const { entries, missing } = loadGroup(group)
  const problems = checkEntries(entries, outline, { partial: missing.length > 0, fields: scheme.fields })
  if (missing.length) {
    // 조각이 빠진 채로 쓰면 이미 만들어 둔 괘 파일이 사라진다. 검사만 하고 넘어간다.
    console.log(`  건너뜀 - 아직 없는 조각: ${missing.join(', ')}`)
    if (problems.length) { failed++; for (const p of problems.slice(0, 20)) console.error('   ' + p) }
    continue
  }
  if (problems.length) {
    failed++
    console.error(`✖ ${group}: ${problems.length}건`)
    for (const p of problems.slice(0, 20)) console.error('   ' + p)
    continue
  }

  const dir = `${root}public/data/${year}/${group}`
  rmSync(dir, { recursive: true, force: true })   // 예전 괘 파일이 남지 않게 지우고 새로 쓴다
  mkdirSync(dir, { recursive: true })
  const byGwae = new Map(outline.entries.map((e) => [e.gwae, e]))
  for (const entry of entries) {
    writeFileSync(`${dir}/${entry.gwae}.json`, JSON.stringify({ ...byGwae.get(entry.gwae), ...entry }) + '\n')
  }
  console.log(`✔ ${group}: ${entries.length}괘 → public/data/${year}/${group}/<괘>.json`)
}

if (failed) process.exit(1)
