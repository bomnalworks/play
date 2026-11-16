// 토정비결 작괘(괘 뽑기).
//
//   상괘 = (세는 나이 + 그해 태세수) % 8          (0 이면 8)
//   중괘 = (그해 생월의 날수 + 그해 생월 월건수) % 6 (0 이면 6)
//   하괘 = (음력 생일 + 그해 생일의 일진수) % 3     (0 이면 3)
//
// 생월·생일은 "운세를 보는 해"의 같은 음력 달·날짜로 본다. (그해 3월 6일의 일진 등)
// 태세수·월건수·일진수는 천간 수 + 지지 수로 정해진다. 값은 전통 조견표 60갑자와 대조했다. (tests/tojeong.test.js)
// 음력 변환: kor-lunar (MIT, 한국천문연구원 데이터, 1890~2050)

import { LunarCalendar, SolarTable } from 'kor-lunar'

const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계']
const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해']

// 천간 수: 세 표 모두 같다 (갑기 9, 을경 8, 병신 7, 정임 6, 무계 5)
const STEM_NUM = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5]
// 지지 수: 표마다 다르다
const BRANCH_TAESE = [11, 13, 10, 10, 13, 9, 9, 13, 12, 12, 13, 11]
const BRANCH_WOLGEON = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4]
const BRANCH_ILJIN = [9, 11, 8, 8, 11, 7, 7, 11, 10, 10, 11, 9]

// 간지 한 글자씩을 수로 바꿔 더한다. 표만 다르고 셈은 같다.
const ganzhiNum = (branchNum) => (ganzhi) => {
  const s = STEMS.indexOf(ganzhi[0])
  const b = BRANCHES.indexOf(ganzhi[1])
  if (s < 0 || b < 0) throw new Error(`간지를 읽을 수 없습니다: ${ganzhi}`)
  return STEM_NUM[s] + branchNum[b]
}

export const taeseNum = ganzhiNum(BRANCH_TAESE)
export const wolgeonNum = ganzhiNum(BRANCH_WOLGEON)
export const iljinNum = ganzhiNum(BRANCH_ILJIN)

const rem = (n, m) => (n % m === 0 ? m : n % m)

/**
 * 생일을 음력으로 맞춘다. 없는 날짜는 여기서 걸러 낸다.
 * @param {{calendar:'solar'|'lunar', year:number, month:number, day:number, isLeap?:boolean}} birth
 */
export function toLunarBirth(birth) {
  if (birth.calendar !== 'solar' && birth.calendar !== 'lunar') {
    throw new RangeError('양력인지 음력인지 골라 주세요.')
  }
  if (birth.calendar === 'solar') {
    if (!SolarTable.isValidDate(birth.year, birth.month, birth.day)) throw new RangeError('없는 날짜입니다.')
    if (!SolarTable.isDateInRange(birth.year, birth.month, birth.day)) throw new RangeError('볼 수 있는 범위를 벗어난 날짜입니다.')
    const l = LunarCalendar.fromSolar(birth.year, birth.month, birth.day)
    return { year: l.year, month: l.month, day: l.day, isLeap: l.isLeapMonth }
  }
  if (!LunarCalendar.isValid(birth.year, birth.month, birth.day, !!birth.isLeap)) {
    throw new RangeError('없는 음력 날짜입니다.')
  }
  return { year: birth.year, month: birth.month, day: birth.day, isLeap: !!birth.isLeap }
}

/**
 * 그해 그 음력 달의 중괘. 윤달생도 같은 숫자의 평달로 본다.
 * castGwae 와 reachableGwae 가 같은 셈을 쓰도록 한곳에 둔다.
 */
function middleOf(targetYear, lunarMonth) {
  const month = LunarCalendar.of(targetYear, lunarMonth, 1)
  const monthDays = month.daysInMonth
  const wolgeon = month.wolgeon
  return { monthDays, wolgeon, middle: rem(monthDays + wolgeonNum(wolgeon), 6) }
}

/**
 * 괘를 뽑는다.
 * @returns {{gwae:string, upper:number, middle:number, lower:number, detail:object}}
 */
export function castGwae(birth, targetYear) {
  const lunar = toLunarBirth(birth)
  const age = targetYear - lunar.year + 1
  if (age < 1) throw new RangeError('태어난 해보다 앞선 해는 볼 수 없습니다.')

  const secha = LunarCalendar.of(targetYear, 1, 1).secha
  const { monthDays, wolgeon, middle } = middleOf(targetYear, lunar.month)

  // 그해의 같은 음력 날짜. 그해 그 달에 30일이 없으면 그달 말일(29일)의 일진을 쓴다.
  const day = Math.min(lunar.day, monthDays)
  const iljin = LunarCalendar.of(targetYear, lunar.month, day).iljin

  const tN = taeseNum(secha)
  const iN = iljinNum(iljin)

  const upper = rem(age + tN, 8)
  const lower = rem(lunar.day + iN, 3)

  return {
    gwae: `${upper}${middle}${lower}`,
    upper,
    middle,
    lower,
    detail: {
      lunarBirth: lunar,
      age,
      secha, taese: tN,
      monthDays, wolgeon, wolgeonNum: wolgeonNum(wolgeon),
      iljin, iljinNum: iN
    }
  }
}

/**
 * 그해에 실제로 나올 수 있는 괘 목록.
 * 중괘는 그해 열두 달의 날수와 월건으로만 정해져서 해마다 나오지 않는 값이 있다. (2027년은 중괘 4가 없어 120괘)
 */
export function reachableGwae(targetYear) {
  const middles = new Set()
  for (let m = 1; m <= 12; m++) middles.add(middleOf(targetYear, m).middle)
  const list = []
  for (let u = 1; u <= 8; u++) for (const m of [...middles].sort()) for (let l = 1; l <= 3; l++) list.push(`${u}${m}${l}`)
  return list
}
