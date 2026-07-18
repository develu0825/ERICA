// terms.js — 행정용어 쉬운말 사전(순수 데이터/로직)
// content script와 Node 테스트 양쪽에서 공유(classify.js와 동일한 로딩 방식).
(function (root) {
  // 한국 행정 웹사이트에 자주 나오는 어려운 말 → 쉬운 설명
  const TERMS = {
    민원: "국민이 행정기관에 신청하거나 요청하는 일",
    신청: "무언가를 해달라고 정식으로 요청하는 것",
    접수: "서류나 신청을 받아서 처리하기 시작하는 것",
    발급: "증명서나 서류를 만들어서 주는 것",
    교부: "서류나 물건을 정식으로 내어 주는 것",
    수급자: "지원금이나 혜택을 받는 사람",
    지원금: "정부가 도와주려고 주는 돈",
    보조금: "정부가 일부를 대신 내주는 돈",
    감면: "내야 할 돈을 줄여주거나 안 내게 해주는 것",
    납부: "세금이나 요금을 내는 것",
    공제: "전체 금액에서 일부를 빼주는 것",
    소득분위: "소득 수준을 등급으로 나눈 것(낮을수록 소득이 적음)",
    자격: "무언가를 할 수 있는 조건을 갖춘 상태",
    요건: "꼭 갖춰야 하는 조건",
    구비서류: "준비해서 내야 하는 서류들",
    첨부: "서류에 다른 파일을 함께 붙이는 것",
    열람: "내용을 확인해 보는 것",
    정정: "잘못된 내용을 바르게 고치는 것",
    반려: "신청이 받아들여지지 않고 되돌아오는 것",
    처리기한: "일을 끝내주기로 한 기한(며칠 안에)",
    수수료: "서비스를 받을 때 내는 돈",
    위임: "다른 사람에게 대신 하도록 맡기는 것",
    대리: "본인 대신 다른 사람이 해주는 것",
    본인인증: "정말 본인이 맞는지 확인하는 절차",
    전자서명: "인터넷에서 하는 도장·서명",
    증명서: "어떤 사실을 공식적으로 확인해 주는 서류",
    등본: "원본 내용을 그대로 옮겨 적은 서류",
    초본: "필요한 부분만 뽑아 적은 서류",
    관할: "그 일을 담당하는 지역·기관",
    소관: "그 일을 맡아 처리하는 부서",
    고지서: "낼 돈을 알려주는 안내 서류",
    과태료: "규칙을 어겼을 때 내는 벌금",
    체납: "내야 할 돈을 기한까지 내지 않은 것",
    확인서: "사실을 확인해 주는 서류",
  };

  /**
   * 주어진 텍스트에 등장하는 사전 등록 용어 목록을 반환.
   * @param {string} text
   * @returns {string[]}
   */
  function findTerms(text) {
    const s = String(text || "");
    const out = [];
    for (const term of Object.keys(TERMS)) {
      if (s.includes(term)) out.push(term);
    }
    return out;
  }

  /**
   * 용어의 쉬운 설명을 반환(없으면 빈 문자열).
   * @param {string} term
   * @returns {string}
   */
  function explainTerm(term) {
    return Object.prototype.hasOwnProperty.call(TERMS, term) ? TERMS[term] : "";
  }

  root.WG = root.WG || {};
  root.WG.TERMS = TERMS;
  root.WG.findTerms = findTerms;
  root.WG.explainTerm = explainTerm;
})(typeof globalThis !== "undefined" ? globalThis : this);
