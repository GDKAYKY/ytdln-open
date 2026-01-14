/**
 * Stream Client - MediaSource API client para streaming
 * 
 * Responsabilidade:
 * - Criar MediaSource
 * - Fetch do endpoint de stream
 * - Alimentar SourceBuffer incrementalmente
 * - Gerenciar ciclo de vida do stream
 */

/**
 * Reproduzir stream de mídia usando MediaSource API
 * 
 * @param {string} streamUrl - URL do endpoint de stream (/api/stream/:taskId)
 * @param {HTMLVideoElement} videoElement - Elemento <video> para reprodução
 * @param {object} options - Opções { onError, onProgress, onEnd }
 * @returns {Promise<void>}
 */
async function playStream(streamUrl, videoElement, options = {}) {
  const { onError, onProgress, onEnd } = options;

  try {
    // Criar MediaSource
    const ms = new MediaSource();
    const objectUrl = URL.createObjectURL(ms);
    videoElement.src = objectUrl;

    // Aguardar sourceopen
    await new Promise((resolve, reject) => {
      ms.addEventListener("sourceopen", resolve, { once: true });
      ms.addEventListener("sourceended", () => reject(new Error("MediaSource ended before opening")), { once: true });
    });

    // Criar SourceBuffer
    // Codecs padrão: H.264 video + AAC audio
    // TODO: Detectar codecs do backend ou usar codec detection
    const mimeType = 'video/mp4; codecs="avc1.64001f, mp4a.40.2"';
    let sb;
    
    try {
      sb = ms.addSourceBuffer(mimeType);
    } catch (err) {
      // Fallback: tentar codecs alternativos
      console.warn("[StreamClient] Codec não suportado, tentando alternativos:", err);
      const fallbackMimeTypes = [
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4; codecs="avc1.640028, mp4a.40.2"',
        'video/mp4'
      ];
      
      let success = false;
      for (const mime of fallbackMimeTypes) {
        try {
          sb = ms.addSourceBuffer(mime);
          success = true;
          break;
        } catch (e) {
          // Tentar próximo
        }
      }
      
      if (!success) {
        throw new Error("Nenhum codec suportado");
      }
    }

    // Fetch do stream
    const response = await fetch(streamUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Response body não está disponível (ReadableStream não suportado)");
    }

    const reader = response.body.getReader();

    // Helper: aguardar SourceBuffer estar pronto
    const waitForSourceBuffer = () => {
      return new Promise((resolve) => {
        if (sb.updating) {
          sb.addEventListener("updateend", resolve, { once: true });
        } else {
          resolve();
        }
      });
    };

    // Ler chunks e anexar ao SourceBuffer
    while (true) {
      const { value, done } = await reader.read();
      
      if (done) {
        break;
      }

      // Aguardar SourceBuffer estar pronto
      await waitForSourceBuffer();

      // Verificar se MediaSource ainda está aberto
      if (ms.readyState !== "open") {
        throw new Error("MediaSource foi fechado");
      }

      // Anexar chunk ao SourceBuffer
      try {
        sb.appendBuffer(value);
      } catch (err) {
        // SourceBuffer pode estar cheio, aguardar
        await waitForSourceBuffer();
        sb.appendBuffer(value);
      }

      // Callback de progresso (opcional)
      if (onProgress) {
        onProgress({ bytesAppended: value.length });
      }
    }

    // Aguardar último append completar
    await waitForSourceBuffer();

    // Finalizar stream
    if (ms.readyState === "open") {
      ms.endOfStream();
    }

    // Cleanup
    URL.revokeObjectURL(objectUrl);

    if (onEnd) {
      onEnd();
    }

  } catch (error) {
    console.error("[StreamClient] Erro no stream:", error);
    
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
  }
}

/**
 * Obter status do stream (progresso)
 * 
 * @param {string} statusUrl - URL do endpoint de status (/api/stream/:taskId/status)
 * @returns {Promise<object>} Status do stream
 */
async function getStreamStatus(statusUrl) {
  const response = await fetch(statusUrl);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Parar stream (sinaliza para o servidor parar)
 * 
 * @param {string} stopUrl - URL do endpoint de stop (/api/stream/:taskId/stop)
 * @returns {Promise<void>}
 */
async function stopStream(stopUrl) {
  const response = await fetch(stopUrl, {
    method: "POST"
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// Exportar para uso em outros módulos
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    playStream,
    getStreamStatus,
    stopStream
  };
}

// Expor globalmente para uso em scripts de página
if (typeof window !== "undefined") {
  window.StreamClient = {
    playStream,
    getStreamStatus,
    stopStream
  };
}
