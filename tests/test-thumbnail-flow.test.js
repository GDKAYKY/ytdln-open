const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const path = require('node:path');
const fs = require('node:fs');




describe('Test Thumbnail Flow', () => {
  const testDir = path.join(__dirname, 'test-data-thumb');
  const downloadsDir = path.join(testDir, 'downloads');
  const thumbnailsDir = path.join(testDir, 'thumbnails');

  beforeAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(downloadsDir, { recursive: true });
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should create test directories', () => {
    expect(fs.existsSync(downloadsDir)).toBe(true);
    expect(fs.existsSync(thumbnailsDir)).toBe(true);
  });

  it('should create video and thumbnail files', () => {
    const videoPath = path.join(downloadsDir, 'video.mp4');
    const thumbPath = path.join(downloadsDir, 'video.jpg');

    fs.writeFileSync(videoPath, 'fake video');
    fs.writeFileSync(thumbPath, 'fake thumbnail');

    expect(fs.existsSync(videoPath)).toBe(true);
    expect(fs.existsSync(thumbPath)).toBe(true);
  });

  it('should have valid file structure', () => {
    const files = fs.readdirSync(downloadsDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it('should handle thumbnail paths correctly', () => {
    const videoPath = path.join(downloadsDir, 'test.mp4');
    const thumbPath = path.join(downloadsDir, 'test.jpg');

    fs.writeFileSync(videoPath, 'video');
    fs.writeFileSync(thumbPath, 'thumb');

    const baseName = path.basename(videoPath, path.extname(videoPath));
    expect(baseName).toBe('test');

    const thumbExt = path.extname(thumbPath);
    expect(thumbExt).toBe('.jpg');
  });
});



