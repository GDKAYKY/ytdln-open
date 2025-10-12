const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const debugModeCheckbox = document.getElementById('debugMode');
const openFolderBtn = document.getElementById('openFolderBtn');

// Elementos do modal de configurações
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeBtn = document.querySelector('.close');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');

// Elementos das abas
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Configurações padrão
const defaultSettings = {
    // Básicas
    outputFormat: 'mp4',
    quality: 'best',
    audioFormat: 'mp3',
    concurrentFragments: 8,
    embedSubs: false,
    writeInfoJson: false,
    
    // Avançadas
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    referer: 'https://www.youtube.com/',
    socketTimeout: 30,
    retries: 5,
    fragmentRetries: 5,
    extractorRetries: 3,
    noCheckCertificate: true,
    ignoreErrors: true,
    writeThumbnail: false,
    writeDescription: false
};

// Carregar configurações salvas
let currentSettings = { ...defaultSettings };

// Funções para gerenciar configurações
function loadSettings() {
    const saved = localStorage.getItem('ytdln-settings');
    if (saved) {
        currentSettings = { ...defaultSettings, ...JSON.parse(saved) };
    }
    applySettingsToUI();
}

function saveSettings() {
    localStorage.setItem('ytdln-settings', JSON.stringify(currentSettings));
}

function applySettingsToUI() {
    // Básicas
    document.getElementById('outputFormat').value = currentSettings.outputFormat;
    document.getElementById('quality').value = currentSettings.quality;
    document.getElementById('audioFormat').value = currentSettings.audioFormat;
    document.getElementById('concurrentFragments').value = currentSettings.concurrentFragments;
    document.getElementById('concurrentFragmentsValue').textContent = currentSettings.concurrentFragments;
    document.getElementById('embedSubs').checked = currentSettings.embedSubs;
    document.getElementById('writeInfoJson').checked = currentSettings.writeInfoJson;
    
    // Avançadas
    document.getElementById('userAgent').value = currentSettings.userAgent;
    document.getElementById('referer').value = currentSettings.referer;
    document.getElementById('socketTimeout').value = currentSettings.socketTimeout;
    document.getElementById('retries').value = currentSettings.retries;
    document.getElementById('fragmentRetries').value = currentSettings.fragmentRetries;
    document.getElementById('extractorRetries').value = currentSettings.extractorRetries;
    document.getElementById('noCheckCertificate').checked = currentSettings.noCheckCertificate;
    document.getElementById('ignoreErrors').checked = currentSettings.ignoreErrors;
    document.getElementById('writeThumbnail').checked = currentSettings.writeThumbnail;
    document.getElementById('writeDescription').checked = currentSettings.writeDescription;
}

function getSettingsFromUI() {
    return {
        // Básicas
        outputFormat: document.getElementById('outputFormat').value,
        quality: document.getElementById('quality').value,
        audioFormat: document.getElementById('audioFormat').value,
        concurrentFragments: parseInt(document.getElementById('concurrentFragments').value),
        embedSubs: document.getElementById('embedSubs').checked,
        writeInfoJson: document.getElementById('writeInfoJson').checked,
        
        // Avançadas
        userAgent: document.getElementById('userAgent').value,
        referer: document.getElementById('referer').value,
        socketTimeout: parseInt(document.getElementById('socketTimeout').value),
        retries: parseInt(document.getElementById('retries').value),
        fragmentRetries: parseInt(document.getElementById('fragmentRetries').value),
        extractorRetries: parseInt(document.getElementById('extractorRetries').value),
        noCheckCertificate: document.getElementById('noCheckCertificate').checked,
        ignoreErrors: document.getElementById('ignoreErrors').checked,
        writeThumbnail: document.getElementById('writeThumbnail').checked,
        writeDescription: document.getElementById('writeDescription').checked
    };
}

function resetToDefaults() {
    currentSettings = { ...defaultSettings };
    applySettingsToUI();
}

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
  
  // Carregar configurações salvas
  loadSettings();
  
  // Event listeners para o modal
  setupModalEvents();
  
  // Event listeners para as abas
  setupTabEvents();
  
  // Event listeners para controles
  setupControlEvents();
});

// Configurar eventos do modal
function setupModalEvents() {
  // Abrir modal
  settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    applySettingsToUI();
  });
  
  // Fechar modal
  closeBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  
  cancelSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  
  // Fechar ao clicar fora do modal
  window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
  
  // Salvar configurações
  saveSettingsBtn.addEventListener('click', () => {
    currentSettings = getSettingsFromUI();
    saveSettings();
    settingsModal.style.display = 'none';
    updateStatus('Configurações salvas com sucesso!');
  });
  
  // Resetar para padrão
  resetSettingsBtn.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja resetar todas as configurações para o padrão?')) {
      resetToDefaults();
      updateStatus('Configurações resetadas para o padrão!');
    }
  });
}

// Configurar eventos das abas
function setupTabEvents() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      
      // Remover classe active de todos os botões e conteúdos
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Adicionar classe active ao botão clicado e conteúdo correspondente
      btn.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

// Configurar eventos dos controles
function setupControlEvents() {
  // Atualizar valor do slider de fragmentos simultâneos
  document.getElementById('concurrentFragments').addEventListener('input', (e) => {
    document.getElementById('concurrentFragmentsValue').textContent = e.target.value;
  });
}

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
  openFolderBtn.style.display = 'none';
  
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
  
  // Enviar configurações junto com a URL
  window.electronAPI.downloadVideoWithSettings(url, currentSettings);
});

openFolderBtn.addEventListener('click', () => {
  window.electronAPI.openDownloadsFolder();
});

// Listen for download progress updates from the main process
window.electronAPI.onDownloadProgress((data) => {
  updateStatus(data, true); // Append para debug, sobrescrever para normal
});

// Listen for download success message
window.electronAPI.onDownloadSuccess(() => {
  updateStatus('\n\nDownload concluído com sucesso!', true);
  openFolderBtn.style.display = 'block';
});

// Listen for download error message
window.electronAPI.onDownloadError((errorMessage) => {
  updateStatus(`\n\nERRO: ${errorMessage}`, true);
});
