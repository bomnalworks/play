// node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { castGwae, taeseNum, wolgeonNum, iljinNum, reachableGwae } from '../public/js/tojeong.js'

// 전통 조견표(태세수/월건수/일진수). 출처 페이지의 행 이름 오타 3곳(기해·기유·신유가 乙亥·乙酉·辛卯로 적힘)은 바로잡아 옮겼다.
const SOURCE = `
갑자 20 18 18|갑술 22 14 20|갑신 21 16 19|갑오 18 18 16|갑진 22 14 20|갑인 19 16 17
을축 20 16 19|을해 19 12 17|을유 20 14 18|을미 21 16 19|을사 17 12 15|을묘 18 14 16
병인 17 14 15|병자 18 16 16|병술 20 12 18|병신 19 14 17|병오 16 16 14|병진 20 12 18
정묘 16 12 14|정축 19 14 17|정해 17 10 15|정유 18 12 16|정미 19 14 17|정사 15 10 13
무진 18 10 16|무인 15 12 13|무자 16 14 14|무술 18 10 16|무신 17 12 15|무오 14 14 12
기사 18 13 16|기묘 19 15 17|기축 22 17 20|기해 20 13 18|기유 21 15 19|기미 22 17 20
경오 17 17 15|경진 21 13 19|경인 18 15 16|경자 19 17 17|경술 21 13 19|경신 20 15 18
신미 20 15 18|신사 16 11 14|신묘 17 13 15|신축 20 15 18|신해 18 11 16|신유 19 13 17
임신 18 13 16|임오 15 15 13|임진 19 11 17|임인 16 13 14|임자 17 15 15|임술 19 11 17
계유 17 11 15|계미 18 13 16|계사 14 9 12|계묘 15 11 13|계축 18 13 16|계해 16 9 14`
  .trim().split(/[|\n]/).map((r) => r.trim().split(/\s+/))

test('조견표 59칸 일치, 을축 태세수만 다름', () => {
  // 신축 태세수는 출처에 20 으로 적혀 있다. 축(丑)의 태세 지지 수가 정축·기축·계축 모두 13 이라
  // 을축(20)과 신축(20)은 표 오타로 보고, 규칙대로 21·20 을 쓴다. (신 7 + 축 13 = 20 은 일치)
  const mismatches = []
  for (const [g, t, w, i] of SOURCE) {
    if (taeseNum(g) !== +t) mismatches.push(`${g} 태세 ${t}→${taeseNum(g)}`)
    if (wolgeonNum(g) !== +w) mismatches.push(`${g} 월건 ${w}→${wolgeonNum(g)}`)
    if (iljinNum(g) !== +i) mismatches.push(`${g} 일진 ${i}→${iljinNum(g)}`)
  }
  assert.equal(SOURCE.length, 60)
  assert.deepEqual(mismatches, ['을축 태세 20→21'])
})

test('예시 1: 음력 1976-08-26생, 2005년 → 212', () => {
  const r = castGwae({ calendar: 'lunar', year: 1976, month: 8, day: 26 }, 2005)
  assert.equal(r.detail.age, 30)
  assert.equal(r.detail.secha, '을유')
  assert.equal(r.detail.taese, 20)
  assert.equal(r.detail.monthDays, 29)
  assert.equal(r.detail.wolgeon, '을유')
  assert.equal(r.detail.iljin, '병진')
  assert.equal(r.gwae, '212')
})

test('예시 2: 음력 1985-03-06생, 2018년 → 451', () => {
  const r = castGwae({ calendar: 'lunar', year: 1985, month: 3, day: 6 }, 2018)
  assert.equal(r.detail.age, 34)
  assert.equal(r.detail.secha, '무술')
  assert.equal(r.detail.taese, 18)
  assert.equal(r.detail.monthDays, 29)
  assert.equal(r.detail.wolgeon, '병진')
  assert.equal(r.detail.iljin, '계미')
  assert.equal(r.gwae, '451')
})

test('양력 입력은 음력으로 바꿔 계산한다 (양력 1976-09-19 = 음력 8-26)', () => {
  const a = castGwae({ calendar: 'solar', year: 1976, month: 9, day: 19 }, 2005)
  assert.equal(a.gwae, '212')
})

test('2027년 결과는 나올 수 있는 120괘 안에 있고, 120괘가 모두 나온다', () => {
  const reachable = new Set(reachableGwae(2027))
  assert.equal(reachable.size, 120)
  const seen = new Set()
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 29; d++) {
      for (let y = 1980; y < 1988; y++) { // 8년 연속이면 상괘 8종이 모두 나온다
        const r = castGwae({ calendar: 'lunar', year: y, month: m, day: d }, 2027)
        assert.ok(r.upper >= 1 && r.upper <= 8 && r.middle >= 1 && r.middle <= 6 && r.lower >= 1 && r.lower <= 3)
        assert.ok(reachable.has(r.gwae), r.gwae)
        seen.add(r.gwae)
      }
    }
  }
  assert.equal(seen.size, 120)
})

test('윤달생과 30일생도 계산된다', () => {
  // 2023년 윤2월
  assert.ok(castGwae({ calendar: 'lunar', year: 2023, month: 2, day: 10, isLeap: true }, 2027).gwae)
  for (let m = 1; m <= 12; m++) {
    try {
      castGwae({ calendar: 'lunar', year: 1980, month: m, day: 30 }, 2027)
    } catch (e) {
      if (!(e instanceof RangeError)) throw e // 1980년 그 달에 30일이 없으면 입력 단계에서 막힌다
    }
  }
})
