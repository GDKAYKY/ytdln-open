#!/bin/bash

# Stream Pipe Tests - Script de Execução
# Executa todos os testes de streaming com progresso

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Stream Pipe Tests - Validação Completa                   ║"
echo "║  Streaming com Progresso em Tempo Real                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para imprimir status
print_status() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ $2${NC}"
  else
    echo -e "${RED}✗ $2${NC}"
    exit 1
  fi
}

# 1. Verificar se npm está instalado
echo -e "${YELLOW}[1/5]${NC} Verificando dependências..."
if ! command -v npm &> /dev/null; then
  echo -e "${RED}npm não encontrado${NC}"
  exit 1
fi
print_status 0 "npm encontrado"

# 2. Instalar dependências
echo ""
echo -e "${YELLOW}[2/5]${NC} Instalando dependências..."
npm install > /dev/null 2>&1
print_status $? "Dependências instaladas"

# 3. Rodar testes de serviço
echo ""
echo -e "${YELLOW}[3/5]${NC} Executando testes de serviço..."
npm test -- src/api/services/__tests__/stream-pipe.service.test.js --passWithNoTests
print_status $? "Testes de serviço passaram"

# 4. Rodar testes de controller
echo ""
echo -e "${YELLOW}[4/5]${NC} Executando testes de controller..."
npm test -- src/api/controllers/__tests__/stream-pipe.controller.test.js --passWithNoTests
print_status $? "Testes de controller passaram"

# 5. Rodar todos os testes com cobertura
echo ""
echo -e "${YELLOW}[5/5]${NC} Executando todos os testes com cobertura..."
npm test -- jest.config.stream-pipe.js --coverage
print_status $? "Todos os testes passaram"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}✓ Todos os testes passaram com sucesso!${NC}              ║"
echo "║  Streaming com progresso validado para produção          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Próximos passos:"
echo "1. Revisar cobertura de testes"
echo "2. Executar testes E2E em ambiente real"
echo "3. Validar no Chrome Download Manager"
echo "4. Deploy em produção"
