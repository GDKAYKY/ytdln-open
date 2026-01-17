// Mock do Electron para testes
jest.mock('electron', () => ({
  app: {
    getPath: (name) => {
      if (name === 'downloads') {
        return './downloads';
      }
      if (name === 'userData') {
        return './userData';
      }
      return './';
    },
  },
}), { virtual: true });


