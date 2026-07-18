// 링크 분류(광고/피싱/공식) 순수 로직 테스트
import { test } from "node:test";
import assert from "node:assert/strict";

// classify.js는 export가 없는 클래식 스크립트 → import 실행만으로 globalThis.WG를 채운다.
await import("../src/lib/classify.js");
const { classifyLabel } = globalThis.WG;

test("공식 정부 도메인(.gov.kr)은 official", () => {
  assert.equal(
    classifyLabel({ text: "교육비 지원 신청", href: "https://www.gov.kr/portal/service", currentHostname: "www.gov.kr" }),
    "official"
  );
});

test(".go.kr / .korea.kr 도 official", () => {
  assert.equal(classifyLabel({ text: "민원신청", href: "https://minwon.go.kr/x", currentHostname: "www.gov.kr" }), "official");
  assert.equal(classifyLabel({ text: "정책브리핑", href: "https://korea.kr/news", currentHostname: "www.gov.kr" }), "official");
});

test("광고 키워드가 있으면 ad", () => {
  assert.equal(
    classifyLabel({ text: "무료 상담 신청 지금!", href: "https://ad.example.com/land", currentHostname: "www.gov.kr" }),
    "ad"
  );
});

test("공식 도메인은 광고 키워드보다 우선 (오탐 방지)", () => {
  assert.equal(
    classifyLabel({ text: "무료 교육 지원", href: "https://www.gov.kr/free", currentHostname: "www.gov.kr" }),
    "official"
  );
});

test("외부 상업 도메인은 suspect", () => {
  assert.equal(
    classifyLabel({ text: "바로가기", href: "https://random-shop.com/item", currentHostname: "www.gov.kr" }),
    "suspect"
  );
});

test("같은 사이트 내부 링크는 normal", () => {
  assert.equal(
    classifyLabel({ text: "다음 단계", href: "https://blog.naver.com/x", currentHostname: "shop.naver.com" }),
    "normal"
  );
});

test("IP 주소 호스트는 피싱 신호 → suspect", () => {
  assert.equal(
    classifyLabel({ text: "로그인", href: "http://192.168.10.5/login", currentHostname: "www.gov.kr" }),
    "suspect"
  );
});

test("퓨니코드(xn--) 호스트는 suspect", () => {
  assert.equal(
    classifyLabel({ text: "안내", href: "https://xn--mnchen-3ya.de/", currentHostname: "www.gov.kr" }),
    "suspect"
  );
});

test("단축 URL(bit.ly)은 suspect", () => {
  assert.equal(
    classifyLabel({ text: "여기 클릭", href: "https://bit.ly/abcd", currentHostname: "www.gov.kr" }),
    "suspect"
  );
});

test("http(비보안) 외부 링크는 suspect", () => {
  assert.equal(
    classifyLabel({ text: "안내 페이지", href: "http://example.org/info", currentHostname: "www.gov.kr" }),
    "suspect"
  );
});

test("빈 입력이나 잘못된 href는 normal (예외 없이)", () => {
  assert.equal(classifyLabel({}), "normal");
  assert.equal(classifyLabel({ text: "링크", href: "javascript:void(0)", currentHostname: "www.gov.kr" }), "normal");
});
