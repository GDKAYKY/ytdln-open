# Script para testar a extensão CRX

param(
    [string]$CrxPath = "releases\ytdln-open-extension.crx"
)

Write-Host "=== TESTE DE EXTENSAO ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se arquivo existe
if (-not (Test-Path $CrxPath)) {
    Write-Host "Arquivo CRX nao encontrado: $CrxPath" -ForegroundColor Red
    exit 1
}

# Validar formato CRX
Write-Host "Validando arquivo CRX..." -ForegroundColor Yellow

$crxBytes = [System.IO.File]::ReadAllBytes($CrxPath)

# Verificar magic number "Cr24"
$magic = [System.Text.Encoding]::ASCII.GetString($crxBytes[0..3])
if ($magic -ne "Cr24") {
    Write-Host "Erro: Magic number invalido. Esperado 'Cr24', obtido '$magic'" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Magic number valido: $magic" -ForegroundColor Green

# Verificar versão
$version = [System.BitConverter]::ToUInt32($crxBytes, 4)
Write-Host "✓ Versao CRX: $version" -ForegroundColor Green

# Verificar tamanhos
$pubKeyLen = [System.BitConverter]::ToUInt32($crxBytes, 8)
$sigLen = [System.BitConverter]::ToUInt32($crxBytes, 12)

Write-Host "✓ Tamanho chave publica: $pubKeyLen bytes" -ForegroundColor Green
Write-Host "✓ Tamanho assinatura: $sigLen bytes" -ForegroundColor Green

# Informações do arquivo
$fileInfo = Get-Item $CrxPath
Write-Host ""
Write-Host "=== INFORMACOES DO ARQUIVO ===" -ForegroundColor Cyan
Write-Host "Nome: $($fileInfo.Name)" -ForegroundColor Green
Write-Host "Tamanho: $([math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor Green
Write-Host "Criado: $($fileInfo.CreationTime)" -ForegroundColor Green
Write-Host "Modificado: $($fileInfo.LastWriteTime)" -ForegroundColor Green

# Hash
$hash = (Get-FileHash $CrxPath -Algorithm SHA256).Hash
Write-Host "SHA256: $hash" -ForegroundColor Gray

Write-Host ""
Write-Host "=== COMO INSTALAR ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Abra Chrome/Chromium" -ForegroundColor Yellow
Write-Host "2. Vá para: chrome://extensions/" -ForegroundColor Yellow
Write-Host "3. Arraste e solte o arquivo CRX" -ForegroundColor Yellow
Write-Host "4. Confirme a instalacao" -ForegroundColor Yellow
Write-Host ""
Write-Host "Arquivo pronto para instalacao!" -ForegroundColor Green
