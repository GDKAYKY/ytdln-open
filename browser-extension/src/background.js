// Service Worker para a extensão

// Criar menu de contexto para downloads rápidos
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'download-video',
    title: '⬇️ Baixar com YTDLN',
    contexts: ['link', 'page'],
  });

  chrome.contextMenus.create({
    id: 'download-audio',
    title: '🎵 Baixar como MP3',
    contexts: ['link', 'page'],
  });

  chrome.contextMenus.create({
    id: 'copy-link-info',
    title: '📋 Copiar informações do vídeo',
    contexts: ['link', 'page'],
  });
});

// Tratador de cliques no menu de contexto
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.pageUrl;

  if (info.menuItemId === 'download-video') {
    downloadWithFormat(url, 'best');
  } else if (info.menuItemId === 'download-audio') {
    downloadWithFormat(url, 'audio');
  } else if (info.menuItemId === 'copy-link-info') {
    getVideoInfo(url, tab.id);
  }
});

// Função para baixar com formato específico (usando API v2.0)
async function downloadWithFormat(url, format) {
  try {
    // Usar API v2.0 na porta 9001
    const response = await fetch('http://localhost:9001/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        format: format === 'audio' ? 'audio' : format,
        audioOnly: format === 'audio',
        subtitles: false,
        source: 'browser-extension-context'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      showNotification('Erro', error.error || error.message || 'Erro ao iniciar download');
      return;
    }

    const data = await response.json();

    if (data.taskId) {
      showNotification('Sucesso', `Download iniciado! Task ID: ${data.taskId}`);
      
      // Opcional: Abrir popup para mostrar progresso
      chrome.action.openPopup?.();
    } else {
      showNotification('Erro', data.message || 'Erro ao iniciar download');
    }
  } catch (error) {
    console.error('Erro:', error);
    showNotification('Erro', 'Não foi possível conectar ao YTDLN. Certifique-se de que está executando.');
  }
}

// Função para obter informações do vídeo (usando API v2.0)
async function getVideoInfo(url, tabId) {
  try {
    // Nota: A API v2.0 não tem endpoint de video-info ainda
    // Por enquanto, apenas copiar URL
    const info = `URL: ${url}`;

    // Usar chrome.scripting.executeScript para copiar no contexto da página
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (text) => {
        navigator.clipboard.writeText(text).then(() => {
          console.log('URL copiada para clipboard');
        });
      },
      args: [info]
    });

    showNotification('Sucesso', 'URL copiada para a área de transferência');
  } catch (error) {
    console.error('Erro ao copiar informações:', error);
    showNotification('Erro', 'Não foi possível copiar informações');
  }
}

// Mostrar notificação
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}

// Escutar mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadVideo') {
    downloadWithFormat(request.url, request.format);
    sendResponse({ success: true });
  }
});

// Health check periódico (API v2.0)
setInterval(() => {
  fetch('http://localhost:9001/health').catch(() => {
    console.log('YTDLN servidor offline');
  });
}, 30000);
