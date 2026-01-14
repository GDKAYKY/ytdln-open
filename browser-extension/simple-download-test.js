// Teste simples para verificar se conseguimos adicionar downloads à lista

// Função de teste mais direta
function testSimpleDownload() {
  console.log('[Test] Testando download simples...');
  
  // Criar um arquivo de teste pequeno
  const testContent = 'Este é um teste de download da extensão YTDLN';
  const blob = new Blob([testContent], { type: 'text/plain' });
  const blobUrl = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: blobUrl,
    filename: 'teste-ytdln.txt',
    saveAs: false,
    conflictAction: 'uniquify'
  }, (downloadId) => {
    URL.revokeObjectURL(blobUrl);
    
    if (chrome.runtime.lastError) {
      console.error('[Test] Falha no teste:', chrome.runtime.lastError.message);
    } else {
      console.log('[Test] ✅ Teste bem-sucedido! ID:', downloadId);
      
      // Verificar se apareceu na lista
      setTimeout(() => {
        chrome.downloads.search({ id: downloadId }, (results) => {
          if (results && results[0]) {
            console.log('[Test] ✅ Confirmado na lista:', results[0]);
          } else {
            console.log('[Test] ❌ Não encontrado na lista');
          }
        });
      }, 1000);
    }
  });
}

// Função para forçar download mesmo que seja JSON (para debug)
function forceDownloadTest(taskId, fileName) {
  console.log(`[Test] Forçando download de ${fileName}...`);
  
  // Tentar várias URLs possíveis
  const urls = [
    `http://localhost:9001/files/${fileName}`,
    `http://localhost:9001/download/${taskId}`,
    `http://localhost:9001/api/download/${taskId}/file`,
    `http://localhost:9001/static/${fileName}`,
  ];
  
  urls.forEach((url, index) => {
    setTimeout(() => {
      console.log(`[Test] Tentando URL ${index + 1}: ${url}`);
      
      chrome.downloads.download({
        url: url,
        filename: `teste-${index + 1}-${fileName}`,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.log(`[Test] URL ${index + 1} falhou: ${chrome.runtime.lastError.message}`);
        } else {
          console.log(`[Test] ✅ URL ${index + 1} funcionou! ID: ${downloadId}`);
        }
      });
    }, index * 1000); // Espaçar tentativas
  });
}

// Exportar para uso no console
window.testSimpleDownload = testSimpleDownload;
window.forceDownloadTest = forceDownloadTest;

console.log('[Test] Funções de teste carregadas. Use:');
console.log('- testSimpleDownload() para teste básico');
console.log('- forceDownloadTest("taskId", "filename.mp4") para teste forçado');