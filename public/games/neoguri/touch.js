// 봄날 너구리 - 손가락으로 민 방향 읽기. DOM 이 없다 (테스트가 화면 없이 불러 돌린다)
//
// 좌우로 밀면 걷기, 위아래로 밀면 사다리, 위쪽 대각선으로 밀면 그쪽으로 점프.
// 아래쪽 대각선은 걷기로 본다 (구멍 앞에서 아래로 훑다가 엉뚱하게 멈추지 않게).

export const SWIPE_MIN = 16 // 이만큼(px) 밀어야 방향으로 친다. 덜 밀고 떼면 톡 치기
export const TAP_MS = 300 // 이보다 짧게 대었다 떼면 톡 치기
const SLOPE = 0.5 // 가로·세로로 보는 기울기 한계 (약 27°). 그 사이는 대각선

/** 민 거리(dx, dy)를 방향으로. 덜 밀었으면 null. 화면 좌표라 dy 가 음수면 위쪽이다 */
export function readSwipe(dx, dy) {
  if (Math.hypot(dx, dy) < SWIPE_MIN) return null
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ay <= ax * SLOPE) return dx > 0 ? 'right' : 'left'
  if (ax <= ay * SLOPE) return dy > 0 ? 'down' : 'up'
  if (dy < 0) return dx > 0 ? 'jumpRight' : 'jumpLeft'
  return dx > 0 ? 'right' : 'left'
}

/**
 * 밀던 방향(prev)에서 새로 읽은 방향. 아직 바꿀 만큼 안 밀었으면 null.
 * 걷거나 사다리를 타던 중에 위쪽 대각선으로 바꾸려면 두 배를 밀어야 한다 -
 * 좌우로 밀며 걷다가 엄지가 살짝 위로 휜 것까지 점프로 보면 엉뚱하게 뛴다.
 */
export function nextSwipe(prev, dx, dy) {
  const dir = readSwipe(dx, dy)
  if (!dir) return null
  const intoJump = dir.startsWith('jump') && prev && !prev.startsWith('jump')
  if (intoJump && Math.hypot(dx, dy) < SWIPE_MIN * 2) return null
  return dir
}

/** 방향 하나를 누르고 있을 키들과 점프 여부로. 점프 대각선은 그쪽 키를 누른 채 한 번 뛴다. null 이면 다 놓는다 */
export function swipeKeys(dir) {
  const hold = { left: false, right: false, up: false, down: false }
  const side = { jumpLeft: 'left', jumpRight: 'right' }[dir]
  if (side) hold[side] = true
  else if (dir in hold) hold[dir] = true
  return { hold, jump: Boolean(side) }
}
