/**
 * 🎯 Base Inscription MCP Server
 * ========================
 *
 * The foundation of our Inscription MCP server architecture, providing a robust
 * base for both SSE and STDIO implementations. This abstract class handles
 * all the core functionality while letting specific implementations define
 * their transport mechanisms.
 *
 * Architecture Overview:
 *
 *     ┌─────────────────┐
 *     │BaseOrdinalsServer│
 *     └─────────┬───────┘
 *               │
 *        ┌──────┴──────┐
 *        │             │
 *   ┌────▼───┐    ┌────▼───┐
 *   │  SSE   │    │ STDIO  │
 *   └────────┘    └────────┘
 *
 * Features:
 * 🔧 Tool Registration & Handling
 * 🚦 Error Management
 * 🔄 Lifecycle Control
 * 🛡️ Type Safety
 * 🔍 Specialized Decoding (Ordinals)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  ErrorCode,
  McpError,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";

import { OrdinalsClient } from "../ordinals_client.js";
import {
  BitcoinError,
  OrdinalsServer,
  Config,
  ConfigSchema,
  GetTransactionSchema,
  DecodeWitnessSchema,
  TransactionWithOrdinal,
} from "../mcp_inscription_types.js";
import logger from "../utils/logger.js";
import { VERSION } from "../utils/version.js";
import { safeStringify } from "../utils/json_utils.js";
import fs from 'fs';
import path from 'path';
import os from 'os';

const SERVER_NAME = "mcp-inscription";
const SERVER_VERSION = VERSION;

/**
 * Abstract base class for Ordinals MCP servers (mcp-inscription)
 * Provides common functionality for both STDIO and SSE implementations
 * along with specialized Bitcoin transaction decoding for Ordinals
 */
export abstract class BaseOrdinalsServer implements OrdinalsServer {
  protected server: Server;
  protected client: OrdinalsClient;
  // Cache for recently decoded transactions
  private successfulDecodings: Map<string, number> = new Map();

  /**
   * Creates a new MCP server instance
   *
   * @param config - Server configuration including network and API settings
   * @throws Error if configuration is invalid
   */
  constructor(config: Config) {
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }
    
    this.client = new OrdinalsClient(config);
    this.server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } }
    );
    
    this.setupHandlers();
  }

  /**
   * Setup Server Event Handlers
   * Configures error handling and graceful shutdown for the server instance
   */
  protected setupHandlers(): void {
    this.server.onerror = (error: unknown) => {
      logger.error({ error }, "MCP Server Error");
    };
    
    process.on("SIGINT", async () => {
      await this.shutdown();
    });
    
    process.on("SIGTERM", async () => {
      await this.shutdown();
    });
    
    process.on("uncaughtException", (error: unknown) => {
      logger.error("Uncaught Exception", error);
      this.shutdown(1);
    });
    
    process.on("unhandledRejection", (reason: unknown) => {
      logger.error("Unhandled Rejection", reason);
      this.shutdown(1);
    });
    
    this.setupToolHandlers();
  }

  /**
   * Register Available Tools
   * Sets up handlers for all supported Bitcoin and Ordinals operations
   */
  protected setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "show_ordinals",
          description: "## 🔹 Bitcoin Ordinals Expert Assistant  \n\n### **🚀 MANDATORY TWO-RESPONSE PROCESS FOR IMAGES**  \nI strictly follow a **two-step structured workflow** for processing Bitcoin Ordinal inscriptions. **STRICT ADHERENCE IS REQUIRED.**  \n\n---\n\n## 📌 **Required Tools & Workflow**  \n\n### **🔍 Tools Used:**  \n1️⃣ **`show_ordinals` (MANDATORY FIRST STEP)**  \n   - Fetches **inscription data**.  \n   - If the inscription is an **image**, it **MUST**:  \n     - **Save it locally** and return the **`local_file_path`**.\n     - *(Code currently does NOT return a separate displayable source, only the local path)*\n\n2️⃣ **`image_processor` / `vision` (OCR & Visual Analysis ONLY)**  \n   - **MUST be used** for extracting textual/visual data from the image.\n   - Takes **`local_file_path`** as input.\n\n---\n\n## **🚀 MANDATORY TWO-STEP RESPONSE WORKFLOW (FOR IMAGES)**  \n\n### **📌 RESPONSE 1: Display Attempt + Technical Details (NON-TERMINAL)**  \n✔ **Execute `show_ordinals` FIRST.**  \n✔ **Return an `<img>` tag** using the **`local_file_path` provided by `show_ordinals`** as the `src` attribute.\n✔ **Follow with detailed technical metadata.**  \n✔ **STOP HERE. NO ANALYSIS YET.**  \n\n**✅ RESPONSE FORMAT (STRICTLY ENFORCED):**  \n```html\n<!-- Attempting display using local path. Note: May not render in standard browsers due to security restrictions. -->\n<img src=\"[local_file_path from show_ordinals]\" alt=\"Ordinal Image Inscription\" style=\"max-width: 100%; height: auto;\" />\n\n### 📊 Technical Details  \n* **MIME Type:** [MIME type]\n* **Size:** [Size]\n* **Transaction ID:** [Tx ID]\n* **Status:** [Status]\n* **Inscription Input:** [Input]\n* **Local Path (for analysis):** `[local_file_path from show_ordinals]`\n* [Other available details]\n```  \n🔹 **End FIRST response here.** **No OCR, No AI-generated descriptions. This response is intended to be NON-TERMINAL to allow for Step 2.**  \n\n---\n\n### **📌 RESPONSE 2: OCR & Content Analysis (Using Designated Tools ONLY)**  \n✔ **AFTER Response 1, consult available tools.**\n✔ **Execute `image_processor` OR `vision` using the `local_file_path` from Response 1.**\n✔ **Strictly use ONLY tool-generated analysis.**  \n✔ **If BOTH tools fail, state failure explicitly.**  \n✔ **Return a new markdown response with the extracted data.**  \n\n**✅ RESPONSE FORMAT (STRICTLY ENFORCED):**  \n```markdown\n### 📝 Detailed Image Analysis (Result from '[Executed Tool Name]')\n\n[Extracted OCR text, visual description, or failure message from the tool ONLY]\n```\n⚠ **No hallucinations. No AI-generated assumptions.**  \n\n---\n\n### **📌 FALLBACK MECHANISM (IF OCR TOOLS FAIL)**  \n- If **BOTH** `image_processor` AND `vision` **fail**, use a **verified fallback OCR tool** (if available).\n- If **no fallback exists**, explicitly **state failure** instead of hallucinating content.\n\n---\n\n### **🎯 Summary: Strict 2-Response Workflow**  \n✅ **Step 1:** **Execute `show_ordinals`** → Attempt Image Display (using local path) + Metadata. (Response intended as Non-Terminal)\n✅ **Step 2:** **Execute `image_processor` / `vision`** → Analysis Description. (Separate Response)\n\n---\n\n💡 **This ensures clarity, prevents AI hallucinations, and provides structured responses.** 🚀",
          inputSchema: {
            type: "object",
            properties: {
              txid: {
                type: "string",
                description: "The unique 64-character hexadecimal identifier of the Bitcoin transaction to inspect for Ordinals. Example: 'f1d2d3...a8b9c0'."
              },
              inscription_index: {
                type: "integer",
                description: "Optional. The specific index (starting from 0) of the inscription to retrieve within the transaction, if there are multiple."
              },
              content_type_filter: {
                type: "string",
                description: "Optional. Filter inscriptions by content type, e.g., 'image/png', 'text/plain', 'application/json'."
              }
            },
            required: ["txid"]
          }
        } as Tool,
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.debug({ name, args }, "Tool called");

      try {
        switch (name) {
          case "show_ordinals":
            return await this.handleDecodeWitness(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  /**
   * Handle Get Transaction tool requests
   * @param args
   */
  protected async handleGetTransaction(args: unknown) {
    const result = GetTransactionSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const txid = result.data.txid;
    
    // Check if this transaction has been recently decoded successfully
    if (this.wasRecentlyDecoded(txid)) {
      logger.warn(`Attempted call to get_transaction for ${txid} after successful Ordinals decoding.`);
      return {
        content: [
          {
            type: "text",
            text: `❌ TOOL CALL BLOCKED ❌\n\nDO NOT USE get_transaction AFTER A SUCCESSFUL SHOW_ORDINALS!\n\nTransaction ${txid} has ALREADY been successfully decoded and its Ordinal inscription is displayed above. You are seeing this message because you attempted to run get_transaction after a successful show_ordinals operation.\n\nINSTRUCTIONS:\n1. Look at the image already displayed above\n2. DO NOT run get_transaction or other tools\n3. Just describe the image that was successfully decoded\n\nThe operation is complete. No further tools are needed.`,
            isComplete: true,
            isTerminal: true
          }
        ] as TextContent[],
      };
    }
    
    // Continue with normal behavior if this is not a recently decoded transaction
    try {
      const tx = await this.client.getTransaction(txid);

      // Format the transaction information
      let txInfo = `Transaction: ${tx.txid}\n`;
      txInfo += `Status: ${tx.status.confirmed ? `Confirmed in block ${tx.status.blockHeight}` : "Unconfirmed"}\n`;
      txInfo += `Size: ${tx.size} bytes\n`;
      txInfo += `Weight: ${tx.weight} WU\n`;
      txInfo += `Inputs: ${tx.inputs.length}\n`;
      txInfo += `Outputs: ${tx.outputs.length}\n`;

      // Add fee information if available
      if (tx.fee !== undefined) {
        txInfo += `Fee: ${tx.fee} sats`;
        if (tx.size > 0) {
          const feeRate = Math.round((tx.fee / tx.size) * 100) / 100;
          txInfo += ` (${feeRate} sats/vB)\n`;
        } else {
          txInfo += `\n`;
        }
      } else {
        txInfo += `Fee: Unknown\n`;
      }

      // Check for RBF (Replace-By-Fee)
      const isRBF = tx.inputs.some((input) => input.sequence < 0xffffffff - 1);
      txInfo += `RBF: ${isRBF ? "Yes" : "No"}\n\n`;

      // Detailed transaction information
      txInfo += `Detailed Transaction Information:\n`;

      // Inputs
      txInfo += `Inputs (${tx.inputs.length}):\n`;
      for (let i = 0; i < tx.inputs.length; i++) {
        const input = tx.inputs[i];
        txInfo += `  ${i + 1}. `;
        if (input.txid) {
          txInfo += `${input.txid}:${input.vout}`;
          if (input.prevout) {
            txInfo += ` (${input.prevout.value} sats)`;
          }
        } else {
          txInfo += "Coinbase";
        }
        txInfo += `\n`;
      }

      // Outputs
      txInfo += `\nOutputs (${tx.outputs.length}):\n`;
      for (let i = 0; i < tx.outputs.length; i++) {
        const output = tx.outputs[i];
        txInfo += `  ${i + 1}. ${output.scriptPubKeyAddress || "Unknown address"} (${output.value} sats)`;
        if (output.scriptPubKeyType) {
          txInfo += ` [${output.scriptPubKeyType}]`;
        }
        txInfo += `\n`;
      }

      // Ordinal Information
      let ordinalInfo = "";
      if (tx.ordinal && tx.ordinal.isOrdinal) {
        ordinalInfo = "Ordinal Information:\n";
        if (tx.ordinal.content) {
          ordinalInfo += `  Content Type: ${tx.ordinal.content.type}\n`;
          // For long content, truncate to a reasonable length in the summary
          if (tx.ordinal.content.data.length > 200) {
            ordinalInfo += `  Content: ${tx.ordinal.content.data.substring(0, 200)}...(truncated)\n`;
            ordinalInfo += `  Content Size: ${tx.ordinal.content.data.length / 2} bytes\n`;
            
            if (tx.ordinal.content.type.startsWith('image/')) {
              ordinalInfo += "  Image inscription detected, use show_ordinals for full content\n";
            } else if (tx.ordinal.content.type === 'application/json') {
              ordinalInfo += "  JSON inscription detected, use show_ordinals for formatted content\n";
            } else {
              ordinalInfo += "  Use show_ordinals for full content\n";
            }
          }
          try {
            if (tx.ordinal.content.type === 'application/json') {
              // Try to parse and format JSON for better display
              const jsonData = JSON.parse(Buffer.from(tx.ordinal.content.data, 'hex').toString('utf8'));
              ordinalInfo += `  Content (JSON):\n${JSON.stringify(jsonData, null, 2)}\n`;
            } else if (tx.ordinal.content.type.startsWith('text/')) {
              // Format text content for better display
              const textContent = Buffer.from(tx.ordinal.content.data, 'hex').toString('utf8');
              ordinalInfo += `  Content (Text):\n${textContent}\n`;
            } else if (tx.ordinal.content.type.startsWith('image/')) {
              // For images, just mention the presence and point to show_ordinals
              ordinalInfo += "  Image inscription detected, use show_ordinals to view\n";
            } else {
              // For other types, show limited hex data
              ordinalInfo += `  Content (${tx.ordinal.content.data.length / 2} bytes): ${tx.ordinal.content.data.substring(0, 40)}...\n`;
              ordinalInfo += "  Use show_ordinals for full content\n";
            }
          } catch (e) {
            // If parsing fails, show raw data
            ordinalInfo += `  Content Raw (${tx.ordinal.content.data.length / 2} bytes):\n`;
            ordinalInfo += `  ${tx.ordinal.content.data.substring(0, 200)}${tx.ordinal.content.data.length > 200 ? '...(truncated)' : ''}\n`;
          }
        } else {
          ordinalInfo += "  Content: No content data available\n";
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `${txInfo}${ordinalInfo}`,
          },
        ] as TextContent[],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Handle Get Raw Transaction tool requests
   * @param args
   */
  protected async handleGetRawTransaction(args: unknown) {
    const result = GetTransactionSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }
    
    const rawHex = await this.client.getRawTransaction(result.data.txid);
    return {
      content: [
        {
          type: "text",
          text: `Raw transaction hex:\n${rawHex}`,
        },
      ] as TextContent[],
    };
  }

  /**
   * Determine the file extension from a MIME type
   * @param mimeType The MIME type of the image
   * @returns The corresponding file extension
   */
  private getMimeExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'image/x-icon': '.ico'
    };
    
    return extensions[mimeType] || '.bin';
  }

  /**
   * Process and save image data (either from data URI or file path)
   * @param imageData The image data or file path
   * @param txid Transaction ID
   * @param txInfo Transaction information
   */
  protected async processAndSaveImage(
    imageData: string,
    txid: string,
    txInfo: TransactionWithOrdinal
  ): Promise<{ content: TextContent[], endProcessing?: boolean }> {
    try {
      let filePath: string;
      let mimeType: string;
      let buffer: Buffer;

      // Get the client's configured image directory (always ~/.cache/mcp-inscription)
      const imageTempDir = this.client.getConfig().imageTempDir;
      logger.debug(`Using image directory from client config: ${imageTempDir}`);

      // Process file path
      if (imageData.startsWith('file://')) {
        // Convert file:// URI to OS-compatible path
        const filePathRaw = imageData.substring(7);
        
        // Normalize path based on operating system
        filePath = path.normalize(decodeURIComponent(filePathRaw));
        
        // On Windows, if path starts with /, add drive letter
        if (process.platform === 'win32' && filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }
        
        if (!fs.existsSync(filePath)) {
          logger.warn(`File not found: ${filePath}, attempting to retrieve raw data`);
          // Fallback - try to use inscription data directly from txInfo
          if (txInfo.ordinal?.content && txInfo.ordinal.content.type.startsWith('image/')) {
            const contentBuffer = Buffer.from(txInfo.ordinal.content.data, 'hex');
            const extension = this.getMimeExtension(txInfo.ordinal.content.type);
            const filename = `${txid}${extension}`;
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(imageTempDir)) {
              fs.mkdirSync(imageTempDir, { recursive: true });
            }
            
            filePath = path.join(imageTempDir, filename);
            
            // Write the file
            fs.writeFileSync(filePath, contentBuffer);
            buffer = contentBuffer;
            mimeType = txInfo.ordinal.content.type;
          } else {
            throw new Error(`File not found and unable to retrieve image data: ${filePath}`);
          }
        } else {
          buffer = fs.readFileSync(filePath);
          mimeType = this.getMimeTypeFromPath(filePath);
        }
      } 
      // Process data URI
      else if (imageData.startsWith('data:image/')) {
        const mimeMatch = imageData.match(/^data:([^;]+);base64,(.*)$/);
        if (!mimeMatch) {
          throw new Error("Invalid Data URI format");
        }
        
        mimeType = mimeMatch[1];
        const base64Data = mimeMatch[2];
        const extension = this.getMimeExtension(mimeType);
        const filename = `${txid}${extension}`;
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(imageTempDir)) {
          fs.mkdirSync(imageTempDir, { recursive: true });
        }
        
        filePath = path.join(imageTempDir, filename);
        buffer = Buffer.from(base64Data, 'base64');
        
        // Write the file
        fs.writeFileSync(filePath, buffer);
      } 
      // Fallback - try to use inscription data directly
      else if (txInfo.ordinal?.content && txInfo.ordinal.content.type.startsWith('image/')) {
        const contentBuffer = Buffer.from(txInfo.ordinal.content.data, 'hex');
        mimeType = txInfo.ordinal.content.type;
        const extension = this.getMimeExtension(mimeType);
        const filename = `${txid}${extension}`;
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(imageTempDir)) {
          fs.mkdirSync(imageTempDir, { recursive: true });
        }
        
        filePath = path.join(imageTempDir, filename);
        
        // Write the file
        fs.writeFileSync(filePath, contentBuffer);
        buffer = contentBuffer;
      } else {
        throw new Error("Unsupported image data format");
      }

      // Path to display in metadata - use filePath directly without file:// prefix
      let displayPath: string = filePath;
      
      // CRITICAL: Ensure the path used in HTML is the absolute path with correct slashes
      // and NEVER add file:// prefix as it causes issues with image display
      let imgSrc = filePath.replace(/\\/g, '/');
      // Explicitly remove any file:// prefix if present
      imgSrc = imgSrc.replace(/^file:\/\/+/, '');

      // Return formatted response with specific format to identify non-empty result
      // and include detailed inscription information
      const fileSizeKB = Math.round(buffer.length / 1024);
      const inputInfo = txInfo.inputs
        .filter(input => input.witness && input.witness.length > 0)
        .map(input => input.txid ? `${input.txid}:${input.vout}` : 'coinbase')[0] || "Unknown";

      // Log the paths to help with debugging
      logger.debug({
        filePath,
        displayPath,
        imgSrc,
        mimeType,
        size: fileSizeKB,
      }, "Image processing complete");

      return {
        content: [
          {
            type: "text",
            text: `DECODE_WITNESS_RESULT={ "status": "SUCCESS", "txid": "${txid}", "content_type": "image", "size": "${fileSizeKB} KB", "mime_type": "${mimeType}" }\n\n` +
                  `### Ordinal Inscription Details ###\n` +
                  `• Type: Ordinal Inscription (${mimeType})\n` +
                  `• Size: ${fileSizeKB} KB\n` +
                  `• Transaction ID: ${txid}\n` +
                  `• Status: ${txInfo.status.confirmed ? `Confirmed in block #${txInfo.status.blockHeight}` : "Unconfirmed"}\n` +
                  `• Transaction Size: ${txInfo.size} bytes\n` +
                  `• Fee: ${txInfo.fee} sats\n` +
                  `• Input containing inscription: ${inputInfo}\n` +
                  `• Image Path: ${displayPath}\n\n` +
                  `<img src="${imgSrc}" />\n\n` +
                  `Please describe this Ordinal inscription image in detail. What does it show? What are its main visual elements? Include the image again in your response using:\n\n\`\`\`html\n<img src="${imgSrc}" />\n\`\`\``,
            isComplete: true,
            isTerminal: true
          }
        ] as TextContent[],
        endProcessing: true
      };
    } catch (error) {
      logger.error({ error, txid }, "Error processing image");
      
      // In case of error, try to return a data URI if available
      if (imageData.startsWith('data:image/')) {
        const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
        if (mimeMatch) {
          const mimeType = mimeMatch[1];
          const fileSizeEstimateKB = Math.round((imageData.length - imageData.indexOf(',') - 1) * 3 / 4 / 1024);
          const inputInfo = txInfo.inputs
            .filter(input => input.witness && input.witness.length > 0)
            .map(input => input.txid ? `${input.txid}:${input.vout}` : 'coinbase')[0] || "Unknown";

          logger.debug("Using data URI directly in error handler");

          return {
            content: [
              {
                type: "text",
                text: `DECODE_WITNESS_RESULT={ "status": "SUCCESS", "txid": "${txid}", "content_type": "image", "size": "${fileSizeEstimateKB} KB", "mime_type": "${mimeType}" }\n\n` +
                      `### Ordinal Inscription Details ###\n` +
                      `• Type: Ordinal Inscription (${mimeType})\n` +
                      `• Size: ~${fileSizeEstimateKB} KB\n` +
                      `• Transaction ID: ${txid}\n` +
                      `• Status: ${txInfo.status.confirmed ? `Confirmed in block #${txInfo.status.blockHeight}` : "Unconfirmed"}\n` +
                      `• Transaction Size: ${txInfo.size} bytes\n` +
                      `• Fee: ${txInfo.fee} sats\n` +
                      `• Input containing inscription: ${inputInfo}\n` +
                      `• Format: Data URI\n\n` +
                      `<img src="${imageData}" />\n\n` +
                      `Please describe this Ordinal inscription image in detail. What does it show? What are its main visual elements? Include the image again in your response using:\n\n\`\`\`html\n<img src="${imageData}" />\n\`\`\``,
                isComplete: true,
                isTerminal: true
              }
            ] as TextContent[],
            endProcessing: true
          };
        }
      }
      
      // If all fails, throw the error to be handled by the caller
      throw error;
    }
  }

  /**
   * Handle Decode Witness tool requests
   * This decodes Ordinal inscriptions from transaction witness data
   * @param args
   */
  protected async handleDecodeWitness(args: unknown) {
    const result = DecodeWitnessSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const txid = result.data.txid;
    logger.info(`Processing Ordinals for transaction: ${txid}`);
    
    try {
      // Call decodeWitness method with file option to store images in ~/.cache
      const decodedWitness = await this.client.decodeWitness(txid, "file");
      
      // Check if an image is present in the results
      // Image paths now never have file:// prefix
      const images = decodedWitness.filter(content => 
        content.startsWith('data:image/') || 
        (content.length > 0 && !content.startsWith('{') && !content.startsWith('['))
      );
      
      // If we have an image, process it for display
      if (images.length > 0) {
        const imageData = images[0];
        const txInfo = await this.client.getTransaction(txid, false);
        
        // Mark this txid as successfully decoded BEFORE processing the image
        // to avoid timing issues with get_transaction call
        this.markSuccessfulDecoding(txid);
        logger.info(`Transaction ${txid} marked as successfully decoded before image processing`);
        
        // Use processAndSaveImage method for display
        return await this.processAndSaveImage(imageData, txid, txInfo);
      }
      
      // For other content types (JSON, text, etc.)
      const formattedContent = decodedWitness.map(content => {
        if (content.startsWith('{') || content.startsWith('[')) {
          try {
            const jsonData = JSON.parse(content);
            return `\`\`\`json\n${JSON.stringify(jsonData, null, 2)}\n\`\`\``;
          } catch (e) {
            return content;
          }
        }
        return content;
      }).join('\n\n');
      
      return {
        content: [
          {
            type: "text",
            text: formattedContent
          }
        ] as TextContent[],
      };
    } catch (error) {
      // In case of error during the decoding process
      logger.error({ error }, `Error decoding Ordinals for ${txid}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Error decoding Ordinals for transaction ${txid}:\n` +
                  `${error instanceof Error ? error.message : String(error)}\n\n` +
                  "This may be due to a blockchain API access issue, an unsupported transaction format, " +
                  "or the transaction may not exist."
          }
        ] as TextContent[],
      };
    }
  }

  /**
   * Handle errors and convert them to appropriate MCP responses
   * @param error
   */
  protected handleError(error: unknown) {
    if (error instanceof McpError) {
      throw error;
    }
    
    if (error instanceof BitcoinError) {
      return {
        content: [
          {
            type: "text",
            text: `Bitcoin error (${error.code}): ${error.message}`,
            isError: true,
          },
        ] as TextContent[],
      };
    }
    
    logger.error({ error }, "Unexpected error in tool handler");
    throw new McpError(ErrorCode.InternalError, "An unexpected error occurred");
  }

  /**
   * Graceful shutdown
   * Cleanly shuts down the server and exits
   */
  public abstract shutdown(code?: number): Promise<never>;

  /**
   * Start Server
   * Abstract method to be implemented by specific server types
   */
  public abstract start(): Promise<void>;

  /**
   * Determine the MIME type from the file path
   * @param filePath The file path
   * @returns The corresponding MIME type
   */
  private getMimeTypeFromPath(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.ico': 'image/x-icon'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Method to mark a decoding as successful
  private markSuccessfulDecoding(txid: string): void {
    this.successfulDecodings.set(txid, Date.now());
    
    // Clean up entries older than 5 minutes
    const expiryTime = Date.now() - 5 * 60 * 1000;
    for (const [key, timestamp] of this.successfulDecodings.entries()) {
      if (timestamp < expiryTime) {
        this.successfulDecodings.delete(key);
      }
    }
  }
  
  // Method to check if a decoding was recently successful
  private wasRecentlyDecoded(txid: string): boolean {
    return this.successfulDecodings.has(txid);
  }
}
