/**
 * Inscription MCP Server
 * ==========================
 * 
 * Entry point for the Inscription Model Context Protocol server.
 * This file handles server initialization, configuration, and startup.
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
export * from "./mcp_inscription_types.js";
import { Config, ServerMode } from './mcp_inscription_types.js';
import { OrdinalsStdioServer } from './servers/stdio.js';
import { OrdinalsSseServer } from './servers/sse.js';
import logger from './utils/logger.js';

import { config } from "dotenv";
import { ServerConfig } from "./mcp_inscription_types.js";


// Ensure the cache directory exists (always ~/.cache/mcp-inscription)
const defaultCacheDir = path.join(os.homedir(), '.cache', 'mcp-inscription');
try {
  if (!fs.existsSync(defaultCacheDir)) {
    fs.mkdirSync(defaultCacheDir, { recursive: true });
    logger.info(`Created default cache directory: ${defaultCacheDir}`);
  }
} catch (error) {
  logger.error({ error }, `Failed to create default cache directory: ${defaultCacheDir}`);
}

// Load environment variables
config();

/**
 * Starts the Inscription MCP server with configuration from environment variables
 * 
 * This function:
 * 1. Loads and validates configuration from environment variables
 * 2. Initializes the appropriate server type (STDIO or SSE) based on configuration
 * 3. Starts the server and handles any startup errors
 * 
 * @returns Promise that resolves when server is started
 * @throws Error if required environment variables are missing or invalid
 */
export async function main() {
  // Get configuration from environment
  const network = (process.env.BITCOIN_NETWORK || "mainnet") as
    | "mainnet"
    | "testnet";
  const blockstreamApiBase =
    process.env.BLOCKSTREAM_API_BASE ||
    (network === "mainnet"
      ? "https://blockstream.info/api"
      : "https://blockstream.info/testnet/api");

  const config: Config = {
    network,
    blockstreamApiBase,
    imageTempDir: defaultCacheDir,
  };

  const mode =
    (process.env.SERVER_MODE?.toLowerCase() as ServerMode) || ServerMode.STDIO;
  const serverConfig: ServerConfig = {
    mode,
    port: parseInt(process.env.PORT || "3000"),
  };

  // Validate required environment variables
  if (!config.network) {
    logger.error("NETWORK environment variable is required");
    process.exit(1);
  }

  try {
    const server =
      mode === ServerMode.SSE
        ? new OrdinalsSseServer(config, serverConfig)
        : new OrdinalsStdioServer(config);

    await server.start();
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Only run if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error({ error }, "Unhandled error");
    process.exit(1);
  });
}
