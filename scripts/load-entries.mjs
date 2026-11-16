// 손으로 쓴 풀이 조각(data/<연도>/<연령대>/<상괘>.json)을 읽어 한 줄로 세운다.
// 빌드(build-data.mjs)와 테스트(tests/data.test.js)가 같이 쓴다.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../', import.meta.url))
export const readJson = (relative) => JSON.parse(readFileSync(root + relative, 'utf-8'))

export const scheme = readJson('public/data/scheme.json')
export const outline = readJson(`data/${scheme.year}/outline.json`)
export const groups = Object.keys(scheme.ageGroups)

/** @returns {{entries: object[], missing: string[]}} */
export function loadGroup(group, year = scheme.year) {
  const entries = []
  const missing = []
  for (let upper = 1; upper <= 8; upper++) {
    const file = `data/${year}/${group}/${upper}.json`
    if (existsSync(root + file)) entries.push(...readJson(file))
    else missing.push(file)
  }
  return { entries, missing }
}
