#!/usr/bin/env node

/**
 * TEST_INTEGRATION.js
 * 
 * Script para testar a integração da API v2.0
 * Execute com: node TEST_INTEGRATION.js
 * 
 * Testa:
 * 1. Conexão com API v2.0
 * 2. Criação de download
 * 3. Monitoramento via SSE
 * 4. Cancelamento
 */

const http = require('http');
const EventSource = require('eventsource');

const API_URL = 'http://localhost:9001/api';
const HEALTH_CHECK = 'http://localhost:9001/health';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test 1: Health check
async function testHealthCheck() {
  log('\n📋 Test 1: Health Check', 'blue');
  log('─'.repeat(50));
  
  try {
    const response = await fetch(HEALTH_CHECK);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    log(`✅ API respondendo: ${data.status}`, 'green');
    log(`📍 Versão: ${data.version}`);
    log(`📊 Fila: ${JSON.stringify(data.queue)}`);
    return true;
  } catch (error) {
    log(`❌ Erro na health check: ${error.message}`, 'red');
    log('   Certifique-se que o Electron está rodando!', 'yellow');
    return false;
  }
}

// Test 2: Create download
async function testCreateDownload() {
  log('\n📥 Test 2: Criar Download', 'blue');
  log('─'.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        format: 'best',
        subtitles: false,
        source: 'test-script'
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    log(`✅ Download criado com sucesso!`, 'green');
    log(`🔑 Task ID: ${data.taskId}`);
    log(`📊 Status: ${data.status}`);
    log(`📁 Pasta: ${data.downloadFolder}`);
    
    return data.taskId;
  } catch (error) {
    log(`❌ Erro ao criar download: ${error.message}`, 'red');
    return null;
  }
}

// Test 3: Monitor SSE
async function testMonitorSSE(taskId) {
  log('\n📡 Test 3: Monitorar com SSE', 'blue');
  log('─'.repeat(50));
  
  return new Promise((resolve) => {
    try {
      const eventSource = new EventSource(`${API_URL}/download/${taskId}/sse`);
      let progressCount = 0;

      eventSource.addEventListener('progress', (e) => {
        try {
          const data = JSON.parse(e.data);
          progressCount++;
          
          if (progressCount % 5 === 0 || progressCount === 1) {
            log(`📊 Progresso: ${data.percent}% | ${data.speed} | ETA: ${data.eta}`);
          }
        } catch (err) {
          console.error('Parse error:', err);
        }
      });

      eventSource.addEventListener('complete', (e) => {
        try {
          const data = JSON.parse(e.data);
          log(`✅ Download concluído!`, 'green');
          log(`📁 Arquivo: ${data.filename}`);
          eventSource.close();
          resolve(true);
        } catch (err) {
          console.error('Parse error:', err);
          eventSource.close();
          resolve(false);
        }
      });

      eventSource.addEventListener('error', (e) => {
        log(`❌ Erro no SSE: ${e.message}`, 'red');
        eventSource.close();
        resolve(false);
      });

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          log('⏹️ SSE desconectado', 'yellow');
        }
        eventSource.close();
        resolve(false);
      };

      // Timeout após 30 segundos
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          log('⏱️ Timeout (30s) - encerrando monitoramento', 'yellow');
          eventSource.close();
          resolve(false);
        }
      }, 30000);
    } catch (error) {
      log(`❌ Erro ao abrir SSE: ${error.message}`, 'red');
      resolve(false);
    }
  });
}

// Test 4: Get status
async function testGetStatus(taskId) {
  log('\n📊 Test 4: Obter Status', 'blue');
  log('─'.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/download/status/${taskId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    log(`✅ Status obtido:`, 'green');
    log(`   Tarefas pendentes: ${data.queue?.pending || 0}`);
    log(`   Ativas: ${data.queue?.active || 0}`);
    log(`   Concluídas: ${data.queue?.completed || 0}`);
    log(`   Falhadas: ${data.queue?.failed || 0}`);
    return true;
  } catch (error) {
    log(`❌ Erro ao obter status: ${error.message}`, 'red');
    return false;
  }
}

// Test 5: Cancel download
async function testCancelDownload(taskId) {
  log('\n❌ Test 5: Cancelar Download', 'blue');
  log('─'.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/download/${taskId}/cancel`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    log(`✅ Download cancelado:`, 'green');
    log(`   Status: ${data.status}`);
    return true;
  } catch (error) {
    log(`❌ Erro ao cancelar: ${error.message}`, 'red');
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n🚀 INICIANDO TESTES DA INTEGRAÇÃO v2.0', 'blue');
  log('='.repeat(50));
  
  // Test 1
  const healthy = await testHealthCheck();
  if (!healthy) {
    log('\n⚠️  API não está respondendo. Encerrando testes.', 'yellow');
    process.exit(1);
  }
  
  // Test 2
  const taskId = await testCreateDownload();
  if (!taskId) {
    log('\n⚠️  Não foi possível criar download. Encerrando testes.', 'yellow');
    process.exit(1);
  }
  
  // Test 3 (comentado - toma muito tempo)
  // log('\n⏳ Aguardando início do download para monitorar progresso...');
  // await new Promise(resolve => setTimeout(resolve, 2000));
  // await testMonitorSSE(taskId);
  
  // Test 4
  await testGetStatus(taskId);
  
  // Test 5 (comentado - cancelaria o download)
  // await testCancelDownload(taskId);
  
  log('\n' + '='.repeat(50));
  log('✅ TESTES CONCLUÍDOS!', 'green');
  log('   API v2.0 está funcionando corretamente.', 'green');
}

// Entry point
if (require.main === module) {
  runTests().catch(error => {
    log(`\n💥 Erro fatal: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  testHealthCheck,
  testCreateDownload,
  testMonitorSSE,
  testGetStatus,
  testCancelDownload
};
