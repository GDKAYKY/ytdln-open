/**
 * Parser para extrair informações de progresso da saída do yt-dlp
 * 
 * Exemplos de output do yt-dlp com --progress --newline:
 * [download]   1.5% of ~123.45MiB at  5.23MiB/s ETA 00:23
 * [download]  10.0% of 1.23GiB at 10.50MiB/s ETA 02:15
 * [Merger] Merging formats into "filename.mp4"
 * [download] 100% of 123.45MiB in 00:24
 */

class ProgressParser {
  /**
   * Parsear uma linha de progresso do yt-dlp
   * @param {string} line - Uma linha de output do yt-dlp
   * @returns {object|null} Objeto com {percent, total, downloaded, speed, eta} ou null
   */
  static parseProgressLine(line) {
    if (!line || typeof line !== 'string') {
      return null;
    }

    // Padrão: [download]   1.5% of ~123.45MiB at  5.23MiB/s ETA 00:23
    const progressPattern = /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+([\d:]+)/i;
    const match = line.match(progressPattern);

    if (match) {
      return {
        percent: parseFloat(match[1]),
        total: match[2],
        speed: match[3],
        eta: match[4],
        timestamp: new Date().toISOString()
      };
    }

    // Padrão alternativo: [download] 100% of 123.45MiB in 00:24
    const completePattern = /\[download\]\s+(100)%\s+of\s+([\d.]+\w+)\s+in\s+([\d:]+)/i;
    const completeMatch = line.match(completePattern);

    if (completeMatch) {
      return {
        percent: 100,
        total: completeMatch[2],
        speed: '0 B/s',
        eta: '00:00',
        timestamp: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * Manter estado de progresso e evitar atualizações redundantes
   */
  constructor() {
    this.lastProgress = {
      percent: 0,
      total: null,
      speed: null,
      eta: null
    };
    this.progressHistory = [];
  }

  /**
   * Processar uma linha e retornar progresso normalizado
   * @param {string} line - Linha de output do yt-dlp
   * @returns {object|null} Objeto com progresso normalizado ou null
   */
  processLine(line) {
    const parsed = ProgressParser.parseProgressLine(line);

    if (!parsed) {
      return null;
    }

    // Atualizar o estado
    this.lastProgress = {
      percent: parsed.percent,
      total: parsed.total,
      speed: parsed.speed,
      eta: parsed.eta
    };

    // Manter histórico (últimas 100 atualizações)
    this.progressHistory.push({
      ...this.lastProgress,
      timestamp: parsed.timestamp
    });

    if (this.progressHistory.length > 100) {
      this.progressHistory.shift();
    }

    return this.lastProgress;
  }

  /**
   * Obter progresso atual
   */
  getLastProgress() {
    return { ...this.lastProgress };
  }

  /**
   * Resetar parser
   */
  reset() {
    this.lastProgress = {
      percent: 0,
      total: null,
      speed: null,
      eta: null
    };
    this.progressHistory = [];
  }
}

module.exports = ProgressParser;
