// 풀이 한 덩어리를 검사한다. 빌드(build-data.mjs)와 테스트(tests/data.test.js)가 같이 쓴다.

// 겁주는 말투와 예스러운 말투를 막는다. (CLAUDE.md '건강·돈·법률을 단정하거나 겁주는 풀이 금지')
const BANNED = [
  '하리라', '할지어다', '흉하', '불길', '재앙', '횡사', '사망', '파산', '부도', '소송', '이혼',
  '병이 난다', '병을 얻', '큰돈을 잃', '사고가 난다', '망한다', '주식', '코인', '부동산 투자', '보험 가입'
]
const SENT_MAX = 60   // 한 문장 공백 포함 길이 (40자 안팎으로 쓰고, 넘치면 잡는다)
const SUM_MAX = 24    // 한 줄 요약

const sentences = (s) => s.split(/(?<=[.!?])\s+/).map((t) => t.trim()).filter(Boolean)

export function checkEntries(entries, outline, { partial = false } = {}) {
  const p = []
  const want = new Map(outline.entries.map((e) => [e.gwae, e]))
  const seen = new Set()

  for (const e of entries) {
    const at = `${e.gwae}`
    if (!want.has(e.gwae)) { p.push(`${at}: 2027년에 나오지 않는 괘`); continue }
    if (seen.has(e.gwae)) p.push(`${at}: 중복`)
    seen.add(e.gwae)

    const texts = [e.summary, e.overall, ...(e.quarters ?? []), e.advice]
    const countSentences = (label, text, min, max) => {
      const n = sentences(text ?? '').length
      if (n < min || n > max) p.push(`${at}: ${label} 문장 ${n}개 (${min}~${max}개)`)
    }
    if (!e.summary || e.summary.length > SUM_MAX) p.push(`${at}: summary 길이 ${e.summary?.length}`)
    countSentences('overall', e.overall, 3, 4)
    if (!Array.isArray(e.quarters) || e.quarters.length !== 4) p.push(`${at}: quarters 4개 아님`)
    else e.quarters.forEach((q, i) => countSentences(`quarters[${i}]`, q, 2, 3))
    countSentences('advice', e.advice, 2, 2)
    if (!e.lucky?.color || !e.lucky?.keyword || !Number.isInteger(e.lucky?.number)) p.push(`${at}: lucky 비어 있음`)
    else if (e.lucky.number < 1 || e.lucky.number > 45) p.push(`${at}: lucky.number ${e.lucky.number}`)

    for (const t of texts) {
      if (typeof t !== 'string' || !t.trim()) { p.push(`${at}: 빈 칸`); continue }
      for (const b of BANNED) if (t.includes(b)) p.push(`${at}: 금지된 말 "${b}"`)
      for (const s of sentences(t)) if (s.length > SENT_MAX) p.push(`${at}: 문장 ${s.length}자 — "${s.slice(0, 24)}…"`)
    }
  }

  if (!partial) for (const g of want.keys()) if (!seen.has(g)) p.push(`${g}: 풀이 없음`)
  return p
}
