chrome.action.onClicked.addListener((tab) => {
  if (tab.url) {
    const deepLink = `ytdln-open://download?url=${encodeURIComponent(tab.url)}`;
    chrome.tabs.update({ url: deepLink });
  }
});

// Listener para mensagens vindas do popup, caso queira disparar por lá também
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openApp" && request.url) {
    const deepLink = `ytdln-open://download?url=${encodeURIComponent(request.url)}`;
    // Usar tabs.update para disparar o protocolo
    chrome.tabs.update({ url: deepLink });
    sendResponse({ success: true });
  }
});
