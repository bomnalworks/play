// 봄날 운세 오락실 — 2027 토정비결 화면
// 생년월일은 서버로 보내지 않는다. 계산은 이 파일 안에서 끝나고, 저장은 localStorage 뿐이다.
import { castGwae } from '../js/tojeong.js'
import { YEAR, GROUPS } from '../js/config.js'   // scheme.json 에서 생성 (연도·연령대 구분)

const STORE = 'bomnal-play-birth-v1'

// 세는 나이로 연령대를 가른다. maxAge 가 null 이면 위로 열려 있다.
const groupOf = (age) => GROUPS.find((g) => g.maxAge === null || age <= g.maxAge)

const $ = (sel) => document.querySelector(sel)
const form = $('#birth-form')
const errorBox = $('#form-error')
const resultBox = $('#result')
const leapWrap = $('#leap-wrap')
const clearBtn = $('#clear')

const cache = {}
function load(path) {
  cache[path] ??= fetch(path)
    .then((r) => {
      if (!r.ok) throw new Error(`${path} ${r.status}`)
      return r.json()
    })
    .catch((err) => {
      delete cache[path]   // 실패한 응답을 물고 있으면 다시 눌러도 계속 실패한다
      throw err
    })
  return cache[path]
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/* ---------- 입력 ---------- */

function showLeap() {
  const lunar = form.calendar.value === 'lunar'
  leapWrap.hidden = !lunar
  if (!lunar) form.leap.checked = false
}
form.addEventListener('change', (e) => { if (e.target.name === 'calendar') showLeap() })

function readForm() {
  const year = +form.year.value, month = +form.month.value, day = +form.day.value
  if (!year || !month || !day) throw new RangeError('생년월일을 모두 넣어 주세요.')
  if (year < 1900 || year > YEAR) throw new RangeError(`태어난 해는 1900년부터 ${YEAR}년까지 넣을 수 있어요.`)
  if (month < 1 || month > 12) throw new RangeError('월은 1부터 12까지예요.')
  if (day < 1 || day > 31) throw new RangeError('일은 1부터 31까지예요.')
  return { calendar: form.calendar.value, year, month, day, isLeap: !!form.leap.checked }
}

function fillForm(birth) {
  form.year.value = birth.year
  form.month.value = birth.month
  form.day.value = birth.day
  form.calendar.value = birth.calendar   // RadioNodeList 라 맞는 라디오가 선택된다
  form.leap.checked = !!birth.isLeap
  showLeap()
}

function remember(birth) {
  try {
    if (form.remember.checked) localStorage.setItem(STORE, JSON.stringify(birth))
    else localStorage.removeItem(STORE)
  } catch { /* 저장을 못 해도 결과는 보여 준다 */ }
  clearBtn.hidden = !form.remember.checked
}

clearBtn.addEventListener('click', () => {
  try { localStorage.removeItem(STORE) } catch {}
  clearBtn.hidden = true
  form.remember.checked = false
  resultBox.hidden = true
  resultBox.replaceChildren()
  form.reset()
  showLeap()
  form.year.focus()
})

/* ---------- 결과 ---------- */

async function show(birth) {
  errorBox.hidden = true
  errorBox.textContent = ''
  const cast = castGwae(birth, YEAR)
  const group = groupOf(cast.detail.age)
  const reading = await load(`data/${YEAR}/${group.key}/${cast.gwae}.json`)
  render({ cast, group, reading })
}

function render({ cast, group, reading: r }) {
  const d = cast.detail
  const lunar = `${d.lunarBirth.year}년 ${d.lunarBirth.isLeap ? '윤' : ''}${d.lunarBirth.month}월 ${d.lunarBirth.day}일`
  const quarterLabels = ['1~3월', '4~6월', '7~9월', '10~12월']

  resultBox.innerHTML = `
    <div class="gwae-head">
      <span class="gwae-no">${esc(cast.gwae)}</span>
      <span class="badge">${esc(r.grade)}</span>
      <span class="gwae-name">${esc(r.name)}</span>
    </div>
    <p class="summary">${esc(r.summary)}</p>
    <p class="symbol">${esc(r.symbol)}</p>

    <div class="block">
      <h3>올해 총운</h3>
      <p>${esc(r.overall)}</p>
    </div>

    <div class="block">
      <h3>계절별 흐름</h3>
      <ul class="quarters">
        ${r.quarters.map((q, i) => `
          <li class="${i === r.peak ? 'peak' : ''}"><strong>${quarterLabels[i]}</strong>${esc(q)}</li>`).join('')}
      </ul>
    </div>

    <div class="block">
      <h3>이렇게 해 보세요</h3>
      <p>${esc(r.advice)}</p>
    </div>

    <div class="block">
      <h3>올해의 행운</h3>
      <ul class="lucky">
        <li><span>색</span><b>${esc(r.lucky.color)}</b></li>
        <li><span>숫자</span><b>${esc(r.lucky.number)}</b></li>
        <li><span>키워드</span><b>${esc(r.lucky.keyword)}</b></li>
      </ul>
    </div>

    <p class="who">${esc(group.label)} 기준 풀이입니다. ${YEAR}년 세는 나이 ${d.age}세 · 음력 생일 ${esc(lunar)}</p>

    <details class="detail">
      <summary>괘가 어떻게 나왔는지 보기</summary>
      <dl>
        <dt>상괘 ${cast.upper}</dt><dd>세는 나이 ${d.age} + ${YEAR}년 태세수 ${d.taese} (${esc(d.secha)}) ÷ 8</dd>
        <dt>중괘 ${cast.middle}</dt><dd>그해 생월 날수 ${d.monthDays} + 월건수 ${d.wolgeonNum} (${esc(d.wolgeon)}) ÷ 6</dd>
        <dt>하괘 ${cast.lower}</dt><dd>음력 생일 ${d.lunarBirth.day} + 일진수 ${d.iljinNum} (${esc(d.iljin)}) ÷ 3</dd>
      </dl>
      <p>나머지가 0이면 나누는 수(8·6·3)를 씁니다. 음력 변환은 kor-lunar(한국천문연구원 자료)를 씁니다.</p>
    </details>

    <div class="share">
      <button type="button" class="primary" id="share">결과 공유하기</button>
      <button type="button" class="plain" id="again">다른 생일로 보기</button>
    </div>
    <p class="share-done" id="share-done" hidden>링크를 복사했어요.</p>

    <div class="ad" id="ad" hidden>
      <span class="ad-label">광고</span>
      <div id="ad-slot"></div>
      <p class="ad-notice">이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
    </div>
  `
  resultBox.hidden = false

  const shareText = `${YEAR}년 내 토정비결 ${cast.gwae}번 — ${r.summary}`
  $('#share').addEventListener('click', async () => {
    const url = location.origin + location.pathname   // 지금 보고 있는 주소를 그대로 나눈다
    try {
      if (navigator.share) { await navigator.share({ title: '봄날 운세 오락실', text: shareText, url }); return }
      await navigator.clipboard.writeText(`${shareText}\n${url}`)
      $('#share-done').hidden = false
    } catch { /* 사용자가 취소한 경우 */ }
  })
  $('#again').addEventListener('click', () => {
    resultBox.hidden = true
    $('#form-card').scrollIntoView({ behavior: 'smooth', block: 'start' })
    form.year.focus()
  })

  mountAd()
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 쿠팡 배너는 ad/coupang.html 에 배너 태그를 붙여 넣으면 그때부터 보인다. 비어 있으면 자리도 그리지 않는다.
let adReady
function hasBanner() {
  adReady ??= fetch('ad/coupang.html')
    .then((res) => (res.ok ? res.text() : ''))
    .then((html) => html.replace(/<!--[\s\S]*?-->/g, '').includes('coupang'))   // 안내 주석은 빼고 본다
    .catch(() => false)
  return adReady
}

async function mountAd() {
  try {
    if (!(await hasBanner())) return
    const frame = document.createElement('iframe')
    frame.src = 'ad/coupang.html'
    frame.title = '광고'
    frame.loading = 'lazy'
    frame.height = '140'
    frame.setAttribute('scrolling', 'no')
    $('#ad-slot').appendChild(frame)
    $('#ad').hidden = false
  } catch { /* 광고가 없어도 운세는 보인다 */ }
}

/* ---------- 시작 ---------- */

function showError(err) {
  resultBox.hidden = true
  errorBox.textContent = err instanceof RangeError ? err.message : '결과를 불러오지 못했어요. 잠시 뒤 다시 해 주세요.'
  errorBox.hidden = false
  if (!(err instanceof RangeError)) console.error(err)
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  try {
    const birth = readForm()
    remember(birth)
    await show(birth)
  } catch (err) {
    showError(err)
  }
})

showLeap()
try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null')
  if (saved?.year) {
    fillForm(saved)
    clearBtn.hidden = false
    show(saved).catch(showError)   // 저장된 생일이 안 맞으면 조용히 넘기지 말고 알린다
  }
} catch { /* 저장된 값이 깨졌으면 무시한다 */ }
