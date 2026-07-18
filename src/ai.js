// ai.js — LLM API 추상화 레이어
// guide() 하나만 쓰면 됨. provider(gemini/openai)와 키는 설정(chrome.storage)에서 읽음.

import { getSettings } from "./settings.js";

const SYSTEM_PROMPT = (lang) => `당신은 한국 행정 웹사이트를 처음 쓰는 외국인/다문화 가정을 돕는 안내자입니다.
사용자의 목적과 현재 페이지 내용을 보고, "지금 이 페이지에서 다음에 무엇을 눌러야 하는지"를
${lang} 언어로, 쉬운 말로, 딱 한 걸음만 안내하세요.

규칙:
- 어려운 행정용어는 풀어서 설명합니다.
- 광고/피싱/외부 상업 링크(label이 ad 또는 suspect)는 절대 nextLink로 추천하지 말고 warnings에 경고로 넣습니다.
- 공식 정부 링크(label이 official)만 nextLink로 추천합니다.
- 목표에 맞는 링크가 현재 페이지에 없으면 nextLink는 null로 두고, steps에서 어디로 가야 할지 설명합니다.
- 반드시 아래 JSON 형식으로만 답하세요. 다른 텍스트 금지.

{
  "summary": "이 페이지가 무엇을 하는 곳인지 ${lang}로 2~3줄",
  "steps": ["${lang}로 1단계 지시", "2단계 지시"],
  "nextLink": { "text": "눌러야 할 링크 텍스트", "href": "..." },
  "warnings": ["${lang}로 무시해야 할 광고/의심 요소 설명"]
}`;

export function buildUserPrompt({ goal, pageTitle, pageText, links }) {
  const linkList = links
    .map((l, i) => `${i + 1}. [${l.label}] "${l.text}" -> ${l.href}`)
    .join("\n");
  return `사용자 목적: ${goal}

현재 페이지 제목: ${pageTitle}

현재 페이지 본문(일부):
${pageText}

현재 페이지의 링크 목록(label = official/normal/ad/suspect):
${linkList}`;
}

export function safeParseJson(text) {
  // 모델이 코드펜스로 감쌀 때 대비
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

async function callGemini(system, user, cfg) {
  const model = cfg.geminiModel || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.geminiApiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error("Gemini API error: " + res.status + " " + (await res.text()));
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAI(system, user, cfg) {
  const model = cfg.openaiModel || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + cfg.openaiApiKey,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error("OpenAI API error: " + res.status + " " + (await res.text()));
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/**
 * 메인 진입점.
 * @returns {Promise<{summary:string, steps:string[], nextLink:{text,href}|null, warnings:string[]}>}
 */
export async function guide({ goal, lang, pageTitle, pageText, links }) {
  const cfg = await getSettings();
  const system = SYSTEM_PROMPT(lang);
  const user = buildUserPrompt({ goal, pageTitle, pageText, links });

  const raw =
    cfg.provider === "openai"
      ? await callOpenAI(system, user, cfg)
      : await callGemini(system, user, cfg);

  const parsed = safeParseJson(raw);
  return {
    summary: parsed.summary || "",
    steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    nextLink: parsed.nextLink && parsed.nextLink.href ? parsed.nextLink : null,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}
