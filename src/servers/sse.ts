/**
 * 🌊 SSE (Server-Sent Events) Inscription MCP Server
 * ==========================================
 *
 * A specialized implementation of the Inscription MCP server that uses
 * Server-Sent Events (SSE) for real-time communication. This server
 * type is ideal for web-based clients that need to maintain an open
 * connection for receiving updates from the mcp-inscription server.
 *
 * Connection Flow:
 *
 *    Client         SSE Server
 *      │     GET /sse    │
 *      │─────────────────>
 *      │    SSE Setup    │
 *      │<─────────────────
 *      │                 │
 *      │  POST /messages │
 *      │─────────────────>
 *      │     Events      │
 *      │<─────────────────
 *      │                 │
 *
 * Features:
 * 📡 Real-time Updates
 * 🔌 Persistent Connections
 * 🔄 Automatic Reconnection
 * 🛡️ Error Recovery
 * 🔍 Inscription Detection
 */

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Config, ServerConfig, ServerMode } from "../mcp_inscription_types.js";
import logger from "../utils/logger.js";
import express from "express";
import { BaseOrdinalsServer } from "./base.js";
import cors from "cors";
import http from "http";

/**
 * OrdinalsSseServer implements a Server-Sent Events based Model Context Protocol server for Ordinals (mcp-inscription)
 * Provides a web server with endpoints for SSE connections and message handling while supporting
 * specialized Bitcoin transaction decoding with support for Ordinals
 */
export class OrdinalsSseServer extends BaseOrdinalsServer {
  /** SSE transport used for server-sent events communication */
  private transport?: SSEServerTransport;
  
  /** Express application instance for handling HTTP requests */
  private app: express.Application;
  
  /** Port number the server will listen on */
  private port: number;

  /**
   * Creates a new SSE-based Bitcoin MCP server
   *
   * @param config - Bitcoin network configuration
   * @param serverConfig - SSE server settings including port
   */
  constructor(config: Config, serverConfig: ServerConfig) {
    super(config);
    this.port = serverConfig.port ?? 3000;
    this.app = express();
    this.setupExpressMiddleware();
    this.setupExpressRoutes();
  }

  /**
   * Configure Express Middleware
   * Sets up necessary middleware for the Express server
   */
  private setupExpressMiddleware(): void {
    // Enable CORS with appropriate configuration
    this.app.use(cors());
    
    // Parse JSON request bodies
    this.app.use(express.json());

    // Add request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Configure Express Routes
   * Sets up the SSE endpoint and message handling route
   */
  private setupExpressRoutes(): void {
    // Basic status endpoint for health checks
    this.app.get("/", (req, res) => {
      res.status(200);
      res.json({ status: "ok", server: "mcp-inscription", mode: ServerMode.SSE });
    });

    // SSE connection endpoint
    this.app.get("/sse", async (req, res) => {
      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      // Ensure response is not buffered
      res.flushHeaders();
      
      // Initialize transport with the response object
      this.transport = new SSEServerTransport("/messages", res);
      await this.server.connect(this.transport);
      
      logger.info("Ordinals SSE connection established");
      
      // Handle client disconnect
      req.on("close", () => {
        logger.info("Ordinals SSE connection closed by client");
        this.transport = undefined;
      });
    });

    // Message handling endpoint
    this.app.post("/messages", async (req, res) => {
      if (!this.transport) {
        logger.warn("Ordinals message received but no active SSE connection");
        res.status(400).json({ error: "No active Ordinals SSE connection" });
        return;
      }
      
      try {
        logger.debug("Handling incoming Ordinals message");
        await this.transport.handlePostMessage(req, res);
      } catch (error) {
        logger.error({ error }, "Error handling Ordinals message");
        res.status(500).json({ error: "Failed to process Ordinals message" });
      }
    });

    // Fallback 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: "Not found" });
    });
  }

  /**
   * Start SSE Server
   * Begins listening for HTTP connections on the configured port
   * 
   * @returns Promise that resolves when server is started
   */
  public async start(): Promise<void> {
    this.app.listen(this.port, () => {
      logger.info({ mode: "sse", port: this.port }, "Ordinals MCP server running");
    });
  }

  /**
   * Graceful Shutdown
   * Cleanly closes SSE connections and shuts down the server
   * 
   * @param code - Exit code to use when terminating the process (default: 0)
   * @returns Never returns as process is terminated
   */
  public async shutdown(code = 0): Promise<never> {
    logger.info("Shutting down Ordinals SSE server...");
    try {
      if (this.transport) {
        await this.server.close();
      }
      logger.info("Ordinals SSE Server shutdown complete");
      process.exit(code);
    } catch (error) {
      logger.error({ error }, "Error during Ordinals SSE server shutdown");
      process.exit(1);
    }
  }
} 