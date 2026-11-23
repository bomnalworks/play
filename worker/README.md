# 봄날 오락실 순위표 서버

게임마다 1~5등(이니셜 3글자 · 점수 · 날짜)을 받는 Cloudflare Worker 입니다. 저장소는 Cloudflare KV, 비용은 무료 한도 안입니다
(KV 쓰기 하루 1,000번 · 읽기 10만 번).

- 규칙(어느 게임·판을 무엇으로 줄 세우나, 말이 되는 점수 범위): `../public/js/scores-rules.js` - 사이트와 같이 쓴다
- 처리: `src/index.js` (`GET /scores?game=&board=`, `POST /scores`)
- 사이트 쪽: `../public/js/scores.js`. 게임 페이지에 `#hall-here` 자리가 있으면 그리고, 서버가 안 되면 칸째 감춘다

- 주소: `https://scores.bomnalworks.com` (같은 Cloudflare 계정의 도메인에 바로 붙였다. `wrangler.toml` 의 `routes`)
- wrangler 는 **Node 22.12 이상**이 필요하다. 이 PC 의 기본 Node 는 16 이라, PowerShell 에서는 그 창에서만 바꿔 쓴다:
  `$env:Path = "C:\Users\kst99\AppData\Local\nvm\v24.20.0;" + $env:Path`

## 이 PC 에서 시험하기 (Cloudflare 없이)

```
npm run scores      # http://localhost:8787 - 메모리에만 둔다, 끄면 사라진다
npm run serve       # 다른 창에서. localhost 에서는 사이트가 8787 을 쓴다
```

## 처음 올리기 (한 번만 - 2026-11-23 끝냄, 기록용)

```
cd worker
npx wrangler login                          # 브라우저가 열리면 Cloudflare 로 로그인
npx wrangler kv namespace create SCORES     # 나온 id 를 wrangler.toml 의 id 에 적는다
npx wrangler deploy                         # scores.bomnalworks.com 에 붙는다 (DNS 기록은 Cloudflare 가 만든다)
```

- 로그인 창이 시간이 지나 꺼지면 `npx wrangler login --browser=false` 로 주소를 받아 크롬에 붙여 넣는다
- `../public/js/scores.js` 의 `API` 가 이 주소를 가리킨다. 사이트를 푸시하면 순위표가 켜진다

## 고치고 다시 올리기

`npx wrangler deploy` 만 다시 하면 된다. 저장된 순위는 그대로 남는다.

## 지킬 것

- 받는 것은 이니셜·점수·날짜뿐. IP 는 1분 횟수 제한에만 메모리로 쓰고 저장하지 않는다
- 점수는 브라우저가 보내는 값이라 조작할 수 있다. 범위(`min`·`max`)로만 거른다 - 이상한 기록이 보이면
  Cloudflare 화면 → KV → `lb:<게임>:<판>` 열쇠에서 지운다
