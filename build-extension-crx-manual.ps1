# Script para criar CRX manualmente usando OpenSSL

param(
    [string]$KeyPath = "extension-keys\extension-key.pem",
    [string]$OutputDir = "releases"
)

$extensionPath = "extension"
$outputName = "ytdln-open-extension"

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

if (-not $openssl) {
    Write-Host "OpenSSL nao encontrado!" -ForegroundColor Red
    exit 1
}

# Criar diretório de releases
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# Verificar arquivos necessários
if (-not (Test-Path $extensionPath)) {
    Write-Host "Pasta 'extension' nao encontrada!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $KeyPath)) {
    Write-Host "Chave privada nao encontrada em: $KeyPath" -ForegroundColor Red
    exit 1
}

Write-Host "Criando CRX assinado..." -ForegroundColor Cyan
Write-Host "OpenSSL: $openssl" -ForegroundColor Gray
Write-Host "Chave: $KeyPath" -ForegroundColor Gray

# Caminhos temporários
$tempDir = Join-Path $OutputDir "temp-crx"
$zipFile = Join-Path $tempDir "extension.zip"
$pubKeyFile = Join-Path $tempDir "public.pem"
$sigFile = Join-Path $tempDir "signature.bin"
$crxOutput = Join-Path $OutputDir "$outputName.crx"

# Limpar e criar diretório temporário
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    # 1. Criar ZIP da extensão
    Write-Host "1. Compactando extensao..." -ForegroundColor Yellow
    Compress-Archive -Path $extensionPath -DestinationPath $zipFile -Force
    
    if (-not (Test-Path $zipFile)) {
        throw "Falha ao criar ZIP"
    }
    
    # 2. Extrair chave pública
    Write-Host "2. Extraindo chave publica..." -ForegroundColor Yellow
    & $openssl rsa -in $KeyPath -pubout -outform DER -out $pubKeyFile 2>$null
    
    if (-not (Test-Path $pubKeyFile)) {
        throw "Falha ao extrair chave publica"
    }
    
    # 3. Assinar o ZIP
    Write-Host "3. Assinando extensao..." -ForegroundColor Yellow
    & $openssl dgst -sha256 -sign $KeyPath -binary -out $sigFile $zipFile 2>$null
    
    if (-not (Test-Path $sigFile)) {
        throw "Falha ao assinar extensao"
    }
    
    # 4. Criar CRX (formato: magic + version + pubkey_len + pubkey + sig_len + sig + zip)
    Write-Host "4. Montando arquivo CRX..." -ForegroundColor Yellow
    
    $crxStream = [System.IO.File]::Create($crxOutput)
    
    # Magic number (4 bytes): "Cr24"
    $crxStream.Write([System.Text.Encoding]::ASCII.GetBytes("Cr24"), 0, 4)
    
    # Version (4 bytes, little-endian): 3
    $crxStream.Write([System.BitConverter]::GetBytes([uint32]3), 0, 4)
    
    # Public key length (4 bytes, little-endian)
    $pubKeyBytes = [System.IO.File]::ReadAllBytes($pubKeyFile)
    $crxStream.Write([System.BitConverter]::GetBytes([uint32]$pubKeyBytes.Length), 0, 4)
    
    # Signature length (4 bytes, little-endian)
    $sigBytes = [System.IO.File]::ReadAllBytes($sigFile)
    $crxStream.Write([System.BitConverter]::GetBytes([uint32]$sigBytes.Length), 0, 4)
    
    # Public key
    $crxStream.Write($pubKeyBytes, 0, $pubKeyBytes.Length)
    
    # Signature
    $crxStream.Write($sigBytes, 0, $sigBytes.Length)
    
    # ZIP content
    $zipBytes = [System.IO.File]::ReadAllBytes($zipFile)
    $crxStream.Write($zipBytes, 0, $zipBytes.Length)
    
    $crxStream.Close()
    
    if (-not (Test-Path $crxOutput)) {
        throw "Falha ao criar CRX"
    }
    
    # Sucesso!
    Write-Host ""
    Write-Host "=== SUCESSO ===" -ForegroundColor Green
    $size = (Get-Item $crxOutput).Length / 1KB
    Write-Host "CRX criado com sucesso!" -ForegroundColor Green
    Write-Host "Nome: $(Split-Path $crxOutput -Leaf)" -ForegroundColor Green
    Write-Host "Tamanho: $([math]::Round($size, 2)) KB" -ForegroundColor Green
    Write-Host "Caminho: $crxOutput" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pronto para release!" -ForegroundColor Cyan
    
}
catch {
    Write-Host ""
    Write-Host "ERRO: $_" -ForegroundColor Red
    exit 1
}
finally {
    # Limpar temporários
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
}
