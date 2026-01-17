const { describe, it, expect } = require('@jest/globals');
const { existsSync, statSync } = require('node:fs');
const { join } = require('node:path');





describe('Check Binaries', () => {
  const binDir = join(__dirname, '..', 'bin');
  const requiredBinaries = ['yt-dlp.exe', 'ffmpeg.exe'];

  describe('Binary Verification', () => {
    requiredBinaries.forEach((binary) => {
      it(`should find ${binary}`, () => {
        const binaryPath = join(binDir, binary);
        expect(existsSync(binaryPath)).toBe(true);
      });

      it(`should have valid size for ${binary}`, () => {
        const binaryPath = join(binDir, binary);
        if (existsSync(binaryPath)) {
          const stats = statSync(binaryPath);
          expect(stats.size).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Binary Directory', () => {
    it('should have bin directory', () => {
      expect(existsSync(binDir)).toBe(true);
    });
  });
});



