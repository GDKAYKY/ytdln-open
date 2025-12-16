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
    writeThumbnail: true,
    writeDescription: false,
    showConsole: true
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
    toggleConsoleVisibility(currentSettings.showConsole);
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
    document.getElementById('showConsole').checked = currentSettings.showConsole;
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
        writeDescription: document.getElementById('writeDescription').checked,
        showConsole: document.getElementById('showConsole').checked
    };
}

function resetToDefaults() {
    currentSettings = { ...defaultSettings };
    applySettingsToUI();
}

let typingInterval;

function typeWriter(text, element, speed = 10) {
    if (typingInterval) clearInterval(typingInterval);
    element.innerText = '';
    
    let i = 0;
    typingInterval = setInterval(() => {
        if (i < text.length) {
            element.innerText += text.charAt(i);
            i++;
            // Auto-scroll to bottom while typing
            element.parentElement.scrollTop = element.parentElement.scrollHeight;
        } else {
            clearInterval(typingInterval);
            typingInterval = null;
        }
    }, speed);
}

// Função para atualizar status com controle de debug
function updateStatus(message, isAppend = false) {
  if (debugModeCheckbox.checked) {
    if (isAppend) {
      statusDiv.innerText += message;
      statusDiv.parentElement.scrollTop = statusDiv.parentElement.scrollHeight;
    } else {
      statusDiv.innerText = message;
    }
  } else {
    // No modo normal, mostrar apenas a última linha
    const lines = message.trim().split('\n');
    const lastLine = lines[lines.length - 1] || '';
    
    // Check if it looks like a progress update (has percentage)
    // If it is progress, show instantly to avoid jitter. If not, type it out.
    if (lastLine.match(/\d+\.?\d*%/) || lastLine.includes('[download]')) {
         if (typingInterval) clearInterval(typingInterval);
         statusDiv.innerText = lastLine;
    } else {
         typeWriter(lastLine, statusDiv, 20);
    }
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
  // 1. Configurar UI e Event Listeners (Prioridade)
  loadSettings();
  setupModalEvents();
  setupTabEvents();
  setupControlEvents();

  // 2. Inicializar comunicação com Backend
  updateStatus('Verificando binários...');
  
  // Start particle background
  if (window.initParticleLoader) {
    window.initParticleLoader();
  }

  if (window.electronAPI) {
    window.electronAPI.checkBinariesStatus();
  } else {
    console.error('CRITICAL: window.electronAPI is not defined. Preload script might have failed.');
    updateStatus('Erro Crítico: API do Electron não carregada. Verifique o console.');
  }
});

// Console toggle functionality
// Console toggle functionality
function toggleConsoleVisibility(show) {
  const consoleSection = document.getElementById('consoleSection');
  const mainContent = document.querySelector('.main-content');
  
  if (show) {
    consoleSection.classList.remove('collapsed');
    mainContent.classList.remove('console-collapsed');
  } else {
    consoleSection.classList.add('collapsed');
    mainContent.classList.add('console-collapsed');
  }
}


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
    toggleConsoleVisibility(currentSettings.showConsole);
    showToast('Settings saved successfully!', 'success', 3000);
  });
  
  // Resetar para padrão
  resetSettingsBtn.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja resetar todas as configurações para o padrão?')) {
      resetToDefaults();
      updateStatus('Configurações resetadas para o padrão!');
      showToast('Settings reset to default!', 'info', 3000);
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
  const loader = document.getElementById('app-loader');
  
  if (data.status === 'ready') {
    const appModeInfo = data.appMode ? ` | Modo: ${data.appMode.description}` : '';
    updateStatus(`Binários prontos! SO: ${data.platform} (${data.arch})${appModeInfo}`);
    downloadBtn.disabled = false;
    
    // Hide loader
    if (loader) loader.classList.add('hidden');
    
  } else if (data.status === 'error') {
     updateStatus(`Status: ${data.message}`);
     downloadBtn.disabled = true;
     
     // Update loader text to show error instead of just hiding (or hide and show toast)
     const loaderText = document.getElementById('loader-status');
     if (loaderText) {
       loaderText.textContent = "Error: " + data.message;
       loaderText.style.color = "#ff6b6b";
       // Don't hide loader so user sees the error
     }
  } else {
    updateStatus(`Status: ${data.message}`);
    downloadBtn.disabled = true;
  }
});

const progressFrame = document.querySelector('.progress-frame');

// ... exist code ...

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
  
  // Show progress ring
  if (progressFrame) progressFrame.classList.add('active');
  
  // Show download popup instead of toast
  showDownloadPopup();
  
  // Enviar configurações junto com a URL
  window.electronAPI.downloadVideoWithSettings(url, currentSettings);
});

openFolderBtn.addEventListener('click', () => {
  window.electronAPI.openDownloadsFolder();
});

// ===== DOWNLOAD POPUP SYSTEM =====
const downloadPopup = document.getElementById('downloadPopup');
const downloadPopupClose = document.getElementById('downloadPopupClose');
const downloadPopupTitle = document.getElementById('downloadPopupTitle');
const downloadPopupFilename = document.getElementById('downloadPopupFilename');
const downloadPopupProgressFill = document.getElementById('downloadPopupProgressFill');
const downloadPopupProgressText = document.getElementById('downloadPopupProgressText');
const downloadPopupSpeed = document.getElementById('downloadPopupSpeed');
const downloadPopupEta = document.getElementById('downloadPopupEta');
const downloadPopupSize = document.getElementById('downloadPopupSize');

// Text scramble effect
function scrambleText(element) {
  if (!element || !element.dataset.value) return;
  
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let iteration = 0;
  const targetText = element.dataset.value;
  
  const interval = setInterval(() => {
    element.innerText = targetText
      .split("")
      .map((letter, index) => {
        if (index < iteration) {
          return targetText[index];
        }
        return letters[Math.floor(Math.random() * 26)];
      })
      .join("");
    
    if (iteration >= targetText.length) {
      clearInterval(interval);
    }
    
    iteration += 1 / 3;
  }, 30);
}

function showDownloadPopup() {
  downloadPopup?.classList.add('active');
  
  // Trigger text scramble effect
  if (downloadPopupTitle) {
    setTimeout(() => scrambleText(downloadPopupTitle), 100);
  }
  
  // Reset values
  if (downloadPopupFilename) downloadPopupFilename.textContent = 'Preparing download...';
  if (downloadPopupProgressFill) downloadPopupProgressFill.style.width = '0%';
  if (downloadPopupProgressText) downloadPopupProgressText.textContent = '0%';
  if (downloadPopupSpeed) downloadPopupSpeed.textContent = '--';
  if (downloadPopupEta) downloadPopupEta.textContent = '--';
  if (downloadPopupSize) downloadPopupSize.textContent = '--';
}

function hideDownloadPopup() {
  downloadPopup?.classList.remove('active');
}

downloadPopupClose?.addEventListener('click', () => {
  hideDownloadPopup();
});

// Listen for download progress updates from the main process
window.electronAPI.onDownloadProgress((data) => {
  updateStatus(data, true); // Append para debug, sobrescrever para normal

  // Parse progress percentage
  const progressMatch = data.match(/(\d+\.?\d*)%/);
  if (progressMatch && progressMatch[1]) {
    const percent = parseFloat(progressMatch[1]);
    const progressRing = document.getElementById('progressRing');
    
    // Update text
    progressText.textContent = `${Math.floor(percent)}%`;
    
    // Update popup progress
    if (downloadPopupProgressFill) {
      downloadPopupProgressFill.style.width = `${percent}%`;
    }
    if (downloadPopupProgressText) {
      downloadPopupProgressText.textContent = `${Math.floor(percent)}%`;
    }
    
    // Update ring
    if (progressRing) {
      const radius = progressRing.r.baseVal.value;
      const circumference = radius * 2 * Math.PI;
      const offset = circumference - (percent / 100) * circumference;
      progressRing.style.strokeDashoffset = offset;
    }
  }

  // Parse download speed (e.g., "5.2MiB/s" or "1.5MB/s")
  const speedMatch = data.match(/(\d+\.?\d*\s*[KMG]i?B\/s)/i);
  if (speedMatch && downloadPopupSpeed) {
    downloadPopupSpeed.textContent = speedMatch[1];
  }

  // Parse ETA (e.g., "00:05" or "01:23:45")
  const etaMatch = data.match(/ETA\s+(\d{2}:\d{2}(?::\d{2})?)/i);
  if (etaMatch && downloadPopupEta) {
    downloadPopupEta.textContent = etaMatch[1];
  }

  // Parse file size (e.g., "125.5MiB" or "1.2GiB")
  const sizeMatch = data.match(/of\s+~?\s*(\d+\.?\d*\s*[KMG]i?B)/i);
  if (sizeMatch && downloadPopupSize) {
    downloadPopupSize.textContent = sizeMatch[1];
  }

  // Parse filename from [download] Destination: path
  const filenameMatch = data.match(/\[download\]\s+Destination:\s+(.+)/i);
  if (filenameMatch && downloadPopupFilename) {
    const fullPath = filenameMatch[1].trim();
    const filename = fullPath.split(/[/\\]/).pop(); // Get last part of path
    downloadPopupFilename.textContent = filename;
  }
});

// ===== TOAST NOTIFICATION SYSTEM =====
const toastQueue = [];
let isToastVisible = false;
let toastTimeout = null;

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 4000)
 */
function showToast(message, type = 'success', duration = 4000) {
  toastQueue.push({ message, type, duration });
  if (!isToastVisible) {
    processToastQueue();
  }
}

function processToastQueue() {
  if (toastQueue.length === 0) {
    isToastVisible = false;
    return;
  }

  const { message, type, duration } = toastQueue.shift();
  isToastVisible = true;

  // Update toast content
  const toastText = document.querySelector('.toast-text');
  const toastCheckmark = document.querySelector('.toast-checkmark svg');
  const progressFill = document.querySelector('.progress-fill');
  
  toastText.textContent = message;

  // Update Icon based on type
  if (toastCheckmark) {
    let pathD = '';
    // Reset viewbox if needed, though standardizing on 24x24 is best
    
    switch(type) {
        case 'success':
            pathD = 'M20 6L9 17L4 12';
            break;
        case 'error':
            pathD = 'M18 6L6 18M6 6l12 12';
            break;
        case 'info':
            pathD = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
            break;
        case 'warning':
            pathD = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
            break;
        default:
            pathD = 'M20 6L9 17L4 12';
    }
    
    toastCheckmark.innerHTML = `<path d="${pathD}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />`;
  }

  // Set type class
  toastContainer.classList.remove('success', 'error', 'info', 'warning');
  toastContainer.classList.add(type);

  // Show toast
  toastContainer.classList.add('show');

  // Reset and start progress animation
  if (progressFill) {
    progressFill.style.transition = 'none';
    progressFill.style.width = '0%';
    
    // Force reflow to restart animation
    void progressFill.offsetHeight;
    
    progressFill.style.transition = `width ${duration}ms linear`;
    progressFill.style.width = '100%';
  }

  // Clear existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  // Auto-hide after duration
  toastTimeout = setTimeout(() => {
    hideToast();
  }, duration);
}

function hideToast() {
  toastContainer.classList.remove('show');
  
  setTimeout(() => {
    isToastVisible = false;
    processToastQueue(); // Process next toast in queue
  }, 400); // Wait for transition
}

// Add click handler for close button
document.querySelector('.toast-close')?.addEventListener('click', () => {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  hideToast();
});

// Listen for download success message
window.electronAPI.onDownloadSuccess(() => {
  updateStatus('\n\nDownload concluído com sucesso!', true);
  openFolderBtn.style.display = 'block';
  progressText.textContent = '100%';

  // Restore button state
  downloadBtn.classList.remove('downloading');
  downloadBtn.textContent = 'Download';
  
  // Hide download popup
  hideDownloadPopup();
  
  // Hide progress ring after a short delay to show 100%
  setTimeout(() => {
    if (progressFrame) progressFrame.classList.remove('active');
    // Reset progress text/ring after animation
    setTimeout(() => {
      progressText.textContent = '0%';
      const progressRing = document.getElementById('progressRing');
      if (progressRing) {
          const radius = progressRing.r.baseVal.value;
          const circumference = radius * 2 * Math.PI;
          progressRing.style.strokeDashoffset = circumference;
      }
    }, 300);
  }, 1000);

  // Show success toast
  showToast('Download completed successfully!', 'success', 4000);
});

// Listen for download error message
window.electronAPI.onDownloadError((errorMessage) => {
  updateStatus(`\n\nERRO: ${errorMessage}`, true);
  // Restore button state on error
  downloadBtn.classList.remove('downloading');
  downloadBtn.textContent = 'Download';
  
  // Hide download popup
  hideDownloadPopup();
  
  // Hide progress ring
  if (progressFrame) progressFrame.classList.remove('active');
  
  // Show error toast
  showToast('Download failed! Check console for details.', 'error', 5000);
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
let filteredFilesList = [];
let currentSearchTerm = '';
let currentSortOption = 'date-desc';

// Update downloads count
function updateDownloadsCount(count) {
  const downloadsCount = document.getElementById('downloadsCount');
  if (downloadsCount) {
    downloadsCount.textContent = count === 1 ? '1 video' : `${count} videos`;
  }
}

// Search functionality
function filterFiles(searchTerm) {
  currentSearchTerm = searchTerm.toLowerCase();
  filteredFilesList = downloadedFilesList.filter(file => {
    const titleMatch = file.title.toLowerCase().includes(currentSearchTerm);
    const fileNameMatch = file.fileName.toLowerCase().includes(currentSearchTerm);
    return titleMatch || fileNameMatch;
  });
  sortAndDisplayFiles();
}

// Sort functionality
function sortFiles(files, sortOption) {
  const sorted = [...files];
  
  switch (sortOption) {
    case 'date-desc':
      sorted.sort((a, b) => new Date(b.downloadDate) - new Date(a.downloadDate));
      break;
    case 'date-asc':
      sorted.sort((a, b) => new Date(a.downloadDate) - new Date(b.downloadDate));
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'size-desc':
      sorted.sort((a, b) => b.fileSize - a.fileSize);
      break;
    case 'size-asc':
      sorted.sort((a, b) => a.fileSize - b.fileSize);
      break;
  }
  
  return sorted;
}

function sortAndDisplayFiles() {
  const sorted = sortFiles(filteredFilesList, currentSortOption);
  displayDownloadedFiles(sorted);
  updateDownloadsCount(sorted.length);
}

// Setup library controls
function setupLibraryControls() {
  const searchInput = document.getElementById('searchInput');
  const refreshBtn = document.getElementById('refreshLibraryBtn');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterFiles(e.target.value);
    });
  }
  
  // Custom dropdown sort logic
  const sortMenu = document.querySelector('.sort-menu');
  const sortMenuItem = sortMenu ? sortMenu.querySelector('.item') : null;
  const sortMenuLink = sortMenu ? sortMenu.querySelector('.link') : null;
  const sortItems = document.querySelectorAll('.sort-menu .submenu-item');
  const currentSortLabel = document.getElementById('currentSortLabel');

  // 1. Click to toggle menu
  if (sortMenuLink && sortMenuItem) {
    sortMenuLink.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent document click from closing immediately
      sortMenuItem.classList.toggle('active');
    });
  }

  // 2. Click outside to close
  document.addEventListener('click', (e) => {
    if (sortMenuItem && sortMenuItem.classList.contains('active')) {
      if (!sortMenu.contains(e.target)) {
        sortMenuItem.classList.remove('active');
      }
    }
  });

  // 3. Handle selection click
  sortItems.forEach(item => {
    item.addEventListener('click', () => {
      const value = item.dataset.value;
      const text = item.querySelector('.submenu-link').textContent;
      
      currentSortOption = value;
      if (currentSortLabel) {
        currentSortLabel.textContent = text;
      }
      
      sortAndDisplayFiles();
      // Close menu after selection
      if (sortMenuItem) sortMenuItem.classList.remove('active');
    });
  });

  // 4. Scroll to change option
  if (sortMenu) {
    sortMenu.addEventListener('wheel', (e) => {
      e.preventDefault(); // Prevent page scroll
      
      const direction = e.deltaY > 0 ? 1 : -1;
      const itemsArray = Array.from(sortItems);
      const currentIndex = itemsArray.findIndex(item => item.dataset.value === currentSortOption);
      
      let newIndex = currentIndex + direction;
      
      // Wrap around
      if (newIndex >= itemsArray.length) newIndex = 0;
      if (newIndex < 0) newIndex = itemsArray.length - 1;
      
      const newItem = itemsArray[newIndex];
      const value = newItem.dataset.value;
      const text = newItem.querySelector('.submenu-link').textContent;
      
      currentSortOption = value;
      if (currentSortLabel) {
        currentSortLabel.textContent = text;
      }
      
      sortAndDisplayFiles();
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadDownloadedFiles();
      showToast('Library refreshed!', 'info', 2000);
    });
  }
}

// Initialize library controls on page load
document.addEventListener('DOMContentLoaded', () => {
  setupLibraryControls();
});

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
    </div>
    <div class="separator-line"></div>
  `;
}

function displayDownloadedFiles(files) {
  const downloadsContainer = document.getElementById('downloadsContainer');
  const noDownloadsMessage = document.querySelector('.no-downloads-message');
  const contentLoader = document.getElementById('contentLoader');
  
  if (!files || files.length === 0) {
    if (noDownloadsMessage) noDownloadsMessage.style.display = 'flex';
    if (contentLoader) contentLoader.style.display = 'none';
    updateDownloadsCount(0);
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
  
  updateDownloadsCount(files.length);
}

function addFileActionListeners() {
  const playIcons = document.querySelectorAll('.play-icon[data-action="play"]');
  const deleteIcons = document.querySelectorAll('.delete-icon[data-action="delete"]');
  
  playIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
      const fileId = e.target.closest('.download-item').dataset.fileId;
      const file = downloadedFilesList.find(f => f.id == fileId);
      if (file) {
        window.electronAPI.openVideoFile(file.id);
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
  filteredFilesList = files;
  hideContentLoader();
  sortAndDisplayFiles();
});

// Listen for file deleted
window.electronAPI.onFileDeleted((fileId) => {
  downloadedFilesList = downloadedFilesList.filter(f => f.id !== fileId);
  filteredFilesList = filteredFilesList.filter(f => f.id !== fileId);
  const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
  if (fileElement) {
    fileElement.remove();
  }
  
  updateDownloadsCount(filteredFilesList.length);
  
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