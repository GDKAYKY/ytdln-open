const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const debugModeCheckbox = document.getElementById('debugMode');

// Função para atualizar status com controle de debug
function updateStatus(message, isAppend = false) {
  if (debugModeCheckbox.checked) {
    if (isAppend) {
      statusDiv.innerText += message;
    } else {
      statusDiv.innerText = message;
    }
  } else {
    // No modo normal, mostrar apenas a última linha
    const lines = message.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    statusDiv.innerText = lastLine;
  }
}

// Função para validar URL no frontend
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// Verificar status dos binários ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
  updateStatus('Verificando binários...');
  window.electronAPI.checkBinariesStatus();
});

// Listener para status dos binários
window.electronAPI.onBinariesStatus((data) => {
  if (data.status === 'ready') {
    const appModeInfo = data.appMode ? ` | Modo: ${data.appMode.description}` : '';
    updateStatus(`Binários prontos! SO: ${data.platform} (${data.arch})${appModeInfo}`);
    downloadBtn.disabled = false;
  } else {
    updateStatus(`Status: ${data.message}`);
    downloadBtn.disabled = true;
  }
});

// Clear status on new download
downloadBtn.addEventListener('click', () => {
  const url = videoUrlInput.value.trim();
  
  // Validação básica no frontend
  if (!url) {
    updateStatus('ERRO: Por favor, insira uma URL válida.');
    return;
  }
  
  if (!isValidUrl(url)) {
    updateStatus('ERRO: URL inválida. Use http:// ou https://');
    return;
  }
  
  updateStatus('Iniciando download...');
  window.electronAPI.downloadVideo(url);
});

// Listen for download progress updates from the main process
window.electronAPI.onDownloadProgress((data) => {
  updateStatus(data, true); // Append para debug, sobrescrever para normal
});

// Listen for download success message
window.electronAPI.onDownloadSuccess(() => {
  updateStatus('\n\nDownload concluído com sucesso!', true);
});

// Listen for download error message
window.electronAPI.onDownloadError((errorMessage) => {
  updateStatus(`\n\nERRO: ${errorMessage}`, true);
});
