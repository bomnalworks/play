// 쿠팡 배너 한 장. ad/coupang.html 에 배너 태그가 들어 있을 때만 자리가 그려진다.
// 토정비결 결과와 게임 끝 화면이 같이 쓴다. 라벨·대가성 문구까지 여기서 만든다 —
// 페이지마다 마크업을 복사해 두면 문구 한 줄 고칠 때 세 군데를 고쳐야 한다.
import { track } from './browser.js'

const SRC = '/ad/coupang.html'   // /games/… 안에서도 같은 파일을 보도록 절대 경로
const ANCHOR = 'ad-here'   // 게임 페이지가 광고 자리로 비워 두는 곳. 붙일 데를 호출부마다 적지 않는다
const NOTICE = '이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'
const FALLBACK_H = '110'   // 배너 높이를 읽기 전에 쓰는 임시값

let adReady
function hasBanner() {
  adReady ??= fetch(SRC)
    .then((res) => {
      if (!res.ok) throw new Error(`ad ${res.status}`)   // 404·5xx 모두 아래 catch 로
      return res.text()
    })
    // 본문에 요소가 하나라도 있으면 배너가 있는 것이다. 주석은 요소가 아니라 세지 않으니
    // "태그를 지우고 주석만 남기면 광고가 안 뜬다"가 그대로 성립한다. 태그 종류도 안 가린다.
    .then((html) => new DOMParser().parseFromString(html, 'text/html').body.children.length > 0)
    .catch(() => { adReady = undefined; return false })   // 한 번 끊겼다고 영구히 광고를 숨기지 않는다
  return adReady
}

// 같은 출처라 배너의 실제 높이를 읽어 칸을 맞춘다 — 빈 여백도 잘림도 없게.
// 배너는 칸 폭에 따라 줄어드니 화면을 돌리면 높이도 달라진다. 그래서 resize 때도 다시 잰다.
// 못 읽으면 임시값을 그대로 쓴다. 배너 크기를 바꿔도 코드는 안 고친다.
function fit(frame) {
  const h = frame.contentDocument?.body?.scrollHeight
  if (h) frame.height = String(h)
}

// 지금 떠 있는 틀은 화면에서 바로 찾는다. 따로 명단을 들고 있으면 "다른 생일로 보기"로
// 버려진 틀을 손으로 지워 줘야 하고, 깜빡하면 그대로 쌓인다.
let watching = false
function watchResize() {
  if (watching) return
  watching = true
  window.addEventListener('resize', () => {
    for (const frame of document.querySelectorAll('.ad iframe')) fit(frame)
  })
}

// 틀이 다 뜬 뒤. 배너를 제대로 받아 왔을 때만 자리를 남기고 노출로 센다.
function settle(frame, box) {
  const doc = frame.contentDocument
  // 틀을 만들자마자 오는 빈 문서(about:blank)의 load 는 배너가 아니다. 그냥 넘기고 진짜 문서를 기다린다.
  if (!doc || doc.URL === 'about:blank') return
  const images = [...doc.images]
  // 그림을 하나도 못 받아 왔다면(광고 차단·쿠팡 장애) "광고" 글자와 빈 칸만 남는다. 자리째 거둔다.
  // 그림이 아닌 배너 태그를 넣었을 때를 위해, 그림이 아예 없는 경우는 건드리지 않는다.
  if (images.length && images.every((img) => img.naturalWidth === 0)) {
    box.remove()
    return
  }
  fit(frame)
  track('ad_shown')   // 화면에 실제로 그려진 것만 센다 (틀은 보일 때 뜨는 lazy 다)
}

/** 광고 자리를 한 번 만든다. 배너가 없거나 이미 붙어 있으면 아무것도 하지 않는다. */
export async function mountAd(target = document.getElementById(ANCHOR)) {
  if (!target || target.querySelector('.ad')) return

  // 배너가 있는지 알아보기 전에 빈 자리를 먼저 붙여 둔다. 그래야 알아보는 사이에 한 번 더
  // 불려도 바로 위 가드에 걸린다. 아직 숨겨 둬서 테두리가 번쩍하지는 않는다.
  const box = document.createElement('div')
  box.className = 'ad'
  box.hidden = true
  target.appendChild(box)

  try {
    if (!(await hasBanner())) { box.remove(); return }

    box.innerHTML = `<span class="ad-label">광고</span><div class="ad-slot"></div><p class="ad-notice">${NOTICE}</p>`
    box.hidden = false   // 보여야 틀이 제 폭을 갖고 높이를 잴 수 있다

    // 광고 차단 프로그램이 이 자리를 숨기면 "광고" 글자만 덩그러니 남는다. 그럴 땐 자리까지 거둔다.
    // 그림 요청만 막혔을 때는 위 settle() 이 같은 일을 한다.
    const slot = box.querySelector('.ad-slot')
    if (getComputedStyle(box).display === 'none' || getComputedStyle(slot).display === 'none') {
      box.remove()
      return
    }

    const frame = document.createElement('iframe')
    frame.src = SRC
    frame.title = '광고'
    frame.loading = 'lazy'
    frame.height = FALLBACK_H
    frame.setAttribute('scrolling', 'no')
    frame.addEventListener('load', () => settle(frame, box))
    slot.appendChild(frame)
    watchResize()
  } catch {
    box.remove()   // 광고가 없어도 운세와 놀이는 그대로 된다
  }
}
