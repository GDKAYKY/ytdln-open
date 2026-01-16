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

const fs = require("node:fs");
const path = require("node:path");
const fsPromises = require("node:fs/promises");

async function testLibraryIntegrity() {
  console.log("🧪 TESTE DE INTEGRIDADE DA BIBLIOTECA");
  console.log("=====================================\n");

  // Criar estrutura de teste
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

    // Criar arquivos de teste
    console.log("📁 Criando estrutura de teste...");

    // Arquivo 1: Válido com thumbnail
    const file1Path = path.join(downloadsDir, "video1.mp4");
    await fsPromises.writeFile(file1Path, "fake video content 1");
    const thumb1Path = path.join(thumbnailsDir, "video1.jpg");
    await fsPromises.writeFile(thumb1Path, "fake thumbnail 1");

    // Arquivo 2: Válido sem thumbnail
    const file2Path = path.join(downloadsDir, "video2.mp4");
    await fsPromises.writeFile(file2Path, "fake video content 2");

    // Arquivo 3: Referência faltando (será removida)
    const file3Path = path.join(downloadsDir, "video3.mp4");

    // Thumbnail órfã
    const orphanThumbPath = path.join(thumbnailsDir, "orphan.jpg");
    await fsPromises.writeFile(orphanThumbPath, "orphaned thumbnail");

    // Criar metadados
    const metadata = [
      {
        id: "1",
        title: "Video 1",
        fileName: "video1.mp4",
        filePath: file1Path,
        fileSize: 20,
        thumbnail: thumb1Path,
        duration: 100,
      },
      {
        id: "2",
        title: "Video 2",
        fileName: "video2.mp4",
        filePath: file2Path,
        fileSize: 20,
        thumbnail: null,
        duration: 100,
      },
      {
        id: "3",
        title: "Video 3 (Missing)",
        fileName: "video3.mp4",
        filePath: file3Path,
        fileSize: 0,
        thumbnail: null,
        duration: 100,
      },
    ];

    const metadataPath = path.join(testDir, "downloads.json");
    await fsPromises.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2)
    );

    console.log("✅ Estrutura criada\n");

    // Carregar o módulo de integridade
    const {
      checkLibraryIntegrity,
      repairLibrary,
      generateLibraryReport,
    } = require("../src/main/library-integrity");

    // 1. Verificar integridade
    console.log("🔍 Verificando integridade...\n");
    const integrityReport = await checkLibraryIntegrity();

    console.log("📊 RELATÓRIO DE INTEGRIDADE:");
    console.log(`   Total de arquivos: ${integrityReport.totalFiles}`);
    console.log(`   Arquivos válidos: ${integrityReport.validFiles}`);
    console.log(`   Arquivos faltando: ${integrityReport.missingFiles}`);
    console.log(`   Thumbnails faltando: ${integrityReport.missingThumbnails}`);
    console.log(`   Metadados corrompidos: ${integrityReport.corruptedMetadata}`);
    console.log(`   Tamanho total: ${(integrityReport.stats.totalSize / 1024).toFixed(2)} KB`);
    console.log(`   Tamanho válido: ${(integrityReport.stats.validSize / 1024).toFixed(2)} KB\n`);

    if (integrityReport.issues.length > 0) {
      console.log("⚠️  PROBLEMAS ENCONTRADOS:");
      integrityReport.issues.forEach((issue, i) => {
        const icon =
          issue.severity === "HIGH"
            ? "🔴"
            : issue.severity === "MEDIUM"
              ? "🟡"
              : "🟢";
        console.log(`   ${icon} [${issue.type}] ${issue.message}`);
      });
      console.log();
    }

    // 2. Gerar relatório detalhado
    console.log("📈 GERANDO RELATÓRIO DETALHADO...\n");
    const detailedReport = await generateLibraryReport();

    console.log("📋 SAÚDE DA BIBLIOTECA:");
    console.log(`   Score: ${detailedReport.summary.health}/100`);
    console.log();

    if (detailedReport.summary.recommendations.length > 0) {
      console.log("💡 RECOMENDAÇÕES:");
      detailedReport.summary.recommendations.forEach((rec) => {
        const icon = rec.priority === "HIGH" ? "🔴" : "🟡";
        console.log(`   ${icon} ${rec.message}`);
      });
      console.log();
    }

    // 3. Reparar biblioteca
    console.log("🔧 REPARANDO BIBLIOTECA...\n");
    const repairReport = await repairLibrary({
      removeMissingFiles: true,
      removeOrphanedThumbnails: true,
    });

    console.log("✅ RELATÓRIO DE REPARO:");
    console.log(`   Arquivos reparados: ${repairReport.repaired}`);
    console.log(`   Itens removidos: ${repairReport.removed}`);
    console.log();

    if (repairReport.actions.length > 0) {
      console.log("📝 AÇÕES REALIZADAS:");
      repairReport.actions.forEach((action) => {
        console.log(`   • [${action.type}] ${action.message || action.fileName}`);
      });
      console.log();
    }

    // 4. Verificar novamente após reparo
    console.log("🔍 VERIFICANDO NOVAMENTE APÓS REPARO...\n");
    const finalReport = await checkLibraryIntegrity();

    console.log("📊 RELATÓRIO FINAL:");
    console.log(`   Total de arquivos: ${finalReport.totalFiles}`);
    console.log(`   Arquivos válidos: ${finalReport.validFiles}`);
    console.log(`   Arquivos faltando: ${finalReport.missingFiles}`);
    console.log(`   Thumbnails faltando: ${finalReport.missingThumbnails}\n`);

    // Resultado final
    const finalHealth = await generateLibraryReport();
    console.log("✅ TESTE CONCLUÍDO!");
    console.log(`   Saúde final: ${finalHealth.summary.health}/100`);

    // Limpar
    await fsPromises.rm(testDir, { recursive: true });
  } catch (error) {
    console.error("\n❌ ERRO NO TESTE:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testLibraryIntegrity();
