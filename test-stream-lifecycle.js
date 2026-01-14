/**
 * Script de Teste Completo do Ciclo de Vida do Stream-Download
 * 
 * Testa todos os endpoints e fluxos do sistema de streaming
 */

const http = require('http');

const API_BASE = 'http://localhost:9001';
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Vídeo curto para teste

// Cores para terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(name) {
  log(`\n[TEST] ${name}`, 'blue');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

/**
 * Fazer requisição HTTP
 */
function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {}
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = res.headers['content-type']?.includes('application/json') 
            ? JSON.parse(data) 
            : data;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
            raw: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            raw: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Teste 1: Health Check
 */
async function testHealthCheck() {
  logTest('Health Check');
  try {
    const response = await httpRequest('GET', '/health');
    
    if (response.status === 200) {
      logSuccess('Health check OK');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      return true;
    } else {
      logError(`Health check falhou: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Erro no health check: ${error.message}`);
    return false;
  }
}

/**
 * Teste 2: Criar Stream
 */
async function testCreateStream() {
  logTest('Criar Stream');
  try {
    const response = await httpRequest('POST', '/api/stream', {
      url: TEST_VIDEO_URL,
      format: 'best',
      audioOnly: false
    });

    if (response.status === 200 && response.body.taskId) {
      logSuccess(`Stream criado: ${response.body.taskId}`);
      console.log('Response:', JSON.stringify(response.body, null, 2));
      return response.body.taskId;
    } else {
      logError(`Falha ao criar stream: ${response.status}`);
      console.log('Response:', response.body);
      return null;
    }
  } catch (error) {
    logError(`Erro ao criar stream: ${error.message}`);
    return null;
  }
}

/**
 * Teste 3: Verificar Status do Stream
 */
async function testStreamStatus(taskId) {
  logTest('Verificar Status do Stream');
  try {
    const response = await httpRequest('GET', `/api/stream/${taskId}/status`);

    if (response.status === 200) {
      logSuccess('Status obtido com sucesso');
      console.log('Status:', JSON.stringify(response.body, null, 2));
      return response.body;
    } else {
      logError(`Falha ao obter status: ${response.status}`);
      console.log('Response:', response.body);
      return null;
    }
  } catch (error) {
    logError(`Erro ao obter status: ${error.message}`);
    return null;
  }
}

/**
 * Teste 4: Monitorar Progresso
 */
async function testMonitorProgress(taskId, maxWait = 300000) {
  logTest('Monitorar Progresso do Download');
  const startTime = Date.now();
  let lastProgress = 0;

  while (Date.now() - startTime < maxWait) {
    try {
      const status = await testStreamStatus(taskId);
      
      if (!status) {
        logWarning('Status não disponível');
        await sleep(2000);
        continue;
      }

      const progress = status.progress?.ytdlp?.percent || status.progress || 0;
      
      if (progress > lastProgress) {
        logSuccess(`Progresso: ${progress.toFixed(1)}%`);
        lastProgress = progress;
      }

      // Verificar se completou
      const downloadStatus = await httpRequest('GET', `/api/stream/${taskId}/status`);
      if (downloadStatus.body?.status === 'completed' || progress >= 100) {
        logSuccess('Download completado!');
        return true;
      }

      // Verificar se houve erro
      if (downloadStatus.body?.status === 'error') {
        logError(`Erro no download: ${downloadStatus.body.error || 'Erro desconhecido'}`);
        return false;
      }

      await sleep(2000);
    } catch (error) {
      logError(`Erro ao monitorar: ${error.message}`);
      await sleep(2000);
    }
  }

  logWarning('Timeout aguardando conclusão');
  return false;
}

/**
 * Teste 5: Verificar Arquivo Disponível
 */
async function testFileAvailable(taskId) {
  logTest('Verificar Arquivo Disponível');
  try {
    const response = await httpRequest('GET', `/api/stream/${taskId}/status`);
    
    if (response.status === 200 && response.body.progress?.outputPath) {
      logSuccess(`Arquivo disponível: ${response.body.progress.outputPath}`);
      return response.body.progress.outputPath;
    } else {
      logWarning('Arquivo ainda não disponível ou caminho não retornado');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      return null;
    }
  } catch (error) {
    logError(`Erro ao verificar arquivo: ${error.message}`);
    return null;
  }
}

/**
 * Teste 6: Baixar Arquivo via Stream
 */
async function testDownloadFile(taskId) {
  logTest('Baixar Arquivo via Stream Endpoint');
  try {
    const response = await httpRequest('GET', `/api/stream/${taskId}/file`);

    if (response.status === 200) {
      logSuccess('Arquivo disponível para download');
      console.log('Headers:', {
        'Content-Type': response.headers['content-type'],
        'Content-Length': response.headers['content-length'],
        'Content-Disposition': response.headers['content-disposition']
      });
      
      // Verificar se é realmente um arquivo de mídia
      const contentType = response.headers['content-type'];
      if (contentType && (contentType.includes('video/') || contentType.includes('audio/'))) {
        logSuccess('Content-Type correto para mídia');
        return true;
      } else {
        logWarning(`Content-Type suspeito: ${contentType}`);
        return false;
      }
    } else if (response.status === 400) {
      logWarning('Arquivo ainda não está completo');
      console.log('Response:', response.body);
      return false;
    } else if (response.status === 404) {
      logError('Download não encontrado');
      return false;
    } else {
      logError(`Falha ao baixar arquivo: ${response.status}`);
      console.log('Response:', response.body);
      return false;
    }
  } catch (error) {
    logError(`Erro ao baixar arquivo: ${error.message}`);
    return false;
  }
}

/**
 * Teste 7: Parar Stream
 */
async function testStopStream(taskId) {
  logTest('Parar Stream');
  try {
    const response = await httpRequest('POST', `/api/stream/${taskId}/stop`);

    if (response.status === 200) {
      logSuccess('Stream parado com sucesso');
      console.log('Response:', JSON.stringify(response.body, null, 2));
      return true;
    } else {
      logError(`Falha ao parar stream: ${response.status}`);
      console.log('Response:', response.body);
      return false;
    }
  } catch (error) {
    logError(`Erro ao parar stream: ${error.message}`);
    return false;
  }
}

/**
 * Teste 8: Testar Erros
 */
async function testErrors() {
  logTest('Testar Tratamento de Erros');
  
  // Teste 8.1: Stream inexistente
  logTest('  - Stream inexistente');
  try {
    const response = await httpRequest('GET', '/api/stream/invalid_task_id/status');
    if (response.status === 404) {
      logSuccess('Erro 404 retornado corretamente para taskId inválido');
    } else {
      logError(`Esperado 404, recebido ${response.status}`);
    }
  } catch (error) {
    logError(`Erro inesperado: ${error.message}`);
  }

  // Teste 8.2: Criar stream sem URL
  logTest('  - Criar stream sem URL');
  try {
    const response = await httpRequest('POST', '/api/stream', {});
    if (response.status === 400) {
      logSuccess('Erro 400 retornado corretamente para URL ausente');
    } else {
      logError(`Esperado 400, recebido ${response.status}`);
    }
  } catch (error) {
    logError(`Erro inesperado: ${error.message}`);
  }
}

/**
 * Função auxiliar: sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executar todos os testes
 */
async function runAllTests() {
  logSection('TESTE COMPLETO DO CICLO DE VIDA DO STREAM-DOWNLOAD');
  
  // Teste 1: Health Check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    logError('Servidor não está respondendo. Certifique-se de que a aplicação está rodando.');
    return;
  }

  await sleep(1000);

  // Teste 2: Criar Stream
  const taskId = await testCreateStream();
  if (!taskId) {
    logError('Não foi possível criar stream. Abortando testes.');
    return;
  }

  await sleep(2000);

  // Teste 3: Verificar Status Inicial
  await testStreamStatus(taskId);

  await sleep(2000);

  // Teste 4: Monitorar Progresso
  logSection('MONITORAMENTO DE PROGRESSO');
  const completed = await testMonitorProgress(taskId);

  if (completed) {
    await sleep(2000);

    // Teste 5: Verificar Arquivo
    await testFileAvailable(taskId);

    await sleep(1000);

    // Teste 6: Baixar Arquivo
    await testDownloadFile(taskId);
  } else {
    logWarning('Download não completou. Testando endpoint de arquivo mesmo assim...');
    await testDownloadFile(taskId);
  }

  // Teste 7: Parar Stream (opcional - comentado para não interromper downloads)
  // await testStopStream(taskId);

  // Teste 8: Testar Erros
  logSection('TESTES DE TRATAMENTO DE ERROS');
  await testErrors();

  logSection('TESTES CONCLUÍDOS');
  log('Verifique os resultados acima para identificar problemas.', 'yellow');
}

// Executar testes
if (require.main === module) {
  runAllTests().catch(error => {
    logError(`Erro fatal: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testHealthCheck,
  testCreateStream,
  testStreamStatus,
  testMonitorProgress,
  testDownloadFile,
  testStopStream,
  testErrors
};
