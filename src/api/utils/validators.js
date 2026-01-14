/**
 * Validadores - Funções para validar entrada
 */

/**
 * Validar requisição de download
 */
function validateDownloadRequest(data) {
  if (!data.url) {
    return {
      valid: false,
      error: 'URL é obrigatória',
      code: 'MISSING_URL'
    };
  }

  // Validar formato de URL
  try {
    new URL(data.url);
  } catch (error) {
    return {
      valid: false,
      error: 'URL inválida',
      code: 'INVALID_URL'
    };
  }

  // Validar format
  const validFormats = ['best', 'worst', 'audio', 'video', '360p', '480p', '720p', '1080p', '2160p'];
  if (data.format && !validFormats.includes(data.format)) {
    return {
      valid: false,
      error: `Formato inválido. Válidos: ${validFormats.join(', ')}`,
      code: 'INVALID_FORMAT'
    };
  }

  return { valid: true };
}

/**
 * Validar taskId
 * Aceita taskIds que começam com "task_" (downloads) ou "stream_" (streams)
 */
function validateTaskId(taskId) {
  if (!taskId) {
    return {
      valid: false,
      error: 'taskId é obrigatório',
      code: 'MISSING_TASK_ID'
    };
  }

  // Deve começar com "task_" ou "stream_"
  if (!taskId.startsWith('task_') && !taskId.startsWith('stream_')) {
    return {
      valid: false,
      error: 'taskId inválido. Deve começar com "task_" ou "stream_"',
      code: 'INVALID_TASK_ID'
    };
  }

  // Validar formato básico (deve ter pelo menos 10 caracteres)
  if (taskId.length < 10) {
    return {
      valid: false,
      error: 'taskId muito curto',
      code: 'INVALID_TASK_ID'
    };
  }

  return { valid: true };
}

module.exports = {
  validateDownloadRequest,
  validateTaskId
};
