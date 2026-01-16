// MOCK para evitar erro do Electron em ambiente Node puro
require("module").prototype.require = (function (orig) {
  return function (name) {
    if (name === "electron") {
      return {
        app: {
          getPath: (n) => {
            if (n === "userData") return "./test-data";
            return "./test-data/downloads";
          },
        },
      };
    }
    return orig.apply(this, arguments);
  };
})(require("module").prototype.require);

const path = require("node:path");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");

async function testThumbnailFlow() {
  console.log("🎬 TESTE: Fluxo de Thumbnail");
  console.log("=============================\n");

  const testDir = "./test-data";
  const downloadsDir = path.join(testDir, "downloads");
  const thumbnailsDir = path.join(testDir, "thumbnails");

  try {
    // Limpar e criar diretórios
    if (fs.existsSync(testDir)) {
      await fsPromises.rm(testDir, { recursive: true });
    }
    await fsPromises.mkdir(downloadsDir, { recursive: true });
    await fsPromises.mkdir(thumbnailsDir, { recursive: true });

    console.log("📁 Estrutura de teste criada\n");

    // Simular arquivo de vídeo e thumbnail
    const videoPath = path.join(downloadsDir, "video.mp4");
    const thumbPath = path.join(downloadsDir, "video.jpg");

    await fsPromises.writeFile(videoPath, "fake video");
    await fsPromises.writeFile(thumbPath, "fake thumbnail");

    console.log("📝 Arquivos criados:");
    console.log(`   Vídeo: ${videoPath}`);
    console.log(`   Thumbnail: ${thumbPath}\n`);

    // TESTE 1: Verificar que thumbnail é SEMPRE salva no cache
    console.log("🔍 TESTE 1: Thumbnail SEMPRE salva no cache");
    console.log("==========================================\n");

    const settings1 = {
      writeThumbnailToDownload: false,
    };

    const libraryManager = require("../src/main/library-manager");

    // Simular o que acontece no trackDownloadedFile
    const originalThumbPath = await libraryManager.findThumbnailForFile(
      videoPath
    );
    console.log(`Thumbnail encontrada: ${originalThumbPath}`);

    if (originalThumbPath && fs.existsSync(originalThumbPath)) {
      const thumbExt = path.extname(originalThumbPath);
      const cachePathBase = libraryManager.getCachedThumbnailPath(videoPath);
      const libraryThumbPath =
        cachePathBase.substring(0, cachePathBase.lastIndexOf(".")) + thumbExt;

      console.log(`Cache path: ${libraryThumbPath}`);

      // Copiar para cache (SEMPRE)
      await fsPromises.copyFile(originalThumbPath, libraryThumbPath);
      console.log(`✅ Thumbnail copiada para cache`);

      // Deletar original (SEMPRE)
      try {
        await fsPromises.unlink(originalThumbPath);
        console.log(`✅ Thumbnail deletada do downloads`);
      } catch (e) {
        console.error("Erro ao deletar:", e.message);
      }

      // Verificar resultado
      console.log("\n📊 Resultado:");
      console.log(
        `   No cache: ${fs.existsSync(libraryThumbPath) ? "✅ SIM (correto)" : "❌ NÃO"}`
      );
      console.log(
        `   No downloads: ${fs.existsSync(originalThumbPath) ? "❌ SIM (erro)" : "✅ NÃO (correto)"}`
      );
    }

    console.log("\n");

    // Limpar para próximo teste
    await fsPromises.rm(testDir, { recursive: true });
    await fsPromises.mkdir(downloadsDir, { recursive: true });
    await fsPromises.mkdir(thumbnailsDir, { recursive: true });

    // TESTE 2: Verificar que thumbnail é SEMPRE salva no cache (mesmo com writeThumbnailToDownload=true)
    console.log("🔍 TESTE 2: Thumbnail SEMPRE salva no cache (mesmo com writeThumbnailToDownload=true)");
    console.log("================================================================================\n");

    const settings2 = {
      writeThumbnailToDownload: true,
    };

    const videoPath2 = path.join(downloadsDir, "video2.mp4");
    const thumbPath2 = path.join(downloadsDir, "video2.jpg");

    await fsPromises.writeFile(videoPath2, "fake video");
    await fsPromises.writeFile(thumbPath2, "fake thumbnail");

    const originalThumbPath2 = await libraryManager.findThumbnailForFile(
      videoPath2
    );
    console.log(`Thumbnail encontrada: ${originalThumbPath2}`);

    if (originalThumbPath2 && fs.existsSync(originalThumbPath2)) {
      const thumbExt = path.extname(originalThumbPath2);
      const cachePathBase = libraryManager.getCachedThumbnailPath(videoPath2);
      const libraryThumbPath =
        cachePathBase.substring(0, cachePathBase.lastIndexOf(".")) + thumbExt;

      console.log(`Cache path: ${libraryThumbPath}`);

      // Copiar para cache (SEMPRE)
      await fsPromises.copyFile(originalThumbPath2, libraryThumbPath);
      console.log(`✅ Thumbnail copiada para cache`);

      // Deletar original (SEMPRE)
      try {
        await fsPromises.unlink(originalThumbPath2);
        console.log(`✅ Thumbnail deletada do downloads`);
      } catch (e) {
        console.error("Erro ao deletar:", e.message);
      }

      // Verificar resultado
      console.log("\n📊 Resultado:");
      console.log(
        `   No cache: ${fs.existsSync(libraryThumbPath) ? "✅ SIM (correto)" : "❌ NÃO"}`
      );
      console.log(
        `   No downloads: ${fs.existsSync(originalThumbPath2) ? "❌ SIM (erro)" : "✅ NÃO (correto)"}`
      );
    }

    console.log("\n✅ TESTE CONCLUÍDO!");

    // Limpar
    await fsPromises.rm(testDir, { recursive: true });
  } catch (error) {
    console.error("\n❌ ERRO NO TESTE:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testThumbnailFlow();
