// Service Worker para a extensão

// Armazenar downloads ativos para monitoramento
const activeDownloads = new Map(); // taskId -> { url, format, startTime }

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
      showNotification('Download Iniciado', `Baixando vídeo...`);
      
      // Armazenar download para monitoramento
      activeDownloads.set(data.taskId, {
        url: url,
        format: format,
        startTime: Date.now()
      });
      
      // Iniciar monitoramento do download
      monitorDownload(data.taskId);
      
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

// Monitorar status de um download
async function monitorDownload(taskId) {
  const downloadInfo = activeDownloads.get(taskId);
  if (!downloadInfo) return;

  const maxAttempts = 3600; // Máximo de 1 hora (verificando a cada segundo)
  let attempts = 0;

  const checkStatus = async () => {
    try {
      const response = await fetch(`http://localhost:9001/api/download/status/${taskId}`);
      
      if (!response.ok) {
        console.error(`Erro ao verificar status do download ${taskId}`);
        activeDownloads.delete(taskId);
        return;
      }

      const status = await response.json();
      
      if (status.status === 'completed') {
        // Download completo!
        activeDownloads.delete(taskId);
        const formatText = downloadInfo.format === 'audio' ? 'áudio' : 'vídeo';
        
        // Obter nome do arquivo do status
        const fileName = status.outputPath ? status.outputPath.split(/[/\\]/).pop() : 'arquivo';
        
        // Usar API de downloads do Chrome para adicionar à lista de downloads do navegador
        const downloadUrl = `http://localhost:9001/api/download/${taskId}/file`;
        
        console.log(`[Background] Adicionando download à lista do navegador: ${downloadUrl}`);
        
        try {
          chrome.downloads.download({
            url: downloadUrl,
            filename: fileName,
            saveAs: false,
            conflictAction: 'uniquify'
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('[Background] Erro ao adicionar à lista de downloads:', chrome.runtime.lastError.message);
              showNotification('Download Concluído ✅', `Seu ${formatText} foi baixado com sucesso!`);
            } else {
              console.log(`[Background] Download adicionado à lista do navegador com ID: ${downloadId}`);
              
              // Opcional: Adicionar metadados ao download (não muda o texto "Download feito por" mas pode ser útil)
              chrome.downloads.search({ id: downloadId }, (results) => {
                if (results && results[0]) {
                  console.log(`[Background] Download aparecendo na página de downloads do navegador`);
                }
              });
              
              showNotification('Download Concluído ✅', `${fileName} foi adicionado aos downloads do navegador!`);
            }
          });
        } catch (error) {
          console.error('[Background] Exceção ao chamar chrome.downloads.download:', error);
          showNotification('Download Concluído ✅', `Seu ${formatText} foi baixado com sucesso!`);
        }
        
        return;
      }

      if (status.status === 'error') {
        // Erro no download
        activeDownloads.delete(taskId);
        const errorMsg = status.error || 'Erro desconhecido';
        showNotification('Erro no Download ❌', `Falha ao baixar: ${errorMsg}`);
        return;
      }

      if (status.status === 'cancelled') {
        // Download cancelado
        activeDownloads.delete(taskId);
        return;
      }

      // Continuar monitorando se ainda está em progresso
      attempts++;
      if (attempts < maxAttempts && (status.status === 'downloading' || status.status === 'queued' || status.status === 'merging' || status.status === 'processing')) {
        setTimeout(checkStatus, 2000); // Verificar a cada 2 segundos
      } else if (attempts >= maxAttempts) {
        // Timeout - parar monitoramento
        activeDownloads.delete(taskId);
        console.warn(`Timeout no monitoramento do download ${taskId}`);
      }

    } catch (error) {
      console.error(`Erro ao monitorar download ${taskId}:`, error);
      // Tentar novamente em caso de erro de rede
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 5000); // Aguardar 5 segundos antes de tentar novamente
      } else {
        activeDownloads.delete(taskId);
      }
    }
  };

  // Iniciar verificação após 2 segundos
  setTimeout(checkStatus, 2000);
}

// Health check periódico (API v2.0)
setInterval(() => {
  fetch('http://localhost:9001/health').catch(() => {
    console.log('YTDLN servidor offline');
  });
}, 30000);
