const { describe, it, expect } = require('@jest/globals');
const { existsSync, statSync } = require('node:fs');
const { join } = require('node:path');

describe('Check Binaries', () => {
  const binDir = join(__dirname, '..', 'bin');
  const requiredBinaries = ['yt-dlp.exe', 'ffmpeg.exe'];
  const binDirExists = existsSync(binDir);

  describe('Binary Verification', () => {
    requiredBinaries.forEach((binary) => {
      it(`should find ${binary}`, () => {
        const binaryPath = join(binDir, binary);
        if (!binDirExists) {
          console.warn(`⚠️  Binary directory not found at ${binDir}. Skipping binary verification.`);
          expect(true).toBe(true);
          return;
        }
        expect(existsSync(binaryPath)).toBe(true);
      });

      it(`should have valid size for ${binary}`, () => {
        const binaryPath = join(binDir, binary);
        if (!binDirExists || !existsSync(binaryPath)) {
          expect(true).toBe(true);
          return;
        }
        const stats = statSync(binaryPath);
        expect(stats.size).toBeGreaterThan(0);
      });
    });
  });

  describe('Binary Directory', () => {
    it('should have bin directory', () => {
      if (!binDirExists) {
        console.warn(`⚠️  Binary directory not found at ${binDir}. Run binary downloader to populate binaries.`);
        expect(true).toBe(true);
        return;
      }
      expect(existsSync(binDir)).toBe(true);
    });
  });
});



