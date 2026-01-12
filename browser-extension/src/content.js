// Content Script - rodando no contexto da página

// Detectar padrões de URL de vídeo
const VIDEO_PATTERNS = [
  /youtube\.com/i,
  /youtu\.be/i,
  /vimeo\.com/i,
  /dailymotion\.com/i,
  /twitch\.tv/i,
  /instagram\.com/i,
  /tiktok\.com/i,
  /reddit\.com/i,
  /twitter\.com/i,
  /x\.com/i,
  /facebook\.com/i,
  /bilibili\.com/i,
];

// Adicionar botão de download flutuante
function addFloatingDownloadButton() {
  if (shouldShowButton()) {
    const isVideoSite = VIDEO_PATTERNS.some(pattern => 
      pattern.test(window.location.href)
    );
    
    if (isVideoSite) {
      createFloatingButton();
    }
  }
}

function shouldShowButton() {
  // Verificar se já existe o botão
  return !document.getElementById('ytdln-float-btn');
}

function createFloatingButton() {
  const button = document.createElement('div');
  button.id = 'ytdln-float-btn';
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M12 2v20m-8-8h16" stroke="white" stroke-width="2"/>
      <path d="M7 12h10" stroke="white" stroke-width="2"/>
    </svg>
  `;
  
  button.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    transition: all 0.3s ease;
    user-select: none;
    border: none;
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  });
  
  button.addEventListener('click', () => {
    const currentUrl = window.location.href;
    chrome.runtime.sendMessage({
      action: 'fillUrl',
      url: currentUrl
    });
    chrome.runtime.openOptionsPage?.();
  });
  
  document.body.appendChild(button);
}

// Detectar links de vídeo em contexto menu
document.addEventListener('contextmenu', (e) => {
  const target = e.target.closest('a, img, video');
  
  if (target) {
    let url = null;
    
    if (target.tagName === 'A') {
      url = target.href;
    } else if (target.tagName === 'IMG') {
      url = target.src;
    } else if (target.tagName === 'VIDEO') {
      url = target.src || target.querySelector('source')?.src;
    }
    
    if (url && isValidVideoUrl(url)) {
      chrome.runtime.sendMessage({
        action: 'videoLinkDetected',
        url: url
      });
    }
  }
}, true);

function isValidVideoUrl(url) {
  try {
    const urlObj = new URL(url, window.location.origin);
    const ext = urlObj.pathname.toLowerCase();
    return /\.(mp4|mkv|webm|avi|mov|flv|wmv|m3u8|mpd)$/i.test(ext) ||
           VIDEO_PATTERNS.some(p => p.test(url));
  } catch {
    return false;
  }
}

// Injetar script para acessar informações da página
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/injected.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inicializar
injectScript();
addFloatingDownloadButton();

// Escutar mensagens do background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageUrl') {
    sendResponse({ url: window.location.href });
  }
});

// Monkey patch para detectar reprodução de vídeo
(function() {
  const originalFetch = window.fetch;
  
  window.fetch = function(...args) {
    const url = args[0];
    
    if (typeof url === 'string' && isValidVideoUrl(url)) {
      console.log('[YTDLN] Vídeo detectado:', url);
    }
    
    return originalFetch.apply(this, args);
  };
})();
