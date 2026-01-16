# Script para criar o ZIP da extensão para release no GitHub

$extensionPath = "extension"
$outputName = "ytdln-open-extension.zip"
$outputPath = Join-Path (Get-Location) $outputName

# Verificar se a pasta extension existe
if (-not (Test-Path $extensionPath)) {
    Write-Host "Pasta 'extension' nao encontrada!" -ForegroundColor Red
    exit 1
}

# Remover ZIP anterior se existir
if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
    Write-Host "ZIP anterior removido" -ForegroundColor Yellow
}

# Criar o ZIP
Write-Host "Criando ZIP da extensao..." -ForegroundColor Cyan
Compress-Archive -Path $extensionPath -DestinationPath $outputPath

# Verificar se foi criado
if (Test-Path $outputPath) {
    $size = (Get-Item $outputPath).Length / 1KB
    Write-Host "Extensao empacotada com sucesso!" -ForegroundColor Green
    Write-Host "Arquivo: $outputName" -ForegroundColor Green
    Write-Host "Tamanho: $([math]::Round($size, 2)) KB" -ForegroundColor Green
    Write-Host "Caminho: $outputPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pronto para fazer upload no GitHub!" -ForegroundColor Cyan
}
else {
    Write-Host "Erro ao criar o ZIP!" -ForegroundColor Red
    exit 1
}
