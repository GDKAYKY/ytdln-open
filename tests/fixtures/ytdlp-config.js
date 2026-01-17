const path = require('node:path');
const fs = require('node:fs');

// Load default configuration from config/ytdlp-defaults.json
const configPath = path.join(__dirname, '..', '..', 'config', 'ytdlp-defaults.json');
const defaultConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

/**
 * Get default YT-DLP configuration
 * @returns {Object} Default configuration object
 */
function getDefaultYtdlpConfig() {
  return structuredClone(defaultConfig);
}

/**
 * Merge custom config with defaults
 * @param {Object} customConfig - Custom configuration to merge
 * @returns {Object} Merged configuration
 */
function mergeYtdlpConfig(customConfig = {}) {
  return {
    ...getDefaultYtdlpConfig(),
    ...customConfig,
  };
}

/**
 * Get minimal configuration for testing
 * @returns {Object} Minimal configuration
 */
function getMinimalYtdlpConfig() {
  return {
    outputFormat: 'mp4',
    quality: 'best',
  };
}

/**
 * Get extended configuration for testing
 * @returns {Object} Extended configuration
 */
function getExtendedYtdlpConfig() {
  return mergeYtdlpConfig({
    useSponsorBlock: true,
    embedMetadata: true,
    writeAutoSubs: true,
    embedSubs: true,
    writeThumbnail: true,
    writeInfoJson: true,
  });
}

module.exports = {
  getDefaultYtdlpConfig,
  mergeYtdlpConfig,
  getMinimalYtdlpConfig,
  getExtendedYtdlpConfig,
  default: defaultConfig,
};

