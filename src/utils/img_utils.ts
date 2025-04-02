/**
 * 🖼️ Image Utilities
 * ==================
 * 
 * Utilities for handling image paths and URLs in a cross-platform manner.
 * This module ensures images are properly formatted for display in HTML or other contexts,
 * taking into account OS differences in path formats.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from './logger.js';

/**
 * Get file extension from MIME type
 * @param mimeType The MIME type of the image
 * @returns The corresponding file extension
 */
export function getFileExtensionFromMimeType(mimeType: string): string {
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
 * Determine the MIME type from the file path
 * @param filePath The file path
 * @returns The corresponding MIME type
 */
export function getMimeTypeFromPath(filePath: string): string {
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

/**
 * Generate a file path for an image based on transaction ID and content type
 * @param txid Transaction ID associated with the image
 * @param mimeType MIME type of the image
 * @param index Optional index for multiple images in one transaction
 * @param tempDir Optional custom temp directory
 * @returns Object containing file path and other properties
 */
export function getImageFilePath(
  txid: string,
  mimeType: string,
  index = 0,
  tempDir?: string
): { filePath: string, tempDir: string, extension: string, filename: string } {
  const extension = getFileExtensionFromMimeType(mimeType);
  const filename = `${txid}${index > 0 ? `_${index}` : ''}${extension}`;
  
  // Use appropriate temp directory for all platforms
  const imageTempDir = tempDir || path.join(os.tmpdir(), 'bitcoin-mcp-images');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(imageTempDir)) {
    try {
      fs.mkdirSync(imageTempDir, { recursive: true });
      logger.debug(`Created image directory: ${imageTempDir}`);
    } catch (error) {
      logger.error({ error }, `Failed to create image directory: ${imageTempDir}`);
      throw new Error(`Could not create image directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return {
    filePath: path.join(imageTempDir, filename),
    tempDir: imageTempDir,
    extension,
    filename
  };
}

/**
 * Get platform-specific URL for an image file
 * Returns a URL compatible with HTML img tags that works on the current OS
 * @param filePath Path to the image file
 * @returns URL for accessing the image
 */
export function getImageUrl(filePath: string): string {
  // Ensure absolute path
  const absolutePath = path.resolve(filePath);
  
  // Format differently based on OS
  if (process.platform === 'win32') {
    // Windows requires triple slash for file protocol and forward slashes
    return `file:///${absolutePath.replace(/\\/g, '/')}`;
  } else {
    // Unix-like OS: use standard file protocol format
    return `file://${absolutePath}`;
  }
}

/**
 * Save image data to file and get its URL
 * @param data Image data (Buffer)
 * @param txid Transaction ID
 * @param mimeType MIME type of the image
 * @param index Optional index for multiple images
 * @param tempDir Optional custom temp directory
 * @returns Object with file info and URL
 */
export function saveImageAndGetUrl(
  data: Buffer,
  txid: string,
  mimeType: string,
  index = 0,
  tempDir?: string
): { filePath: string, url: string, sizeKB: number } {
  const { filePath } = getImageFilePath(txid, mimeType, index, tempDir);
  
  // Write image data to file
  fs.writeFileSync(filePath, data);
  
  // Get file size in KB
  const stats = fs.statSync(filePath);
  const sizeKB = Math.round(stats.size / 1024);
  
  return {
    filePath,
    url: getImageUrl(filePath),
    sizeKB
  };
}

/**
 * Convert a base64 data URI to a file and get its URL
 * @param dataUri Base64 data URI string
 * @param txid Transaction ID
 * @param index Optional index for multiple images
 * @param tempDir Optional custom temp directory
 * @returns Object with file info and URL
 */
export function dataUriToFileUrl(
  dataUri: string,
  txid: string,
  index = 0,
  tempDir?: string
): { filePath: string, url: string, sizeKB: number, mimeType: string } {
  // Extract MIME type and base64 data
  const match = dataUri.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid data URI format');
  }
  
  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  const result = saveImageAndGetUrl(buffer, txid, mimeType, index, tempDir);
  
  return {
    ...result,
    mimeType
  };
}

/**
 * Convert hex-encoded data to a file and get its URL
 * @param hexData Hex-encoded string
 * @param txid Transaction ID
 * @param mimeType MIME type of the image
 * @param index Optional index for multiple images
 * @param tempDir Optional custom temp directory
 * @returns Object with file info and URL
 */
export function hexDataToFileUrl(
  hexData: string,
  txid: string,
  mimeType: string,
  index = 0,
  tempDir?: string
): { filePath: string, url: string, sizeKB: number } {
  const buffer = Buffer.from(hexData, 'hex');
  return saveImageAndGetUrl(buffer, txid, mimeType, index, tempDir);
}

/**
 * Handle any type of image source and process it to a file with OS-compatible URL
 * This is a unified function to handle all image source types in one place
 * @param imageData Image data (data URI, file path, or fallback to transaction data)
 * @param txid Transaction ID
 * @param txInfo Transaction with ordinal data (for fallback)
 * @param index Optional index for multiple images
 * @param tempDir Optional custom temp directory
 * @returns Object with processed image info
 */
export async function processImageSource(
  imageData: string,
  txid: string,
  txInfo: { ordinal?: { content?: { type: string, data: string } } | null },
  index = 0, 
  tempDir?: string
): Promise<{ 
  filePath: string, 
  url: string, 
  mimeType: string, 
  sizeKB: number,
  buffer: Buffer
}> {
  // Case 1: File path (file://)
  if (imageData.startsWith('file://')) {
    const filePathRaw = imageData.substring(7);
    
    // Normalize path based on operating system
    const normalizedPath = path.normalize(decodeURIComponent(filePathRaw));
    
    // On Windows, if path starts with /, add drive letter
    const adjustedPath = process.platform === 'win32' && normalizedPath.startsWith('/') 
      ? normalizedPath.substring(1) 
      : normalizedPath;
    
    if (!fs.existsSync(adjustedPath)) {
      logger.warn(`File not found: ${adjustedPath}, attempting to retrieve from transaction data`);
      
      // Fallback - try to use inscription data from transaction
      if (txInfo?.ordinal?.content && txInfo.ordinal.content.type.startsWith('image/')) {
        const result = hexDataToFileUrl(
          txInfo.ordinal.content.data, 
          txid, 
          txInfo.ordinal.content.type,
          index, 
          tempDir
        );
        
        return {
          ...result,
          mimeType: txInfo.ordinal.content.type,
          buffer: fs.readFileSync(result.filePath)
        };
      } else {
        throw new Error(`File not found and unable to retrieve image data: ${adjustedPath}`);
      }
    }
    
    // File exists, read it
    const buffer = fs.readFileSync(adjustedPath);
    const mimeType = getMimeTypeFromPath(adjustedPath);
    const url = getImageUrl(adjustedPath);
    
    return {
      filePath: adjustedPath,
      url,
      mimeType,
      sizeKB: Math.round(buffer.length / 1024),
      buffer
    };
  }
  
  // Case 2: Data URI
  else if (imageData.startsWith('data:image/')) {
    const result = dataUriToFileUrl(imageData, txid, index, tempDir);
    
    return {
      ...result,
      buffer: fs.readFileSync(result.filePath)
    };
  }
  
  // Case 3: Transaction data fallback
  else if (txInfo?.ordinal?.content && txInfo.ordinal.content.type.startsWith('image/')) {
    const result = hexDataToFileUrl(
      txInfo.ordinal.content.data, 
      txid, 
      txInfo.ordinal.content.type,
      index, 
      tempDir
    );
    
    return {
      ...result,
      mimeType: txInfo.ordinal.content.type,
      buffer: fs.readFileSync(result.filePath)
    };
  }
  
  // No valid image source found
  throw new Error("Unsupported image data format or no valid image source found");
}

/**
 * Get image path format specifically for AI assistant context
 * CRITICAL: Must return a special format that works in AI environment
 * @param filePath Path to the image file
 * @returns Special path format compatible with AI assistant
 */
export function getHtmlImagePath(filePath: string): string {
  // For AI assistant environment, we must use a special format
  // which is simply the absolute path with no file:// prefix
  const absolutePath = path.resolve(filePath);
  
  // Convert all paths (including Windows) to format with forward slashes
  // without any file:// protocol prefix
  return absolutePath.replace(/\\/g, '/');
} 