// 손으로 쓴 풀이 조각(data/<연도>/<연령대>/<상괘>.json)을 읽어 한 줄로 세운다.
// 빌드(build-data.mjs)와 테스트(tests/data.test.js)가 같이 쓴다.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../', import.meta.url))
export const readJson = (relative) => JSON.parse(readFileSync(root + relative, 'utf-8'))

export const scheme = readJson('public/data/scheme.json')
export const outline = readJson(`data/${scheme.year}/outline.json`)
export const groups = Object.keys(scheme.ageGroups)

/**
 * 풀이 조각(<상괘>.json)과 분야별 조각(fields-<상괘>.json)을 괘 번호로 묶어 돌려준다.
 * @returns {{entries: object[], missing: string[]}}
 */
export function loadGroup(group, year = scheme.year) {
  const entries = []
  const missing = []
  for (let upper = 1; upper <= 8; upper++) {
    const main = `data/${year}/${group}/${upper}.json`
    const extra = `data/${year}/${group}/fields-${upper}.json`
    if (!existsSync(root + main)) { missing.push(main); continue }
    const byGwae = new Map()
    if (existsSync(root + extra)) for (const f of readJson(extra)) byGwae.set(f.gwae, f.fields)
    else missing.push(extra)
    for (const e of readJson(main)) entries.push(byGwae.has(e.gwae) ? { ...e, fields: byGwae.get(e.gwae) } : e)
  }
  return { entries, missing }
}
