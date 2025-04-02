/**
 * Version management utility for the server
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

// Get the current directory path
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Retrieves the package version from package.json
 * 
 * @returns The package version string or "0.0.0" if unavailable
 */
export function getVersion(): string {
  try {
    // Go up two levels: /src/utils → /
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch (error) {
    // Return a default version in case of error
    logger.error({ error }, 'Failed to read package.json version');
    return '0.0.0';
  }
}

// Export the version directly for easy access
export const VERSION = getVersion(); 