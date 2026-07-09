/* 밈검정원 공유 로직 — 성적표 Canvas 카드 + 공유 + 토스트 + 저장. window.Exam 로 노출. */
"use strict";
window.Exam = (function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const NS = "meme-exam:" + location.pathname.replace(/[^a-z]/gi, "") + ":";
  function store(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} }
  function load(k, d) { try { const v = localStorage.getItem(NS + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }

  let toastTimer;
  function toast(msg) {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrap(ctx, text, x, y, maxW, lh) {
    const words = String(text).split(" "); let line = "", yy = y;
    for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
    ctx.fillText(line, x, yy); return yy;
  }

  async function loadFonts() {
    try {
      await document.fonts.load('900 100px "Noto Serif KR"');
      await document.fonts.load('600 40px "Noto Serif KR"');
      await document.fonts.load('500 30px "Noto Sans KR"');
    } catch (e) {}
  }

  /* result: {examName, round, name, big, bigUnit, title, quote, rows:[[k,v]], footerUrl, stampTop, stampBot} */
  async function draw(result) {
    await loadFonts();
    let cv = $("#card-canvas");
    if (!cv) { cv = document.createElement("canvas"); cv.id = "card-canvas"; cv.width = 1080; cv.height = 1350; cv.hidden = true; document.body.appendChild(cv); }
    const ctx = cv.getContext("2d"); const W = 1080, H = 1350;
    const SERIF = '"Noto Serif KR",serif', SANS = '"Noto Sans KR",sans-serif';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f6f1e4"; ctx.fillRect(0, 0, W, H);
    for (let yy = 0; yy < H; yy += 4) { ctx.fillStyle = "#f0eadb"; ctx.fillRect(0, yy, W, 1); }
    ctx.strokeStyle = "#241f14"; ctx.lineWidth = 5; ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.lineWidth = 1.5; ctx.strokeRect(42, 42, W - 84, H - 84);
    ctx.fillStyle = "#241f14"; ctx.textAlign = "center";
    ctx.font = `600 30px ${SERIF}`; ctx.fillText(result.examName || "밈검정원 검정시험", W / 2, 112);
    ctx.font = `900 74px ${SERIF}`; ctx.fillText(result.sheetTitle || "성 적 통 지 표", W / 2, 196);
    ctx.font = `500 24px ${SANS}`; ctx.fillStyle = "#8a2b25"; ctx.fillText("( 비 공 식 )", W / 2, 236);
    ctx.fillStyle = "#4c4433"; ctx.font = `500 25px ${SANS}`;
    ctx.fillText(result.subline || "", W / 2, 290);
    ctx.strokeStyle = "#241f14"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(70, 318); ctx.lineTo(W - 70, 318); ctx.stroke();
    // big (급수) 또는 heroText(긴 문구를 크게 감싸 렌더)
    ctx.fillStyle = "#241f14";
    if (result.heroText) {
      ctx.font = `600 26px ${SANS}`; ctx.fillStyle = "#6d6450"; ctx.fillText(result.title || "", W / 2, 400);
      ctx.font = `900 58px ${SERIF}`; ctx.fillStyle = "#241f14";
      const endY = wrap(ctx, result.heroText, W / 2, 480, 900, 76);
      ctx.font = `500 27px ${SANS}`; ctx.fillStyle = "#6d6450";
      wrap(ctx, result.quote || "", W / 2, endY + 60, 880, 38);
    } else {
      if (result.big) {
        ctx.font = `900 150px ${SERIF}`; ctx.fillText(result.big, W / 2, 520);
        if (result.bigUnit) { ctx.font = `900 56px ${SERIF}`; ctx.fillText(result.bigUnit, W / 2, 585); }
      }
      ctx.font = `600 40px ${SERIF}`; ctx.fillText(result.title || "", W / 2, 660);
      ctx.font = `500 27px ${SANS}`; ctx.fillStyle = "#6d6450";
      wrap(ctx, result.quote || "", W / 2, 712, 880, 38);
    }
    // rows
    ctx.fillStyle = "#241f14"; let by = 800;
    (result.rows || []).forEach((r) => {
      ctx.textAlign = "left"; ctx.font = `500 26px ${SANS}`; ctx.fillStyle = "#6d6450"; ctx.fillText(r[0], 120, by);
      ctx.textAlign = "right"; ctx.font = `700 28px ${SANS}`; ctx.fillStyle = "#241f14"; ctx.fillText(r[1], W - 120, by);
      by += 52;
    });
    // 검인 도장 (heroText 카드는 텍스트와 안 겹치게 아래로)
    ctx.save(); ctx.translate(W - 168, result.heroText ? 1085 : 500); ctx.rotate(0.16);
    ctx.strokeStyle = "rgba(179,38,30,.85)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 86, 0, 7); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 74, 0, 7); ctx.stroke();
    ctx.fillStyle = "rgba(179,38,30,.85)"; ctx.textAlign = "center";
    ctx.font = `900 40px ${SERIF}`; ctx.fillText(result.stampTop || "밈검정원", 0, -6);
    ctx.font = `900 34px ${SERIF}`; ctx.fillText(result.stampBot || "검 인", 0, 38);
    ctx.restore();
    // footer
    ctx.textAlign = "center"; ctx.fillStyle = "#8a806b"; ctx.font = `400 21px ${SANS}`;
    ctx.fillText("본 검정은 어떠한 공신력도 없으며, 순수 재미 목적입니다.", W / 2, H - 118);
    ctx.fillStyle = "#241f14"; ctx.font = `700 28px ${SANS}`;
    ctx.fillText((result.footerUrl || location.host + location.pathname).replace(/^https?:\/\//, ""), W / 2, H - 72);
    return cv;
  }

  async function save(result) {
    const cv = await draw(result);
    cv.toBlob(async (blob) => {
      if (!blob) { toast("이미지 생성 실패"); return; }
      const file = new File([blob], (result.fileName || "밈검정원-성적표") + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text: result.examName || "밈검정원 성적표" }); return; } catch (e) { if (e.name === "AbortError") return; }
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("성적표 이미지를 저장했습니다");
    }, "image/png");
  }

  async function share(text) {
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(text); toast("결과가 복사됐습니다. 단톡방에 붙여넣기!"); }
    catch (e) { toast("복사 실패 — 미리보기를 길게 눌러 복사하세요"); }
  }

  return { $, store, load, toast, draw, save, share };
})();
