// 밈능검 E2E — 배포 전 가드. 삽입된 문항이 게임을 깨지 않는지 실제 플레이로 검증.
// 로컬: BASE=http://localhost:8123/?debug=1 node test/e2e.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8123/?debug=1";
let failed = 0;
const ok = (cond, label) => { console.log((cond ? "PASS" : "FAIL") + " — " + label); if (!cond) failed++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(BASE);
await page.waitForTimeout(700);

ok(/제 \d+회/.test(await page.textContent("#round-label")), "홈: 회차 표기");

// 데일리는 최근 2개 연도 밈만 (2024 등 오래된 밈 미출제)
const fresh = await page.evaluate(() => {
  const set = buildDailySet("2026-08-15");
  return { min: Math.min(...set.map((q) => parseInt(q.t.slice(0, 4)))), n: set.length };
});
ok(fresh.n === 12, `데일리 12문항 (${fresh.n})`);
ok(fresh.min >= new Date().getFullYear() - 1, `데일리 최신-only: 최소 연도 ${fresh.min}`);

// 12문항 플레이 (10정답/2오답) — 삽입 문항이 렌더/채점을 깨지 않는지 확인
await page.click("#btn-start");
const wrongAt = [2, 7];
for (let i = 0; i < 12; i++) {
  await page.waitForSelector("#choices .choice:not([disabled])", { timeout: 60000 });
  if (wrongAt.includes(i)) {
    for (const b of await page.$$("#choices .choice")) {
      if (!(await b.getAttribute("class")).includes("debug-answer")) { await b.click(); break; }
    }
  } else {
    await page.click("#choices .choice.debug-answer");
  }
  await page.waitForTimeout(wrongAt.includes(i) ? 1300 : 900);
}
await page.waitForSelector("#scr-result.active", { timeout: 15000 });

ok(/^[1-6]$/.test((await page.textContent("#grade-num")).trim()), "결과: 급수 판정");
ok(parseInt((await page.textContent("#r-score")).replace(/,/g, "")) > 900, "결과: 점수 산출");
const grid = await page.textContent("#emoji-grid");
ok([...grid].filter((c) => "🟩🟨🟥⬛".includes(c)).length >= 12, "결과: 이모지 그리드 12칸");
ok((await page.textContent("#r-age")).includes("세") || (await page.textContent("#r-age")).includes("측정"), "결과: 밈연령");
ok((await page.$$("#era-bars .era-bar-row")).length >= 1, "결과: 연도 막대 렌더");

const cardLen = await page.evaluate(async () => { const cv = await drawCard(); return cv ? cv.toDataURL("image/png").length : 0; });
ok(cardLen > 50000, "성적표 canvas 생성");

await page.click("#btn-review");
await page.waitForSelector("#scr-review.active");
ok((await page.$$("#review-list .review-item")).length === 12, "오답노트 12문항");

ok(errors.length === 0, "콘솔/페이지 에러 0건" + (errors.length ? " → " + errors.join(" | ") : ""));

await browser.close();
console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
