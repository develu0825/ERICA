// history.js 저장/로드/자르기 테스트 (chrome.storage.local 모킹)
import { test } from "node:test";
import assert from "node:assert/strict";

let store = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(key) { return key in store ? { [key]: store[key] } : {}; },
      async set(obj) { Object.assign(store, obj); },
    },
  },
};

const { getHistory, addHistory, clearHistory, MAX_HISTORY } = await import("../src/history.js");

test("getHistory: 없으면 빈 배열", async () => {
  store = {};
  assert.deepEqual(await getHistory(), []);
});

test("addHistory: 최신 항목이 맨 앞에 온다", async () => {
  store = {};
  await addHistory({ goal: "첫번째" });
  await addHistory({ goal: "두번째" });
  const list = await getHistory();
  assert.equal(list[0].goal, "두번째");
  assert.equal(list[1].goal, "첫번째");
});

test("addHistory: MAX_HISTORY 개를 넘지 않는다", async () => {
  store = {};
  for (let i = 0; i < MAX_HISTORY + 5; i++) await addHistory({ goal: "g" + i });
  const list = await getHistory();
  assert.equal(list.length, MAX_HISTORY);
  assert.equal(list[0].goal, "g" + (MAX_HISTORY + 4)); // 가장 최근
});

test("clearHistory: 전체 삭제", async () => {
  store = {};
  await addHistory({ goal: "x" });
  await clearHistory();
  assert.deepEqual(await getHistory(), []);
});
