// sidepanel.js — 패널 UI 로직
import { guide } from "./ai.js";
import { getSettings, saveSettings, hasApiKey } from "./settings.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const resultEl = $("result");

function setStatus(msg, isErr = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("err", isErr);
}

// ---------- 설정(API 키) UI ----------
function toggleProviderFields(provider) {
  $("gemini-fields").hidden = provider !== "gemini";
  $("openai-fields").hidden = provider !== "openai";
}

async function loadSettingsIntoForm() {
  const s = await getSettings();
  $("provider").value = s.provider;
  $("geminiApiKey").value = s.geminiApiKey;
  $("geminiModel").value = s.geminiModel;
  $("openaiApiKey").value = s.openaiApiKey;
  $("openaiModel").value = s.openaiModel;
  toggleProviderFields(s.provider);
}

async function refreshKeyBanner() {
  const ok = await hasApiKey();
  $("key-banner").hidden = ok;
  return ok;
}

function openSettings(open = true) {
  $("settings").hidden = !open;
}

$("settings-toggle").addEventListener("click", () => {
  $("settings").hidden = !$("settings").hidden;
});

$("provider").addEventListener("change", (e) => toggleProviderFields(e.target.value));

$("save-settings").addEventListener("click", async () => {
  await saveSettings({
    provider: $("provider").value,
    geminiApiKey: $("geminiApiKey").value.trim(),
    geminiModel: $("geminiModel").value.trim() || "gemini-2.0-flash",
    openaiApiKey: $("openaiApiKey").value.trim(),
    openaiModel: $("openaiModel").value.trim() || "gpt-4o-mini",
  });
  const s = $("settings-status");
  s.textContent = "저장했어요 ✓";
  s.classList.remove("err");
  const ok = await refreshKeyBanner();
  if (ok) setTimeout(() => openSettings(false), 700);
});

// 첫 실행 시: 키 없으면 설정 자동 열기
(async () => {
  await loadSettingsIntoForm();
  const ok = await refreshKeyBanner();
  if (!ok) openSettings(true);
})();

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// content script에 메시지 (실패 시 주입 후 재시도)
async function sendToContent(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/lib/classify.js", "src/content.js"] });
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

function render({ summary, steps, nextLink, warnings }, tabId) {
  resultEl.hidden = false;
  resultEl.innerHTML = "";

  if (summary) {
    const c = document.createElement("div");
    c.className = "wg-card";
    c.innerHTML = `<h3>📄 이 페이지는</h3><div class="wg-summary"></div>`;
    c.querySelector(".wg-summary").textContent = summary;
    resultEl.appendChild(c);
  }

  if (steps?.length) {
    const c = document.createElement("div");
    c.className = "wg-card";
    c.innerHTML = `<h3>🧭 이렇게 하세요</h3>`;
    const ol = document.createElement("ul");
    ol.className = "wg-steps";
    steps.forEach((s, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="n">${i + 1}</span>`;
      li.appendChild(document.createTextNode(s));
      ol.appendChild(li);
    });
    c.appendChild(ol);
    resultEl.appendChild(c);
  }

  if (nextLink) {
    const c = document.createElement("div");
    c.className = "wg-card wg-next";
    c.innerHTML = `<h3>✓ 다음에 누를 곳</h3><div class="lk"></div>
      <button class="hl-btn">페이지에서 찾아주기</button>`;
    c.querySelector(".lk").textContent = nextLink.text;
    c.querySelector(".hl-btn").addEventListener("click", async () => {
      const r = await sendToContent(tabId, { type: "WG_HIGHLIGHT", href: nextLink.href, text: nextLink.text });
      setStatus(r?.ok ? "페이지에서 초록색으로 표시했어요 ✓" : "그 링크를 페이지에서 못 찾았어요.");
    });
    resultEl.appendChild(c);
  }

  if (warnings?.length) {
    const c = document.createElement("div");
    c.className = "wg-card wg-warn";
    c.innerHTML = `<h3>주의하세요</h3>`;
    const ul = document.createElement("ul");
    warnings.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      ul.appendChild(li);
    });
    c.appendChild(ul);
    resultEl.appendChild(c);
  }
}

// ---------- 안내 실행 (버튼/자동 공용) ----------
// 마지막 안내에 쓴 목적·언어와, 이미 안내한 URL을 기억해 루프에 활용한다.
let lastRun = null;        // { goal, lang }
let lastGuidedUrl = "";    // 중복 자동 안내 방지용
let busy = false;          // 동시 실행 방지

const autoGuideOn = () => $("autoGuide").checked;

async function runGuide({ goal, lang, auto = false }) {
  if (busy) return;
  if (!goal) return setStatus("하고 싶은 일을 입력해 주세요.", true);

  if (!(await hasApiKey())) {
    openSettings(true);
    await refreshKeyBanner();
    return setStatus("먼저 설정에서 API 키를 넣어 주세요.", true);
  }

  const btn = $("run");
  busy = true;
  btn.disabled = true;
  setStatus(auto ? "페이지가 바뀌었어요 · 다시 읽는 중…" : "페이지를 읽는 중…");
  if (!auto) resultEl.hidden = true;

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("활성 탭을 찾을 수 없어요.");

    const page = await sendToContent(tab.id, { type: "WG_EXTRACT" });
    if (!page) throw new Error("페이지를 읽지 못했어요. 새로고침 후 다시 시도해 주세요.");

    setStatus("AI가 안내를 준비하는 중…");
    const out = await guide({
      goal,
      lang,
      pageTitle: page.title,
      pageText: page.pageText,
      links: page.links,
    });

    render(out, tab.id);
    lastRun = { goal, lang };
    lastGuidedUrl = page.url || tab.url || "";

    // 추천 링크가 있으면 페이지에서 바로 초록색으로 표시(루프 흐름 매끄럽게)
    if (out.nextLink) {
      const r = await sendToContent(tab.id, {
        type: "WG_HIGHLIGHT", href: out.nextLink.href, text: out.nextLink.text,
      });
      setStatus(r?.ok
        ? "다음에 누를 곳을 페이지에 표시했어요 ✓"
        : (auto ? "새 페이지를 자동으로 안내했어요 ✓" : ""));
    } else {
      setStatus(auto ? "새 페이지를 자동으로 안내했어요 ✓" : "");
    }
  } catch (e) {
    console.error(e);
    setStatus("오류: " + e.message + "  (⚙ 설정의 API 키/모델을 확인하세요)", true);
  } finally {
    busy = false;
    btn.disabled = false;
  }
}

$("run").addEventListener("click", () =>
  runGuide({ goal: $("goal").value.trim(), lang: $("lang").value })
);

// ---------- 루프: 같은 탭이 새 페이지로 이동하면 자동으로 다시 안내 ----------
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!autoGuideOn() || !lastRun || busy) return;
  if (changeInfo.status !== "complete") return;          // 로딩 완료 시점만
  if (!tab?.active) return;                              // 백그라운드 탭 무시
  const url = tab.url || "";
  if (!url || url === lastGuidedUrl) return;             // 같은 페이지 재안내 방지
  if (/^(chrome|edge|about|chrome-extension):/i.test(url)) return; // 내부 페이지 무시

  const active = await getActiveTab();
  if (!active || active.id !== tabId) return;            // 현재 보고 있는 탭만

  lastGuidedUrl = url; // 중복 트리거 즉시 차단
  runGuide({ goal: lastRun.goal, lang: lastRun.lang, auto: true });
});
