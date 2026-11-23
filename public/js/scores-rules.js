// 오락실 순위표 규칙 - 어느 게임의 어느 판을, 무엇으로, 어느 쪽이 높게 줄 세우는가.
// 사이트(js/scores.js)와 순위표 서버(worker/)가 이 파일 하나를 같이 쓴다. DOM 이 없다.
//
// 저장하는 것은 이니셜 3글자 · 점수 · 날짜뿐이다. 이름·연락처·IP 는 받지도 남기지도 않는다.

// 짝맞추기 단계 표는 게임 쪽 것을 그대로 쓴다 (DOM 없는 작은 파일이라 서버에 들어가도 된다)
import { MAX_STAGE, pairsOf } from '../games/memory/logic.js'

export const TOP = 5 // 1~5등

const sec = (s) => s * 1000
const range = (n) => Array.from({ length: n }, (_, i) => String(i + 1))

// better: 'high' 는 클수록, 'low' 는 작을수록(걸린 시간) 위
// min·max: 말이 안 되는 점수를 거른다 (브라우저가 보내는 값이라 조작할 수 있다 - 범위로만 막는다)
// label(board): 순위표에 붙는 판 이름. 판이 하나뿐인 게임은 없다
export const GAMES = {
  plane: { name: '봄날 종이비행기', better: 'high', unit: 'm', boards: ['all'], min: () => 1, max: () => 100000 },
  neoguri: { name: '봄날 너구리', better: 'high', unit: '점', boards: ['all'], min: () => 10, max: () => 999990 },
  // 스도쿠는 레벨마다 따로. 아무리 빨라도 15초 안에는 못 푼다.
  // 10 은 sudoku/logic.js 의 MAX_LEVEL (생성기가 커서 가져오지 않는다 - 맞는지는 tests/scores.test.js 가 본다)
  sudoku: {
    name: '봄날 스도쿠', better: 'low', unit: 'time', boards: range(10), label: (b) => `${b}레벨`,
    min: () => sec(15), max: () => sec(24 * 3600),
  },
  // 짝맞추기는 단계마다 따로. 카드 한 장 뒤집는 데 0.2초는 걸린다 (짝 수 × 2장)
  memory: {
    name: '봄날 짝맞추기', better: 'low', unit: 'time', boards: range(MAX_STAGE), label: (b) => `${b}단계`,
    min: (board) => pairsOf(Number(board)) * 2 * 200, max: () => sec(24 * 3600),
  },
}

// 이니셜에 쓰면 안 되는 낱말 (영어 욕설·혐오 표현 몇 가지). 다 막지는 못한다
const BLOCK = new Set(['ASS', 'CUM', 'DIE', 'FAG', 'FUK', 'FUC', 'GAY', 'JEW', 'KKK', 'NIG', 'SEX', 'SHT', 'TIT', 'WTF', 'XXX', 'HIV', 'NAZ', 'SS'])

/** 대문자 A-Z·0-9 만 남기고 3글자로 자른다 (입력창이 치는 대로 이것을 쓴다) */
export const trimName = (raw) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)

/** 이니셜을 대문자 A-Z·0-9 1~3글자로 다듬는다. 못 쓰는 이니셜이면 null */
export function cleanName(raw) {
  const name = trimName(raw)
  if (!name || BLOCK.has(name)) return null
  return name
}

export const boardOk = (game, board) => Boolean(GAMES[game]?.boards.includes(String(board)))

/** 이 게임·판에 올릴 수 있는 점수인가 (정수, 범위 안) */
export function scoreOk(game, board, score) {
  if (!boardOk(game, board) || !Number.isInteger(score)) return false
  const g = GAMES[game]
  return score >= g.min(String(board)) && score <= g.max(String(board))
}

const beats = (better, a, b) => (better === 'high' ? a > b : a < b)

/** 지금 순위(list)에 들 수 있는 점수인가. 같은 점수는 먼저 올린 사람이 위라 이겨야 든다 */
export function qualifies(game, list, score) {
  if (list.length < TOP) return true
  return beats(GAMES[game].better, score, list[list.length - 1].score)
}

/** 새 기록을 넣은 순위와 몇 등인지 (못 들면 rank 0, 순위는 그대로) */
export function insertScore(game, list, entry) {
  const better = GAMES[game].better
  let at = list.findIndex((e) => beats(better, entry.score, e.score))
  if (at < 0) at = list.length
  if (at >= TOP) return { list, rank: 0 }
  const next = [...list.slice(0, at), entry, ...list.slice(at)].slice(0, TOP)
  return { list: next, rank: at + 1 }
}
