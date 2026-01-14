/**
 * Stream Pipe Integration Tests
 * Testa o fluxo completo de streaming com progresso
 */

const { PassThrough } = require('stream');
const StreamPipeService = require('../services/stream-pipe.service');
const StreamPipeController = require('../controllers/stream-pipe.controller');

describe('Stream Pipe Integration Tests', () => {
  let service;
  let controller;
  let mockBinaries;

  beforeEach(() => {
    mockBinaries = {
      ytdlp: 'yt-dlp',
      ffmpeg: 'ffmpeg',
      ffprobe: 'ffprobe',
    };
    service = new StreamPipeService(mockBinaries);
    controller = new StreamPipeController(service);
  });

  describe('Fluxo Completo: Iniciar → Monitorar → Parar', () => {
    it('deve completar fluxo de streaming com sucesso', async () => {
      const taskId = 'integration_test_123';
      const url = 'https://example.com/video.mp4';
      const fileSize = 1000000;

      // 1. Obter tamanho do arquivo
      const size = await service.getFileSize(url, { format: 'best' });
      expect(typeof size).toBe('number');

      // 2. Iniciar stream
      const progressUpdates = [];
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      // Mock dos processos
      const mockYtdlpProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockYtdlpProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockFfmpegProcess = {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockFfmpegProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      // Substituir spawn
      const originalSpawn = require('child_process').spawn;
      require('child_process').spawn = jest.fn()
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      try {
        const stream = await service.startStream(
          taskId,
          url,
          { format: 'best' },
          { onProgress },
          { fileSize, filename: 'video.mp4' }
        );

        expect(stream).toBe(mockFfmpegProcess.stdout);
        expect(service.streams.has(taskId)).toBe(true);

        // 3. Simular transferência de dados
        const chunk1 = Buffer.alloc(250000);
        const chunk2 = Buffer.alloc(250000);
        const chunk3 = Buffer.alloc(250000);
        const chunk4 = Buffer.alloc(250000);

        mockFfmpegProcess.stdout.emit('data', chunk1);
        mockFfmpegProcess.stdout.emit('data', chunk2);
        mockFfmpegProcess.stdout.emit('data', chunk3);
        mockFfmpegProcess.stdout.emit('data', chunk4);

        // 4. Verificar progresso
        let status = service.getStreamStatus(taskId);
        expect(status.percent).toBe(100);
        expect(status.bytesTransferred).toBe(1000000);

        // 5. Parar stream
        service.stopStream(taskId);
        expect(service.streams.has(taskId)).toBe(false);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve rastrear progresso em múltiplos estágios', async () => {
      const taskId = 'progress_tracking_test';
      const url = 'https://example.com/video.mp4';
      const fileSize = 1000000;

      const progressUpdates = [];
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress);
      });

      const mockYtdlpProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockYtdlpProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockFfmpegProcess = {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockFfmpegProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const originalSpawn = require('child_process').spawn;
      require('child_process').spawn = jest.fn()
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      try {
        await service.startStream(
          taskId,
          url,
          { format: 'best' },
          { onProgress },
          { fileSize, filename: 'video.mp4' }
        );

        // Simular progresso em 4 estágios
        const stages = [25, 50, 75, 100];
        stages.forEach((percent) => {
          const bytes = (percent / 100) * fileSize;
          const chunk = Buffer.alloc(bytes - (progressUpdates.length > 0 ? progressUpdates[progressUpdates.length - 1].bytesTransferred : 0));
          mockFfmpegProcess.stdout.emit('data', chunk);

          const status = service.getStreamStatus(taskId);
          expect(status.percent).toBe(percent);
        });

        // Verificar que progresso foi rastreado
        expect(onProgress.mock.calls.length).toBeGreaterThan(0);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });
  });

  describe('Cenários de Erro', () => {
    it('deve recuperar de erro de yt-dlp', async () => {
      const taskId = 'error_recovery_test';
      const url = 'https://example.com/video.mp4';

      const onError = jest.fn();

      const mockYtdlpProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('yt-dlp failed')), 10);
          }
          return mockYtdlpProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockFfmpegProcess = {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn(),
        kill: jest.fn(),
        killed: false,
      };

      const originalSpawn = require('child_process').spawn;
      require('child_process').spawn = jest.fn()
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      try {
        await service.startStream(taskId, url, {}, { onError }, {});

        // Simular erro
        const error = new Error('yt-dlp failed');
        mockYtdlpProcess.emit('error', error);

        expect(onError).toHaveBeenCalledWith(error);
        expect(service.streams.has(taskId)).toBe(false);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve limpar recursos em caso de erro', async () => {
      const taskId = 'cleanup_test';
      const url = 'https://example.com/video.mp4';

      const mockYtdlpProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Process error')), 10);
          }
          return mockYtdlpProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockFfmpegProcess = {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn(),
        kill: jest.fn(),
        killed: false,
      };

      const originalSpawn = require('child_process').spawn;
      require('child_process').spawn = jest.fn()
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      try {
        await service.startStream(taskId, url, {}, {}, {});

        expect(service.streams.has(taskId)).toBe(true);

        // Simular erro
        mockYtdlpProcess.emit('error', new Error('Process error'));

        expect(service.streams.has(taskId)).toBe(false);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });
  });

  describe('Validação de Headers HTTP', () => {
    it('deve enviar Content-Length correto', async () => {
      const taskId = 'headers_test';
      const fileSize = 1234567890;

      const mockYtdlpProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockYtdlpProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockFfmpegProcess = {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockFfmpegProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const originalSpawn = require('child_process').spawn;
      require('child_process').spawn = jest.fn()
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      try {
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          setHeader: jest.fn().mockReturnThis(),
          on: jest.fn().mockReturnThis(),
        };

        const mockReq = {
          body: { url: 'https://example.com/video.mp4' },
          params: { taskId },
        };

        // Simular getFileSize
        service.getFileSize = jest.fn().mockResolvedValue(fileSize);

        // Iniciar stream
        await controller.createStream(mockReq, mockRes);

        // Adicionar stream ao mapa
        service.streams.set(taskId, {
          ffmpegProcess: mockFfmpegProcess,
          fileSize,
          filename: 'video.mp4',
        });

        // Servir stream
        mockReq.params = { taskId };
        mockFfmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

        await controller.getStream(mockReq, mockRes);

        // Verificar headers
        const setHeaderCalls = mockRes.setHeader.mock.calls;
        const contentLengthCall = setHeaderCalls.find(call => call[0] === 'Content-Length');

        expect(contentLengthCall).toBeDefined();
        expect(contentLengthCall[1]).toBe(fileSize);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve enviar Content-Disposition correto', async () => {
      const taskId = 'disposition_test';
      const filename = 'my_video.mp4';

      const mockYtdlpProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockYtdlpProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockFfmpegProcess = {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockFfmpegProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const originalSpawn = require('child_process').spawn;
      require('child_process').spawn = jest.fn()
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      try {
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          setHeader: jest.fn().mockReturnThis(),
          on: jest.fn().mockReturnThis(),
        };

        // Adicionar stream ao mapa
        service.streams.set(taskId, {
          ffmpegProcess: mockFfmpegProcess,
          fileSize: 1000000,
          filename,
        });

        const mockReq = {
          params: { taskId },
        };

        mockFfmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

        await controller.getStream(mockReq, mockRes);

        // Verificar Content-Disposition
        const setHeaderCalls = mockRes.setHeader.mock.calls;
        const dispositionCall = setHeaderCalls.find(call => call[0] === 'Content-Disposition');

        expect(dispositionCall).toBeDefined();
        expect(dispositionCall[1]).toContain('attachment');
        expect(dispositionCall[1]).toContain(filename);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });
  });

  describe('Múltiplos Streams Simultâneos', () => {
    it('deve gerenciar múltiplos streams independentemente', async () => {
      const taskId1 = 'stream_1';
      const taskId2 = 'stream_2';
      const fileSize = 1000000;

      const mockYtdlpProcess1 = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockYtdlpProcess1;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockFfmpegProcess1 = {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockFfmpegProcess1;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockYtdlpProcess2 = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockYtdlpProcess2;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const mockFfmpegProcess2 = {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 100);
          }
          return mockFfmpegProcess2;
        }),
        kill: jest.fn(),
        killed: false,
      };

      const originalSpawn = require('child_process').spawn;
      require('child_process').spawn = jest.fn()
        .mockReturnValueOnce(mockYtdlpProcess1)
        .mockReturnValueOnce(mockFfmpegProcess1)
        .mockReturnValueOnce(mockYtdlpProcess2)
        .mockReturnValueOnce(mockFfmpegProcess2);

      try {
        // Iniciar dois streams
        await service.startStream(taskId1, 'https://example.com/video1.mp4', {}, {}, { fileSize });
        await service.startStream(taskId2, 'https://example.com/video2.mp4', {}, {}, { fileSize });

        expect(service.streams.size).toBe(2);

        // Simular progresso independente
        mockFfmpegProcess1.stdout.emit('data', Buffer.alloc(250000));
        mockFfmpegProcess2.stdout.emit('data', Buffer.alloc(500000));

        const status1 = service.getStreamStatus(taskId1);
        const status2 = service.getStreamStatus(taskId2);

        expect(status1.percent).toBe(25);
        expect(status2.percent).toBe(50);

        // Parar um stream
        service.stopStream(taskId1);
        expect(service.streams.size).toBe(1);
        expect(service.streams.has(taskId2)).toBe(true);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });
  });
});
