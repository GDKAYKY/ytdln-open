let socket = null;
let queueState = [];

function connect() {
  socket = new WebSocket("ws://localhost:8888");

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Lógica determinística: Só inicia o download quando o App já validou TUDO
    if (data.type === "DOWNLOAD_READY") {
      const downloadUrl = `http://localhost:8888/download?id=${data.downloadId}`;
      chrome.downloads.download({
        url: downloadUrl,
        saveAs: false, // Deixa o servidor decidir o nome via Content-Disposition
      });
    }

    if (data.type === "QUEUE_UPDATE") queueState = data.payload || [];
    if (data.type === "ERROR") console.error("[YTDLN] Erro:", data.message);
  };

  socket.onclose = () => setTimeout(connect, 3000);
}
connect();

/**
 * Extensão atua como Orquestradora:
 * Captura URL e Configurações, envia para o App validar,
 * e inicia o download nativo via sinal do App.
 */
async function sendToApp(url, tabId) {
  if (!url || url.startsWith("blob:")) return;

  const settings = await chrome.storage.local.get(null);

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "PREPARE_NATIVE_DOWNLOAD",
        url: url,
        settings: settings,
      })
    );
    console.log("[YTDLN] Solicitando validação do App...");
  } else {
    // Fallback para Deep Link se o servidor local estiver offline
    const settingsBase64 = btoa(
      unescape(encodeURIComponent(JSON.stringify(settings)))
    );
    const deepLink = `ytdln-open://download?url=${encodeURIComponent(url)}&settings=${settingsBase64}`;
    chrome.tabs.update(tabId, { url: deepLink });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "downloadWithYTDLN",
    title: "Baixar com YTDLN",
    contexts: ["page", "link", "video"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "downloadWithYTDLN") {
    let urlToDownload = info.linkUrl || info.pageUrl;
    if (urlToDownload) sendToApp(urlToDownload, tab.id);
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.url) sendToApp(tab.url, tab.id);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openApp" && request.url) {
    sendToApp(request.url, sender.tab?.id);
    sendResponse({ success: true });
  }
  if (request.action === "get_queue_state") sendResponse({ queue: queueState });
});
