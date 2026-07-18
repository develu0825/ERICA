# 다문화 가정 AI 웹 길잡이 — 개발 가이드 (CODING_GUIDE)

> 이 문서는 아이디어 기획서(PDF)를 **코드로 옮기기 위한 개발 지침서**입니다.
> 사람이 읽어도 되고, AI 코딩 도구(Cursor/Copilot/Claude)에게 그대로 넘겨서 작업 지시로 써도 됩니다.

---

## 0. 한 줄 요약

**어떤 한국어 웹사이트에서든 단축키를 누르면, 사용자가 모국어로 목적을 입력하고,
AI가 "지금 이 페이지에서 다음에 눌러야 할 곳"을 모국어로 안내하며, 광고·피싱은 걸러주는 크롬 확장.**

- 주제: 다문화 가정 언어장벽·정보격차 해소
- 형태: Chrome Extension (Manifest V3) + LLM API
- 데모 시나리오(가정): 정부24에서 "다문화 가정 자녀 교육비 지원 찾기"
- 지원 언어(가정): 베트남어 · 영어 (프롬프트로 확장 가능)
- AI API(가정): Google Gemini (무료 할당량) — 코드는 API 교체 가능하게 추상화

---

## 1. MVP 범위 (해커톤 제출 기준)

반드시 구현할 3개(★)와, 시간 남으면 붙일 확장 기능입니다.

| 우선순위 | 기능 | 설명 |
|---|---|---|
| ★ 필수 | **목적 기반 단계별 안내** | 목적 입력 → 현재 페이지 분석 → "다음 한 걸음" 안내 + 링크 하이라이트 |
| ★ 필수 | **페이지 모국어 요약** | 지금 화면이 뭘 하는 곳인지 쉬운 모국어 3줄 요약 |
| ★ 필수 | **광고·피싱 신호등** | 공식 링크 ✅ / 광고·의심 ⚠️ 색으로 구분 |
| 확장 | 행정용어 마우스오버 사전 | 어려운 단어에 툴팁으로 쉬운 설명 |
| 확장 | 안내 기록·다시보기 | 지난 안내를 저장하고 이어보기 |
| 확장 | 음성 입력 | 목적을 말로 입력 |

> **원칙:** 넓게 벌리지 말고 **데모 시나리오 1개를 끝까지 매끄럽게**. 심사 임팩트는 완성도에서 나온다.

---

## 2. 사용자 흐름 (5단계)

```
[1] 단축키(Alt+Q) 누름          → 사이드 패널 열림
[2] 모국어로 목적 입력           → 예: "자녀 학비 지원 신청하고 싶어요"
[3] content script가 페이지 파싱  → 본문·링크 추출 + 광고/추적 요소 제거
[4] AI 호출 (목적+페이지+언어)    → { 요약, 다음_링크, 단계_안내, 광고_경고 } 반환
[5] 패널에 안내 표시 + 링크 강조  → 사용자가 이동하면 [3]~[5] 반복 (루프)
```

**루프가 핵심:** 전체 경로를 한 번에 아는 건 불가능. 매 페이지에서 "다음 한 걸음"만 정확히 안내하고,
사용자가 링크를 누르면 새 페이지에서 다시 안내한다.

---

## 3. 폴더 구조

```
damunhwa-guide/
├─ manifest.json          # 확장 설정 (MV3)
├─ src/
│  ├─ background.js       # 서비스워커: 단축키 → 사이드패널 열기, 메시지 중계
│  ├─ content.js          # 페이지 파싱, 광고 필터, 링크 하이라이트 오버레이
│  ├─ sidepanel.html      # 길잡이 패널 UI
│  ├─ sidepanel.css       # 패널 스타일
│  ├─ sidepanel.js        # 패널 로직: 목적 입력 → AI 호출 → 결과 렌더
│  ├─ ai.js               # LLM API 추상화 (Gemini 기본, OpenAI 교체 가능)
│  └─ config.example.js   # API 키 템플릿 (복사해서 config.js 로)
├─ icons/                 # 16/48/128 아이콘
├─ docs/
│  └─ CODING_GUIDE.md     # (이 문서)
├─ .vscode/               # VSCode 설정
├─ .gitignore
└─ README.md
```

---

## 4. 각 파일이 할 일 (구현 명세)

### 4.1 `manifest.json`
- `manifest_version: 3`
- `permissions`: `["activeTab", "scripting", "sidePanel", "storage"]`
- `host_permissions`: 데모는 `["https://*.gov.kr/*"]`부터. 넓히려면 `<all_urls>`.
- `commands`: `_execute_action` 또는 커스텀 커맨드 `open-guide` = **Alt+Q**
- `background.service_worker`: `src/background.js`
- `side_panel.default_path`: `src/sidepanel.html`
- `content_scripts`: `src/content.js` (matches: 데모 도메인)

### 4.2 `background.js`
- `chrome.commands.onCommand` 리스너 → `chrome.sidePanel.open({ tabId })`
  (사이드패널 열기는 사용자 제스처 필요 — 커맨드가 제스처로 인정됨)
- 패널 ↔ content script 사이 메시지 중계가 필요하면 여기서 relay.

### 4.3 `content.js`
페이지에서 실행되는 스크립트. 핵심 3가지:
1. **본문 추출** — `document.body.innerText` 또는 주요 영역 텍스트. 너무 길면 앞 N자 자르기.
2. **링크 추출** — `document.querySelectorAll('a')` → `{ text, href }` 리스트. 텍스트 없는/빈 링크 제외.
3. **광고·추적 필터** — 아래 휴리스틱으로 링크에 라벨 부여:
   - 외부 도메인(현재 사이트와 다른 도메인) → `suspect`
   - 텍스트에 "광고 / AD / 무료 / 지금 클릭 / 상담신청" 등 포함 → `ad`
   - `*.gov.kr`, `*.go.kr` 등 공식 도메인 → `official`
4. **하이라이트** — 패널이 "이 링크를 누르라"고 지정하면, 해당 `<a>`에 테두리/배지 오버레이. 광고는 흐리게/취소선.
5. 메시지로 `{ pageText, links }` 를 패널에 전달, `{ highlightHref }` 를 받아 강조.

### 4.4 `sidepanel.js`
- 언어 선택(베트남어/영어/한국어) + 목적 입력창 + "안내받기" 버튼.
- 버튼 클릭 시:
  1. 활성 탭의 content script에 페이지 데이터 요청
  2. `ai.guide({ goal, lang, pageText, links })` 호출
  3. 결과(`summary`, `steps`, `nextLink`, `warnings`)를 카드로 렌더
  4. `nextLink` 를 content script에 보내 하이라이트
- 로딩 스피너, 에러 처리 포함.

### 4.5 `ai.js` — LLM 추상화 ⭐중요
- `guide({ goal, lang, pageText, links })` 하나의 진입점.
- 내부에서 provider 스위치: `gemini`(기본) / `openai`.
- **구조화 출력**을 강제: 아래 JSON 스키마로 받도록 프롬프트 작성.

```json
{
  "summary": "이 페이지가 무엇을 하는 곳인지 모국어 2~3줄",
  "steps": ["1단계 지시", "2단계 지시"],
  "nextLink": { "text": "눌러야 할 링크 텍스트", "href": "..." },
  "warnings": ["무시해야 할 광고/의심 요소 설명"]
}
```

**시스템 프롬프트 뼈대 (그대로 써도 됨):**
```
당신은 한국 행정 웹사이트를 처음 쓰는 외국인/다문화 가정을 돕는 안내자입니다.
사용자의 목적과 현재 페이지 내용을 보고, "지금 이 페이지에서 다음에 무엇을 눌러야 하는지"를
{lang} 언어로, 쉬운 말로, 딱 한 걸음만 안내하세요.
- 어려운 행정용어는 풀어서 설명합니다.
- 광고/피싱/외부 상업 링크는 절대 추천하지 말고 warnings에 경고로 넣습니다.
- 공식 정부 링크만 nextLink로 추천합니다.
- 반드시 아래 JSON 형식으로만 답하세요.
```

### 4.6 `config.example.js`
```js
// 이 파일을 복사해서 같은 폴더에 config.js 로 저장하고 키를 채우세요.
export const CONFIG = {
  provider: "gemini",            // "gemini" | "openai"
  geminiApiKey: "여기에_키",
  geminiModel: "gemini-1.5-flash",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
};
```
> `config.js` 는 `.gitignore` 에 넣어 커밋 금지 (키 노출 방지).

---

## 5. API 키 발급 (Gemini · 무료)

1. Google AI Studio(aistudio.google.com) 접속 → "Get API key"
2. 발급된 키를 `src/config.js` 의 `geminiApiKey` 에 붙여넣기
3. 무료 티어로 해커톤 데모에는 충분. 요청 폭주 시 `gemini-1.5-flash`(저렴/빠름) 사용.

> OpenAI로 바꾸려면 `provider: "openai"` + `openaiApiKey` 채우면 끝 (ai.js가 분기 처리).

---

## 6. 로컬에서 실행/테스트

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** → 이 폴더(`damunhwa-guide`) 선택
4. 정부24 같은 페이지 열고 **Alt+Q** → 패널 확인
5. 목적 입력 후 안내가 뜨는지 확인. 콘솔(F12)에서 에러 체크.

> 코드 수정 후에는 `chrome://extensions` 에서 확장 **새로고침(↻)** 눌러야 반영됨.

---

## 7. 개발 순서 (마감 역산)

- **STEP 1 · 골격** — manifest + 단축키로 패널 열기 + 페이지 텍스트 추출 (동작 확인)
- **STEP 2 · AI 연결** — Gemini 키 발급 → ai.js → 목적+페이지 → 모국어 안내 출력
- **STEP 3 · 핵심 UX** — 링크 하이라이트 + 광고 신호등 + **데모 시나리오 1개 완성**
- **STEP 4 · 제출** — 소개영상 촬영, 결과보고서, 소스코드 정리/커밋

---

## 8. 역할 분담 제안 (팀: 세현·다연 등)

| 파트 | 담당 후보 | 산출물 |
|---|---|---|
| 확장 골격 + content script | 개발A | manifest, background, content |
| AI 연동 + 패널 UI | 개발B | ai.js, sidepanel.* |
| 시나리오 설계 + 데모/영상 | 기획 | 데모 대본, 소개영상 |
| 결과보고서 | 문서 | 제출용 보고서 |

---

## 9. 데모 대본 (예시)

1. "다문화 가정 어머니가 정부24에서 자녀 교육비 지원을 찾으려 합니다."
2. 페이지는 온통 한국어 행정용어 — 어디를 눌러야 할지 막막.
3. **Alt+Q** → 길잡이 패널. 베트남어로 "자녀 학비 지원 신청하고 싶어요" 입력.
4. AI가 베트남어로: ① 이 페이지 요약 ② "여기 초록색 '교육비 지원 신청'을 누르세요" ③ "무료 상담 배너는 광고니 무시하세요"
5. 화면의 공식 링크가 ✅로 강조, 광고는 ⚠️로 표시됨.
6. 링크를 누르니 다음 페이지에서 또 안내가 이어짐 → "혼자서도 끝까지 갈 수 있다."

---

## 10. 남은 결정 (팀에서 확정할 것)

1. 데모 사이트 고정: 정부24 only? 홈택스/하이코리아 추가?
2. 지원 언어: 베트남어·영어면 충분? 중국어 추가?
3. 광고 판별: 규칙 기반 vs AI 판단 vs 둘 다?
4. 프로젝트 이름 확정 (현재 가칭 "손잡이").
