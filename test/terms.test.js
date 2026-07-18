// 행정용어 사전(순수 로직) 테스트
import { test } from "node:test";
import assert from "node:assert/strict";

// terms.js는 export 없는 클래식 스크립트 → import 실행만으로 globalThis.WG가 채워진다.
await import("../src/lib/terms.js");
const { findTerms, explainTerm, TERMS } = globalThis.WG;

test("findTerms: 문장 속 등록 용어를 모두 찾는다", () => {
  const found = findTerms("교육비 지원금 신청을 위해 구비서류를 접수하세요");
  assert.ok(found.includes("지원금"));
  assert.ok(found.includes("신청"));
  assert.ok(found.includes("구비서류"));
  assert.ok(found.includes("접수"));
});

test("findTerms: 등록 용어가 없으면 빈 배열", () => {
  assert.deepEqual(findTerms("오늘 날씨가 좋네요"), []);
});

test("findTerms: 빈/널 입력에도 예외 없이 빈 배열", () => {
  assert.deepEqual(findTerms(""), []);
  assert.deepEqual(findTerms(null), []);
  assert.deepEqual(findTerms(undefined), []);
});

test("explainTerm: 등록 용어의 쉬운 설명 반환", () => {
  assert.equal(explainTerm("반려"), "신청이 받아들여지지 않고 되돌아오는 것");
  assert.ok(explainTerm("과태료").length > 0);
});

test("explainTerm: 미등록 용어는 빈 문자열", () => {
  assert.equal(explainTerm("존재하지않는용어"), "");
});

test("사전에 최소 30개 이상의 용어가 있다", () => {
  assert.ok(Object.keys(TERMS).length >= 30);
});
