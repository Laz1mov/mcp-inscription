/**
 * Utilities for JSON manipulation with support for special types like BigInt
 */

/**
 * Replacer function for JSON.stringify that handles BigInt
 * 
 * @param key - Key of the key-value pair being processed
 * @param value - Value being processed
 * @returns The transformed value if necessary (BigInt converted to string)
 */
export const bigIntReplacer = (key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? value.toString() : value;

/**
 * Serializes an object to JSON while properly handling BigInt values
 * 
 * @param obj - The object to serialize
 * @param space - Number of spaces to use for indentation (optional)
 * @returns JSON string with BigInt values converted to strings
 */
export function safeStringify(obj: unknown, space?: number): string {
  return JSON.stringify(obj, bigIntReplacer, space);
}

/**
 * Attempts to parse JSON while handling errors gracefully
 * 
 * @param text - The JSON string to parse
 * @param defaultValue - Value to return if parsing fails
 * @returns The parsed object or defaultValue if an error occurs
 */
export function safeParse<T>(text: string, defaultValue?: T): T | null {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    return defaultValue !== undefined ? defaultValue : null;
  }
} 