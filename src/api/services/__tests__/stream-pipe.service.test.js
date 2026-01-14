/**
 * Stream Pipe Service Tests
 * Testa streaming com progresso em tempo real
 */

const { spawn } = require('child_process');
const { Readable, PassThrough } = require('stream');
const StreamPipeService = require('../stream-pipe.service');

// Mock do spawn
jest.mock('child_process');

describe('StreamPipeService', () => {
  let service;
  let mockBinaries;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBinaries = {
      ytdlp: 'yt-dlp',
      ffmpeg: 'ffmpeg',
      ffprobe: 'ffprobe',
    };
    service = new StreamPipeService(mockBinaries);
  });

  describe('getFileSize', () => {
    it('deve obter tamanho do arquivo com sucesso', async () => {
      const mockProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
          return mockProcess;
        }),
        kill: jest.fn(),
      };

      spawn.mockReturnValue(mockProcess);

      const fileSize = 1234567890;
      const jsonData = JSON.stringify({ filesize: fileSize });

      // Simular resposta do yt-dlp
      setTimeout(() => {
        mockProcess.stdout.write(jsonData);
        mockProcess.stdout.end();
      }, 5);

      const result = await service.getFileSize('https://example.com/video.mp4', {
        format: 'best',
      });

      expect(result).toBe(fileSize);
    });

    it('deve retornar 0 se não conseguir parsear JSON', async () => {
      const mockProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
          return mockProcess;
        }),
        kill: jest.fn(),
      };

      spawn.mockReturnValue(mockProcess);

      setTimeout(() => {
        mockProcess.stdout.write('invalid json');
        mockProcess.stdout.end();
      }, 5);

      const result = await service.getFileSize('https://example.com/video.mp4', {
        format: 'best',
      });

      expect(result).toBe(0);
    });

    it('deve retornar 0 se processo falhar', async () => {
      const mockProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10); // Código de erro
          }
          return mockProcess;
        }),
        kill: jest.fn(),
      };

      spawn.mockReturnValue(mockProcess);

      const result = await service.getFileSize('https://example.com/video.mp4', {
        format: 'best',
      });

      expect(result).toBe(0);
    });

    it('deve usar filesize_approx se filesize não existir', async () => {
      const mockProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
          return mockProcess;
        }),
        kill: jest.fn(),
      };

      spawn.mockReturnValue(mockProcess);

      const fileSize = 9876543210;
      const jsonData = JSON.stringify({ filesize_approx: fileSize });

      setTimeout(() => {
        mockProcess.stdout.write(jsonData);
        mockProcess.stdout.end();
      }, 5);

      const result = await service.getFileSize('https://example.com/video.mp4', {
        format: 'best',
      });

      expect(result).toBe(fileSize);
    });

    it('deve fazer timeout após 35 segundos', async () => {
      const mockProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn(),
        kill: jest.fn(),
      };

      spawn.mockReturnValue(mockProcess);

      const promise = service.getFileSize('https://example.com/video.mp4', {
        format: 'best',
      });

      // Simular timeout
      jest.advanceTimersByTime(35000);

      const result = await promise;
      expect(result).toBe(0);
      expect(mockProcess.kill).toHaveBeenCalled();
    }, 40000);
  });

  describe('startStream', () => {
    it('deve iniciar stream com sucesso', async () => {
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

      spawn
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      const taskId = 'test_task_123';
      const url = 'https://example.com/video.mp4';
      const options = { format: 'best', audioOnly: false };
      const metadata = { fileSize: 1000000, filename: 'video.mp4' };

      const stream = await service.startStream(taskId, url, options, {}, metadata);

      expect(stream).toBe(mockFfmpegProcess.stdout);
      expect(service.streams.has(taskId)).toBe(true);

      const streamData = service.streams.get(taskId);
      expect(streamData.fileSize).toBe(1000000);
      expect(streamData.filename).toBe('video.mp4');
      expect(streamData.bytesTransferred).toBe(0);
    });

    it('deve rastrear bytes transferidos', async () => {
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

      spawn
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      const taskId = 'test_task_456';
      const url = 'https://example.com/video.mp4';
      const metadata = { fileSize: 1000000, filename: 'video.mp4' };
      const onProgress = jest.fn();

      await service.startStream(taskId, url, {}, { onProgress }, metadata);

      // Simular dados sendo transferidos
      const chunk1 = Buffer.alloc(100000);
      const chunk2 = Buffer.alloc(200000);

      mockFfmpegProcess.stdout.emit('data', chunk1);
      mockFfmpegProcess.stdout.emit('data', chunk2);

      const streamData = service.streams.get(taskId);
      expect(streamData.bytesTransferred).toBe(300000);

      // Verificar que onProgress foi chamado
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          percent: 30, // 300000 / 1000000 = 30%
          bytesTransferred: 300000,
          fileSize: 1000000,
        })
      );
    });

    it('deve calcular percentual corretamente', async () => {
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

      spawn
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      const taskId = 'test_task_percent';
      const url = 'https://example.com/video.mp4';
      const metadata = { fileSize: 1000000, filename: 'video.mp4' };
      const onProgress = jest.fn();

      await service.startStream(taskId, url, {}, { onProgress }, metadata);

      // Simular 50% transferido
      const chunk = Buffer.alloc(500000);
      mockFfmpegProcess.stdout.emit('data', chunk);

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          percent: 50,
        })
      );
    });

    it('deve chamar onError se yt-dlp falhar', async () => {
      const mockYtdlpProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('yt-dlp error')), 10);
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

      spawn
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      const taskId = 'test_task_error';
      const url = 'https://example.com/video.mp4';
      const onError = jest.fn();

      await service.startStream(taskId, url, {}, { onError }, {});

      // Simular erro
      const error = new Error('yt-dlp error');
      mockYtdlpProcess.emit('error', error);

      expect(onError).toHaveBeenCalledWith(error);
      expect(service.streams.has(taskId)).toBe(false);
    });

    it('deve limpar stream quando FFmpeg fecha', async () => {
      const mockYtdlpProcess = {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
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
            setTimeout(() => callback(0), 10);
          }
          return mockFfmpegProcess;
        }),
        kill: jest.fn(),
        killed: false,
      };

      spawn
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      const taskId = 'test_task_cleanup';
      const url = 'https://example.com/video.mp4';

      await service.startStream(taskId, url, {}, {}, {});

      expect(service.streams.has(taskId)).toBe(true);

      // Simular fechamento do FFmpeg
      mockFfmpegProcess.emit('close', 0);

      // Aguardar limpeza
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(service.streams.has(taskId)).toBe(false);
    });
  });

  describe('calculateSpeed', () => {
    it('deve calcular velocidade corretamente', () => {
      const stream = {
        startTime: Date.now() - 10000, // 10 segundos atrás
        bytesTransferred: 10 * 1024 * 1024, // 10 MB
      };

      const speed = service.calculateSpeed(stream);

      expect(speed).toMatch(/\d+\.\d+ MB\/s/);
      expect(parseFloat(speed)).toBeCloseTo(1, 0); // ~1 MB/s
    });

    it('deve retornar 0 MB/s se tempo < 1 segundo', () => {
      const stream = {
        startTime: Date.now(),
        bytesTransferred: 1000000,
      };

      const speed = service.calculateSpeed(stream);

      expect(speed).toBe('0 MB/s');
    });
  });

  describe('getStreamStatus', () => {
    it('deve retornar status do stream', async () => {
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

      spawn
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      const taskId = 'test_task_status';
      const url = 'https://example.com/video.mp4';
      const metadata = { fileSize: 1000000, filename: 'video.mp4' };

      await service.startStream(taskId, url, {}, {}, metadata);

      // Simular 25% transferido
      const chunk = Buffer.alloc(250000);
      mockFfmpegProcess.stdout.emit('data', chunk);

      const status = service.getStreamStatus(taskId);

      expect(status).toEqual(
        expect.objectContaining({
          taskId,
          status: 'streaming',
          fileSize: 1000000,
          bytesTransferred: 250000,
          percent: 25,
        })
      );
      expect(status.speed).toMatch(/MB\/s/);
    });

    it('deve retornar null se stream não existir', () => {
      const status = service.getStreamStatus('nonexistent_task');

      expect(status).toBeNull();
    });

    it('deve calcular percentual como 0 se fileSize for 0', async () => {
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

      spawn
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      const taskId = 'test_task_zero_size';
      const url = 'https://example.com/video.mp4';

      await service.startStream(taskId, url, {}, {}, { fileSize: 0 });

      const status = service.getStreamStatus(taskId);

      expect(status.percent).toBe(0);
    });
  });

  describe('stopStream', () => {
    it('deve parar stream com sucesso', async () => {
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

      spawn
        .mockReturnValueOnce(mockYtdlpProcess)
        .mockReturnValueOnce(mockFfmpegProcess);

      const taskId = 'test_task_stop';
      const url = 'https://example.com/video.mp4';

      await service.startStream(taskId, url, {}, {}, {});

      expect(service.streams.has(taskId)).toBe(true);

      service.stopStream(taskId);

      expect(mockYtdlpProcess.kill).toHaveBeenCalled();
      expect(mockFfmpegProcess.kill).toHaveBeenCalled();
      expect(service.streams.has(taskId)).toBe(false);
    });

    it('deve retornar silenciosamente se stream não existir', () => {
      expect(() => {
        service.stopStream('nonexistent_task');
      }).not.toThrow();
    });
  });

  describe('buildYtdlpArgs', () => {
    it('deve construir argumentos corretos para formato best', () => {
      const args = service.buildYtdlpArgs({ format: 'best' }, 'https://example.com/video.mp4');

      expect(args).toContain('--progress');
      expect(args).toContain('--newline');
      expect(args).toContain('-o');
      expect(args).toContain('-');
      expect(args).toContain('-f');
      expect(args).toContain('best');
      expect(args).toContain('https://example.com/video.mp4');
    });

    it('deve construir argumentos para audio', () => {
      const args = service.buildYtdlpArgs({ format: 'audio', audioOnly: true }, 'https://example.com/video.mp4');

      expect(args).toContain('bestaudio');
      expect(args).toContain('-x');
      expect(args).toContain('--audio-format');
      expect(args).toContain('mp3');
    });

    it('deve construir argumentos para resolução específica', () => {
      const args = service.buildYtdlpArgs({ format: '720p' }, 'https://example.com/video.mp4');

      expect(args).toContain('best[height<=720]');
    });
  });

  describe('buildFfmpegArgs', () => {
    it('deve construir argumentos para vídeo', () => {
      const args = service.buildFfmpegArgs({ audioOnly: false });

      expect(args).toContain('-i');
      expect(args).toContain('-');
      expect(args).toContain('-c');
      expect(args).toContain('copy');
      expect(args).toContain('-f');
      expect(args).toContain('mp4');
    });

    it('deve construir argumentos para áudio', () => {
      const args = service.buildFfmpegArgs({ audioOnly: true });

      expect(args).toContain('-f');
      expect(args).toContain('mp3');
    });
  });
});
