// 내 전적 - 점수가 없어 명예의 전당이 없는 게임(리버시·틱택토)이 난이도별 승·무·패와 연승을 남기고 보여 준다.
// 이 브라우저(localStorage)에만 남고 서버로는 아무것도 보내지 않는다.
//
// 페이지에 #record-here 자리가 있으면 거기에 난이도별 표를 그린다.
// 저장 모양: { 난이도: { w, d, l, streak(지금 연승), best(최고 연승) } } - 예전 저장(w·d·l 만)도 그대로 읽는다.
import { store } from './browser.js'

const ANCHOR = 'record-here'
const RESULTS = ['w', 'd', 'l']

const count = (v) => (Number.isInteger(v) && v >= 0 ? v : 0)
const tidy = (rec) => {
  const r = rec && typeof rec === 'object' ? rec : {} // 망가진 저장값(null·글자)은 빈 전적으로
  return { w: count(r.w), d: count(r.d), l: count(r.l), streak: count(r.streak), best: count(r.best) }
}
const games = (rec) => rec.w + rec.d + rec.l
// 승률은 비긴 판을 뺀 승패 판만으로 센다 (틱택토 고급처럼 비기는 게 대부분인 난이도에서 0% 로 보이지 않게)
const rate = (rec) => (rec.w + rec.l ? `${Math.round((rec.w * 100) / (rec.w + rec.l))}%` : '-')
// "12전 8승 1무 3패" (비기거나 진 판이 없으면 그 말은 뺀다). 한 판도 안 했으면 빈 글자
const tally = (rec) => (games(rec) ? `${games(rec)}전 ${rec.w}승${rec.d ? ` ${rec.d}무` : ''}${rec.l ? ` ${rec.l}패` : ''}` : '')
// "3연승 중 · 최고 5연승" - 연승은 2판부터 연승이라 부른다
const streakText = (rec) => {
  const now = rec.streak >= 2 ? `${rec.streak}연승 중` : ''
  const best = rec.best >= 2 ? `최고 ${rec.best}연승` : ''
  return [now, best].filter(Boolean).join(' · ') || '-'
}

/**
 * storeKey: 이 게임의 전적 저장 이름, levels: [난이도 값], names: { 난이도: 보이는 이름 }
 * add(level, 'w'|'d'|'l') 로 한 판을 넣고, quit(level) 은 끝내지 않고 버린 판 (전적에는 안 넣고 연승만 끊는다), show(level) 은 표에서 그 난이도를 짚고 판 아래에 쓸 한 줄 요약을 돌려준다.
 */
export function createRecord(storeKey, levels, names) {
  const raw = store.read(storeKey, {})
  const data = Object.fromEntries(levels.map((level) => [level, tidy(raw?.[level])]))
  let current = levels[0]

  const anchor = globalThis.document?.getElementById(ANCHOR) // 화면 없이(테스트) 불러도 기록 계산은 된다
  let body = null
  if (anchor) {
    const card = document.createElement('section')
    card.className = 'card record'
    card.innerHTML = `<h2>내 전적</h2>
      <table class="record-table">
        <thead><tr><th scope="col">난이도</th><th scope="col">전적</th><th scope="col">승률</th><th scope="col">연승</th></tr></thead>
        <tbody></tbody>
      </table>
      <p class="small">이 브라우저에만 남습니다. 승률은 비긴 판을 빼고 셉니다. 연승은 지거나 비기거나, 판 도중에 새 판을 열면 끊깁니다.</p>`
    anchor.appendChild(card)
    body = card.querySelector('tbody')
  }

  function draw() {
    if (!body) return
    body.replaceChildren(
      ...levels.map((level) => {
        const rec = data[level]
        const tr = document.createElement('tr')
        if (level === current) tr.className = 'on'
        const cells = [names[level], tally(rec) || '-', rate(rec), streakText(rec)] // 모두 글자
        cells.forEach((text, i) => {
          const td = document.createElement(i ? 'td' : 'th')
          if (!i) td.scope = 'row'
          td.textContent = text
          tr.appendChild(td)
        })
        return tr
      }),
    )
  }

  function add(level, result) {
    const rec = data[level]
    if (!rec || !RESULTS.includes(result)) return
    rec[result]++
    rec.streak = result === 'w' ? rec.streak + 1 : 0
    rec.best = Math.max(rec.best, rec.streak)
    store.write(storeKey, data)
    draw()
  }

  function line(level) {
    const rec = data[level]
    if (!rec || !games(rec)) return `${names[level]} - 아직 전적이 없어요`
    return `${names[level]} ${tally(rec)}${rec.streak >= 2 ? ` · ${rec.streak}연승 중` : ''}`
  }

  // 지는 판을 새 판으로 버려 연승을 지키지 못하게 - 패로 세지는 않는다
  function quit(level) {
    const rec = data[level]
    if (!rec || !rec.streak) return
    rec.streak = 0
    store.write(storeKey, data)
    draw()
  }

  // 화면을 그릴 때마다 불러도 되게, 표는 난이도가 바뀔 때만 다시 그린다
  function show(level) {
    if (level !== current) {
      current = level
      draw()
    }
    return line(level)
  }

  draw()
  return { add, quit, show }
}
