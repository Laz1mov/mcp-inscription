/**
 * Centralized error handling utilities
 * Provides standardized error management for Bitcoin operations
 */

import { BitcoinError, BitcoinErrorCode } from '../mcp_inscription_types.js';
import logger from './logger.js';

/**
 * Handles errors from external libraries
 * 
 * @param error - The caught error
 * @param context - The context where the error occurred
 * @param txid - Associated transaction ID (optional)
 * @returns A standardized BitcoinError
 */
export function handleExternalLibraryError(
  error: unknown,
  context: string,
  txid?: string
): BitcoinError {
  if (error instanceof Error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      txid
    }, `[${context}] Error during operation`);
    
    return new BitcoinError(
      `${context} error: ${error.message}`,
      BitcoinErrorCode.EXTERNAL_SERVICE_ERROR
    );
  } else {
    const errorMessage = String(error);
    logger.error({
      error: errorMessage,
      txid
    }, `[${context}] Unknown error type`);
    
    return new BitcoinError(
      `${context} error: ${errorMessage}`,
      BitcoinErrorCode.EXTERNAL_SERVICE_ERROR
    );
  }
}

/**
 * Handles specific decoding errors
 * 
 * @param error - The caught error
 * @param context - The context where the error occurred
 * @param txid - Associated transaction ID (optional)
 * @returns A standardized BitcoinError
 */
export function handleDecodeError(
  error: unknown,
  context: string,
  txid?: string
): BitcoinError {
  if (error instanceof BitcoinError) {
    // If it's already a BitcoinError, return it directly
    return error;
  }
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error({
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    txid
  }, `[${context}] Decode error`);
  
  return new BitcoinError(
    `Failed to decode: ${errorMessage}`,
    BitcoinErrorCode.DECODE_ERROR
  );
}

/**
 * Handles errors related to blockchain API calls
 * 
 * @param error - The caught error
 * @param context - The context where the error occurred
 * @param resourceId - Resource identifier (txid, address, etc.)
 * @returns A standardized BitcoinError
 */
export function handleBlockchainError(
  error: unknown,
  context: string,
  resourceId?: string
): BitcoinError {
  if (error instanceof BitcoinError) {
    return error;
  }
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error({
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    resourceId
  }, `[${context}] Blockchain API error`);
  
  return new BitcoinError(
    `Blockchain API error: ${errorMessage}`,
    BitcoinErrorCode.BLOCKCHAIN_ERROR
  );
}

/**
 * Handles file system related errors and wraps them in a BitcoinError
 * 
 * @param error - The original file system error
 * @param context - The context where the error occurred
 * @param filePath - Optional file path associated with the error
 * @returns A standardized BitcoinError
 */
export function handleFileSystemError(
  error: unknown,
  context: string,
  filePath?: string
): BitcoinError {
  if (error instanceof BitcoinError) {
    return error;
  }
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error({
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    filePath
  }, `[${context}] File system error`);
  
  return new BitcoinError(
    `File system error in ${context}: ${errorMessage}`,
    BitcoinErrorCode.FILE_SYSTEM_ERROR
  );
} 