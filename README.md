# 다문화 웹 길잡이 (Web Guide) 🧭

한국어 웹사이트에서 **목적을 모국어로 입력하면, 다음에 눌러야 할 곳을 안내**하고
**광고·피싱은 걸러주는** 크롬 확장 프로그램. (AI 해커톤 · 다문화 가정 언어장벽 주제)

## 빠른 시작

1. **확장 로드** — Chrome에서 `chrome://extensions` → **개발자 모드 ON** →
   **압축해제된 확장 프로그램을 로드** → 이 폴더 선택.
2. **API 키 입력** — `*.gov.kr` 페이지에서 **Alt+Q**(또는 아이콘 클릭)로 패널을 열고,
   우측 상단 **⚙ 설정** → [Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급한
   Gemini 키를 붙여넣고 **설정 저장**. (키는 브라우저 저장소에만 저장되며 파일/깃에 남지 않습니다.)
3. **사용** — 패널에서 목적 입력 → 안내 확인.

> 별도의 `config.js` 파일을 만들 필요가 없습니다. 키 관리는 전적으로 패널 설정 UI에서 이뤄집니다.

## 프로젝트 구조

- `manifest.json` — 확장 설정 (MV3)
- `src/background.js` — 단축키/아이콘 → 사이드 패널 열기
- `src/content.js` — 페이지 파싱, 광고 분류, 링크 하이라이트
- `src/sidepanel.*` — 길잡이 패널 UI
- `src/ai.js` — LLM 추상화 (Gemini 기본, OpenAI 교체 가능)
- `src/settings.js` — API 키/모델 설정을 `chrome.storage.local`에 저장·로드
- `src/config.example.js` — (레거시) 이제 키는 패널 ⚙ 설정에서 입력
- `docs/CODING_GUIDE.md` — 상세 개발 가이드 ← **먼저 읽어보세요**

## 자세한 개발 지침

`docs/CODING_GUIDE.md` 에 기능 명세, 사용자 흐름, 프롬프트, 개발 순서, 역할 분담,
데모 대본, 남은 결정사항이 모두 정리되어 있습니다.

## ⚠️ 현재 상태

이 코드는 **동작하는 뼈대(scaffold)** 입니다. `config.js`에 키만 넣으면 기본 흐름이 돌아가며,
데모 시나리오 완성·UX 다듬기·광고 필터 고도화가 남은 작업입니다.
