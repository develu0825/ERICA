// ai.js 순수 헬퍼 테스트 (LLM 출력 파싱 · 프롬프트 조립)
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeParseJson, buildUserPrompt } from "../src/ai.js";

test("safeParseJson: 순수 JSON 파싱", () => {
  const obj = safeParseJson('{"summary":"안녕","steps":["1","2"]}');
  assert.equal(obj.summary, "안녕");
  assert.deepEqual(obj.steps, ["1", "2"]);
});

test("safeParseJson: ```json 코드펜스 제거", () => {
  const raw = "```json\n{\"nextLink\":{\"text\":\"신청\",\"href\":\"https://gov.kr\"}}\n```";
  const obj = safeParseJson(raw);
  assert.equal(obj.nextLink.text, "신청");
});

test("safeParseJson: 앞뒤 설명 텍스트가 섞여도 객체만 추출", () => {
  const raw = '네, 안내드릴게요.\n{"summary":"요약"}\n감사합니다.';
  const obj = safeParseJson(raw);
  assert.equal(obj.summary, "요약");
});

test("safeParseJson: 잘못된 JSON은 예외를 던진다", () => {
  assert.throws(() => safeParseJson("이건 JSON이 아니에요"));
});

test("buildUserPrompt: 목적·제목·링크 라벨이 프롬프트에 포함", () => {
  const prompt = buildUserPrompt({
    goal: "자녀 학비 지원",
    pageTitle: "정부24",
    pageText: "본문 내용",
    links: [
      { label: "official", text: "교육비 지원", href: "https://gov.kr/edu" },
      { label: "ad", text: "무료상담", href: "https://ad.com" },
    ],
  });
  assert.match(prompt, /자녀 학비 지원/);
  assert.match(prompt, /정부24/);
  assert.match(prompt, /\[official\] "교육비 지원"/);
  assert.match(prompt, /\[ad\] "무료상담"/);
});
