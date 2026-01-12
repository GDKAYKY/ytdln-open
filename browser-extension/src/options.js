// Gerenciador de configurações

const DEFAULTS = {
  serverUrl: 'http://localhost:9000',
  autoConnect: true,
  defaultFormat: 'best',
  autoDownloadSubs: false,
  maxConcurrent: 2,
  floatingButton: true,
  contextMenu: true,
  notifications: true,
  timeout: 30,
  retryAttempts: 3,
};

const form = document.getElementById('settingsForm');
const statusMessage = document.getElementById('statusMessage');

// Carregar configurações ao abrir
document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULTS);
  
  // Preencher formulário
  Object.keys(settings).forEach(key => {
    const element = document.getElementById(key);
    
    if (!element) return;
    
    if (element.type === 'checkbox') {
      element.checked = settings[key];
    } else {
      element.value = settings[key];
    }
  });
}

// Salvar configurações
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {};
  
  // Coletar valores do formulário
  Array.from(form.elements).forEach(element => {
    if (element.id && element.id !== 'statusMessage') {
      if (element.type === 'checkbox') {
        settings[element.id] = element.checked;
      } else if (element.name) {
        settings[element.id] = element.value;
      }
    }
  });
  
  try {
    // Validar URL do servidor
    if (settings.serverUrl) {
      try {
        new URL(settings.serverUrl);
      } catch {
        showStatus('URL do servidor inválida', 'error');
        return;
      }
    }
    
    // Converter números
    settings.maxConcurrent = parseInt(settings.maxConcurrent) || 2;
    settings.timeout = parseInt(settings.timeout) || 30;
    settings.retryAttempts = parseInt(settings.retryAttempts) || 3;
    
    await chrome.storage.sync.set(settings);
    showStatus('✅ Configurações salvas com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showStatus('❌ Erro ao salvar configurações', 'error');
  }
});

// Restaurar padrões
form.addEventListener('reset', async (e) => {
  setTimeout(async () => {
    await chrome.storage.sync.set(DEFAULTS);
    showStatus('✅ Configurações restauradas para o padrão', 'success');
  }, 100);
});

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;
  
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.classList.remove('show');
    }, 4000);
  }
}
