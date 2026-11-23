// 오락실 순위표(명예의 전당) - 게임마다 1~5등, 이니셜 3글자.
// 규칙(무엇으로 줄 세우나·말이 되는 점수 범위)은 scores-rules.js, 서버는 worker/ 에 있다.
//
// 페이지에 #hall-here 자리가 없으면 아무것도 그리지 않는다. 서버가 안 받거나 느려도 놀이는 그대로 된다 (순위표 칸만 감춘다).
import { track, store } from './browser.js'
import { formatTime } from './timer.js'
import { TOP, GAMES, cleanName, trimName, scoreOk, qualifies } from './scores-rules.js'

// 순위표 서버 주소 (worker/README.md). 이 PC 에서는 npm run scores 로 띄운 시험 서버를 쓴다
const API = location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://scores.bomnalworks.com'
const NAME_KEY = 'bomnal-hall-name-v1' // 지난번에 쓴 이니셜 (다음에 미리 채워 둔다)
const ANCHOR = 'hall-here'

const fmt = (game, score) => {
  const { unit } = GAMES[game]
  return unit === 'time' ? formatTime(score) : `${score.toLocaleString('ko-KR')}${unit}`
}

async function getTop(game, board) {
  const res = await fetch(`${API}/scores?game=${game}&board=${encodeURIComponent(board)}`)
  if (!res.ok) throw new Error(`scores ${res.status}`)
  return (await res.json()).top ?? []
}

async function postScore(game, board, name, score) {
  const res = await fetch(`${API}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game, board, name, score }),
  })
  if (!res.ok) throw new Error(`scores ${res.status}`)
  return res.json()
}

const OFF = { show() {}, offer: () => Promise.resolve() }

/**
 * 게임 하나의 명예의 전당. show(board) 로 그 판의 1~5등을 보여 주고,
 * offer(board, score) 는 순위에 들면 이니셜을 받아 올린다 (닫힐 때까지 기다리는 Promise).
 * board 는 숫자로 줘도 된다 (안에서 글자로 바꾼다). 판 이름은 scores-rules.js 의 label.
 */
export function createHall(game) {
  const anchor = document.getElementById(ANCHOR)
  if (!anchor || !GAMES[game]) return OFF
  const boardLabel = GAMES[game].label ?? (() => '')

  const card = document.createElement('section')
  card.className = 'card hall'
  card.hidden = true
  card.innerHTML = `<h2>명예의 전당 <small class="hall-board"></small></h2>
    <ol class="hall-list"></ol>
    <p class="small">순위에 들면 이니셜 3글자를 남길 수 있습니다. 이니셜·점수·날짜만 서버에 저장합니다.</p>`
  anchor.appendChild(card)
  const listBox = card.querySelector('.hall-list')
  const boardBox = card.querySelector('.hall-board')

  let shown = null // 지금 보여 주는 판 (늦게 온 응답이 다른 판을 덮어쓰지 않게)
  // 방금 올리고 받은 순위. 읽기는 10초 캐시라 그사이 다시 받으면 올리기 전 순위가 와서 덮어쓴다 - 그동안은 이것을 그린다
  let fresh = null // { board, top, rank, until }

  function render(board, top, mine = 0) {
    boardBox.textContent = boardLabel(board)
    listBox.replaceChildren(
      ...Array.from({ length: TOP }, (_, i) => {
        const e = top[i]
        const li = document.createElement('li')
        if (i + 1 === mine) li.className = 'mine'
        li.innerHTML = `<b>${i + 1}</b><span class="hall-name"></span><span class="hall-score"></span><span class="hall-at"></span>`
        // 서버가 거른 글자지만 그래도 글자(textContent)로만 넣는다. 빈 자리는 오락실처럼 ---
        li.querySelector('.hall-name').textContent = e ? e.name : '---'
        li.querySelector('.hall-score').textContent = e ? fmt(game, e.score) : ''
        li.querySelector('.hall-at').textContent = e ? e.at.slice(5).replace('-', '.') : ''
        return li
      }),
    )
    card.hidden = false
  }

  async function show(rawBoard) {
    const board = String(rawBoard)
    shown = board
    if (fresh && fresh.board === board && Date.now() < fresh.until) {
      render(board, fresh.top, fresh.rank)
      return
    }
    try {
      const top = await getTop(game, board)
      if (shown === board) render(board, top)
    } catch {
      card.hidden = true // 서버가 안 되면 자리째 감춘다
    }
  }

  async function offer(rawBoard, score) {
    const board = String(rawBoard)
    if (!scoreOk(game, board, score)) return
    let top
    try {
      top = await getTop(game, board)
    } catch {
      return
    }
    if (!qualifies(game, top, score)) return
    let sent
    try {
      sent = await askName(game, board, score, boardLabel(board))
    } catch {
      return // 창을 못 띄우는 브라우저 - 순위표만 빼고 놀이는 그대로
    }
    if (!sent) return
    // 다시 받지 않고 서버가 돌려준 순위를 그대로 그린다. 그사이 다른 사람이 먼저 들어 순위 밖(rank 0)이 됐어도 새 순위는 보여 준다
    shown = board
    fresh = { board, top: sent.top, rank: sent.rank, until: Date.now() + 10_000 }
    render(board, sent.top, sent.rank)
  }

  return { show, offer }
}

/* ---------- 이니셜 넣기 (오락실 기록판처럼) ---------- */

let dialog = null
function ensureDialog() {
  if (dialog) return dialog
  dialog = document.createElement('dialog')
  dialog.className = 'hall-dialog'
  dialog.innerHTML = `<form method="dialog">
      <p class="hall-title">명예의 전당에 들었어요!</p>
      <p class="hall-what"></p>
      <label class="hall-label">이니셜 3글자 (영문·숫자)
        <input name="name" maxlength="3" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" required />
      </label>
      <p class="hall-error" role="alert"></p>
      <div class="hall-actions">
        <button type="button" class="plain" value="skip">안 남기기</button>
        <button type="submit" class="primary" value="send">남기기</button>
      </div>
    </form>`
  const input = dialog.querySelector('input')
  input.addEventListener('input', () => {
    input.value = trimName(input.value)
  })
  // 창에서 치는 글자가 뒤에 있는 게임의 단축키(숫자 칸 채우기, N 새 판, 방향키 …)로 새지 않게
  for (const type of ['keydown', 'keyup']) dialog.addEventListener(type, (e) => e.stopPropagation())
  document.body.appendChild(dialog)
  return dialog
}

// 이니셜을 받아 올린다. 올렸으면 서버 응답 { top, rank }, 안 남기거나 못 올렸으면 null
function askName(game, board, score, label) {
  const d = ensureDialog()
  if (d.open) return Promise.resolve(null) // 이미 떠 있는 창이 있으면 겹쳐 띄우지 않는다
  const form = d.querySelector('form')
  const input = d.querySelector('input')
  const what = d.querySelector('.hall-what')
  const error = d.querySelector('.hall-error')
  const skip = d.querySelector('[value="skip"]')
  const send = d.querySelector('[value="send"]')
  what.textContent = `${GAMES[game].name}${label ? ` · ${label}` : ''} · ${fmt(game, score)}`
  input.value = store.read(NAME_KEY, '') || ''
  error.textContent = ''
  send.disabled = skip.disabled = false

  return new Promise((resolve) => {
    let sent = null
    let sending = false
    const done = () => {
      form.removeEventListener('submit', onSubmit)
      skip.removeEventListener('click', onSkip)
      d.removeEventListener('close', done)
      d.removeEventListener('cancel', onCancel)
      resolve(sent)
    }
    const onSkip = () => d.close()
    // 올리는 동안 Esc 로 닫으면 서버에는 들어갔는데 화면에는 안 나온다 - 그동안은 닫지 않는다
    const onCancel = (e) => {
      if (sending) e.preventDefault()
    }
    async function onSubmit(e) {
      e.preventDefault()
      const name = cleanName(input.value)
      if (!name) {
        error.textContent = '영문이나 숫자 1~3글자로 넣어 주세요.'
        return
      }
      send.disabled = skip.disabled = sending = true
      error.textContent = '올리는 중…'
      try {
        sent = await postScore(game, board, name, score)
        store.write(NAME_KEY, name)
        track('hall_submit')
        sending = false
        d.close()
      } catch {
        send.disabled = skip.disabled = sending = false
        error.textContent = '지금은 올리지 못했어요. 잠시 뒤 다시 눌러 주세요.'
      }
    }
    form.addEventListener('submit', onSubmit)
    skip.addEventListener('click', onSkip)
    d.addEventListener('close', done)
    d.addEventListener('cancel', onCancel)
    d.showModal()
    input.focus()
    input.select()
  })
}
