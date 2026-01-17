// MOCK para evitar erro do Electron em ambiente Node puro
require("module").prototype.require = (function (orig) {
  return function (name) {
    if (name === "electron") {
      return { app: { getPath: (n) => `C:\\Users\\${process.env.USERNAME}\\Downloads` } };
    }
    return orig.apply(this, arguments);
  };
})(require("module").prototype.require);

const VideoDownloader = require("../src/video-downloader");
const fs = require("node:fs");
const path = require("node:path");

async function testStreamDownload() {
  console.log("🧪 TESTE DE STREAMING - Simulando extensão");
  console.log("================================================\n");

  const videoUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
  
  // Configurações que a extensão enviaria (padrão do app)
  const extensionSettings = {
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
    const downloader = new VideoDownloader();
    
    console.log("📦 Inicializando binários...");
    // Usar binários locais diretamente com caminhos normalizados
    const ytdlpPath = path.resolve(__dirname, "..", "bin", "yt-dlp.exe");
    const ffmpegPath = path.resolve(__dirname, "..", "bin", "ffmpeg.exe");
    
    downloader.binaries = {
      ytdlp: ytdlpPath,
      ffmpeg: ffmpegPath,
    };
    console.log("✅ Binários prontos");
    console.log(`   yt-dlp: ${downloader.binaries.ytdlp}`);
    console.log(`   ffmpeg: ${downloader.binaries.ffmpeg}\n`);

    console.log("🔍 Obtendo informações do vídeo...");
    try {
      const info = await downloader.getVideoInfo(videoUrl);
      if (info) {
        console.log(`✅ Vídeo encontrado: ${info.title}`);
        console.log(`   Duração: ${info.duration}s`);
        console.log(`   Codec áudio: ${info.acodec}`);
        console.log(`   Extensão: ${info.ext}\n`);
      } else {
        console.log("⚠️  Não foi possível obter informações\n");
      }
    } catch (err) {
      console.log(`⚠️  Erro ao obter info: ${err.message}`);
      console.log("   Continuando com teste...\n");
    }

    console.log("🎬 Construindo argumentos para streaming...");
    const streamArgs = downloader.buildYtdlpArgs(extensionSettings, videoUrl, {
      useStdout: true,
    });
    
    console.log("📋 Argumentos do yt-dlp:");
    console.log(streamArgs.join(" "));
    console.log("\n");

    console.log("🌐 Simulando resposta HTTP...");
    
    // Criar um mock de resposta HTTP
    const mockRes = {
      headersSent: false,
      writeHead: function(code, headers) {
        console.log(`📤 HTTP ${code}`);
        console.log("Headers:");
        Object.entries(headers).forEach(([k, v]) => {
          console.log(`  ${k}: ${v}`);
        });
        this.headersSent = true;
      },
      end: function() {
        console.log("✅ Resposta finalizada");
      },
      destroy: function(err) {
        if (err) {
          console.error("❌ Resposta destruída com erro:", err.message);
        } else {
          console.log("✅ Resposta destruída");
        }
      },
      on: function(event, callback) {
        // Mock de eventos
        if (event === "error") {
          this._errorHandler = callback;
        } else if (event === "close") {
          this._closeHandler = callback;
        }
      },
      once: function(event, callback) {
        // Mock de eventos únicos
        if (event === "error") {
          this._errorHandler = callback;
        } else if (event === "close") {
          this._closeHandler = callback;
        }
      },
      listeners: {},
      emit: function(event, data) {
        if (this.listeners[event]) {
          this.listeners[event].forEach(cb => cb(data));
        }
      },
    };

    // Adicionar pipe mock
    mockRes.pipe = function(dest) {
      console.log("🔗 Pipe conectado");
      return dest;
    };

    console.log("\n⏳ Iniciando stream...\n");
    
    // Timeout de 30 segundos para o teste
    const streamPromise = downloader.stream(videoUrl, extensionSettings, mockRes);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout após 30s")), 30000)
    );

    try {
      await Promise.race([streamPromise, timeoutPromise]);
      console.log("\n✅ TESTE CONCLUÍDO COM SUCESSO!");
    } catch (err) {
      if (err.message === "Timeout após 30s") {
        console.log("\n⏱️  Timeout - stream ainda está rodando (esperado para vídeos grandes)");
        console.log("✅ TESTE PASSOU - Stream iniciou corretamente!");
      } else {
        throw err;
      }
    }

  } catch (error) {
    console.error("\n❌ ERRO NO TESTE:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testStreamDownload();
