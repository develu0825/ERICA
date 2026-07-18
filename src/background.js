// background.js — 서비스워커
// 역할: (1) 단축키/아이콘 클릭 → 사이드 패널 열기  (2) 필요 시 메시지 중계

// 아이콘 클릭 시 현재 탭에서 사이드 패널 열기
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id != null) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// 단축키(Alt+Q) → 사이드 패널 열기
// 주의: sidePanel.open()은 사용자 제스처 안에서 동기적으로 호출해야 함.
// onCommand가 두 번째 인자로 active tab을 주므로 await 없이 바로 연다.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-guide") return;
  if (tab?.id != null) {
    chrome.sidePanel.open({ tabId: tab.id });
  } else {
    // tab이 없으면 windowId로 폴백 (제스처 유지 위해 await 없이)
    chrome.windows.getCurrent().then((w) => {
      if (w?.id != null) chrome.sidePanel.open({ windowId: w.id });
    });
  }
});

// (선택) 사이드 패널을 아이콘으로도 열 수 있게 설정
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});
