// Ordinals client implementation

import * as bitcoin from "bitcoinjs-lib";
import fetch from "node-fetch";
import {
  Config,
  TransactionWithOrdinal,
  BitcoinError,
  FormatImageOption
} from "./mcp_inscription_types.js"; 
import logger from "./utils/logger.js"; 

import {
  BlockstreamTx,
  BlockstreamTxVin,
  BlockstreamTxVout,
} from "./blockstream/types.js"; 

import { SimpleCache } from './utils/cache.js';
import { 
  handleExternalLibraryError, 
  handleBlockchainError 
} from './utils/error_handlers.js';

// Add fs imports for file handling
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Helper to check if a value is a Buffer
/**
 * Verifies if a value is a Buffer instance
 * 
 * @param value - The value to check
 * @returns True if the value is a Buffer, false otherwise
 */
function isBuffer(value: unknown): value is Buffer {
    return Buffer.isBuffer(value);
}

interface ExtractedOrdinal {
  contentType: string;
  content: Buffer;
  sourceInfo: {
    inputIndex: number;
    witnessIndex: number;
    txid?: string;
    vout?: number;
  };
}

interface TransactionCache {
  basicTransaction: TransactionWithOrdinal;
  extractedOrdinals: ExtractedOrdinal[];
  rawHex?: string;
}

type RequestCache = Set<string>;

/**
 * OrdinalsClient provides methods to interact with the Ordinals protocol
 * Handles key generation, transaction decoding, and blockchain data retrieval
 */
export class OrdinalsClient {
  private network: bitcoin.networks.Network;
  private apiBase: string;
  private transactionCache: SimpleCache<TransactionCache>;
  private requestCache: RequestCache;
  private imageTempDir: string;

  /**
   * Creates a new Ordinals client with the specified configuration
   * 
   * @param config - Configuration object with network and API settings
   */
  constructor(config: Config) {
    this.network =
      config.network === "testnet"
        ? bitcoin.networks.testnet
        : bitcoin.networks.bitcoin;
    this.apiBase = config.blockstreamApiBase;
    this.transactionCache = new SimpleCache<TransactionCache>(300); // 5 minutes TTL
    this.requestCache = new Set<string>();
    
    // Create a temporary directory for storing images - ALWAYS in ~/.cache/mcp-inscription
    // Use the config path (now defaulted to ~/.cache/mcp-inscription in ConfigSchema)
    this.imageTempDir = config.imageTempDir;
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.imageTempDir)) {
      try {
        fs.mkdirSync(this.imageTempDir, { recursive: true });
        logger.info(`Created image directory: ${this.imageTempDir}`);
      } catch (error) {
        logger.error({ error }, `Failed to create image directory: ${this.imageTempDir}`);
      }
    }
    
    logger.info(`ord client initialized with network: ${config.network}, API: ${this.apiBase}, images: ${this.imageTempDir}`);
  }

  /**
   * Returns the current configuration of the ord client
   * 
   * @returns The current configuration object
   */
  getConfig(): Config {
    return {
      network: this.network === bitcoin.networks.testnet ? "testnet" : "mainnet",
      blockstreamApiBase: this.apiBase,
      imageTempDir: this.imageTempDir
    };
  }

  /**
   * Helper method to extract content type and data from an Ordinal inscription script.
   * @param scriptBuffer
   */
  private extractOrdinalContent(scriptBuffer: Buffer): { contentType: string; content: Buffer } | null {
    try {
      const decompiled = bitcoin.script.decompile(scriptBuffer);
      if (!decompiled) { return null; }
      const ifIndex = decompiled.findIndex((op) => op === bitcoin.opcodes.OP_IF);
      if (ifIndex === -1 || ifIndex === 0 || decompiled[ifIndex - 1] !== bitcoin.opcodes.OP_FALSE) { return null; }
      const endifIndex = decompiled.findIndex((op, idx) => idx > ifIndex && op === bitcoin.opcodes.OP_ENDIF);
      if (endifIndex === -1) { return null; }
      const ordPushIndex = decompiled.findIndex((op, idx) => idx > ifIndex && idx < endifIndex && isBuffer(op) && op.toString() === 'ord');
      if (ordPushIndex === -1) { return null; }
      let contentTypeIndex = -1;
      let contentType: string | null = null;
      if (ordPushIndex + 1 < endifIndex && (decompiled[ordPushIndex + 1] === bitcoin.opcodes.OP_1 || decompiled[ordPushIndex + 1] === 1)) {
         if (ordPushIndex + 2 < endifIndex && isBuffer(decompiled[ordPushIndex + 2])) { contentTypeIndex = ordPushIndex + 2; contentType = (decompiled[contentTypeIndex] as Buffer).toString('utf8'); }
      } else {
          if (ordPushIndex + 1 < endifIndex && isBuffer(decompiled[ordPushIndex + 1])) { contentTypeIndex = ordPushIndex + 1; contentType = (decompiled[contentTypeIndex] as Buffer).toString('utf8'); }
      }
      if (contentTypeIndex === -1 || !contentType) { return null; }
      let separatorIndex = -1;
      if (contentTypeIndex + 1 < endifIndex) {
          const nextOp = decompiled[contentTypeIndex + 1];
          if (nextOp === bitcoin.opcodes.OP_0) { separatorIndex = contentTypeIndex + 1; }
          else if (isBuffer(nextOp) && nextOp.length === 1 && nextOp[0] === 0) { separatorIndex = contentTypeIndex + 1; }
      }
      if (separatorIndex === -1) { return null; }
      const dataChunks: Buffer[] = [];
      for (let i = separatorIndex + 1; i < endifIndex; i++) {
        const op = decompiled[i];
        if (isBuffer(op)) { dataChunks.push(op); }
        else { logger.warn(`Unexpected opcode ${bitcoin.script.toASM([op])} found within data section at index ${i}.`); }
      }
      const fullContent = Buffer.concat(dataChunks);
      logger.info(`Successfully extracted inscription: Type=${contentType}, Content Size=${fullContent.length}`);
      return { contentType, content: fullContent };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error({ 
          error: error.message, 
          stack: error.stack, 
          bufferHex: scriptBuffer.toString('hex') 
        }, "Error during ordinal content extraction");
      } else {
        logger.error({ 
          error: String(error), 
          bufferHex: scriptBuffer.toString('hex') 
        }, "Unknown error during ordinal content extraction");
      }
      return null;
    }
  }

  /**
   * Centralized method to extract all Ordinal inscriptions from a transaction
   * Avoids redundant processing of the same data
   * 
   * @param txParsed - The already parsed transaction object
   * @returns An array of extracted Ordinal inscriptions
   */
  private extractAllOrdinals(txParsed: BlockstreamTx): ExtractedOrdinal[] {
    const extractedOrdinals: ExtractedOrdinal[] = [];
    logger.debug(`Scanning for Ordinal inscriptions in tx ${txParsed.txid}`);

    // Process all inputs and their witness data
    txParsed.vin.forEach((input, inputIndex) => {
      if (input.witness && input.witness.length > 0) {
        input.witness.forEach((witnessHex, witnessIndex) => {
          try {
            const witnessBuffer = Buffer.from(witnessHex, 'hex');
            const extracted = this.extractOrdinalContent(witnessBuffer);
            
            if (extracted) {
              extractedOrdinals.push({
                contentType: extracted.contentType,
                content: extracted.content,
                sourceInfo: {
                  inputIndex,
                  witnessIndex,
                  txid: input.txid,
                  vout: input.vout
                }
              });
              
              logger.debug(`Found ordinal in tx ${txParsed.txid}, input ${inputIndex}, witness ${witnessIndex}`);
            }
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            logger.debug(`Error extracting ordinal from witness: ${errorMsg}`);
          }
        });
      }
    });

    if (extractedOrdinals.length > 0) {
      logger.info(`Extracted ${extractedOrdinals.length} Ordinal inscription(s) from tx ${txParsed.txid}`);
    } else {
      logger.debug(`No Ordinal inscriptions found in tx ${txParsed.txid}`);
    }

    return extractedOrdinals;
  }

  /**
   * Creates a TransactionWithOrdinal object from base data and extracted inscriptions
   * 
   * @param txParsed - The base transaction data
   * @param extractedOrdinals - The extracted Ordinal inscriptions
   * @returns A complete TransactionWithOrdinal object
   */
  private buildTransactionWithOrdinal(
    txParsed: BlockstreamTx, 
    extractedOrdinals: ExtractedOrdinal[]
  ): TransactionWithOrdinal {
    // Create the base transaction object
    const transactionInfo: TransactionWithOrdinal = {
      txid: txParsed.txid,
      version: txParsed.version,
      locktime: txParsed.locktime,
      size: txParsed.size,
      weight: txParsed.weight,
      fee: txParsed.fee,
      status: {
        confirmed: txParsed.status.confirmed,
        blockHeight: txParsed.status.block_height,
        blockHash: txParsed.status.block_hash,
        blockTime: txParsed.status.block_time
      },
      inputs: txParsed.vin.map((input: BlockstreamTxVin) => ({
        txid: input.txid,
        vout: input.vout,
        sequence: input.sequence,
        prevout: input.prevout ? {
          value: input.prevout.value,
          scriptPubKey: input.prevout.scriptpubkey,
          scriptPubKeyAsm: input.prevout.scriptpubkey_asm,
          scriptPubKeyType: input.prevout.scriptpubkey_type,
          scriptPubKeyAddress: input.prevout.scriptpubkey_address
        } : undefined,
        scriptSig: input.scriptsig,
        scriptSigAsm: input.scriptsig_asm,
        witness: input.witness,
        isCoinbase: input.is_coinbase,
      })),
      outputs: txParsed.vout.map((output: BlockstreamTxVout) => ({
        value: output.value,
        scriptPubKey: output.scriptpubkey,
        scriptPubKeyAsm: output.scriptpubkey_asm,
        scriptPubKeyType: output.scriptpubkey_type,
        scriptPubKeyAddress: output.scriptpubkey_address,
      })),
      ordinal: null
    };

    // Add the first inscription as the main inscription (for backward compatibility)
    if (extractedOrdinals.length > 0) {
      const firstOrdinal = extractedOrdinals[0];
      transactionInfo.ordinal = {
        isOrdinal: true,
        content: {
          type: firstOrdinal.contentType,
          data: firstOrdinal.content.toString('hex')
        }
      };
    }

    return transactionInfo;
  }

  /**
   * Fetches transaction details and decodes Ordinal data.
   * Optimized to better handle transactions with multiple inscriptions and avoid redundant processing.
   * 
   * @param txid - Transaction ID to fetch
   * @param includeRaw - Whether to include the raw transaction hex (default: false)
   * @returns Promise containing the transaction with ordinal data
   * @throws {BitcoinError} If the transaction cannot be retrieved or decoded
   */
  async getTransaction(txid: string, includeRaw: boolean = false): Promise<TransactionWithOrdinal> {
    try {
      logger.debug(`Fetching transaction: ${txid}, includeRaw=${includeRaw}`);

      // Check cache first
      const cached = this.transactionCache.get(txid);
      if (cached) {
        logger.debug(`Transaction found in cache: ${txid}`);
        return cached.basicTransaction;
      }

      // Block cache while making the request
      this.requestCache.add(txid);
      
      try {
        // Retrieve transaction details from the Bitcoin API
        const res = await fetch(`${this.apiBase}/tx/${txid}`);
        if (!res.ok) {
          const errorText = await res.text();
          logger.error(`Failed to fetch transaction details for ${txid}: ${res.status} ${errorText}`);
          throw new Error(`Transaction not found: ${res.status}`);
        }
        
        const txParsed = await res.json() as BlockstreamTx;
        
        // Extract all Ordinal inscriptions in a single pass
        const extractedOrdinals = this.extractAllOrdinals(txParsed);
        
        // Fetch raw hex if requested or needed
        let rawHex: string | undefined = undefined;
        if (includeRaw) {
          try {
            rawHex = await this.getRawTransaction(txid);
          } catch (hexError) {
            logger.warn(`Could not fetch raw tx: ${hexError instanceof Error ? hexError.message : String(hexError)}`);
          }
        }
        
        // Build the transaction info
        const transactionInfo = this.buildTransactionWithOrdinal(txParsed, extractedOrdinals);
        
        // Cache the results
        this.transactionCache.set(txid, {
          basicTransaction: transactionInfo,
          extractedOrdinals,
          rawHex,
        });
        
        return transactionInfo;
      } finally {
        // Unblock cache in all cases
        this.requestCache.delete(txid);
      }
    } catch (error: unknown) {
      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        txid 
      }, "Failed to fetch or process transaction");
      
      if (error instanceof BitcoinError) throw error;
      
      throw handleBlockchainError(error, "Transaction Fetch/Process", txid);
    }
  }

  /**
   * Gets the raw transaction hex for a given transaction ID
   * 
   * @param txid - The transaction ID to fetch
   * @returns Promise containing the raw transaction hex
   * @throws {BitcoinError} If the transaction cannot be retrieved
   */
  async getRawTransaction(txid: string): Promise<string> {
     try {
      const res = await fetch(`${this.apiBase}/tx/${txid}/hex`);
      if (!res.ok) {
          const errorText = await res.text();
          logger.error(`Failed to fetch raw transaction ${txid}: ${res.status} ${errorText}`);
        throw new Error(`Raw transaction not found: ${res.status}`);
      }
      const rawHex = await res.text();
       if (!rawHex || typeof rawHex !== 'string' || rawHex.length === 0) {
           throw new Error(`Received empty or invalid raw hex for ${txid}`);
       }
       return rawHex;
    } catch (error: unknown) {
      if (error instanceof BitcoinError) throw error;
      throw handleBlockchainError(error, "Raw Transaction Fetch", txid);
    }
  }

  /**
   * Decodes witness data containing Ordinal inscriptions from a transaction.
   * Optimized to use the cache and avoid duplicate extraction.
   * 
   * @param txid - The transaction ID to decode witness data from
   * @param formatImageOption - Option for how to handle image data (default: "base64")
   * @returns Promise containing an array of decoded inscription content strings
   * @throws {BitcoinError} If the transaction cannot be retrieved or decoded
   */
  async decodeWitness(txid: string, formatImageOption: FormatImageOption = "base64"): Promise<string[]> {
    try {
      logger.debug(`Decoding witness (Ordinals) for transaction: ${txid}, formatImageOption=${formatImageOption}`);
      
      // Check the cache first
      const cached = this.transactionCache.get(txid);
      
      let extractedOrdinals: ExtractedOrdinal[] = [];
      
      if (cached) {
        logger.debug(`Using cached ordinals data for tx ${txid}`);
        extractedOrdinals = cached.extractedOrdinals;
      } else {
        // If not in cache, we need to retrieve the transaction first
        // getTransaction will extract all inscriptions and put them in cache
        await this.getTransaction(txid, false);
        
        // Now we can get the data from the cache
        const newCached = this.transactionCache.get(txid);
        if (newCached) {
          extractedOrdinals = newCached.extractedOrdinals;
        } else {
          logger.warn(`Transaction ${txid} not found in cache after getTransaction call`);
        }
      }
      
      // Format and return the found inscriptions
      const decodedData: string[] = [];
      
      if (extractedOrdinals.length === 0) {
        logger.info(`No Ordinal inscriptions found in transaction ${txid}`);
        return decodedData;
      }
      
      // Convert each extracted inscription to the requested format
      extractedOrdinals.forEach((ordinal, index) => {
        const formattedContent = this.formatInscriptionContent(
          ordinal.contentType,
          ordinal.content,
          formatImageOption,
          txid,
          index
        );
        
        if (formattedContent) {
          decodedData.push(formattedContent);
        }
      });
      
      logger.info(`Successfully decoded ${decodedData.length} ordinal inscription(s) from tx ${txid}`);
      return decodedData;
    } catch (error: unknown) {
      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        txid 
      }, "Failed to decode witness data");
      
      if (error instanceof BitcoinError) throw error;
      throw handleBlockchainError(error, "Witness Data Decode", txid);
    }
  }
  
  /**
   * Helper method to format inscription content based on its type
   * Now supports saving images to files as an option
   * 
   * @param contentType - The MIME type of the content
   * @param contentBuffer - Buffer containing the raw content
   * @param formatImageOption - Option for how to handle image data ("base64" or "file")
   * @param txid - Transaction ID (for file naming)
   * @param index - Index of inscription within transaction (for file naming)
   * @returns Formatted content string or null if formatting fails
   */
  private formatInscriptionContent(
    contentType: string, 
    contentBuffer: Buffer, 
    formatImageOption: FormatImageOption = "base64",
    txid?: string,
    index: number = 0
  ): string | null {
    try {
      if (contentType.startsWith('image/')) {
        // Handle image data according to the option
        if (formatImageOption === "file" && txid) {
          // Ensure the temp directory exists (now always ~/.cache/mcp-inscription)
          if (!fs.existsSync(this.imageTempDir)) {
            try {
              fs.mkdirSync(this.imageTempDir, { recursive: true });
              logger.info(`Created image directory: ${this.imageTempDir}`);
            } catch (error) {
              logger.error({ error }, `Failed to create image directory: ${this.imageTempDir}`);
              throw new Error(`Failed to create image directory: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
          
          const extension = this.getFileExtensionFromMimeType(contentType);
          const filename = `${txid}_${index}${extension}`;
          const filePath = path.join(this.imageTempDir, filename);
          
          // Check if file already exists to avoid unnecessary writes
          if (!fs.existsSync(filePath)) {
            // Write image data to file
            fs.writeFileSync(filePath, contentBuffer);
            logger.info(`Saved image to file: ${filePath}`);
          } else {
            logger.info(`Image file already exists: ${filePath}`);
          }
          
          // Return absolute file path for consistency across environments
          const absolutePath = path.resolve(filePath);
          
          // CRITICAL: Convert Windows paths to forward slashes, but DO NOT add file:// prefix
          let formattedPath = absolutePath.replace(/\\/g, '/');
          // Explicitly remove any file:// prefix if present
          formattedPath = formattedPath.replace(/^file:\/\/+/, '');
          
          logger.debug({
            originalPath: absolutePath,
            formattedPath: formattedPath,
          }, `Using AI-compatible image path (no file:// prefix)`);
          
          // Return the formatted absolute path
          return formattedPath;
        } else {
          // Default behavior - return base64
          const base64Data = contentBuffer.toString('base64');
          return `data:${contentType};base64,${base64Data}`;
        }
      } else if (contentType === 'application/json') {
        try {
          const jsonString = contentBuffer.toString('utf8');
          const jsonData = JSON.parse(jsonString);
          return JSON.stringify(jsonData, null, 2);
        } catch (e: unknown) {
          logger.error({ 
            error: e instanceof Error ? e.message : String(e) 
          }, "Failed to parse JSON content from ordinal");
          return contentBuffer.toString('utf8'); // Fallback
        }
      } else if (contentType.startsWith('text/')) {
        return contentBuffer.toString('utf8');
      } else {
        const base64Data = contentBuffer.toString('base64');
        return `data:${contentType};base64,${base64Data}`;
      }
    } catch (error: unknown) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        contentType
      }, "Error formatting inscription content");
      return null;
    }
  }

  /**
   * Helper method to get file extension from MIME type
   * 
   * @param mimeType - The MIME type to convert to a file extension
   * @returns File extension with leading dot
   */
  private getFileExtensionFromMimeType(mimeType: string): string {
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
   * Returns the image of an Ordinal inscription directly without using a temporary file.
   * Optimized to use the cache and avoid redundant extractions.
   * 
   * @param txid - The ID of the transaction containing the inscription
   * @returns Promise with an object containing the MIME type and binary image data, or null if no image is found
   */
  async getOrdinalImage(txid: string): Promise<{ mimeType: string; data: Buffer } | null> {
    try {
      logger.debug(`Directly retrieving Ordinal image for transaction: ${txid}`);
      
      // Check the cache first
      const cached = this.transactionCache.get(txid);
      
      let extractedOrdinals: ExtractedOrdinal[] = [];
      
      if (cached) {
        logger.debug(`Using cached ordinals data for tx ${txid}`);
        extractedOrdinals = cached.extractedOrdinals;
      } else {
        // If not in cache, we need to retrieve the transaction first
        await this.getTransaction(txid, false);
        
        // Now we can get the data from the cache
        const newCached = this.transactionCache.get(txid);
        if (newCached) {
          extractedOrdinals = newCached.extractedOrdinals;
        } else {
          logger.warn(`Transaction ${txid} not found in cache after getTransaction call`);
        }
      }
      
      // Look for an image among the extracted inscriptions
      for (const ordinal of extractedOrdinals) {
        if (ordinal.contentType.startsWith('image/')) {
          return {
            mimeType: ordinal.contentType,
            data: ordinal.content
          };
        }
      }
      
      // No image found
      logger.info(`No Ordinal image found in transaction ${txid}`);
      return null;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        txid
      }, "Error retrieving Ordinal image");
      
      if (error instanceof BitcoinError) throw error;
      throw handleBlockchainError(error, "Ordinal Image Retrieval", txid);
    }
  }
}