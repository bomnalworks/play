// 풀이 데이터 검사: 그해 괘가 연령대마다 빠짐없이 있고, 형식·말투 규칙을 지키는지 본다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkEntries } from '../scripts/check-entries.mjs'
import { scheme, outline, groups, loadGroup, readJson } from '../scripts/load-entries.mjs'
import { reachableGwae } from '../public/js/tojeong.js'

const year = scheme.year
const reachable = reachableGwae(year)

test('outline 은 그해에 나올 수 있는 괘와 같다', () => {
  assert.equal(outline.year, year)
  assert.equal(outline.count, reachable.length)
  assert.deepEqual(outline.entries.map((e) => e.gwae), reachable)
  for (const e of outline.entries) {
    assert.ok(scheme.grades[e.grade], `등급 ${e.grade}`)
    assert.ok(e.peak >= 0 && e.peak <= 3)
  }
})

test('중괘 보정이 등급을 거꾸로 움직이지 않는다', () => {
  const ladder = scheme.gradeLadder
  const floor = ladder.indexOf(scheme.gradeFloor)
  for (const e of outline.entries) {
    const [u, m] = e.gwae.split('')
    const base = ladder.indexOf(scheme.upper[u].grade)
    const got = ladder.indexOf(e.grade)
    const shift = scheme.middle[m].gradeShift
    if (shift < 0) {
      assert.ok(got <= base, `${e.gwae}: 내리는 보정인데 ${scheme.upper[u].grade} → ${e.grade}`)
      assert.ok(got >= Math.min(base, floor), `${e.gwae}: ${scheme.gradeFloor} 아래로 내려갔다`)
    } else if (shift > 0) {
      assert.ok(got >= base, `${e.gwae}: 올리는 보정인데 ${scheme.upper[u].grade} → ${e.grade}`)
    } else {
      assert.equal(got, base, `${e.gwae}: 보정이 없는데 등급이 바뀌었다`)
    }
  }
})

test('config.js 는 scheme.json 의 연도·연령대와 같다', async () => {
  const config = await import('../public/js/config.js')
  assert.equal(config.YEAR, year)
  assert.deepEqual(config.GROUPS.map((g) => g.key), groups)
  for (const g of config.GROUPS) assert.equal(g.label, scheme.ageGroups[g.key].label)
  // 마지막 칸만 위로 열려 있고, 경계가 겹치거나 비지 않는다
  const bounds = config.GROUPS.map((g) => g.maxAge)
  assert.equal(bounds.at(-1), null)
  assert.deepEqual(bounds.slice(0, -1), [...bounds.slice(0, -1)].sort((a, b) => a - b))
})

for (const group of groups) {
  test(`${group}: 풀이가 규칙을 지키고 괘마다 파일이 있다`, () => {
    const { entries, missing } = loadGroup(group)
    assert.deepEqual(missing, [])
    assert.equal(entries.length, reachable.length)
    assert.deepEqual(checkEntries(entries, outline, { fields: scheme.fields }), [])

    // 화면이 받는 파일에 outline 과 풀이가 모두 들어 있는지
    const sample = readJson(`public/data/${year}/${group}/${reachable[0]}.json`)
    for (const key of ['gwae', 'name', 'grade', 'symbol', 'peak', 'summary', 'overall', 'quarters', 'advice', 'lucky']) {
      assert.ok(sample[key] !== undefined, `${key} 없음`)
    }
  })
}

test('같은 괘라도 연령대마다 다른 문장이다', () => {
  const byGroup = groups.map((g) => loadGroup(g).entries)
  for (let i = 0; i < byGroup[0].length; i++) {
    const texts = byGroup.map((entries) => entries[i].overall)
    assert.equal(new Set(texts).size, groups.length, `${byGroup[0][i].gwae} 총운이 겹친다`)
  }
})

test('한 연령대 안에서 한 줄 요약이 거의 겹치지 않는다', () => {
  for (const group of groups) {
    const sums = loadGroup(group).entries.map((e) => e.summary)
    const dup = sums.filter((s, i) => sums.indexOf(s) !== i)
    assert.ok(dup.length <= 6, `${group}: 겹치는 요약 ${dup.length}개 - ${[...new Set(dup)].join(', ')}`)
  }
})
