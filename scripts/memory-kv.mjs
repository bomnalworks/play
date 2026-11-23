// Cloudflare KV 를 흉내 낸 메모리 저장소 - 시험 서버(scores-dev.mjs)와 테스트(tests/scores.test.js)가 같이 쓴다.
// 순위표 서버가 쓰는 get(key, 'json')·put 만 있다.
export function memoryKV(map = new Map()) {
  return {
    map,
    get: async (key, type) => {
      const v = map.get(key)
      return v == null ? null : type === 'json' ? JSON.parse(v) : v
    },
    put: async (key, value) => void map.set(key, value),
  }
}
