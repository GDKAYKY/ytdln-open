@echo off
REM Stream Pipe Tests - Script de Execução (Windows)
REM Executa todos os testes de streaming com progresso

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  Stream Pipe Tests - Validação Completa                   ║
echo ║  Streaming com Progresso em Tempo Real                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Verificar se npm está instalado
echo [1/5] Verificando dependências...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo npm não encontrado
  exit /b 1
)
echo ✓ npm encontrado
echo.

REM Instalar dependências
echo [2/5] Instalando dependências...
call npm install >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ✗ Erro ao instalar dependências
  exit /b 1
)
echo ✓ Dependências instaladas
echo.

REM Rodar testes de serviço
echo [3/5] Executando testes de serviço...
call npm test -- src/api/services/__tests__/stream-pipe.service.test.js --passWithNoTests
if %ERRORLEVEL% NEQ 0 (
  echo ✗ Testes de serviço falharam
  exit /b 1
)
echo ✓ Testes de serviço passaram
echo.

REM Rodar testes de controller
echo [4/5] Executando testes de controller...
call npm test -- src/api/controllers/__tests__/stream-pipe.controller.test.js --passWithNoTests
if %ERRORLEVEL% NEQ 0 (
  echo ✗ Testes de controller falharam
  exit /b 1
)
echo ✓ Testes de controller passaram
echo.

REM Rodar todos os testes com cobertura
echo [5/5] Executando todos os testes com cobertura...
call npm test -- jest.config.stream-pipe.js --coverage
if %ERRORLEVEL% NEQ 0 (
  echo ✗ Testes falharam
  exit /b 1
)

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  ✓ Todos os testes passaram com sucesso!                  ║
echo ║  Streaming com progresso validado para produção           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Próximos passos:
echo 1. Revisar cobertura de testes
echo 2. Executar testes E2E em ambiente real
echo 3. Validar no Chrome Download Manager
echo 4. Deploy em produção
echo.

endlocal
