// 봄날 짝맞추기 - 규칙만. DOM 이 없다 (테스트가 화면 없이 이 파일만 불러 돌린다)
//
// 카드 그림은 번호(0, 1, 2…)로만 다룬다. 번호를 어떤 그림으로 보일지는 화면(ui.js)이 정한다.

// 단계마다 가로 칸 수 × 세로 줄 수. 폰 세로 화면에 맞게 가로를 짧은 쪽으로 둔다.
export const STAGES = [
  { cols: 2, rows: 2 },
  { cols: 3, rows: 4 },
  { cols: 4, rows: 5 },
  { cols: 5, rows: 6 },
  { cols: 6, rows: 7 },
]
export const MAX_STAGE = STAGES.length

// 카드 그림 묶음. public/games/memory/cards/<key>/01.webp … 로 있다 (scripts/cut-cards.py 가 만든다).
// count 는 그 폴더의 그림 수 - tests/memory.test.js 가 실제 파일 수와 맞는지, 5단계에 모자라지 않은지 본다.
export const THEMES = [
  { key: 'cute', name: '아기자기', count: 29 },
  { key: 'teen', name: '학생', count: 25 },
  { key: 'old', name: '추억', count: 29 },
]
export const clampStage = (n) => Math.min(MAX_STAGE, Math.max(1, Math.round(Number(n)) || 1))
export const pairsOf = (stage) => (STAGES[stage - 1].cols * STAGES[stage - 1].rows) / 2

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/**
 * 한 판을 새로 돌린다. kinds 는 그림 가짓수 - 그중 필요한 만큼을 골라 짝으로 깐다.
 * open: 지금 앞면인데 아직 짝을 못 찾은 카드(최대 2장) · tries: 두 장을 뒤집어 본 횟수
 */
export function createGame(stage, kinds, rng = Math.random) {
  stage = clampStage(stage)
  const pairs = pairsOf(stage)
  if (kinds < pairs) throw new Error(`그림이 ${pairs}가지 필요한데 ${kinds}가지뿐이다`)
  const picked = shuffle([...Array(kinds).keys()], rng).slice(0, pairs)
  const cards = shuffle([...picked, ...picked], rng)
  return {
    stage,
    cols: STAGES[stage - 1].cols,
    rows: STAGES[stage - 1].rows,
    cards,
    matched: new Array(cards.length).fill(false),
    open: [],
    tries: 0,
    found: 0,
    done: false,
  }
}

/** 틀린 두 장이 앞면으로 남아 있으면 덮는다. 덮은 게 있으면 true. */
export function hideMiss(game) {
  if (game.open.length < 2) return false
  game.open = []
  return true
}

/**
 * i 번 카드를 뒤집는다.
 * 'none' 못 뒤집음 · 'first' 첫 장 · 'match' 짝을 찾음 · 'miss' 두 장이 다름(앞면으로 남는다)
 * 틀린 두 장이 열려 있을 때 다른 카드를 누르면 둘을 먼저 덮고 그 카드를 첫 장으로 연다.
 */
export function flip(game, i) {
  if (game.done || i < 0 || i >= game.cards.length || game.matched[i]) return 'none'
  hideMiss(game) // 틀린 두 장 중 하나를 눌렀어도 먼저 덮는다 - 그 카드가 새 첫 장이 된다
  if (game.open.includes(i)) return 'none'
  game.open.push(i)
  if (game.open.length === 1) return 'first'

  game.tries++
  const [a, b] = game.open
  if (game.cards[a] === game.cards[b]) {
    game.matched[a] = game.matched[b] = true
    game.open = []
    game.found++
    if (game.found === game.cards.length / 2) game.done = true
    return 'match'
  }
  return 'miss'
}

export const isFaceUp = (game, i) => game.matched[i] || game.open.includes(i)
