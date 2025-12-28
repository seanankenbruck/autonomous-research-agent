/**
 * Base Tool Class
 * Abstract base class providing common functionality for all tools
 */

import { Tool, ToolResult, ToolContext, ToolConfig } from './types';
import { Logger } from '../utils/logger';

/**
 * Abstract base class for tools
 * Implements common functionality like error handling, timing, and validation
 */
export abstract class BaseTool<TInput = any, TOutput = any, TConfig extends ToolConfig = ToolConfig>
  implements Tool<TInput, TOutput, TConfig>
{
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly version: string;

  constructor(public config: TConfig) {}

  /**
   * Main execution method with error handling and timing
   */
  async execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>> {
    const startTime = Date.now();

    try {
      // Log execution start
      context.logger.debug(`[${this.name}] Starting execution`, { input });

      // Validate input
      const isValid = await this.validateInput(input);
      if (!isValid) {
        return this.createErrorResult('Invalid input provided', startTime);
      }

      // Check if tool is enabled
      if (this.config.enabled === false) {
        return this.createErrorResult('Tool is disabled', startTime);
      }

      // Execute with timeout
      const timeout = context.timeout || this.config.timeout || 30000;
      const result = await this.executeWithTimeout(
        () => this.executeImpl(input, context),
        timeout
      );

      // Log successful execution
      const duration = Date.now() - startTime;
      context.logger.info(`[${this.name}] Execution completed`, {
        duration,
        success: result.success,
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration,
        },
      };
    } catch (error) {
      // Log error
      context.logger.error(`[${this.name}] Execution failed`, {
        error: error instanceof Error ? error.message : String(error),
      });

      return this.createErrorResult(
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  /**
   * Abstract method - implement actual tool logic here
   * TODO: Implement in subclass
   */
  protected abstract executeImpl(
    input: TInput,
    context: ToolContext
  ): Promise<ToolResult<TOutput>>;

  /**
   * Validate input before execution
   * TODO: Override in subclass for custom validation
   */
  async validateInput(input: TInput): Promise<boolean> {
    // Basic validation - check if input exists
    if (input === null || input === undefined) {
      return false;
    }
    return true;
  }

  /**
   * Get JSON schema for tool input
   * TODO: Override in subclass with actual schema
   */
  abstract getInputSchema(): object;

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Create standardized error result
   */
  protected createErrorResult(error: string, startTime: number): ToolResult<TOutput> {
    return {
      success: false,
      error,
      metadata: {
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Create standardized success result
   */
  protected createSuccessResult(
    data: TOutput,
    metadata?: Record<string, any>
  ): ToolResult<TOutput> {
    return {
      success: true,
      data,
      metadata,
    };
  }

  /**
   * Retry logic for failed operations
   * TODO: Use this in executeImpl for operations that should be retried
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = delayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper to validate required fields
   */
  protected hasRequiredFields<T extends object>(
    obj: T,
    fields: (keyof T)[]
  ): boolean {
    return fields.every(field => {
      const value = obj[field];
      return value !== null && value !== undefined && value !== '';
    });
  }

  /**
   * Helper to sanitize input strings
   */
  protected sanitizeString(str: string, maxLength?: number): string {
    let sanitized = str.trim();
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
  }

  /**
   * Helper to validate URL format
   */
  protected isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper to validate email format
   */
  protected isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Helper to validate number is within range
   */
  protected isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Helper to validate array is not empty
   */
  protected isNonEmptyArray<T>(arr: any): arr is T[] {
    return Array.isArray(arr) && arr.length > 0;
  }

  /**
   * Helper to validate date is valid
   */
  protected isValidDate(date: any): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Helper to parse JSON safely
   * Returns null if parsing fails instead of throwing
   */
  protected parseJsonSafe<T = any>(json: string): T | null {
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }

  /**
   * Helper to stringify object safely
   * Returns empty string if stringification fails
   */
  protected stringifySafe(obj: any): string {
    try {
      return JSON.stringify(obj);
    } catch {
      return '';
    }
  }

  /**
   * Helper to extract domain from URL
   */
  protected extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * Helper to truncate text with ellipsis
   */
  protected truncateText(text: string, maxLength: number, ellipsis: string = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - ellipsis.length) + ellipsis;
  }

  /**
   * Helper to remove HTML tags from string
   */
  protected stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Helper to count words in text
   */
  protected countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Helper to deduplicate array items
   */
  protected deduplicate<T>(arr: T[]): T[] {
    return [...new Set(arr)];
  }

  /**
   * Helper to chunk array into smaller arrays
   */
  protected chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Helper to sleep/delay execution
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper to measure execution time
   */
  protected async measureTime<T>(
    fn: () => Promise<T>,
    label?: string
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;

    if (label) {
      console.debug(`[${this.name}] ${label} took ${duration}ms`);
    }

    return { result, duration };
  }

  /**
   * Helper to rate limit function calls
   * Ensures minimum delay between consecutive calls
   */
  protected createRateLimiter(minDelayMs: number): {
    execute: <T>(fn: () => Promise<T>) => Promise<T>;
  } {
    let lastCallTime = 0;

    return {
      execute: async <T>(fn: () => Promise<T>): Promise<T> => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;

        if (timeSinceLastCall < minDelayMs) {
          await this.sleep(minDelayMs - timeSinceLastCall);
        }

        lastCallTime = Date.now();
        return fn();
      },
    };
  }

  /**
   * Helper to batch process items with concurrency control
   */
  protected async batchProcess<TItem, TResult>(
    items: TItem[],
    processor: (item: TItem) => Promise<TResult>,
    options: {
      batchSize?: number;
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<TResult[]> {
    const {
      batchSize = 10,
      concurrency = 5,
      onProgress,
    } = options;

    const results: TResult[] = [];
    const chunks = this.chunk(items, batchSize);

    for (const chunk of chunks) {
      // Process chunk with concurrency limit
      const chunkPromises = chunk.map(item => processor(item));

      // Limit concurrency
      const chunkResults = await Promise.all(
        chunkPromises.slice(0, concurrency)
      );

      // Process remaining with concurrency
      for (let i = concurrency; i < chunkPromises.length; i++) {
        chunkResults.push(await chunkPromises[i]);
      }

      results.push(...chunkResults);

      if (onProgress) {
        onProgress(results.length, items.length);
      }
    }

    return results;
  }
}
