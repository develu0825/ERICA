// history.js — 지난 안내 기록을 chrome.storage.local에 저장/로드
// settings.js와 같은 방식(ESM). 최신순으로 최대 MAX개 유지.

const KEY = "wg_history";
export const MAX_HISTORY = 20;

// 최신순 배열 반환(없으면 빈 배열)
export async function getHistory() {
  const obj = await chrome.storage.local.get(KEY);
  return Array.isArray(obj[KEY]) ? obj[KEY] : [];
}

// 새 안내 기록을 맨 앞에 추가하고 MAX개로 자른다. 저장된 목록을 반환.
export async function addHistory(entry) {
  const list = await getHistory();
  list.unshift(entry);
  const trimmed = list.slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [KEY]: trimmed });
  return trimmed;
}

// 전체 기록 삭제
export async function clearHistory() {
  await chrome.storage.local.set({ [KEY]: [] });
}
