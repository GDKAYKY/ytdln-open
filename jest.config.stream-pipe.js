/**
 * Jest Configuration for Stream Pipe Tests
 * Executa testes de streaming com progresso
 */

module.exports = {
  displayName: 'stream-pipe',
  testEnvironment: 'node',
  testMatch: [
    '**/src/api/services/__tests__/stream-pipe.service.test.js',
    '**/src/api/controllers/__tests__/stream-pipe.controller.test.js',
    '**/src/api/__tests__/stream-pipe.integration.test.js',
    '**/src/api/__tests__/stream-pipe.e2e.test.js',
  ],
  collectCoverageFrom: [
    'src/api/services/stream-pipe.service.js',
    'src/api/controllers/stream-pipe.controller.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 15000,
  verbose: true,
  bail: false,
};
