// 멈췄다 이어서 갈 수 있는 스톱워치. 게임을 하나도 모른다 - 스도쿠·짝맞추기·화살 퍼즐(남은 시간)이 쓴다.
//
// 지금 몇 시인지(now)는 부르는 쪽이 넘긴다. 그래야 시간을 가짜로 흘려 보며 검사할 수 있다.

export const createTimer = () => ({ base: 0, startedAt: null })
export const startTimer = (t, now) => {
  if (t.startedAt === null) t.startedAt = now
  return t
}
export const pauseTimer = (t, now) => {
  if (t.startedAt !== null) {
    t.base += now - t.startedAt
    t.startedAt = null
  }
  return t
}
export const timerMs = (t, now) => t.base + (t.startedAt === null ? 0 : now - t.startedAt)
export const isRunning = (t) => t.startedAt !== null

export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
