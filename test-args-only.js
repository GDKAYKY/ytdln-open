// MOCK para evitar erro do Electron em ambiente Node puro
require("module").prototype.require = (function (orig) {
  return function (name) {
    if (name === "electron") {
      return { app: { getPath: (n) => `C:\\Downloads\\${n}` } };
    }
    return orig.apply(this, arguments);
  };
})(require("module").prototype.require);

const VideoDownloader = require("./src/video-downloader");
const path = require("node:path");

function testArguments() {
  console.log("🧪 TESTE DE ARGUMENTOS - Simulando extensão");
  console.log("================================================\n");

  const videoUrl = "https://youtu.be/taP0wP-mHZ4";
  
  // Configurações que a extensão enviaria (padrão do app)
  const extensionSettings = {
    outputFormat: "mp4",
    quality: "best",
    concurrentFragments: 8,
    embedSubs: false,
    writeInfoJson: false,
    writeThumbnail: false,
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
    const downloader = new VideoDownloader();
    
    // Mock dos binários
    downloader.binaries = {
      ytdlp: "yt-dlp.exe",
      ffmpeg: "ffmpeg.exe",
    };

    console.log("📋 ARGUMENTOS PARA DOWNLOAD (disco):");
    console.log("=====================================");
    const downloadArgs = downloader.buildYtdlpArgs(extensionSettings, videoUrl, {
      useStdout: false,
    });
    console.log(downloadArgs.join(" \\\n  "));
    console.log("\n");

    console.log("📋 ARGUMENTOS PARA STREAMING (web):");
    console.log("====================================");
    const streamArgs = downloader.buildYtdlpArgs(extensionSettings, videoUrl, {
      useStdout: true,
    });
    console.log(streamArgs.join(" \\\n  "));
    console.log("\n");

    console.log("🔍 COMPARAÇÃO:");
    console.log("==============");
    
    // Encontrar diferenças
    const downloadSet = new Set(downloadArgs);
    const streamSet = new Set(streamArgs);
    
    const onlyInDownload = [...downloadSet].filter(x => !streamSet.has(x));
    const onlyInStream = [...streamSet].filter(x => !downloadSet.has(x));
    
    if (onlyInDownload.length > 0) {
      console.log("❌ Apenas em DOWNLOAD:");
      onlyInDownload.forEach(arg => console.log(`   ${arg}`));
    }
    
    if (onlyInStream.length > 0) {
      console.log("✅ Apenas em STREAM:");
      onlyInStream.forEach(arg => console.log(`   ${arg}`));
    }
    
    if (onlyInDownload.length === 0 && onlyInStream.length === 0) {
      console.log("✅ ARGUMENTOS IDÊNTICOS!");
    }

  } catch (error) {
    console.error("\n❌ ERRO:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testArguments();
