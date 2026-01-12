// Script injetado na página para acesso a dados do DOM

console.log('[YTDLN] Extensão carregada na página');

// Expor método para extrair metadados de vídeo
window.ytdlnGetVideoMetadata = function() {
  const metadata = {
    title: document.title,
    url: window.location.href,
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
  };
  
  // YouTube específico
  if (window.location.href.includes('youtube.com')) {
    const titleEl = document.querySelector('h1 yt-formatted-string');
    if (titleEl) {
      metadata.title = titleEl.textContent;
    }
  }
  
  // Vimeo específico
  if (window.location.href.includes('vimeo.com')) {
    const titleEl = document.querySelector('[itemprop="name"]');
    if (titleEl) {
      metadata.title = titleEl.textContent;
    }
  }
  
  return metadata;
};

// Detectar quando um vídeo começa a reproduzir
document.addEventListener('play', (e) => {
  if (e.target.tagName === 'VIDEO') {
    const videoInfo = {
      duration: e.target.duration,
      src: e.target.src || e.target.querySelector('source')?.src,
      type: e.target.type || e.target.querySelector('source')?.type,
    };
    
    chrome.runtime.sendMessage({
      action: 'videoPlaying',
      data: videoInfo
    }).catch(() => {});
  }
}, true);
