// 밈능검 문항 처리 공유 로직 — Anthropic API 경로(refresh-memes.mjs)와
// Codex/로컬 경로(apply-candidates.mjs)가 함께 쓴다. 순수 함수, 외부 의존 없음.

// 부적절 문항 자동 게이트(무인 반영 방어) — 걸리면 해당 문항 폐기
export const BLOCKLIST = [
  "섹스", "성관계", "자살", "강간", "성기", "야동",
  "존나", "씨발", "병신", "장애인", "김치녀", "한남", "된장녀", "틀딱", "급식충",
];

export function readQuestions(html) {
  const m = html.match(/const QUESTIONS = \[([\s\S]*?)\n\];/);
  if (!m) throw new Error("QUESTIONS 배열을 찾지 못함");
  return new Function("return [" + m[1] + "\n]")();
}

// newQs: [{t,d,q,c,n}] · 반환: 검증 통과분(정규화됨)
export function validateCandidates(newQs, existingQ, opts = {}) {
  const curYear = opts.curYear || new Date().getFullYear();
  const maxNew = opts.maxNew || 2;
  const existTexts = new Set(existingQ.map((q) => q.q.replace(/\s/g, "")));
  const existAns = new Set(existingQ.map((q) => q.c[0].replace(/\s/g, "")));
  const out = [];
  const dropped = [];
  for (const it of newQs || []) {
    const r = [];
    if (!it || !it.q || !it.n) r.push("빈 필드");
    if (!Array.isArray(it?.c) || it.c.length !== 4) r.push("선택지 4개 아님");
    else if (new Set(it.c.map((s) => (s || "").trim())).size !== 4) r.push("선택지 중복");
    if (!/^\d{4}-\d{2}$/.test(it?.t || "")) r.push("t 형식");
    else if (parseInt(it.t.slice(0, 4), 10) < curYear - 1) r.push("최신 아님(풀 편입 불가)");
    if (![1, 2, 3].includes(it?.d)) r.push("난이도");
    if (it?.q && existTexts.has(it.q.replace(/\s/g, ""))) r.push("문제 중복");
    if (it?.c?.[0] && existAns.has(it.c[0].replace(/\s/g, ""))) r.push("정답 중복");
    const blob = [it?.q, it?.n, ...(it?.c || [])].join(" ");
    const hit = BLOCKLIST.find((w) => blob.includes(w));
    if (hit) r.push("금지어:" + hit);
    if (r.length) { dropped.push({ q: it?.q, reasons: r }); continue; }
    out.push({ t: it.t, d: it.d, q: it.q.trim(), c: it.c.map((s) => s.trim()), n: it.n.trim() });
    if (out.length >= maxNew) break;
  }
  return { valid: out, dropped };
}

export function insertQuestions(html, items) {
  if (!items.length) return html;
  const start = html.indexOf("const QUESTIONS = [");
  const eraIdx = html.indexOf("const ERA_NAMES", start);
  const closeRel = html.lastIndexOf("\n];", eraIdx);
  const lines = items
    .map((it) => `{e:2,t:${JSON.stringify(it.t)},d:${it.d},q:${JSON.stringify(it.q)},c:${JSON.stringify(it.c)},n:${JSON.stringify(it.n)}}`)
    .join(",\n");
  return html.slice(0, closeRel) + ",\n" + lines + html.slice(closeRel);
}
