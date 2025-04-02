import pino from "pino";
import fs from "fs";

/**
 * Configure pino logger with pretty printing in development
 */
const defaultConfig = {
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      // Write to stderr to keep stdout clean for JSON-RPC
      destination: 2,
    },
  },
};

// Create configurable logger factory
export function createLogger(config = {}) {
  return pino({
    ...defaultConfig,
    ...config,
  });
}

// Configure file-based logging if LOG_TO_FILE is set
const logToFile = process.env.LOG_TO_FILE === "true";
const logDir = process.env.LOG_DIR || "./logs";

// Create log directory if it doesn't exist
if (logToFile && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configure our default logger
const logger = logToFile 
  ? createLogger({
      transport: {
        target: "pino/file",
        options: { destination: `${logDir}/mcp-inscription.log` }
      }
    })
  : createLogger();


// Export the logger instance
export default logger;
