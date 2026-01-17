# Script de release completo para extensão Chromium

param(
    [string]$Version = $null,
    [switch]$SkipBuild = $false
)

$extensionManifest = "extension\manifest.json"
$packageJson = "package.json"
$keyPath = "extension-keys\extension-key.pem"
$outputDir = "releases"

Write-Host "=== RELEASE DA EXTENSAO YTDLN-OPEN ===" -ForegroundColor Cyan
Write-Host ""

# 1. Atualizar versão se fornecida
if ($Version) {
    Write-Host "Atualizando versao para $Version..." -ForegroundColor Yellow
    
    # Atualizar manifest.json
    $manifest = Get-Content $extensionManifest | ConvertFrom-Json
    $manifest.version = $Version
    $manifest | ConvertTo-Json | Set-Content $extensionManifest
    Write-Host "  ✓ extension/manifest.json atualizado" -ForegroundColor Green
    
    # Atualizar package.json
    $package = Get-Content $packageJson | ConvertFrom-Json
    $package.version = $Version
    $package | ConvertTo-Json | Set-Content $packageJson
    Write-Host "  ✓ package.json atualizado" -ForegroundColor Green
    
    Write-Host ""
}

# 2. Verificar chave privada
if (-not (Test-Path $keyPath)) {
    Write-Host "Chave privada nao encontrada!" -ForegroundColor Red
    Write-Host "Execute primeiro: .\generate-extension-key.ps1" -ForegroundColor Yellow
    exit 1
}

# 3. Construir CRX
if (-not $SkipBuild) {
    Write-Host "Construindo extensao CRX..." -ForegroundColor Yellow
    & .\build-extension-crx-manual.ps1 -KeyPath $keyPath -OutputDir $outputDir
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erro ao construir CRX!" -ForegroundColor Red
        exit 1
    }
}

# 4. Exibir informações de release
Write-Host ""
Write-Host "=== INFORMACOES DE RELEASE ===" -ForegroundColor Cyan

$crxFile = Join-Path $outputDir "ytdln-open-extension.crx"
if (Test-Path $crxFile) {
    $manifest = Get-Content $extensionManifest | ConvertFrom-Json
    $size = (Get-Item $crxFile).Length / 1KB
    $hash = (Get-FileHash $crxFile -Algorithm SHA256).Hash
    
    Write-Host "Nome: $($manifest.name)" -ForegroundColor Green
    Write-Host "Versao: $($manifest.version)" -ForegroundColor Green
    Write-Host "Arquivo: $(Split-Path $crxFile -Leaf)" -ForegroundColor Green
    Write-Host "Tamanho: $([math]::Round($size, 2)) KB" -ForegroundColor Green
    Write-Host "SHA256: $hash" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Caminho completo: $(Resolve-Path $crxFile)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Pronto para fazer upload no GitHub!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "  1. Commit das mudancas: git add . && git commit -m 'Release v$($manifest.version)'" -ForegroundColor Gray
Write-Host "  2. Tag: git tag v$($manifest.version)" -ForegroundColor Gray
Write-Host "  3. Push: git push origin main --tags" -ForegroundColor Gray
Write-Host "  4. Criar release no GitHub e fazer upload do arquivo CRX" -ForegroundColor Gray
