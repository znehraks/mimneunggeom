# Steam 배포 준비 팩

> **솔직한 상태 보고**: Steam 출시는 물리적으로 당일 완료가 불가능하다.
> Valve 규정 — ① Steamworks 파트너 등록 $100(과금이라 사장님 결제 필요) ② 세금 인터뷰·은행 정보 검증(수일)
> ③ 스토어 페이지 "Coming Soon" 최소 2주 노출 의무 ④ 빌드/페이지 각각 Valve 심사(1~5영업일).
> **이 폴더는 사장님이 결제만 하면 나머지가 바로 굴러가도록 모든 것을 준비해 둔 팩이다.**

## 출시 전략 권장안

웹 버전 지표(공유율 15%+, 일 방문 1천+)가 나오면 진행. Steam 버전은 웹과 차별화:
- **컨셉**: "밈능검 아카이브 에디션" — 데일리 + 무한급수 + **연대기 모드**(2000→2026 밈 역사 캠페인)
- **가격**: ₩3,300 (심리적 최저가, "커피값 밈 시험" 밈 마케팅) 또는 무료+DLC 문항팩
- **도전과제**: "밈 화석 발굴됨"(6급 달성), "재수 성공"(재응시로 급수 상승) 등 — 도전과제 자체가 공유 밈이 되도록
- **한국어+영어** 지원 필수 (영어 밈 팩 추가 후)

## 체크리스트 (순서대로)

### A. 계정 (사장님 직접, ~30분 + 검증 대기)
- [ ] https://partner.steamgames.com → Steamworks 계정 생성
- [ ] $100 App Fee 결제 (게임이 $1,000 수익 달성 시 환급)
- [ ] 세금 인터뷰(W-8BEN, 개인) + 은행 계좌 등록

### B. 앱 준비 (Claude가 이어서 자동화 가능)
- [ ] App ID 발급받으면 `electron/` 래퍼로 빌드 (아래 참조)
- [ ] `build/app_build.vdf`의 `%APP_ID%`, `%DEPOT_ID%` 치환
- [ ] steamcmd로 빌드 업로드:
  ```bash
  steamcmd +login <계정> +run_app_build ../steam/build/app_build.vdf +quit
  ```

### C. 스토어 페이지 (에셋 스펙)
| 에셋 | 크기 | 비고 |
|---|---|---|
| 헤더 캡슐 | 920×430 | 성적통지표 + 도장 키비주얼 |
| 메인 캡슐 | 616×353 | 동일 키비주얼 크롭 |
| 스몰 캡슐 | 231×87 | 로고+급수 도장 |
| 라이브러리 캡슐 | 600×900 | 세로형 성적표 |
| 스크린샷 | 1920×1080 ×5 | 시험/결과/오답노트/무한모드/성적표 |
| 트레일러 | 30초 | "당신 6급이면 어쩌려고" 컨셉 |

### D. 스토어 문구 (한/영 초안 완성본)

**짧은 설명(KR)**
> 당신의 밈 감각, 몇 급입니까? 2000년대부터 오늘까지의 밈을 순발력으로 검정하는 3분 시험. 성적통지표(비공식)가 발급됩니다.

**Short description(EN)**
> How fluent are you in Korean internet memes? A 3-minute reflex exam across three decades of meme history. Official-looking (totally unofficial) report card included.

**태그**: Casual, Trivia, Free to Play(해당 시), Singleplayer, Funny, Korean

### E. 출시 시퀀스
1. 스토어 페이지 제출 → 심사(2~5영업일) → **Coming Soon 공개 (최소 2주 의무)**
2. Coming Soon 기간 = 위시리스트 캠페인: 웹 게임 결과 화면에 "Steam 위시리스트" 버튼 추가(전환 루프)
3. 빌드 심사 통과 → 출시 버튼

## electron/ 래퍼 사용법

```bash
cd steam/electron
npm install
npm start          # 로컬 확인
npm run dist       # 배포 빌드 (win/mac)
```

steamworks 연동(도전과제)은 App ID 발급 후 `steamworks.js` 추가:
`npm i steamworks.js` → main.js 주석 해제.
