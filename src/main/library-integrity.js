const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");

const downloadsMetadataPath = path.join(
  app.getPath("userData"),
  "downloads.json"
);

const thumbnailsCachePath = path.join(app.getPath("userData"), "thumbnails");

/**
 * Verifica a integridade da biblioteca
 * @returns {Promise<Object>} Relatório de integridade
 */
async function checkLibraryIntegrity() {
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: 0,
    validFiles: 0,
    missingFiles: 0,
    missingThumbnails: 0,
    corruptedMetadata: 0,
    issues: [],
    stats: {
      totalSize: 0,
      validSize: 0,
    },
  };

  try {
    // 1. Verificar se o arquivo de metadados existe
    if (!fs.existsSync(downloadsMetadataPath)) {
      report.issues.push({
        type: "MISSING_METADATA",
        severity: "HIGH",
        message: "Arquivo de metadados não encontrado",
      });
      return report;
    }

    // 2. Carregar e validar metadados
    let downloadedFiles = [];
    try {
      const data = fs.readFileSync(downloadsMetadataPath, "utf8");
      downloadedFiles = JSON.parse(data);
    } catch (error) {
      report.issues.push({
        type: "CORRUPTED_METADATA",
        severity: "HIGH",
        message: `Erro ao parsear metadados: ${error.message}`,
      });
      report.corruptedMetadata++;
      return report;
    }

    report.totalFiles = downloadedFiles.length;

    // 3. Validar cada arquivo
    for (const file of downloadedFiles) {
      try {
        // Validar estrutura do objeto
        if (!file.id || !file.filePath) {
          report.issues.push({
            type: "INVALID_METADATA",
            severity: "MEDIUM",
            message: `Arquivo sem ID ou filePath: ${file.fileName || "unknown"}`,
            fileId: file.id,
          });
          report.corruptedMetadata++;
          continue;
        }

        // Verificar se o arquivo existe
        if (!fs.existsSync(file.filePath)) {
          report.issues.push({
            type: "MISSING_FILE",
            severity: "HIGH",
            message: `Arquivo não encontrado: ${file.filePath}`,
            fileId: file.id,
            fileName: file.fileName,
          });
          report.missingFiles++;
          continue;
        }

        // Verificar tamanho do arquivo
        const stats = await fsPromises.stat(file.filePath);
        report.stats.totalSize += stats.size;

        // Validar thumbnail
        if (file.thumbnail) {
          if (!fs.existsSync(file.thumbnail)) {
            report.issues.push({
              type: "MISSING_THUMBNAIL",
              severity: "LOW",
              message: `Thumbnail não encontrada: ${file.thumbnail}`,
              fileId: file.id,
              fileName: file.fileName,
            });
            report.missingThumbnails++;
          }
        } else {
          report.issues.push({
            type: "NO_THUMBNAIL",
            severity: "LOW",
            message: `Arquivo sem thumbnail: ${file.fileName}`,
            fileId: file.id,
          });
          report.missingThumbnails++;
        }

        // Arquivo válido
        report.validFiles++;
        report.stats.validSize += stats.size;
      } catch (error) {
        report.issues.push({
          type: "ERROR_CHECKING_FILE",
          severity: "MEDIUM",
          message: `Erro ao verificar arquivo: ${error.message}`,
          fileId: file.id,
          fileName: file.fileName,
        });
      }
    }

    // 4. Verificar diretório de thumbnails
    if (fs.existsSync(thumbnailsCachePath)) {
      try {
        const thumbFiles = await fsPromises.readdir(thumbnailsCachePath);
        const orphanedThumbs = [];

        for (const thumbFile of thumbFiles) {
          const thumbPath = path.join(thumbnailsCachePath, thumbFile);
          const isReferenced = downloadedFiles.some(
            (f) => f.thumbnail === thumbPath
          );

          if (!isReferenced) {
            orphanedThumbs.push(thumbFile);
          }
        }

        if (orphanedThumbs.length > 0) {
          report.issues.push({
            type: "ORPHANED_THUMBNAILS",
            severity: "LOW",
            message: `${orphanedThumbs.length} thumbnails órfãs encontradas`,
            files: orphanedThumbs,
          });
        }
      } catch (error) {
        report.issues.push({
          type: "ERROR_CHECKING_THUMBNAILS",
          severity: "MEDIUM",
          message: `Erro ao verificar diretório de thumbnails: ${error.message}`,
        });
      }
    }
  } catch (error) {
    report.issues.push({
      type: "FATAL_ERROR",
      severity: "HIGH",
      message: `Erro fatal ao verificar integridade: ${error.message}`,
    });
  }

  return report;
}

/**
 * Repara problemas encontrados na biblioteca
 * @param {Object} options - Opções de reparo
 * @returns {Promise<Object>} Relatório de reparo
 */
async function repairLibrary(options = {}) {
  const {
    removeMissingFiles = false,
    removeOrphanedThumbnails = false,
  } = options;

  const report = {
    timestamp: new Date().toISOString(),
    repaired: 0,
    removed: 0,
    actions: [],
  };

  try {
    // 1. Carregar metadados
    if (!fs.existsSync(downloadsMetadataPath)) {
      report.actions.push({
        type: "ERROR",
        message: "Arquivo de metadados não encontrado",
      });
      return report;
    }

    const data = fs.readFileSync(downloadsMetadataPath, "utf8");
    let downloadedFiles = JSON.parse(data);
    const originalCount = downloadedFiles.length;

    // 2. Remover arquivos faltando
    if (removeMissingFiles) {
      downloadedFiles = downloadedFiles.filter((file) => {
        if (!fs.existsSync(file.filePath)) {
          report.actions.push({
            type: "REMOVED_MISSING_FILE",
            fileName: file.fileName,
            filePath: file.filePath,
          });
          report.removed++;
          return false;
        }
        return true;
      });
    }

    // 3. Remover thumbnails órfãs
    if (removeOrphanedThumbnails && fs.existsSync(thumbnailsCachePath)) {
      const thumbFiles = await fsPromises.readdir(thumbnailsCachePath);

      for (const thumbFile of thumbFiles) {
        const thumbPath = path.join(thumbnailsCachePath, thumbFile);
        const isReferenced = downloadedFiles.some(
          (f) => f.thumbnail === thumbPath
        );

        if (!isReferenced) {
          try {
            await fsPromises.unlink(thumbPath);
            report.actions.push({
              type: "REMOVED_ORPHANED_THUMBNAIL",
              fileName: thumbFile,
            });
            report.removed++;
          } catch (error) {
            report.actions.push({
              type: "ERROR_REMOVING_THUMBNAIL",
              fileName: thumbFile,
              error: error.message,
            });
          }
        }
      }
    }

    // 4. Salvar metadados reparados
    if (downloadedFiles.length !== originalCount) {
      const tempPath = `${downloadsMetadataPath}.tmp`;
      await fsPromises.writeFile(
        tempPath,
        JSON.stringify(downloadedFiles, null, 2)
      );
      await fsPromises.rename(tempPath, downloadsMetadataPath);

      report.repaired = originalCount - downloadedFiles.length;
      report.actions.push({
        type: "METADATA_UPDATED",
        message: `Metadados atualizados: ${originalCount} → ${downloadedFiles.length} arquivos`,
      });
    }
  } catch (error) {
    report.actions.push({
      type: "FATAL_ERROR",
      message: `Erro ao reparar biblioteca: ${error.message}`,
    });
  }

  return report;
}

/**
 * Gera um relatório detalhado da biblioteca
 * @returns {Promise<Object>} Relatório detalhado
 */
async function generateLibraryReport() {
  const integrityReport = await checkLibraryIntegrity();

  const report = {
    ...integrityReport,
    summary: {
      health: calculateHealth(integrityReport),
      recommendations: generateRecommendations(integrityReport),
    },
  };

  return report;
}

/**
 * Calcula a saúde da biblioteca (0-100)
 */
function calculateHealth(report) {
  if (report.totalFiles === 0) return 100;

  const validPercentage = (report.validFiles / report.totalFiles) * 100;
  const thumbnailPercentage =
    ((report.totalFiles - report.missingThumbnails) / report.totalFiles) * 100;

  // Média ponderada: 70% arquivos válidos, 30% thumbnails
  const health = validPercentage * 0.7 + thumbnailPercentage * 0.3;

  return Math.round(health);
}

/**
 * Gera recomendações baseadas nos problemas encontrados
 */
function generateRecommendations(report) {
  const recommendations = [];

  if (report.missingFiles > 0) {
    recommendations.push({
      priority: "HIGH",
      message: `${report.missingFiles} arquivo(s) faltando. Execute reparo com removeMissingFiles=true`,
    });
  }

  if (report.missingThumbnails > 0) {
    recommendations.push({
      priority: "LOW",
      message: `${report.missingThumbnails} thumbnail(s) faltando. Considere regenerar.`,
    });
  }

  if (report.corruptedMetadata > 0) {
    recommendations.push({
      priority: "HIGH",
      message: `${report.corruptedMetadata} entrada(s) de metadados corrompida(s). Verifique manualmente.`,
    });
  }

  const highSeverityIssues = report.issues.filter(
    (i) => i.severity === "HIGH"
  );
  if (highSeverityIssues.length > 0) {
    recommendations.push({
      priority: "HIGH",
      message: `${highSeverityIssues.length} problema(s) de alta severidade encontrado(s).`,
    });
  }

  return recommendations;
}

module.exports = {
  checkLibraryIntegrity,
  repairLibrary,
  generateLibraryReport,
};
