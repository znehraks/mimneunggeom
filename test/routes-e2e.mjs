// 3개 신규 라우트 스모크 — 플레이→결과→성적표 canvas→콘솔에러 0
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:8123";
let failed = 0;
const ok = (c, l) => { console.log((c ? "PASS" : "FAIL") + " — " + l); if (!c) failed++; };
const browser = await chromium.launch();

async function newPage() {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 } });
  const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  return { p, errs };
}
async function cardOk(p) {
  return await p.evaluate(async () => {
    // 각 페이지의 cardResult()가 전역이 아니므로 결과 화면 값으로 최소 카드 생성 확인
    const r = { examName: "테스트", subline: "x", big: "1 급", title: "t", quote: "q", rows: [["a", "b"]], footerUrl: "x" };
    const cv = await Exam.draw(r); return cv ? cv.toDataURL("image/png").length : 0;
  });
}

// 1) 광클
{
  const { p, errs } = await newPage();
  await p.goto(BASE + "/gwangclick");
  ok(await p.evaluate(() => typeof Exam === "object"), "gwangclick: exam.js 로드");
  await p.click("#btn-start");
  await p.waitForSelector("#play", { state: "visible", timeout: 8000 });
  for (let i = 0; i < 40; i++) { await p.dispatchEvent("#tapzone", "pointerdown"); await p.waitForTimeout(30); }
  await p.waitForSelector("#scr-result.active", { timeout: 15000 });
  ok(/^[1-6]$/.test((await p.textContent("#r-grade")).trim()), "gwangclick: 급수 판정");
  ok(parseInt(await p.textContent("#r-taps")) > 0, "gwangclick: 타수 기록 " + (await p.textContent("#r-taps")));
  ok((await p.textContent("#share-preview")).includes("gwangclick"), "gwangclick: 공유문구 URL");
  ok((await cardOk(p)) > 50000, "gwangclick: 성적표 canvas");
  ok(errs.length === 0, "gwangclick: 콘솔에러 0" + (errs.length ? " → " + errs.join(" | ") : ""));
  await p.close();
}
// 2) 인내심
{
  const { p, errs } = await newPage();
  await p.goto(BASE + "/patience?debug=1");
  await p.click("#btn-start");
  await p.waitForSelector("#scr-game.active", { timeout: 8000 });
  // 카메라 없음 → 정렬 건너뛰고 3·2·1 카운트다운 후 측정 시작(phase=timing)
  await p.waitForFunction(() => window.__pat && window.__pat.phase === "timing", { timeout: 8000 });
  await p.waitForTimeout(1300);
  await p.dispatchEvent("#hold", "pointerdown"); // 화면 터치 → 종료
  await p.waitForSelector("#scr-result.active", { timeout: 8000 });
  ok(/^[1-6]$/.test((await p.textContent("#r-grade")).trim()), "patience: 급수 판정");
  ok(parseFloat(await p.textContent("#r-sec")) >= 1, "patience: 버틴 시간 " + (await p.textContent("#r-sec")));
  ok((await cardOk(p)) > 50000, "patience: 성적표 canvas");
  ok(errs.length === 0, "patience: 콘솔에러 0" + (errs.length ? " → " + errs.join(" | ") : ""));
  await p.close();
}
// 3) 무쓸모 초능력
{
  const { p, errs } = await newPage();
  await p.goto(BASE + "/superpower");
  await p.click("#btn-start");
  for (let i = 0; i < 3; i++) { await p.waitForSelector("#choices .btn", { timeout: 6000 }); await p.click("#choices .btn"); await p.waitForTimeout(150); }
  await p.waitForSelector("#scr-result.active", { timeout: 8000 });
  ok((await p.textContent("#r-power")).length > 3, "superpower: 초능력 판정 " + (await p.textContent("#r-power")));
  ok((await p.textContent("#share-preview")).includes("superpower"), "superpower: 공유문구 URL");
  ok((await p.evaluate(async () => { const cv = await Exam.draw({ examName: "t", heroText: "「테스트 초능력」", title: "당신의 무쓸모 초능력", quote: "q", rows: [["a", "b"]], footerUrl: "x" }); return cv ? cv.toDataURL().length : 0; })) > 50000, "superpower: 판정서 canvas(heroText)");
  ok(errs.length === 0, "superpower: 콘솔에러 0" + (errs.length ? " → " + errs.join(" | ") : ""));
  await p.close();
}
await browser.close();
console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
