#!/usr/bin/env node
/**
 * 밈능검 일일 자동 최신화 — Claude로 "지금 막 뜬" 한국 밈을 조사·검증해 문항 추가.
 *
 * 흐름:
 *   1) 기존 QUESTIONS를 읽어 이미 다룬 밈 목록(중복 방지)을 만든다
 *   2) Claude + web_search로 최근 1~2개월 신상 한국 밈을 조사한다
 *   3) Claude(구조화 출력)로 DESIGN 규칙에 맞는 문항 JSON을 생성한다
 *   4) 스키마·중복·안전성 검증을 통과한 문항만 index.html에 삽입한다
 *   5) 새 문항이 없으면 파일을 건드리지 않고 종료(멱등)
 *
 * 실제 배포는 CI가 담당: 이 스크립트가 index.html을 바꾸면 → E2E 통과 시에만 배포.
 * 필요한 환경변수: ANTHROPIC_API_KEY. 선택: REFRESH_MODEL(기본 claude-sonnet-5), MAX_NEW(기본 2).
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readQuestions, validateCandidates, insertQuestions } from "./lib/questions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");

const MODEL = process.env.REFRESH_MODEL || "claude-sonnet-5";
const MAX_NEW = parseInt(process.env.MAX_NEW || "2", 10);

// KST 오늘
const kst = new Date(Date.now() + 9 * 3600e3);
const TODAY = kst.toISOString().slice(0, 10);         // YYYY-MM-DD
const TODAY_YM = TODAY.slice(0, 7);                    // YYYY-MM
const CUR_YEAR = parseInt(TODAY.slice(0, 4), 10);

const log = (...a) => console.log("[refresh]", ...a);

async function runWithPauseTurn(params) {
  let res = await client.messages.create(params);
  let guard = 0;
  while (res.stop_reason === "pause_turn" && guard++ < 6) {
    res = await client.messages.create({
      ...params,
      messages: [params.messages[0], { role: "assistant", content: res.content }],
    });
  }
  return res;
}

const client = new Anthropic(); // ANTHROPIC_API_KEY from env

async function research(existingQ) {
  const covered = existingQ.map((q) => q.q).join("\n- ");
  const prompt =
`오늘은 ${TODAY}(KST)입니다. 한국 인터넷에서 **최근 1~2개월 사이에 새로 유행하기 시작한** 밈·유행어·챌린지를 웹에서 조사하세요.
각 항목에 대해: (1) 용어/이름 (2) 뜻 (3) 유래·출처 (4) 대략 언제부터 떴는지(월).
조건:
- 지금 한국에서 실제로 통용되는 최신 밈만. 이미 한물간 것, 몇 년 된 것 제외.
- 특정인 비하·정치·성적·혐오 밈 제외.
- 아래는 이미 문항으로 다룬 것이니 **제외**:
- ${covered}

최대 5개를 간결한 목록으로 정리하세요. 새롭고 검증 가능한 게 없으면 "없음"이라고만 답하세요.`;
  const res = await runWithPauseTurn({
    model: MODEL,
    max_tokens: 4000,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
    messages: [{ role: "user", content: prompt }],
  });
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "string", description: "유행 시기 YYYY-MM" },
          d: { type: "integer", enum: [1, 2, 3], description: "난이도(1 쉬움~3 어려움)" },
          q: { type: "string", description: "문제. 밈 이름을 직접 노출하지 말고 뜻/출처를 묻기" },
          c: { type: "array", items: { type: "string" }, description: "선택지 4개. 첫 번째가 정답" },
          n: { type: "string", description: "해설: 뜻 + 시기/맥락 한 줄" },
        },
        required: ["t", "d", "q", "c", "n"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

async function authorQuestions(researchText, existingQ) {
  const covered = existingQ.map((q) => q.q).join("\n- ");
  const prompt =
`아래는 오늘(${TODAY}) 조사한 최신 한국 밈 리서치입니다. 이걸 바탕으로 "밈능검"(밈 능력 검정시험) 데일리 퀴즈 문항을 만드세요.

## 리서치
${researchText}

## 문항 규칙 (엄수)
- 최대 ${MAX_NEW}개. **확실히 새롭고, 뜻이 검증되며, 안전한 밈만.** 애매하면 넣지 마세요(0개도 좋음).
- 각 문항: 4지선다. **c 배열의 첫 번째가 정답**, 나머지 3개는 오답(최소 1개는 순수 개그, 1개는 그럴듯한 함정).
- q: 밈 이름을 그대로 답으로 노출하지 말고 "뜻은?/출처는?/무엇인가?" 형태로. 예: "'○○'의 뜻은?"
- n: "뜻 + 시기/맥락" 한 줄 해설.
- t: 그 밈이 뜬 시기 "YYYY-MM". 최근이어야 함(${CUR_YEAR - 1}년 또는 ${CUR_YEAR}년). 모르면 ${TODAY_YM}.
- d: 대중도에 따라 1(다 앎)~3(마니아).
- **금지**: 특정인 비하·정치·성적·혐오·저속 표현, 장애/성별/세대 비하.
- 이미 다룬 밈과 중복 금지:
- ${covered}

새로 낼 게 없으면 questions를 빈 배열로 두세요.`;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: QUESTION_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  const txt = res.content.find((b) => b.type === "text")?.text || '{"questions":[]}';
  return JSON.parse(txt).questions || [];
}

(async () => {
  const html = fs.readFileSync(INDEX, "utf8");
  const existingQ = readQuestions(html);
  log(`기존 문항 ${existingQ.length}개. 모델=${MODEL}, 오늘=${TODAY}`);

  const researchText = await research(existingQ);
  log("리서치 결과 길이:", researchText.length);
  if (!researchText || researchText.replace(/\s/g, "") === "없음") {
    log("새 밈 없음 → 종료(변경 없음)"); return;
  }

  const authored = await authorQuestions(researchText, existingQ);
  log(`작성된 후보 ${authored.length}개`);
  const { valid, dropped } = validateCandidates(authored, existingQ, { curYear: CUR_YEAR, maxNew: MAX_NEW });
  dropped.forEach((d) => log("문항 폐기:", d.q, "→", d.reasons.join(", ")));
  if (!valid.length) { log("검증 통과 문항 0개 → 종료(변경 없음)"); return; }

  fs.writeFileSync(INDEX, insertQuestions(html, valid));
  log(`✅ ${valid.length}개 문항 추가:`);
  valid.forEach((v) => log(`   [${v.t}] ${v.q}  (정답: ${v.c[0]})`));
})().catch((e) => { console.error("[refresh] 실패:", e?.message || e); process.exit(1); });
