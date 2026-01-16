// MOCK para evitar erro do Electron em ambiente Node puro
require("module").prototype.require = (function (orig) {
  return function (name) {
    if (name === "electron") {
      return { app: { getPath: (n) => `C:\\Users\\${process.env.USERNAME}\\Downloads` } };
    }
    return orig.apply(this, arguments);
  };
})(require("module").prototype.require);

const path = require("node:path");
const fs = require("node:fs");

async function testMeAtZoo() {
  console.log("🎬 TESTE: Me at the Zoo");
  console.log("=======================\n");

  const videoUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

  const settings = {
    outputFormat: "mp4",
    quality: "best",
    concurrentFragments: 8,
    embedSubs: false,
    writeInfoJson: false,
    writeThumbnail: true,
    writeDescription: false,
    userAgent: "",
    referer: "",
    socketTimeout: 30,
    retries: 5,
    fragmentRetries: 5,
    extractorRetries: 3,
    noCheckCertificate: true,
    ignoreErrors: true,
    audioFormat: "best",
  };

  try {
    // Carregar VideoDownloader
    const VideoDownloader = require("../src/video-downloader");
    const downloader = new VideoDownloader();

    console.log("📦 Inicializando binários...");
    await downloader.init();
    console.log("✅ Binários prontos\n");

    console.log("🔍 Obtendo informações do vídeo...");
    const info = await downloader.getVideoInfo(videoUrl);

    if (info) {
      console.log(`✅ Vídeo encontrado!`);
      console.log(`   Título: ${info.title}`);
      console.log(`   Duração: ${info.duration}s`);
      console.log(`   Codec áudio: ${info.acodec}`);
      console.log(`   Extensão: ${info.ext}\n`);
    } else {
      console.log("⚠️  Não foi possível obter informações\n");
    }

    console.log("📥 Iniciando download...");
    console.log(`   URL: ${videoUrl}`);
    console.log(`   Qualidade: ${settings.quality}`);
    console.log(`   Formato: ${settings.outputFormat}`);
    console.log(`   Thumbnail: Sim (sempre salva no cache)\n`);

    let lastProgress = 0;
    const result = await downloader.download(videoUrl, settings, {
      onProgress: (raw) => {
        const progressMatch = raw.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          if (progress - lastProgress >= 10 || progress === 100) {
            console.log(`   ⏳ ${progress.toFixed(1)}%`);
            lastProgress = progress;
          }
        }
      },
      onError: (err) => {
        console.error(`   ❌ Erro: ${err}`);
      },
    });

    console.log("\n✅ DOWNLOAD CONCLUÍDO!");
    console.log(`   Arquivo: ${result.detectedPath}`);
    console.log(`   Duração: ${result.duration}s\n`);

    // Verificar se o arquivo existe
    if (fs.existsSync(result.detectedPath)) {
      const stats = fs.statSync(result.detectedPath);
      console.log(`📊 INFORMAÇÕES DO ARQUIVO:`);
      console.log(`   Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Criado: ${stats.birthtime.toLocaleString()}\n`);

      // Procurar pela thumbnail
      const dir = path.dirname(result.detectedPath);
      const baseName = path.basename(result.detectedPath, path.extname(result.detectedPath));
      const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

      let thumbFound = false;
      for (const ext of imageExtensions) {
        const thumbPath = path.join(dir, baseName + ext);
        if (fs.existsSync(thumbPath)) {
          const thumbStats = fs.statSync(thumbPath);
          console.log(`🖼️  THUMBNAIL ENCONTRADA:`);
          console.log(`   Arquivo: ${baseName + ext}`);
          console.log(`   Tamanho: ${(thumbStats.size / 1024).toFixed(2)} KB\n`);
          thumbFound = true;
          break;
        }
      }

      if (!thumbFound) {
        console.log(`⚠️  Thumbnail não encontrada no diretório de downloads\n`);
      }
    } else {
      console.log(`❌ Arquivo não encontrado: ${result.detectedPath}\n`);
    }

    console.log("✅ TESTE CONCLUÍDO COM SUCESSO!");
  } catch (error) {
    console.error("\n❌ ERRO NO TESTE:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testMeAtZoo();
