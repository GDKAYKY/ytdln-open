const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const debugModeCheckbox = document.getElementById('debugMode');
const openFolderBtn = document.getElementById('openFolderBtn');
const progressText = document.getElementById('progressText');
const toastContainer = document.querySelector('.toast-container');

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
  // Visual state: downloading
  downloadBtn.classList.add('downloading');
  downloadBtn.innerHTML = '<span class="btn-shine">Baixando…</span>';
  
  // Enviar configurações junto com a URL
  window.electronAPI.downloadVideoWithSettings(url, currentSettings);
});

openFolderBtn.addEventListener('click', () => {
  window.electronAPI.openDownloadsFolder();
});

// Listen for download progress updates from the main process
window.electronAPI.onDownloadProgress((data) => {
  updateStatus(data, true); // Append para debug, sobrescrever para normal

  const progressMatch = data.match(/(\d+\.\d+)%/);
  if (progressMatch && progressMatch[1]) {
    progressText.textContent = `${Math.floor(parseFloat(progressMatch[1]))}%`;
  }
});

// Listen for download success message
window.electronAPI.onDownloadSuccess(() => {
  updateStatus('\n\nDownload concluído com sucesso!', true);
  openFolderBtn.style.display = 'block';
  progressText.textContent = '100%';

  // Restore button state
  downloadBtn.classList.remove('downloading');
  downloadBtn.textContent = 'Download';

  toastContainer.style.opacity = 1;
  setTimeout(() => {
    toastContainer.style.opacity = 0;
  }, 4000);
});

// Listen for download error message
window.electronAPI.onDownloadError((errorMessage) => {
  updateStatus(`\n\nERRO: ${errorMessage}`, true);
  // Restore button state on error
  downloadBtn.classList.remove('downloading');
  downloadBtn.textContent = 'Download';
});

// Content Loader Functions
function showContentLoader() {
  const contentLoader = document.getElementById('contentLoader');
  const noDownloadsMessage = document.querySelector('.no-downloads-message');
  
  if (noDownloadsMessage) noDownloadsMessage.style.display = 'none';
  if (contentLoader) contentLoader.style.display = 'flex';
}

function hideContentLoader() {
  const contentLoader = document.getElementById('contentLoader');
  const noDownloadsMessage = document.querySelector('.no-downloads-message');
  
  if (contentLoader && noDownloadsMessage) {
    contentLoader.style.display = 'none';
    noDownloadsMessage.style.display = 'flex';
  }
}

// Test function to demonstrate the loader (can be called from browser console)
window.testLoader = function() {
  showContentLoader();
  setTimeout(() => {
    hideContentLoader();
  }, 5000);
};

// Test function to refresh downloaded files (can be called from browser console)
window.refreshDownloads = function() {
  loadDownloadedFiles();
};

// Test function to demonstrate cascade animation (can be called from browser console)
window.testCascadeAnimation = function() {
  const testFiles = [
    {
      id: 'test1',
      title: 'Test Video 1',
      fileName: 'test_video_1.mp4',
      fileSize: 1024 * 1024 * 50, // 50MB
      duration: 180, // 3 minutes
      format: 'MP4',
      downloadDate: new Date().toISOString()
    },
    {
      id: 'test2',
      title: 'Test Video 2',
      fileName: 'test_video_2.mp4',
      fileSize: 1024 * 1024 * 75, // 75MB
      duration: 240, // 4 minutes
      format: 'MP4',
      downloadDate: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },
    {
      id: 'test3',
      title: 'Test Video 3',
      fileName: 'test_video_3.mp4',
      fileSize: 1024 * 1024 * 120, // 120MB
      duration: 300, // 5 minutes
      format: 'MP4',
      downloadDate: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
    }
  ];
  
  displayDownloadedFiles(testFiles);
};

// Downloaded Files Management
let downloadedFilesList = [];

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) {
    return 'Just now';
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function createDownloadItemHTML(file, isNewDownload = false) {
  const fileSize = formatFileSize(file.fileSize);
  const duration = formatDuration(file.duration);
  const timestamp = formatDate(file.downloadDate);
  const animationClass = isNewDownload ? 'new-download' : '';
  
  return `
    <div class="download-item ${animationClass}" data-file-id="${file.id}">
      <div class="download-item-content">
        <div class="file-thumbnail">
          ${file.thumbnail ? `<img src="${file.thumbnail}" alt="Thumbnail" />` : ''}
        </div>
        <div class="file-info-container">
          <div class="file-title">${file.title}</div>
          <div class="file-path">${file.fileName}</div>
          <div class="file-details-row">
            ${fileSize ? `<span class="file-size">${fileSize}</span>` : ''}
            ${duration ? `<span class="file-duration">${duration}</span>` : ''}
            <span class="file-format">${file.format}</span>
          </div>
        </div>
        <div class="file-actions">
          <div class="action-buttons">
            <svg class="file-icon play-icon" viewBox="0 0 24 24" fill="none" data-action="play" title="Open file">
              <path d="M8 5V19L19 12L8 5Z" stroke="#E3E3E3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg class="file-icon delete-icon" viewBox="0 0 24 24" fill="none" data-action="delete" title="Delete file">
              <path d="M3 6H5H21" stroke="#E3E3E3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="#E3E3E3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="file-timestamp">${timestamp}</div>
        </div>
      </div>
      <div class="separator-line"></div>
    </div>
  `;
}

function displayDownloadedFiles(files) {
  const downloadsContainer = document.getElementById('downloadsContainer');
  const noDownloadsMessage = document.querySelector('.no-downloads-message');
  const contentLoader = document.getElementById('contentLoader');
  
  if (!files || files.length === 0) {
    if (noDownloadsMessage) noDownloadsMessage.style.display = 'flex';
    if (contentLoader) contentLoader.style.display = 'none';
    return;
  }
  
  if (noDownloadsMessage) noDownloadsMessage.style.display = 'none';
  if (contentLoader) contentLoader.style.display = 'none';
  
  // Clear container first
  downloadsContainer.innerHTML = '';
  
  // Add files with cascade animation
  files.forEach((file, index) => {
    setTimeout(() => {
      const fileHTML = createDownloadItemHTML(file);
      downloadsContainer.insertAdjacentHTML('beforeend', fileHTML);
      
      // Add event listeners for the newly added item
      addFileActionListeners();
    }, index * 100); // 100ms delay between each item
  });
}

function addFileActionListeners() {
  const playIcons = document.querySelectorAll('.play-icon[data-action="play"]');
  const deleteIcons = document.querySelectorAll('.delete-icon[data-action="delete"]');
  
  playIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
      const fileId = e.target.closest('.download-item').dataset.fileId;
      const file = downloadedFilesList.find(f => f.id == fileId);
      if (file) {
        window.electronAPI.openFileLocation(file.id);
      }
    });
  });
  
  deleteIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
      const fileId = e.target.closest('.download-item').dataset.fileId;
      deleteFile(fileId);
    });
  });
}

function loadDownloadedFiles() {
  showContentLoader();
  window.electronAPI.getDownloadedFiles();
}

function deleteFile(fileId) {
  if (confirm('Are you sure you want to delete this file?')) {
    window.electronAPI.deleteDownloadedFile(fileId);
  }
}

// Load downloaded files on page load
document.addEventListener('DOMContentLoaded', () => {
  loadDownloadedFiles();
});

// Listen for downloaded files list
window.electronAPI.onDownloadedFilesList((files) => {
  downloadedFilesList = files;
  hideContentLoader();
  displayDownloadedFiles(files);
});

// Listen for file deleted
window.electronAPI.onFileDeleted((fileId) => {
  downloadedFilesList = downloadedFilesList.filter(f => f.id !== fileId);
  const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
  if (fileElement) {
    fileElement.remove();
  }
  
  // Show no downloads message if no files left
  if (downloadedFilesList.length === 0) {
    const noDownloadsMessage = document.querySelector('.no-downloads-message');
    if (noDownloadsMessage) noDownloadsMessage.style.display = 'flex';
  }
});

// Listen for download success to refresh files list
window.electronAPI.onDownloadSuccess(() => {
  // Refresh the downloaded files list after a successful download
  setTimeout(() => {
    loadDownloadedFiles();
  }, 1000);
});

// Function to add a single new download with cascade animation
function addNewDownloadFile(file) {
  const downloadsContainer = document.getElementById('downloadsContainer');
  const noDownloadsMessage = document.querySelector('.no-downloads-message');
  
  // Hide no downloads message if it's showing
  if (noDownloadsMessage && noDownloadsMessage.style.display === 'flex') {
    noDownloadsMessage.style.display = 'none';
  }
  
  // Add the new file at the top with special animation
  const fileHTML = createDownloadItemHTML(file, true); // true for new download
  downloadsContainer.insertAdjacentHTML('afterbegin', fileHTML);
  
  // Add event listeners for the newly added item
  addFileActionListeners();
  
  // Remove the animation class after animation completes
  setTimeout(() => {
    const newItem = downloadsContainer.querySelector(`[data-file-id="${file.id}"]`);
    if (newItem) {
      newItem.classList.remove('new-download');
    }
  }, 500);
}