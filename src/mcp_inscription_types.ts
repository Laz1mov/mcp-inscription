// MCP-Inscription Server Type definitions

import { z } from "zod";
import * as os from 'os';
import * as path from 'path';
// Note: Avoid directly importing external library types here
// to keep these types dependency-free, use 'any' or define intermediate interfaces.

export const ConfigSchema = z.object({
  network: z.enum(["mainnet", "testnet"]).default("mainnet"),
  blockstreamApiBase: z.string().url().default("https://blockstream.info/api"),
  imageTempDir: z.string().default(path.join(os.homedir(), '.cache', 'mcp-inscription')),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface GeneratedKey {
  address: string;
  privateKey: string;
  publicKey: string;
}

// Type for image formatting option
export type FormatImageOption = "base64" | "file";

export interface DecodedTx {
  txid: string;
  version: number;
  inputs: {
    txid: string;
    vout: number;
    sequence: number;
  }[];
  outputs: {
    value: number;
    scriptPubKey: string;
    address?: string;
  }[];
  locktime: number;
}

export interface BlockInfo {
  hash: string;
  height: number;
  timestamp: number;
  txCount: number;
  size: number;
  weight: number;
}

export interface TransactionInfo {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    blockHeight?: number;
    blockHash?: string;
    blockTime?: number;
  };
  inputs: {
    txid: string;
    vout: number;
    sequence: number;
    prevout?: {
      value: number;
      scriptPubKey: string;
      address?: string;
    };
    witness?: string[];
  }[];
  outputs: {
    value: number;
    scriptPubKey: string;
    address?: string;
  }[];
}

export interface OrdinalInfo {
  isOrdinal: boolean;
  content?: {
    type: string;
    data: string; // Usually hex or base64 encoded raw data
  };
}

export interface TransactionWithOrdinal {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    blockHeight?: number;
    blockHash?: string;
    blockTime?: number;
  };
  inputs: Array<{
    txid?: string; // May be undefined for coinbase
    vout?: number; // May be undefined for coinbase
    sequence: number;
    prevout?: {
      value: number;
      scriptPubKey: string;
      scriptPubKeyAsm: string;
      scriptPubKeyType: string;
      scriptPubKeyAddress?: string;
    };
    scriptSig?: string;
    scriptSigAsm?: string;
    witness?: string[];
    isCoinbase: boolean;
  }>;
  outputs: Array<{
    value: number;
    scriptPubKey: string;
    scriptPubKeyAsm: string;
    scriptPubKeyType: string;
    scriptPubKeyAddress?: string;
  }>;
  ordinal?: OrdinalInfo | null;
}

export enum BitcoinErrorCode {
  KEY_GENERATION_ERROR = "key_generation_error",
  DECODE_ERROR = "decode_error",
  BLOCKCHAIN_ERROR = "blockchain_error",
  VALIDATION_ERROR = "validation_error",
  EXTERNAL_SERVICE_ERROR = "external_service_error",
  FILE_SYSTEM_ERROR = "file_system_error",
}

/**
 * Custom error class for Bitcoin-related operations
 * Extends the standard Error class with additional Bitcoin-specific properties
 */
export class BitcoinError extends Error {
  /**
   * Creates a new Bitcoin error
   * 
   * @param message - Human-readable error message
   * @param code - Error code identifying the type of error
   * @param status - HTTP status code to associate with this error
   */
  constructor(
    message: string,
    public readonly code: BitcoinErrorCode,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "BitcoinError";
  }
}

export enum ServerMode {
  STDIO = "stdio",
  SSE = "sse",
}

export interface ServerConfig {
  mode: ServerMode;
  port?: number;
}

export interface OrdinalsServer {
  start(): Promise<void>;
  shutdown(code?: number): Promise<never>;
}

// Tool schemas
export const ValidateAddressSchema = z.object({
  address: z.string().min(1, "Address is required"),
});

export const DecodeTxSchema = z.object({
  rawHex: z.string().min(1, "Raw transaction hex is required"),
});

export const GetTransactionSchema = z.object({
  txid: z.string().length(64, "Invalid transaction ID"),
});

// Schema for decoding witness with image formatting option
export const DecodeWitnessSchema = z.object({
  txid: z.string().length(64, "Invalid transaction ID"),
  formatImageOption: z.enum(["base64", "file"]).optional().default("base64"),
});

export interface TransactionInput {
  txid: string;
  vout: number;
  sequence: number;
  witness?: string[];
} 