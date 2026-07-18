// content.js — 웹페이지 안에서 실행되는 스크립트
// 역할: (1) 페이지 본문·링크 추출  (2) 광고/피싱 휴리스틱 분류  (3) 추천 링크 하이라이트

// 링크 분류는 공유 순수 모듈(src/lib/classify.js)에 위임한다.
// classify.js가 content_scripts 배열에서 먼저 로드되어 globalThis.WG에 함수를 붙인다.
function classifyLink(a) {
  const text = (a.innerText || a.textContent || "").trim();
  let href = "";
  try { href = new URL(a.href, location.href).href; } catch { href = a.href || ""; }

  let host = "";
  try { host = new URL(href).hostname; } catch {}

  const labelFn = self.WG && self.WG.classifyLabel;
  const label = labelFn
    ? labelFn({ text, href, currentHostname: location.hostname })
    : "normal";

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

// ---------- 행정용어 쉬운말 툴팁 ----------
// 사전은 공유 모듈(src/lib/terms.js)에서 globalThis.WG.TERMS로 제공된다.
const TERM_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "A", "BUTTON", "CODE"]);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 페이지의 어려운 용어에 밑줄+툴팁을 단다. 용어당 첫 등장 1회만, 최대 80개.
function annotateTerms() {
  removeTermAnnotations();
  const dict = self.WG && self.WG.TERMS;
  if (!dict || !document.body) return 0;

  const terms = Object.keys(dict).sort((a, b) => b.length - a.length);
  const rx = new RegExp(terms.map(escapeRegExp).join("|"), "g");
  const seen = new Set();
  const MAX = 80;
  let count = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p || TERM_SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (p.classList.contains("__wg_term") || p.closest(".__wg_term")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets = [];
  let node;
  while ((node = walker.nextNode())) {
    if (rx.test(node.nodeValue)) targets.push(node);
    rx.lastIndex = 0;
    if (targets.length > 600) break;
  }

  for (const textNode of targets) {
    if (count >= MAX) break;
    count += wrapTermsInNode(textNode, rx, dict, seen, MAX - count);
  }
  return count;
}

// 텍스트 노드 하나 안에서 매칭 용어를 span으로 감싼다(용어당 1회, seen으로 전역 중복 방지).
function wrapTermsInNode(textNode, rx, dict, seen, budget) {
  const text = textNode.nodeValue;
  rx.lastIndex = 0;
  let m;
  let last = 0;
  let added = 0;
  const fragment = document.createDocumentFragment();

  while ((m = rx.exec(text))) {
    const term = m[0];
    if (seen.has(term) || added >= budget) continue;
    seen.add(term);
    if (m.index > last) fragment.appendChild(document.createTextNode(text.slice(last, m.index)));
    const span = document.createElement("span");
    span.className = "__wg_term";
    span.textContent = term;
    span.setAttribute("data-tip", dict[term]);
    fragment.appendChild(span);
    last = m.index + term.length;
    added++;
  }
  if (added === 0) return 0;
  if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
  textNode.parentNode.replaceChild(fragment, textNode);
  return added;
}

function removeTermAnnotations() {
  document.querySelectorAll("span.__wg_term").forEach((el) => {
    const t = document.createTextNode(el.textContent);
    el.parentNode.replaceChild(t, el);
  });
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
    .__wg_term { border-bottom:2px dotted #2563c9 !important; cursor:help !important;
      position:relative !important; background:rgba(37,99,201,.06) !important; }
    .__wg_term::after { content:attr(data-tip); position:absolute; left:0; top:calc(100% + 6px);
      z-index:2147483647; min-width:160px; max-width:280px; white-space:normal;
      background:#12233b; color:#fff; font-size:12px; line-height:1.5; font-weight:400;
      padding:8px 10px; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.25);
      opacity:0; visibility:hidden; transition:opacity .12s; pointer-events:none; }
    .__wg_term:hover::after { opacity:1; visibility:visible; }
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
  } else if (msg?.type === "WG_TERMS_ON") {
    sendResponse({ ok: true, count: annotateTerms() });
  } else if (msg?.type === "WG_TERMS_OFF") {
    removeTermAnnotations();
    sendResponse({ ok: true });
  }
  return true; // async response 허용
});
