const fs = require("node:fs");
const path = require("node:path");

console.log("🔍 VERIFICANDO BINÁRIOS");
console.log("=======================\n");

const binDir = path.join(__dirname, "..", "bin");
const requiredBinaries = ["yt-dlp.exe", "ffmpeg.exe"];

console.log(`📁 Diretório: ${binDir}\n`);

let allFound = true;

requiredBinaries.forEach((binary) => {
  const binaryPath = path.join(binDir, binary);
  const exists = fs.existsSync(binaryPath);

  if (exists) {
    const stats = fs.statSync(binaryPath);
    console.log(`✅ ${binary}`);
    console.log(`   Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Caminho: ${binaryPath}\n`);
  } else {
    console.log(`❌ ${binary} - NÃO ENCONTRADO`);
    console.log(`   Esperado em: ${binaryPath}\n`);
    allFound = false;
  }
});

if (!allFound) {
  console.log("⚠️  INSTRUÇÕES PARA INSTALAR:");
  console.log("=============================\n");

  console.log("1. Crie o diretório bin:");
  console.log(`   mkdir ${binDir}\n`);

  console.log("2. Baixe yt-dlp:");
  console.log("   https://github.com/yt-dlp/yt-dlp/releases");
  console.log(`   Coloque em: ${path.join(binDir, "yt-dlp.exe")}\n`);

  console.log("3. Baixe ffmpeg:");
  console.log("   https://ffmpeg.org/download.html");
  console.log(`   Extraia ffmpeg.exe para: ${path.join(binDir, "ffmpeg.exe")}\n`);

  console.log("4. Verifique novamente:");
  console.log("   node tests/check-binaries.js\n");

  process.exit(1);
} else {
  console.log("✅ TODOS OS BINÁRIOS ENCONTRADOS!");
  console.log("Você pode executar os testes agora.\n");
}
