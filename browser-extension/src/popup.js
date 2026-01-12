// Estado
let serverConnected = false;

// Elementos do DOM
const urlInput = document.getElementById('url');
const downloadBtn = document.getElementById('downloadBtn');
const settingsBtn = document.getElementById('settingsBtn');
const statusDiv = document.getElementById('status');
const progressDiv = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const serverStatusDiv = document.getElementById('serverStatus');
const form = document.getElementById('downloadForm');

// Verificar conexão com servidor
async function checkServerConnection() {
  try {
    const response = await fetch('http://localhost:9000/health', {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      serverConnected = true;
      updateServerStatus(true);
      return true;
    }
  } catch (error) {
    serverConnected = false;
    updateServerStatus(false);
  }
  return false;
}

function updateServerStatus(connected) {
  if (connected) {
    serverStatusDiv.classList.remove('disconnected');
    serverStatusDiv.classList.add('connected');
    serverStatusDiv.textContent = '🟢 Conectado ao YTDLN';
    downloadBtn.disabled = false;
  } else {
    serverStatusDiv.classList.remove('connected');
    serverStatusDiv.classList.add('disconnected');
    serverStatusDiv.textContent = '🔴 Desconectado - Execute YTDLN Desktop';
    downloadBtn.disabled = true;
  }
}

function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;
  
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.classList.remove('show');
    }, 5000);
  }
}

function showProgress(show = true) {
  if (show) {
    progressDiv.classList.add('show');
  } else {
    progressDiv.classList.remove('show');
    progressFill.style.width = '0%';
    progressText.textContent = 'Iniciando download...';
  }
}

// Obter URL da aba ativa
async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url;
}

// Carregar URL da aba quando abrir
document.addEventListener('DOMContentLoaded', async () => {
  const tabUrl = await getCurrentTabUrl();
  if (tabUrl) {
    urlInput.value = tabUrl;
  }
  
  // Verificar conexão ao abrir
  checkServerConnection();
  
  // Verificar conexão a cada 5 segundos
  setInterval(checkServerConnection, 5000);
});

// Enviar para download
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const url = urlInput.value.trim();
  if (!url) {
    showStatus('Por favor, insira uma URL válida', 'error');
    return;
  }
  
  if (!serverConnected) {
    showStatus('Servidor não conectado. Inicie o aplicativo YTDLN', 'error');
    return;
  }
  
  const format = document.querySelector('input[name="format"]:checked').value;
  const subtitles = document.getElementById('subtitles').checked;
  
  downloadBtn.disabled = true;
  showStatus('Preparando download...', 'info');
  showProgress(true);
  
  try {
    const response = await fetch('http://localhost:9000/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        format,
        subtitles,
        source: 'browser-extension'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao iniciar download');
    }
    
    const data = await response.json();
    
    if (data.success) {
      showStatus('✅ Download iniciado! Verifique a pasta de downloads.', 'success');
      urlInput.value = '';
      document.getElementById('subtitles').checked = false;
      
      // Monitorar progresso do download
      monitorDownloadProgress(data.downloadId);
    } else {
      showStatus(data.message || 'Erro ao iniciar download', 'error');
    }
  } catch (error) {
    console.error('Erro:', error);
    showStatus(`Erro: ${error.message}`, 'error');
  } finally {
    downloadBtn.disabled = false;
    showProgress(false);
  }
});

// Monitorar progresso do download
async function monitorDownloadProgress(downloadId) {
  const checkProgress = async () => {
    try {
      const response = await fetch(`http://localhost:9000/api/download/${downloadId}/progress`);
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data.status === 'downloading') {
        const percent = Math.min(100, data.progress || 0);
        progressFill.style.width = percent + '%';
        
        // Montar mensagem de progresso com informações adicionais
        let progressMessage = `${percent}%`;
        if (data.speed) {
          progressMessage += ` - ${data.speed}`;
        }
        if (data.eta) {
          progressMessage += ` - ETA: ${data.eta}`;
        } else {
          progressMessage += ` - Calculando tempo restante...`;
        }
        if (data.total) {
          progressMessage += ` (${data.total})`;
        }
        
        progressText.textContent = progressMessage;
        
        setTimeout(checkProgress, 1000);
      } else if (data.status === 'completed') {
        progressFill.style.width = '100%';
        progressText.textContent = '100% - Concluído!';
      } else if (data.status === 'error') {
        showStatus(`Erro no download: ${data.error}`, 'error');
      }
    } catch (error) {
      // Falha ao obter progresso, continuar tentando
      setTimeout(checkProgress, 2000);
    }
  };
  
  checkProgress();
}

// Abrir configurações
settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage?.() || chrome.tabs.create({
    url: chrome.runtime.getURL('src/options.html')
  });
});

// Auto-preencher URL se vinda do contexto menu
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillUrl') {
    urlInput.value = request.url;
    urlInput.focus();
  }
});
