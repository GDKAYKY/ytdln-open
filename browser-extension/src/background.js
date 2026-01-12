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

// Função para baixar com formato específico
async function downloadWithFormat(url, format) {
  try {
    const response = await fetch('http://localhost:9000/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        format,
        subtitles: false,
        source: 'browser-extension-context'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      showNotification('Erro', error.message || 'Erro ao iniciar download');
      return
    }

    const data = await response.json();

    if (data.success) {
      // Signal the browser to start the download
      chrome.downloads.download({
        url: `http://localhost:9000/api/download?downloadId=${data.downloadId}`,
        filename: `${data.title}.${format === 'audio' ? 'mp3' : format}`
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          showNotification('Erro', chrome.runtime.lastError.message);
        } else {
          showNotification('Sucesso', `Download iniciado! ID: ${downloadId}`);
        }
      });
    } else {
      showNotification('Erro', data.message || 'Erro ao iniciar download');
    }
  } catch (error) {
    console.error('Erro:', error);
    showNotification('Erro', 'Não foi possível conectar ao YTDLN. Certifique-se de que está executando.');
  }
}

// Função para obter informações do vídeo
async function getVideoInfo(url, tabId) {
  try {
    const response = await fetch('http://localhost:9000/api/video-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    });

    if (response.ok) {
      const data = await response.json();
      
      // Copiar informações para clipboard
      const info = `
Título: ${data.title}
Autor: ${data.uploader}
Duração: ${data.duration}
URL: ${url}
`.trim();

      navigator.clipboard.writeText(info).then(() => {
        showNotification('Sucesso', 'Informações copiadas para a área de transferência');
      });
    }
  } catch (error) {
    console.error('Erro ao obter informações:', error);
    showNotification('Erro', 'Não foi possível obter informações do vídeo');
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

// Health check periódico
setInterval(() => {
  fetch('http://localhost:9000/health').catch(() => {
    console.log('YTDLN servidor offline');
  });
}, 30000);
