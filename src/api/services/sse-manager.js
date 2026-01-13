/**
 * SSE Manager - Gerencia conexões Server-Sent Events
 * Permite enviar progresso em tempo real ao cliente
 */

class SSEManager {
  constructor() {
    // { taskId: Set[response] }
    this.subscribers = new Map();
  }

  /**
   * Registrar um cliente para receber atualizações de uma tarefa
   */
  subscribe(taskId, response) {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }

    this.subscribers.get(taskId).add(response);
    console.log(`[SSE] Client subscribed to task ${taskId}. Total subscribers: ${this.subscribers.get(taskId).size}`);

    // Enviar headers SSE (usar setHeader se headers ainda não foram enviados)
    if (!response.headersSent) {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no' // Desabilitar buffering do nginx se houver
      });
    } else {
      // Se headers já foram enviados, apenas definir os necessários
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
    }

    // Enviar comment para manter conexão viva
    response.write(': SSE connection established\n\n');

    // Quando cliente desconectar, remover da lista
    response.on('close', () => {
      this.unsubscribe(taskId, response);
    });

    response.on('error', (err) => {
      console.error(`[SSE] Error on task ${taskId}:`, err.message);
      this.unsubscribe(taskId, response);
    });
  }

  /**
   * Remover cliente de uma tarefa
   */
  unsubscribe(taskId, response) {
    const subscribers = this.subscribers.get(taskId);
    
    if (subscribers) {
      subscribers.delete(response);
      console.log(`[SSE] Client unsubscribed from task ${taskId}. Remaining: ${subscribers.size}`);

      // Se não houver mais subscribers, remover a entrada
      if (subscribers.size === 0) {
        this.subscribers.delete(taskId);
      }
    }
  }

  /**
   * Enviar atualização de progresso para todos os subscribers
   */
  broadcast(taskId, data) {
    const subscribers = this.subscribers.get(taskId);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const eventData = typeof data === 'string' ? data : JSON.stringify(data);
    const message = `data: ${eventData}\n\n`;

    let failedResponses = [];

    for (const response of subscribers) {
      try {
        response.write(message);
      } catch (error) {
        console.error(`[SSE] Error sending to subscriber:`, error.message);
        failedResponses.push(response);
      }
    }

    // Remover responses que falharam
    failedResponses.forEach(response => {
      this.unsubscribe(taskId, response);
    });
  }

  /**
   * Enviar um evento específico
   */
  sendEvent(taskId, eventName, data) {
    const subscribers = this.subscribers.get(taskId);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const eventData = typeof data === 'string' ? data : JSON.stringify(data);
    const message = `event: ${eventName}\ndata: ${eventData}\n\n`;

    let failedResponses = [];

    for (const response of subscribers) {
      try {
        response.write(message);
      } catch (error) {
        console.error(`[SSE] Error sending event to subscriber:`, error.message);
        failedResponses.push(response);
      }
    }

    // Remover responses que falharam
    failedResponses.forEach(response => {
      this.unsubscribe(taskId, response);
    });
  }

  /**
   * Fechar conexão de um cliente
   */
  closeSubscriber(taskId, response) {
    try {
      response.end();
      this.unsubscribe(taskId, response);
    } catch (error) {
      console.error(`[SSE] Error closing connection:`, error.message);
    }
  }

  /**
   * Fechar todas as conexões de uma tarefa
   */
  closeAllSubscribers(taskId) {
    const subscribers = this.subscribers.get(taskId);

    if (!subscribers) {
      return;
    }

    for (const response of subscribers) {
      try {
        response.end();
      } catch (error) {
        console.error(`[SSE] Error closing connection:`, error.message);
      }
    }

    this.subscribers.delete(taskId);
    console.log(`[SSE] Closed all connections for task ${taskId}`);
  }

  /**
   * Obter número de subscribers ativos
   */
  getSubscriberCount(taskId) {
    return this.subscribers.get(taskId)?.size || 0;
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    let totalSubscribers = 0;
    const taskIds = [];

    for (const [taskId, subscribers] of this.subscribers.entries()) {
      taskIds.push(taskId);
      totalSubscribers += subscribers.size;
    }

    return {
      activeTasks: taskIds.length,
      totalSubscribers,
      taskIds
    };
  }
}

module.exports = SSEManager;
