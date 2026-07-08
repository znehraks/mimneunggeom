#!/usr/bin/env node
/**
 * 후보 문항 JSON을 받아 결정론적으로 반영·배포하는 로컬 파이프라인.
 * Codex 자동화가 리서치로 만든 후보(JSON)를 여기에 넘겨 안전하게 반영한다.
 * (LLM/네트워크 리서치 없음 — 검증·삽입·E2E·배포만. netlify/git은 로컬 인증 사용.)
 *
 * 입력: 후보 파일 경로(첫 인자) 또는 CANDIDATES_FILE 또는 /tmp/mng-candidates.json
 *   형식: {"questions":[{t,d,q,c,n}...]} 또는 [{...}]  (둘 다 허용)
 * 흐름: 검증 → index.html 삽입 → E2E 게이트(통과해야만) → netlify 배포 → git 커밋/푸시
 *   실패/후보없음 → index.html 원복, no-op. APPLY_DRY_RUN=1이면 배포·커밋 생략(원복).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, execSync } from "child_process";
import { readQuestions, validateCandidates, insertQuestions } from "./lib/questions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const PORT = 8123;
const DRY = process.env.APPLY_DRY_RUN === "1";
const CUR_YEAR = new Date(Date.now() + 9 * 3600e3).getFullYear();
const CAND = process.argv[2] || process.env.CANDIDATES_FILE || "/tmp/mng-candidates.json";
const log = (...a) => console.log("[apply]", ...a);
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });

function loadCandidates(file) {
  if (!fs.existsSync(file)) { log(`후보 파일 없음(${file}) → no-op`); return []; }
  let raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];
  // 코드펜스나 앞뒤 잡텍스트가 섞여도 첫 JSON 덩어리만 추출
  const s = raw.indexOf("{") >= 0 ? raw.indexOf("{") : raw.indexOf("[");
  if (s > 0) raw = raw.slice(s);
  let data;
  try { data = JSON.parse(raw); } catch (e) { log("후보 JSON 파싱 실패 → no-op:", e.message); return []; }
  return Array.isArray(data) ? data : (data.questions || []);
}

async function waitServer(url, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function runE2E() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  try {
    if (!(await waitServer(`http://localhost:${PORT}/index.html`))) throw new Error("로컬 서버 기동 실패");
    execSync(`node test/e2e.mjs`, { cwd: ROOT, stdio: "inherit", env: { ...process.env, BASE: `http://localhost:${PORT}/?debug=1` } });
    return true;
  } catch { return false; }
  finally { try { server.kill(); } catch {} }
}

(async () => {
  const original = fs.readFileSync(INDEX, "utf8");
  const existingQ = readQuestions(original);
  const cands = loadCandidates(CAND);
  log(`기존 ${existingQ.length}개, 후보 ${cands.length}개 (${DRY ? "DRY-RUN" : "LIVE"})`);

  const { valid, dropped } = validateCandidates(cands, existingQ, { curYear: CUR_YEAR, maxNew: parseInt(process.env.MAX_NEW || "2", 10) });
  dropped.forEach((d) => log("폐기:", d.q, "→", d.reasons.join(", ")));
  if (!valid.length) { log("반영할 새 문항 0개 → 종료(변경 없음)"); return; }

  fs.writeFileSync(INDEX, insertQuestions(original, valid));
  log(`${valid.length}개 삽입:`);
  valid.forEach((v) => log(`   [${v.t}] ${v.q} (정답: ${v.c[0]})`));

  log("E2E 게이트 실행…");
  if (!(await runE2E())) {
    fs.writeFileSync(INDEX, original);
    log("❌ E2E 실패 → 원복, 배포 안 함"); process.exit(1);
  }
  log("✅ E2E 통과");

  if (DRY) { fs.writeFileSync(INDEX, original); log("DRY-RUN: 배포·커밋 생략, 원복 완료"); return; }

  log("Netlify 배포…");
  const SITE = process.env.NETLIFY_SITE_ID || "0ec9847a-6b75-451e-8691-eb62d6cf5270";
  sh(`npx --yes netlify-cli deploy --prod --dir . --site ${SITE} --message "codex daily meme refresh"`);
  log("git 커밋/푸시…");
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  sh(`git add index.html`);
  try { sh(`git commit -m "chore: Codex 데일리 밈 최신화 (${today})"`); } catch { log("커밋할 변경 없음"); }
  try { sh(`git push`); } catch (e) { log("push 실패(수동 확인 필요)"); }
  log("✅ 완료");
})().catch((e) => { console.error("[apply] 실패:", e?.message || e); process.exit(1); });
