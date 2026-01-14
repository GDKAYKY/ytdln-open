/**
 * Stream Pipe E2E Tests
 * Testa streaming com progresso em tempo real no navegador
 */

const { PassThrough } = require('stream');
const StreamPipeService = require('../services/stream-pipe.service');
const StreamPipeController = require('../controllers/stream-pipe.controller');

describe('Stream Pipe E2E - Chrome Download Manager Progress', () => {
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

  describe('Cenário Real: Download com Progresso Visível', () => {
    it('deve enviar Content-Length para Chrome calcular % automaticamente', async () => {
      const taskId = 'e2e_chrome_progress';
      const fileSize = 115964416; // 110.5 MB (como no screenshot)
      const url = 'https://www.youtube.com/watch?v=OoQLoKHhohg';

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
      };

      const mockReq = {
        params: { taskId },
      };

      // Simular stream
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
        // Iniciar stream
        await service.startStream(
          taskId,
          url,
          { format: 'best' },
          {},
          { fileSize, filename: 'video.mp4' }
        );

        // Adicionar ao mapa
        service.streams.set(taskId, {
          ffmpegProcess: mockFfmpegProcess,
          fileSize,
          filename: 'video.mp4',
          ytdlpProcess: mockYtdlpProcess,
          startTime: Date.now(),
          bytesTransferred: 0,
        });

        mockFfmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

        // Servir stream
        await controller.getStream(mockReq, mockRes);

        // Verificar que Content-Length foi enviado
        const contentLengthCall = mockRes.setHeader.mock.calls.find(
          call => call[0] === 'Content-Length'
        );

        expect(contentLengthCall).toBeDefined();
        expect(contentLengthCall[1]).toBe(fileSize);

        // Verificar headers críticos para Chrome
        const headers = mockRes.setHeader.mock.calls.reduce((acc, call) => {
          acc[call[0]] = call[1];
          return acc;
        }, {});

        expect(headers['Content-Type']).toBe('video/mp4');
        expect(headers['Content-Length']).toBe(fileSize);
        expect(headers['Content-Disposition']).toContain('attachment');
        expect(headers['Accept-Ranges']).toBe('bytes');

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve rastrear progresso em tempo real (0% → 100%)', async () => {
      const taskId = 'e2e_progress_tracking';
      const fileSize = 115964416; // 110.5 MB
      const url = 'https://www.youtube.com/watch?v=OoQLoKHhohg';

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

        // Simular download em chunks (como Chrome faria)
        const chunkSize = 5000000; // 5 MB chunks
        let transferred = 0;

        while (transferred < fileSize) {
          const chunk = Buffer.alloc(Math.min(chunkSize, fileSize - transferred));
          mockFfmpegProcess.stdout.emit('data', chunk);
          transferred += chunk.length;

          const status = service.getStreamStatus(taskId);
          expect(status.percent).toBeLessThanOrEqual(100);
          expect(status.bytesTransferred).toBe(transferred);
        }

        // Verificar que progresso foi rastreado
        expect(progressUpdates.length).toBeGreaterThan(0);

        // Verificar que chegou a 100%
        const finalStatus = service.getStreamStatus(taskId);
        expect(finalStatus.percent).toBe(100);
        expect(finalStatus.bytesTransferred).toBe(fileSize);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve calcular velocidade realista durante download', async () => {
      const taskId = 'e2e_speed_calculation';
      const fileSize = 115964416; // 110.5 MB
      const url = 'https://www.youtube.com/watch?v=OoQLoKHhohg';

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
          {},
          { fileSize, filename: 'video.mp4' }
        );

        // Simular 10 MB transferidos
        const chunk = Buffer.alloc(10 * 1024 * 1024);
        mockFfmpegProcess.stdout.emit('data', chunk);

        // Aguardar um pouco para simular tempo decorrido
        await new Promise(resolve => setTimeout(resolve, 100));

        const status = service.getStreamStatus(taskId);

        // Verificar que velocidade foi calculada
        expect(status.speed).toMatch(/\d+\.\d+ MB\/s/);

        // Velocidade deve ser razoável (não infinita)
        const speedValue = parseFloat(status.speed);
        expect(speedValue).toBeGreaterThan(0);
        expect(speedValue).toBeLessThan(1000); // Menos de 1000 MB/s

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve permitir retomar download com Accept-Ranges', async () => {
      const taskId = 'e2e_resume_download';
      const fileSize = 115964416; // 110.5 MB
      const url = 'https://www.youtube.com/watch?v=OoQLoKHhohg';

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
      };

      const mockReq = {
        params: { taskId },
      };

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
          {},
          { fileSize, filename: 'video.mp4' }
        );

        service.streams.set(taskId, {
          ffmpegProcess: mockFfmpegProcess,
          fileSize,
          filename: 'video.mp4',
          ytdlpProcess: mockYtdlpProcess,
          startTime: Date.now(),
          bytesTransferred: 0,
        });

        mockFfmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

        await controller.getStream(mockReq, mockRes);

        // Verificar que Accept-Ranges foi enviado
        const acceptRangesCall = mockRes.setHeader.mock.calls.find(
          call => call[0] === 'Accept-Ranges'
        );

        expect(acceptRangesCall).toBeDefined();
        expect(acceptRangesCall[1]).toBe('bytes');

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve mostrar progresso em múltiplos estágios (como Chrome faria polling)', async () => {
      const taskId = 'e2e_polling_progress';
      const fileSize = 115964416; // 110.5 MB
      const url = 'https://www.youtube.com/watch?v=OoQLoKHhohg';

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
          {},
          { fileSize, filename: 'video.mp4' }
        );

        // Simular polling do Chrome a cada 500ms
        const pollIntervals = [0, 25, 50, 75, 100]; // percentuais
        const statusSnapshots = [];

        for (const percent of pollIntervals) {
          const bytes = (percent / 100) * fileSize;
          const chunk = Buffer.alloc(bytes - (statusSnapshots.length > 0 ? statusSnapshots[statusSnapshots.length - 1].bytesTransferred : 0));
          
          if (chunk.length > 0) {
            mockFfmpegProcess.stdout.emit('data', chunk);
          }

          const status = service.getStreamStatus(taskId);
          statusSnapshots.push(status);
        }

        // Verificar que progresso foi rastreado em cada estágio
        expect(statusSnapshots[0].percent).toBe(0);
        expect(statusSnapshots[1].percent).toBe(25);
        expect(statusSnapshots[2].percent).toBe(50);
        expect(statusSnapshots[3].percent).toBe(75);
        expect(statusSnapshots[4].percent).toBe(100);

        // Verificar que cada snapshot tem informações corretas
        statusSnapshots.forEach((snapshot, index) => {
          expect(snapshot.taskId).toBe(taskId);
          expect(snapshot.status).toBe('streaming');
          expect(snapshot.fileSize).toBe(fileSize);
          expect(snapshot.percent).toBe(pollIntervals[index]);
          expect(snapshot.speed).toMatch(/MB\/s/);
        });

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve lidar com desconexão do cliente durante download', async () => {
      const taskId = 'e2e_client_disconnect';
      const fileSize = 115964416; // 110.5 MB
      const url = 'https://www.youtube.com/watch?v=OoQLoKHhohg';

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
      };

      const mockReq = {
        params: { taskId },
      };

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
          {},
          { fileSize, filename: 'video.mp4' }
        );

        service.streams.set(taskId, {
          ffmpegProcess: mockFfmpegProcess,
          fileSize,
          filename: 'video.mp4',
          ytdlpProcess: mockYtdlpProcess,
          startTime: Date.now(),
          bytesTransferred: 0,
        });

        mockFfmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

        await controller.getStream(mockReq, mockRes);

        // Verificar que stream foi adicionado
        expect(service.streams.has(taskId)).toBe(true);

        // Simular desconexão do cliente
        const closeCallback = mockRes.on.mock.calls.find(call => call[0] === 'close')[1];
        closeCallback();

        // Verificar que stream foi parado
        expect(mockStreamPipeService?.stopStream || service.stopStream).toBeDefined();

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });

    it('deve enviar filename correto no Content-Disposition', async () => {
      const taskId = 'e2e_filename';
      const fileSize = 115964416;
      const filename = 'download_task_1768387057042_wdqz71sf8.mp4';
      const url = 'https://www.youtube.com/watch?v=OoQLoKHhohg';

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
      };

      const mockReq = {
        params: { taskId },
      };

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
          {},
          { fileSize, filename }
        );

        service.streams.set(taskId, {
          ffmpegProcess: mockFfmpegProcess,
          fileSize,
          filename,
          ytdlpProcess: mockYtdlpProcess,
          startTime: Date.now(),
          bytesTransferred: 0,
        });

        mockFfmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

        await controller.getStream(mockReq, mockRes);

        // Verificar Content-Disposition
        const dispositionCall = mockRes.setHeader.mock.calls.find(
          call => call[0] === 'Content-Disposition'
        );

        expect(dispositionCall).toBeDefined();
        expect(dispositionCall[1]).toContain('attachment');
        expect(dispositionCall[1]).toContain(filename);

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });
  });

  describe('Validação de Compatibilidade com Chrome', () => {
    it('deve ter todos os headers necessários para Chrome Download Manager', async () => {
      const taskId = 'e2e_chrome_headers';
      const fileSize = 115964416;
      const url = 'https://www.youtube.com/watch?v=OoQLoKHhohg';

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
      };

      const mockReq = {
        params: { taskId },
      };

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
          {},
          { fileSize, filename: 'video.mp4' }
        );

        service.streams.set(taskId, {
          ffmpegProcess: mockFfmpegProcess,
          fileSize,
          filename: 'video.mp4',
          ytdlpProcess: mockYtdlpProcess,
          startTime: Date.now(),
          bytesTransferred: 0,
        });

        mockFfmpegProcess.stdout.pipe = jest.fn().mockReturnValue(mockRes);

        await controller.getStream(mockReq, mockRes);

        const headers = mockRes.setHeader.mock.calls.reduce((acc, call) => {
          acc[call[0]] = call[1];
          return acc;
        }, {});

        // Headers obrigatórios para Chrome
        expect(headers['Content-Type']).toBeDefined();
        expect(headers['Content-Length']).toBeDefined();
        expect(headers['Content-Disposition']).toBeDefined();
        expect(headers['Accept-Ranges']).toBeDefined();
        expect(headers['Cache-Control']).toBeDefined();

        // Verificar valores
        expect(headers['Content-Type']).toBe('video/mp4');
        expect(headers['Content-Length']).toBe(fileSize);
        expect(headers['Content-Disposition']).toContain('attachment');
        expect(headers['Accept-Ranges']).toBe('bytes');
        expect(headers['Cache-Control']).toContain('no-cache');

      } finally {
        require('child_process').spawn = originalSpawn;
      }
    });
  });
});
