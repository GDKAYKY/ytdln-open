# Script para criar extensão no formato CRX (Chromium) para release

param(
    [string]$KeyPath = $null,
    [string]$OutputDir = "releases"
)

$extensionPath = "extension"
$outputName = "ytdln-open-extension"

# Criar diretório de releases se não existir
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Diretório '$OutputDir' criado" -ForegroundColor Yellow
}

# Verificar se a pasta extension existe
if (-not (Test-Path $extensionPath)) {
    Write-Host "Pasta 'extension' nao encontrada!" -ForegroundColor Red
    exit 1
}

# Criar ZIP temporário
$tempZip = Join-Path $OutputDir "$outputName-temp.zip"
$crxOutput = Join-Path $OutputDir "$outputName.crx"
$zipOutput = Join-Path $OutputDir "$outputName.zip"

Write-Host "Criando pacote da extensao..." -ForegroundColor Cyan

# Remover arquivos anteriores
if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
if (Test-Path $crxOutput) { Remove-Item $crxOutput -Force }
if (Test-Path $zipOutput) { Remove-Item $zipOutput -Force }

# Criar ZIP
Compress-Archive -Path $extensionPath -DestinationPath $tempZip

if (-not (Test-Path $tempZip)) {
    Write-Host "Erro ao criar ZIP temporario!" -ForegroundColor Red
    exit 1
}

# Se houver chave privada, criar CRX
if ($KeyPath -and (Test-Path $KeyPath)) {
    Write-Host "Gerando CRX com chave privada..." -ForegroundColor Cyan
    
    # Usar Chrome/Chromium para gerar CRX
    $chromePaths = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "C:\Program Files\Chromium\Application\chrome.exe"
    )
    
    $chromePath = $null
    foreach ($path in $chromePaths) {
        if (Test-Path $path) {
            $chromePath = $path
            break
        }
    }
    
    if ($chromePath) {
        Write-Host "Chrome encontrado em: $chromePath" -ForegroundColor Green
        
        # Criar CRX usando Chrome
        & $chromePath --pack-extension="$((Get-Item $extensionPath).FullName)" `
                      --pack-extension-key="$((Get-Item $KeyPath).FullName)" `
                      --no-message-box
        
        if (Test-Path "$extensionPath.crx") {
            Move-Item "$extensionPath.crx" $crxOutput -Force
            Write-Host "CRX criado com sucesso!" -ForegroundColor Green
        }
    }
    else {
        Write-Host "Chrome nao encontrado. Usando ZIP como alternativa." -ForegroundColor Yellow
        Copy-Item $tempZip $zipOutput
    }
}
else {
    Write-Host "Nenhuma chave privada fornecida. Usando ZIP como alternativa." -ForegroundColor Yellow
    Copy-Item $tempZip $zipOutput
}

# Remover ZIP temporário
Remove-Item $tempZip -Force

# Exibir resultado
Write-Host ""
Write-Host "=== RESULTADO ===" -ForegroundColor Cyan

if (Test-Path $crxOutput) {
    $size = (Get-Item $crxOutput).Length / 1KB
    Write-Host "Arquivo CRX criado com sucesso!" -ForegroundColor Green
    Write-Host "Nome: $(Split-Path $crxOutput -Leaf)" -ForegroundColor Green
    Write-Host "Tamanho: $([math]::Round($size, 2)) KB" -ForegroundColor Green
    Write-Host "Caminho: $crxOutput" -ForegroundColor Green
}
elseif (Test-Path $zipOutput) {
    $size = (Get-Item $zipOutput).Length / 1KB
    Write-Host "Arquivo ZIP criado com sucesso!" -ForegroundColor Green
    Write-Host "Nome: $(Split-Path $zipOutput -Leaf)" -ForegroundColor Green
    Write-Host "Tamanho: $([math]::Round($size, 2)) KB" -ForegroundColor Green
    Write-Host "Caminho: $zipOutput" -ForegroundColor Green
    Write-Host ""
    Write-Host "Dica: Para gerar CRX, forneça uma chave privada:" -ForegroundColor Yellow
    Write-Host "  .\build-extension-crx.ps1 -KeyPath 'caminho/para/chave.pem'" -ForegroundColor Yellow
}
else {
    Write-Host "Erro ao criar pacote!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Pronto para release!" -ForegroundColor Cyan
