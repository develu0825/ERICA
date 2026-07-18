// classify.js — 링크 라벨 분류(순수 로직)
// content script와 Node 테스트 양쪽에서 공유한다.
// - 브라우저: 콘텐츠 스크립트로 먼저 로드되어 globalThis.WG 에 함수를 붙인다(content.js가 사용).
// - Node 테스트: import() 실행만으로 IIFE가 돌아 globalThis.WG 가 채워진다(export 불필요).
(function (root) {
  // 광고/상업 유도 신호 (텍스트 기준)
  const AD_KEYWORDS = [
    "광고", "AD", "무료", "지금 클릭", "상담신청", "무료상담", "이벤트",
    "당첨", "쿠폰", "할인", "특가", "대출", "카지노", "베팅", "성인",
    "sponsored", "promotion",
  ];
  // 공식 정부/공공 도메인 접미사
  const OFFICIAL_HOSTS = [".gov.kr", ".go.kr", ".korea.kr", ".or.kr"];
  // 피싱에 흔한 단축 URL 서비스
  const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "buly.kr", "abr.ge", "me2.do"];

  // 등록 도메인(마지막 두 라벨)으로 같은 사이트 여부 판단
  function regDomain(host) {
    const parts = String(host || "").split(".").filter(Boolean);
    return parts.slice(-2).join(".");
  }

  /**
   * 링크 하나의 라벨을 반환한다.
   * @param {{text?:string, href?:string, currentHostname?:string}} p
   * @returns {"official"|"ad"|"suspect"|"normal"}
   */
  function classifyLabel({ text = "", href = "", currentHostname = "" } = {}) {
    let host = "";
    try { host = new URL(href).hostname.toLowerCase(); } catch { host = ""; }

    const t = text.trim().toLowerCase();
    const looksAd = AD_KEYWORDS.some((k) => t.includes(k.toLowerCase()));
    const isOfficial = !!host && OFFICIAL_HOSTS.some((h) => host === h.slice(1) || host.endsWith(h));
    const sameSite = !!host && !!currentHostname &&
      regDomain(host) === regDomain(currentHostname.toLowerCase());

    // 피싱 신호
    const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const isPunycode = host.includes("xn--");
    const isShortener = SHORTENERS.includes(host);
    const insecureExternal = /^http:\/\//i.test(href) && !!host && !sameSite;

    // 우선순위: 공식 > 피싱신호 > 광고 > 외부도메인 > 내부
    if (isOfficial) return "official";
    if (isIpHost || isPunycode || isShortener || insecureExternal) return "suspect";
    if (looksAd) return "ad";
    if (host && !sameSite) return "suspect"; // 외부 상업 도메인
    return "normal";
  }

  root.WG = root.WG || {};
  root.WG.classifyLabel = classifyLabel;
  root.WG.AD_KEYWORDS = AD_KEYWORDS;
  root.WG.OFFICIAL_HOSTS = OFFICIAL_HOSTS;
})(typeof globalThis !== "undefined" ? globalThis : this);
