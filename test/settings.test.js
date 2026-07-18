// settings.js 저장/로드 로직 테스트 (chrome.storage.local 모킹)
import { test } from "node:test";
import assert from "node:assert/strict";

// settings.js import 전에 chrome.storage.local을 인메모리로 모킹
let store = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(key) { return key in store ? { [key]: store[key] } : {}; },
      async set(obj) { Object.assign(store, obj); },
    },
  },
};

const { getSettings, saveSettings, hasApiKey, DEFAULTS } = await import("../src/settings.js");

test("getSettings: 저장값 없으면 기본값 반환", async () => {
  store = {};
  const s = await getSettings();
  assert.equal(s.provider, "gemini");
  assert.equal(s.geminiModel, DEFAULTS.geminiModel);
  assert.equal(s.geminiApiKey, "");
});

test("saveSettings: patch가 기본값 위에 병합되어 저장·로드", async () => {
  store = {};
  await saveSettings({ geminiApiKey: "AIzaTEST" });
  const s = await getSettings();
  assert.equal(s.geminiApiKey, "AIzaTEST");
  assert.equal(s.provider, "gemini"); // 나머지는 기본값 유지
});

test("hasApiKey: gemini 키 유무를 반영", async () => {
  store = {};
  assert.equal(await hasApiKey(), false);
  await saveSettings({ geminiApiKey: "AIzaTEST" });
  assert.equal(await hasApiKey(), true);
});

test("hasApiKey: openai provider면 openai 키를 확인", async () => {
  store = {};
  await saveSettings({ provider: "openai" });
  assert.equal(await hasApiKey(), false);
  await saveSettings({ openaiApiKey: "sk-test" });
  assert.equal(await hasApiKey(), true);
});
