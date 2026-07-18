// content.js — 웹페이지 안에서 실행되는 스크립트
// 역할: (1) 페이지 본문·링크 추출  (2) 광고/피싱 휴리스틱 분류  (3) 추천 링크 하이라이트

const AD_KEYWORDS = ["광고", "AD", "무료", "지금 클릭", "상담신청", "무료상담", "이벤트", "당첨", "쿠폰"];
const OFFICIAL_HOSTS = [".gov.kr", ".go.kr", ".korea.kr"];

function classifyLink(a) {
  const text = (a.innerText || a.textContent || "").trim();
  let href = "";
  try { href = new URL(a.href, location.href).href; } catch { href = a.href || ""; }

  let host = "";
  try { host = new URL(href).hostname; } catch {}

  const sameSite = host && host.endsWith(location.hostname.split(".").slice(-2).join("."));
  const isOfficial = OFFICIAL_HOSTS.some((h) => host.endsWith(h));
  const looksAd = AD_KEYWORDS.some((k) => text.includes(k));

  let label = "normal";
  if (looksAd) label = "ad";
  else if (isOfficial) label = "official";
  else if (host && !sameSite) label = "suspect"; // 외부 도메인

  return { text, href, host, label };
}

function extractPage() {
  // 본문 텍스트 (너무 길면 앞부분만)
  const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
  const pageText = bodyText.slice(0, 6000);

  // 링크 리스트 (텍스트 있는 것만, 중복 제거)
  const seen = new Set();
  const links = [];
  document.querySelectorAll("a").forEach((a) => {
    const info = classifyLink(a);
    if (!info.text || !info.href) return;
    const key = info.text + "|" + info.href;
    if (seen.has(key)) return;
    seen.add(key);
    links.push(info);
  });

  return { title: document.title, url: location.href, pageText, links: links.slice(0, 120) };
}

// 추천 링크 하이라이트
// AI가 준 nextLink의 href/text가 DOM과 정확히 일치하지 않을 수 있으므로
// (정규화 href) → (정확한 텍스트) → (부분 텍스트) 순으로 견고하게 매칭한다.
function highlightLink(href, text) {
  clearHighlights();
  const anchors = [...document.querySelectorAll("a")];
  const norm = (u) => {
    try { return new URL(u, location.href).href.replace(/#.*$/, "").replace(/\/+$/, ""); }
    catch { return (u || "").trim(); }
  };
  const wantHref = href ? norm(href) : "";
  const wantText = (text || "").trim();
  const atext = (a) => (a.innerText || a.textContent || "").trim();

  let target = wantHref && anchors.find((a) => norm(a.href) === wantHref);
  if (!target && wantText) target = anchors.find((a) => atext(a) === wantText);
  if (!target && wantText) target = anchors.find((a) => atext(a).includes(wantText));
  if (!target) return false;
  target.classList.add("__wg_highlight");
  const badge = document.createElement("span");
  badge.className = "__wg_badge";
  badge.textContent = "✓ 여기를 누르세요";
  target.appendChild(badge);
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

function clearHighlights() {
  document.querySelectorAll(".__wg_highlight").forEach((el) => el.classList.remove("__wg_highlight"));
  document.querySelectorAll(".__wg_badge").forEach((el) => el.remove());
}

// 하이라이트용 스타일 주입
function injectStyle() {
  if (document.getElementById("__wg_style")) return;
  const style = document.createElement("style");
  style.id = "__wg_style";
  style.textContent = `
    .__wg_highlight { outline: 3px solid #1f9d55 !important; outline-offset: 2px !important;
      border-radius: 4px !important; background: rgba(31,157,85,.08) !important; position: relative !important; }
    .__wg_badge { display:inline-block; margin-left:6px; background:#1f9d55; color:#fff;
      font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; vertical-align:middle; }
  `;
  document.documentElement.appendChild(style);
}
injectStyle();

// 패널 ↔ content 메시지 처리
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "WG_EXTRACT") {
    sendResponse(extractPage());
  } else if (msg?.type === "WG_HIGHLIGHT") {
    sendResponse({ ok: highlightLink(msg.href, msg.text) });
  } else if (msg?.type === "WG_CLEAR") {
    clearHighlights();
    sendResponse({ ok: true });
  }
  return true; // async response 허용
});
