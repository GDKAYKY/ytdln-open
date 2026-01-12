// Estado
let serverConnected = false;
let downloadClient = null;
let currentDownloadId = null;
let sseConnection = null;

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

// Inicializar cliente da API v2.0
function initializeDownloadClient() {
  // Criar client apontando para porta 9001 (nova API v2.0)
  downloadClient = {
    apiUrl: 'http://localhost:9001/api',
    
    async createDownload(url, options = {}) {
      const response = await fetch(`${this.apiUrl}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...options })
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },

    startMonitoringSSE(taskId, onProgress, onComplete, onError) {
      const eventSource = new EventSource(`${this.apiUrl}/download/${taskId}/sse`);
      
      eventSource.addEventListener('progress', (e) => {
        try {
          const data = JSON.parse(e.data);
          onProgress?.(data);
        } catch (err) {
          console.error('Erro parseando progresso:', err);
        }
      });

      eventSource.addEventListener('complete', (e) => {
        try {
          const data = JSON.parse(e.data);
          eventSource.close();
          onComplete?.(data);
        } catch (err) {
          console.error('Erro parseando conclusão:', err);
        }
      });

      eventSource.addEventListener('error', (e) => {
        console.error('SSE erro:', e);
        eventSource.close();
        onError?.({ message: 'Conexão SSE perdida' });
      });

      eventSource.onerror = () => {
        eventSource.close();
      };

      return eventSource;
    },

    async cancelDownload(taskId) {
      const response = await fetch(`${this.apiUrl}/download/${taskId}/cancel`, {
        method: 'POST'
      });
      return response.json();
    }
  };
}

// Verificar conexão com servidor (nova API v2.0)
async function checkServerConnection() {
  try {
    const response = await fetch('http://localhost:9001/health', {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json();
      serverConnected = data.status === 'ok';
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
  // Inicializar cliente
  initializeDownloadClient();
  
  const tabUrl = await getCurrentTabUrl();
  if (tabUrl) {
    urlInput.value = tabUrl;
  }
  
  // Verificar conexão ao abrir
  checkServerConnection();
  
  // Verificar conexão a cada 5 segundos
  setInterval(checkServerConnection, 5000);
});

// Enviar para download usando nova API v2.0
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
    // Criar download usando novo cliente
    const result = await downloadClient.createDownload(url, {
      format,
      subtitles,
      source: 'browser-extension'
    });
    
    currentDownloadId = result.taskId;
    showStatus('✅ Download iniciado!', 'success');
    urlInput.value = '';
    document.getElementById('subtitles').checked = false;
    
    // Monitorar progresso com SSE (novo método)
    if (sseConnection) {
      sseConnection.close();
    }
    
    sseConnection = downloadClient.startMonitoringSSE(
      currentDownloadId,
      (progress) => {
        const percent = Math.min(100, progress.percent || 0);
        progressFill.style.width = percent + '%';
        
        let msg = `${percent}%`;
        if (progress.speed) msg += ` - ${progress.speed}`;
        if (progress.eta) msg += ` - ETA: ${progress.eta}`;
        if (progress.total) msg += ` (${progress.total})`;
        
        progressText.textContent = msg;
      },
      (result) => {
        progressFill.style.width = '100%';
        progressText.textContent = '✅ Concluído!';
        setTimeout(() => {
          showProgress(false);
        }, 2000);
      },
      (error) => {
        showStatus(`❌ Erro: ${error.message}`, 'error');
        showProgress(false);
      }
    );
  } catch (error) {
    console.error('Erro:', error);
    showStatus(`Erro: ${error.message}`, 'error');
  } finally {
    downloadBtn.disabled = false;
  }
});
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
