// settings.js — API 설정을 chrome.storage.local에 저장/로드
// config.js 파일 없이, 사용자가 패널 UI에서 키를 입력하면 브라우저에 저장됩니다.

const KEY = "wg_settings";

export const DEFAULTS = {
  provider: "gemini",               // "gemini" | "openai"
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash",  // 빠르고 저렴. 필요시 gemini-2.5-flash 등으로 변경
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
};

// 저장된 설정을 기본값 위에 병합해서 반환
export async function getSettings() {
  const obj = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(obj[KEY] || {}) };
}

// 일부 필드만 patch로 넘겨 저장
export async function saveSettings(patch) {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

// 현재 provider에 맞는 키가 채워져 있는지
export async function hasApiKey() {
  const s = await getSettings();
  return s.provider === "openai" ? !!s.openaiApiKey.trim() : !!s.geminiApiKey.trim();
}
