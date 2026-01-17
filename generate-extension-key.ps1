# Script para gerar chave privada para assinar extensão CRX

param(
    [string]$OutputDir = "extension-keys"
)

# Criar diretório se não existir
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Diretório '$OutputDir' criado" -ForegroundColor Yellow
}

$keyPath = Join-Path $OutputDir "extension-key.pem"

# Verificar se a chave já existe
if (Test-Path $keyPath) {
    Write-Host "Chave privada ja existe em: $keyPath" -ForegroundColor Yellow
    Write-Host "Use esta chave para assinar suas extensoes." -ForegroundColor Cyan
    exit 0
}

# Encontrar OpenSSL
$opensslPaths = @(
    "C:\Program Files\OpenSSL\bin\openssl.exe",
    "C:\Program Files (x86)\OpenSSL\bin\openssl.exe",
    "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
    "C:\Program Files\OpenSSL-Win32\bin\openssl.exe"
)

$openssl = $null
foreach ($path in $opensslPaths) {
    if (Test-Path $path) {
        $openssl = $path
        break
    }
}

# Tentar encontrar no PATH
if (-not $openssl) {
    $openssl = Get-Command openssl -ErrorAction SilentlyContinue
    if ($openssl) {
        $openssl = $openssl.Source
    }
}

if (-not $openssl) {
    Write-Host "OpenSSL nao encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para instalar OpenSSL no Windows:" -ForegroundColor Yellow
    Write-Host "  1. Baixe de: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    Write-Host "  2. Ou use: choco install openssl" -ForegroundColor Yellow
    Write-Host "  3. Ou use: winget install OpenSSL.Light" -ForegroundColor Yellow
    exit 1
}

Write-Host "Gerando chave privada RSA 2048-bit..." -ForegroundColor Cyan
Write-Host "Usando OpenSSL: $openssl" -ForegroundColor Gray

# Gerar chave privada
& $openssl genrsa -out $keyPath 2048

if (Test-Path $keyPath) {
    Write-Host ""
    Write-Host "Chave privada gerada com sucesso!" -ForegroundColor Green
    Write-Host "Caminho: $keyPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "  - Guarde esta chave em local seguro" -ForegroundColor Yellow
    Write-Host "  - Nao compartilhe com ninguem" -ForegroundColor Yellow
    Write-Host "  - Use para assinar todas as versoes da sua extensao" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para gerar o CRX, execute:" -ForegroundColor Cyan
    Write-Host "  .\build-extension-crx.ps1 -KeyPath '$keyPath'" -ForegroundColor Cyan
}
else {
    Write-Host "Erro ao gerar chave privada!" -ForegroundColor Red
    exit 1
}
