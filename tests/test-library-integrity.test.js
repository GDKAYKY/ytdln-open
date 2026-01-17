const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const fs = require('node:fs');
const path = require('node:path');




describe('Test Library Integrity', () => {
  const testDir = path.join(__dirname, 'test-data');
  const downloadsDir = path.join(testDir, 'downloads');
  const thumbnailsDir = path.join(testDir, 'thumbnails');

  beforeAll(async () => {
    // Create test structure
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(downloadsDir, { recursive: true });
    fs.mkdirSync(thumbnailsDir, { recursive: true });

    // Create test files
    fs.writeFileSync(path.join(downloadsDir, 'video1.mp4'), 'fake video content 1');
    fs.writeFileSync(path.join(thumbnailsDir, 'video1.jpg'), 'fake thumbnail 1');
    fs.writeFileSync(path.join(downloadsDir, 'video2.mp4'), 'fake video content 2');
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should have test directories created', () => {
    expect(fs.existsSync(downloadsDir)).toBe(true);
    expect(fs.existsSync(thumbnailsDir)).toBe(true);
  });

  it('should have test files created', () => {
    expect(fs.existsSync(path.join(downloadsDir, 'video1.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(downloadsDir, 'video2.mp4'))).toBe(true);
  });

  it('should have test thumbnails created', () => {
    expect(fs.existsSync(path.join(thumbnailsDir, 'video1.jpg'))).toBe(true);
  });

  it('should validate directory structure', () => {
    const files = fs.readdirSync(downloadsDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('video1.mp4');
    expect(files).toContain('video2.mp4');
  });
});



