// 브라우저에 기대는 두 가지를 한곳에 모은다 — 방문 통계와 이 브라우저 저장소.
// 토정비결·너구리·스도쿠가 같이 쓴다.
//
// 무엇을 보내는지는 이 파일에서 다 볼 수 있다(이름 하나뿐, 매개변수 없음).
// 애널리틱스를 불러오는 스니펫과 측정 ID 자체는 아직 각 페이지 head 에 있다.

// 버튼을 눌렀다는 사실만 보낸다. 매개변수는 붙이지 않는다.
export function track(name) {
  try {
    window.gtag?.('event', name)
  } catch {
    /* 통계는 실패해도 그만 */
  }
}

// localStorage 는 설정에 따라 통째로 막혀 있을 수 있다. 막혀도 놀이는 그대로 된다.
export const store = {
  read(key, fallback = null) {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
    } catch {
      return fallback
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* 저장을 못 해도 그만 */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* 지우지 못해도 그만 */
    }
  },
}
