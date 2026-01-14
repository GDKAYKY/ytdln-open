/**
 * Stream Pipe Controller Tests
 * Testa endpoints de streaming com progresso
 */

const StreamPipeController = require('../stream-pipe.controller');

describe('StreamPipeController', () => {
  let controller;
  let mockStreamPipeService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Mock do serviço
    mockStreamPipeService = {
      getFileSize: jest.fn(),
      startStream: jest.fn(),
      stopStream: jest.fn(),
      getStreamStatus: jest.fn(),
      streams: new Map(),
    };

    controller = new StreamPipeController(mockStreamPipeService);

    // Mock do request
    mockReq = {
      body: {},
      params: {},
    };

    // Mock do response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
    };
  });

  describe('createStream', () => {
    it('deve retornar erro 400 se URL não for fornecida', async () => {
      mockReq.body = { format: 'best' };

      await controller.createStream(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'URL é obrigatória',
          code: 'MISSING_URL',
        })
      );
    });

    it('deve obter tamanho do arquivo e iniciar stream', async () => {
      const url = 'https://example.com/video.mp4';
      const fileSize = 1234567890;

      mockReq.body = { url, format: 'best', audioOnly: false };
      mockStreamPipeService.getFileSize.mockResolvedValue(fileSize);
      mockStreamPipeService.startStream.mockResolvedValue({});

      await controller.createStream(mockReq, mockRes);

      expect(mockStreamPipeService.getFileSize).toHaveBeenCalledWith(url, {
        format: 'best',
        audioOnly: false,
      });

      expect(mockStreamPipeService.startStream).toHaveBeenCalled();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'streaming',
          fileSize,
          message: 'Stream iniciado',
        })
      );
    });

    it('deve retornar taskId e URLs corretas', async () => {
      const url = 'https://example.com/video.mp4';

      mockReq.body = { url };
      mockStreamPipeService.getFileSize.mockResolvedValue(1000000);
      mockStreamPipeService.startStream.mockResolvedValue({});

      await controller.createStream(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];

      expect(response.taskId).toMatch(/^stream_\d+_[a-z0-9]+$/);
      expect(response.streamUrl).toMatch(/^\/api\/stream-pipe\/stream_\d+_[a-z0-9]+\/stream$/);
      expect(response.statusUrl).toMatch(/^\/api\/stream-pipe\/stream_\d+_[a-z0-9]+\/status$/);
    });

    it('deve usar valores padrão para format e audioOnly', async () => {
      const url = 'https://example.com/video.mp4';

      mockReq.body = { url };
      mockStreamPipeService.getFileSize.mockResolvedValue(1000000);
      mockStreamPipeService.startStream.mockResolvedValue({});

      await controller.createStream(mockReq, mockRes);

      expect(mockStreamPipeService.getFileSize).toHaveBeenCalledWith(url, {
        format: 'best',
        audioOnly: false,
      });
    });

    it('deve retornar erro 500 em caso de exceção', async () => {
      mockReq.body = { url: 'https://example.com/video.mp4' };
      mockStreamPipeService.getFileSize.mockRejectedValue(new Error('Test error'));

      await controller.createStream(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Erro ao iniciar stream',
          code: 'INTERNAL_ERROR',
        })
      );
    });
  });

  describe('getStream', () => {
    it('deve retornar erro 404 se stream não existir', async () => {
      mockReq.params = { taskId: 'nonexistent_task' };

      await controller.getStream(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Stream não encontrado',
          code: 'STREAM_NOT_FOUND',
        })
      );
    });

    it('deve enviar headers corretos para streaming', async () => {
      const taskId = 'test_task_123';
      const mockStream = {
        ffmpegProcess: {
          stdout: {
            pipe: jest.fn(),
          },
        },
        fileSize: 1234567890,
        filename: 'video.mp4',
      };

      mockStreamPipeService.streams.set(taskId, mockStream);
      mockReq.params = { taskId };

      // Mock do pipe
      mockStream.ffmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

      await controller.getStream(mockReq, mockRes);

      // Verificar headers
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="video.mp4"'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 1234567890);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-store, must-revalidate'
      );
    });

    it('deve usar Transfer-Encoding se fileSize for 0', async () => {
      const taskId = 'test_task_no_size';
      const mockStream = {
        ffmpegProcess: {
          stdout: {
            pipe: jest.fn(),
          },
        },
        fileSize: 0,
        filename: 'video.mp4',
      };

      mockStreamPipeService.streams.set(taskId, mockStream);
      mockReq.params = { taskId };

      mockStream.ffmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

      await controller.getStream(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
    });

    it('deve pipar FFmpeg stdout para response', async () => {
      const taskId = 'test_task_pipe';
      const mockStream = {
        ffmpegProcess: {
          stdout: {
            pipe: jest.fn(),
          },
        },
        fileSize: 1000000,
        filename: 'video.mp4',
      };

      mockStreamPipeService.streams.set(taskId, mockStream);
      mockReq.params = { taskId };

      mockStream.ffmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

      await controller.getStream(mockReq, mockRes);

      expect(mockStream.ffmpegProcess.stdout.pipe).toHaveBeenCalledWith(mockRes);
    });

    it('deve parar stream quando cliente desconectar', async () => {
      const taskId = 'test_task_disconnect';
      const mockStream = {
        ffmpegProcess: {
          stdout: {
            pipe: jest.fn(),
          },
        },
        fileSize: 1000000,
        filename: 'video.mp4',
      };

      mockStreamPipeService.streams.set(taskId, mockStream);
      mockReq.params = { taskId };

      mockStream.ffmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

      await controller.getStream(mockReq, mockRes);

      // Simular desconexão
      const closeCallback = mockRes.on.mock.calls.find(call => call[0] === 'close')[1];
      closeCallback();

      expect(mockStreamPipeService.stopStream).toHaveBeenCalledWith(taskId);
    });

    it('deve parar stream em caso de erro', async () => {
      const taskId = 'test_task_error';
      const mockStream = {
        ffmpegProcess: {
          stdout: {
            pipe: jest.fn(),
          },
        },
        fileSize: 1000000,
        filename: 'video.mp4',
      };

      mockStreamPipeService.streams.set(taskId, mockStream);
      mockReq.params = { taskId };

      mockStream.ffmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

      await controller.getStream(mockReq, mockRes);

      // Simular erro
      const errorCallback = mockRes.on.mock.calls.find(call => call[0] === 'error')[1];
      errorCallback(new Error('Stream error'));

      expect(mockStreamPipeService.stopStream).toHaveBeenCalledWith(taskId);
    });

    it('deve retornar erro 500 em caso de exceção', async () => {
      mockReq.params = { taskId: 'test_task' };
      mockStreamPipeService.streams.get = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await controller.getStream(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Erro ao servir stream',
          code: 'INTERNAL_ERROR',
        })
      );
    });
  });

  describe('getStreamStatus', () => {
    it('deve retornar status do stream', () => {
      const taskId = 'test_task_status';
      const status = {
        taskId,
        status: 'streaming',
        percent: 50,
        bytesTransferred: 500000,
        fileSize: 1000000,
        speed: '5.00 MB/s',
      };

      mockStreamPipeService.getStreamStatus.mockReturnValue(status);
      mockReq.params = { taskId };

      controller.getStreamStatus(mockReq, mockRes);

      expect(mockStreamPipeService.getStreamStatus).toHaveBeenCalledWith(taskId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(status);
    });

    it('deve retornar erro 404 se stream não existir', () => {
      mockStreamPipeService.getStreamStatus.mockReturnValue(null);
      mockReq.params = { taskId: 'nonexistent_task' };

      controller.getStreamStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Stream não encontrado',
          code: 'STREAM_NOT_FOUND',
        })
      );
    });

    it('deve retornar erro 500 em caso de exceção', () => {
      mockStreamPipeService.getStreamStatus.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      mockReq.params = { taskId: 'test_task' };

      controller.getStreamStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Erro ao obter status',
          code: 'INTERNAL_ERROR',
        })
      );
    });
  });

  describe('stopStream', () => {
    it('deve parar stream com sucesso', () => {
      const taskId = 'test_task_stop';
      mockReq.params = { taskId };

      controller.stopStream(mockReq, mockRes);

      expect(mockStreamPipeService.stopStream).toHaveBeenCalledWith(taskId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          status: 'stopped',
          message: 'Stream parado',
        })
      );
    });

    it('deve retornar erro 500 em caso de exceção', () => {
      mockStreamPipeService.stopStream.mockImplementation(() => {
        throw new Error('Stop error');
      });
      mockReq.params = { taskId: 'test_task' };

      controller.stopStream(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Erro ao parar stream',
          code: 'INTERNAL_ERROR',
        })
      );
    });
  });
});
