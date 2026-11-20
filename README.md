# 봄날 운세 오락실 — play.bomnalworks.com

생년월일만 넣으면 2027 정미년 토정비결을 보여 주는 정적 웹페이지입니다.
**생년월일은 서버로 보내지 않습니다.** 괘 계산과 풀이 조회는 모두 브라우저 안에서 끝나고,
저장을 선택하면 그 브라우저의 localStorage에만 남습니다.

- 괘 번호(상·중·하 세 자리)는 전통 토정비결 계산법을 그대로 씁니다.
- 풀이 문장은 봄날웍스가 정한 해석 체계(`public/data/scheme.json`)로 새로 쓴 글입니다.
  옛 책이나 다른 사이트의 풀이를 옮기지 않았습니다. 재미로 보는 오락용입니다.

## 폴더

```
public/                  그대로 배포되는 정적 파일 (GitHub Pages 아티팩트)
  index.html
  assets/app.js          화면 로직 (입력 → 괘 계산 → 풀이 표시)
  assets/style.css       봄날웍스 홈페이지와 같은 종이색·흙색
  js/tojeong.js          괘 계산 모듈 (테스트와 브라우저가 같이 쓴다)
  js/config.js           연도·연령대 구분 (scheme.json 에서 자동 생성)
  vendor/kor-lunar.esm.js  음력 변환 (MIT, 자동 복사)
  data/scheme.json       봄날 해석 체계 (상괘 8 · 중괘 6 · 하괘 3, 등급 규칙)
  data/2027/<연령대>/<괘>.json   화면이 받는 파일. 괘 하나치(약 1KB)만 받는다
  ad/coupang.html        광고 자리 (비어 있으면 화면에 그려지지 않는다)
data/2027/<연령대>/<상괘>.json   손으로 쓰는 풀이 원본 조각 (연령대마다 8개)
data/2027/outline.json   120괘의 등급·이름·상징 (scheme 에서 자동 생성, 빌드 중간물)
scripts/                 빌드·검사 스크립트
tests/                   node --test
```

자동 생성물(`public/js/config.js`, `public/vendor/`, `data/2027/outline.json`,
`public/data/2027/<연령대>/`)은 직접 고치지 않습니다. `scheme.json`과 `data/` 조각이 원본입니다.

## 명령

```bash
npm install
npm test        # 괘 계산 6개 + 데이터·설정 검사 7개
npm run build   # vendor 사본 + outline + 괘별 풀이 파일 (검사 포함)
npm run serve   # http://localhost:4173 으로 public/ 띄우기
```

풀이를 고칠 때는 생성물이 아니라 `data/2027/<연령대>/<상괘>.json`을 고치고 `npm run build`를 돌립니다.
배포 워크플로가 생성물이 커밋본과 같은지(`git diff --exit-code data public`) 확인하므로,
빌드를 빼먹고 푸시하면 배포가 멈춥니다. Node 20 이상이 필요합니다.

## 괘 계산

```
상괘 = (세는 나이 + 그해 태세수) % 8          (0 이면 8)
중괘 = (그해 생월의 날수 + 그해 생월 월건수) % 6 (0 이면 6)
하괘 = (음력 생일 + 그해 생일의 일진수) % 3     (0 이면 3)
```

생월·생일은 운세를 보는 해의 같은 음력 달·날짜로 봅니다. 윤달생은 같은 숫자의 평달,
그해 그 달에 30일이 없으면 29일의 일진을 씁니다. 2027년에는 중괘 4가 나오지 않아 **120괘**입니다.

## 쿠팡 광고 바꾸기

`public/ad/coupang.html`에 상품 카드(120x240 iframe) 줄이 들어 있습니다(2026-11-20, 이전엔 320x100 배너).
카드를 더하거나 빼려면 `<template id="cards">` 안의 iframe 줄만 손대고 커밋합니다(순서는 열 때마다 섞임). 다섯 장까지 PC에서 한 줄에
들어가고, 좁은 화면에서는 옆으로 밀어 봅니다.
토정비결 결과 아래와 너구리·스도쿠의 게임과 놀이 방법 사이(페이지를 열 때부터)에 광고 자리와 대가성 문구가 함께
나타납니다. 카드를 다 지우면 광고 자리가 그려지지 않습니다. 광고 칸의 최대 폭은
토정비결 638px · 게임 680px입니다.

## 배포

`main`에 푸시하면 GitHub Actions가 `public/`을 GitHub Pages로 올립니다.
워크플로 원본은 `.github/workflows/deploy.yml`, 도메인은 `public/CNAME`입니다.
DNS는 Cloudflare에서 CNAME `play` → `bomnalworks.github.io` (DNS only).

## 내부 문서

계획(PLAN.md)·인수인계(HANDOFF.md)·설계 자료는 저장소에 올리지 않고 작업 PC에만 둡니다.
(`.gitignore` 참고. 새 PC에서는 직접 복사합니다.)

---

봄날의곰 (Bomnal Works) · contact@bomnalworks.com
음력 변환은 [kor-lunar](https://github.com/kahyou22/kor-lunar-js) (MIT)를 사용합니다.
