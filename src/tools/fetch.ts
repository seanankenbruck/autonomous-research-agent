/**
 * Fetch Tool
 * Fetch and extract content from URLs
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { BaseTool } from './base-tool';
import {
  FetchInput,
  FetchOutput,
  FetchConfig,
  FetchedContent,
  ToolResult,
  ToolContext,
} from './types';

interface CachedContent {
  content: FetchedContent;
  timestamp: number;
}

/**
 * FetchTool - Retrieve and extract content from web pages
 *
 * Key features:
 * - Fetch content from URLs
 * - Extract main content from HTML using Mozilla Readability
 * - Extract metadata (title, author, date, etc.)
 * - Handle redirects
 * - Optional caching
 * - Support for different content types
 */
export class FetchTool extends BaseTool<FetchInput, FetchOutput, FetchConfig> {
  readonly name = 'web_fetch';
  readonly description = 'Fetch and extract content from web URLs';
  readonly version = '1.0.0';

  private httpClient: AxiosInstance;
  private cache: Map<string, CachedContent> = new Map();

  constructor(config: FetchConfig) {
    super({
      enabled: true,
      timeout: 30000,
      followRedirects: true,
      maxRedirects: 5,
      validateSSL: true,
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      userAgent: 'Mozilla/5.0 (compatible; ResearchAgent/1.0)',
      ...config,
    });

    // Initialize HTTP client with configuration
    this.httpClient = axios.create({
      timeout: this.config.timeout,
      maxRedirects: this.config.maxRedirects,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      httpsAgent: this.config.validateSSL ? undefined : new (require('https').Agent)({
        rejectUnauthorized: false,
      }),
    });
  }

  /**
   * Execute fetch operation
   */
  protected async executeImpl(
    input: FetchInput,
    context: ToolContext
  ): Promise<ToolResult<FetchOutput>> {
    const startTime = Date.now();

    try {
      // Step 1 - Check cache if enabled
      if (this.config.cacheEnabled) {
        const cached = this.getFromCache(input.url);
        if (cached) {
          context.logger.debug(`[${this.name}] Cache hit`, {
            url: input.url,
          });

          return this.createSuccessResult({
            content: cached,
            fetchTime: Date.now() - startTime,
            cached: true,
          }, {
            url: input.url,
            cached: true,
          });
        }
      }

      context.logger.debug(`[${this.name}] Fetching URL`, {
        url: input.url,
        extractContent: input.extractContent,
        includeMetadata: input.includeMetadata,
      });

      // Step 2 - Fetch content from URL with retry logic
      const response = await this.withRetry(
        () => this.httpClient.get(input.url, {
          timeout: input.timeout || this.config.timeout,
          responseType: 'text',
        }),
        this.config.maxRetries || 3
      );

      // Step 3 - Determine content type
      const contentType = response.headers['content-type'] || '';
      const isHTML = contentType.includes('text/html') || contentType.includes('application/xhtml');

      // Step 4 - Extract content based on type and options
      let extractedContent: FetchedContent;

      if (isHTML && input.extractContent !== false) {
        // Extract readable content from HTML
        extractedContent = await this.extractHTMLContent(response.data, input.url);
      } else {
        // Return raw content
        extractedContent = {
          url: input.url,
          content: response.data,
          contentType,
          contentLength: response.data.length,
        };
      }

      // Step 5 - Extract metadata if requested and content is HTML
      if (input.includeMetadata !== false && isHTML) {
        const metadata = await this.extractMetadata(response.data);
        extractedContent.metadata = metadata;

        // Add top-level fields from metadata if not already set
        if (!extractedContent.author && metadata.author) {
          extractedContent.author = metadata.author;
        }
        if (!extractedContent.publishedDate && metadata.publishedDate) {
          extractedContent.publishedDate = new Date(metadata.publishedDate);
        }
      }

      // Step 6 - Cache the result
      if (this.config.cacheEnabled) {
        this.addToCache(input.url, extractedContent);
      }

      // Step 7 - Create output
      const output: FetchOutput = {
        content: extractedContent,
        fetchTime: Date.now() - startTime,
        cached: false,
      };

      context.logger.info(`[${this.name}] Fetch completed`, {
        url: input.url,
        contentLength: extractedContent.contentLength,
        contentType: extractedContent.contentType,
        fetchTime: output.fetchTime,
      });

      return this.createSuccessResult(output, {
        url: input.url,
        fetchTime: output.fetchTime,
        contentLength: extractedContent.contentLength,
      });
    } catch (error) {
      context.logger.error(`[${this.name}] Fetch failed`, {
        url: input.url,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Validate fetch input
   */
  async validateInput(input: FetchInput): Promise<boolean> {
    // Check required fields
    if (!this.hasRequiredFields(input, ['url'])) {
      return false;
    }

    // Validate URL format
    try {
      new URL(input.url);
    } catch {
      return false;
    }

    // Validate timeout if provided
    if (input.timeout !== undefined) {
      if (input.timeout < 1000 || input.timeout > 120000) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get input schema for LLM tool use
   */
  getInputSchema(): object {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from',
          format: 'uri',
        },
        extractContent: {
          type: 'boolean',
          description: 'Extract main content from HTML (removes navigation, ads, etc.)',
          default: true,
        },
        includeMetadata: {
          type: 'boolean',
          description: 'Extract metadata like title, author, publish date',
          default: true,
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (1000-120000)',
          minimum: 1000,
          maximum: 120000,
        },
      },
      required: ['url'],
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Extract readable content from HTML using Mozilla Readability
   */
  private async extractHTMLContent(html: string, url: string): Promise<FetchedContent> {
    try {
      // Use Mozilla Readability for content extraction
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent) {
        // Successfully extracted article content
        return {
          url,
          title: article.title || undefined,
          content: article.textContent,
          contentType: 'text/html',
          contentLength: article.textContent.length,
        };
      }

      // Fallback: Use cheerio for basic extraction
      const $ = cheerio.load(html);

      // Remove non-content elements
      $('script, style, nav, footer, aside, header, .ad, .advertisement').remove();

      // Try to find main content
      const mainContent = $('article, main, .content, .post, .entry-content, body');
      const content = mainContent.text().trim();
      const title = $('title').text() || $('h1').first().text() || undefined;

      return {
        url,
        title,
        content,
        contentType: 'text/html',
        contentLength: content.length,
      };
    } catch (error) {
      throw new Error(`Failed to extract HTML content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract metadata from HTML
   */
  private async extractMetadata(html: string): Promise<any> {
    try {
      const $ = cheerio.load(html);

      const metadata: any = {
        description: $('meta[name="description"]').attr('content') ||
                    $('meta[property="og:description"]').attr('content'),
        keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()),
        author: $('meta[name="author"]').attr('content') ||
                $('meta[property="article:author"]').attr('content'),
        publishedDate: $('meta[property="article:published_time"]').attr('content') ||
                      $('meta[name="date"]').attr('content') ||
                      $('meta[name="publish_date"]').attr('content'),
        language: $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content'),
        ogTitle: $('meta[property="og:title"]').attr('content'),
        ogDescription: $('meta[property="og:description"]').attr('content'),
        ogImage: $('meta[property="og:image"]').attr('content'),
        twitterCard: $('meta[name="twitter:card"]').attr('content'),
      };

      // Remove undefined values
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined) {
          delete metadata[key];
        }
      });

      return metadata;
    } catch (error) {
      // Return empty metadata on error
      return {};
    }
  }

  /**
   * Get content from cache
   */
  private getFromCache(url: string): FetchedContent | null {
    const cached = this.cache.get(url);
    if (!cached) return null;

    // Check if cache is expired
    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTTL!) {
      this.cache.delete(url);
      return null;
    }

    return cached.content;
  }

  /**
   * Add content to cache
   */
  private addToCache(url: string, content: FetchedContent): void {
    this.cache.set(url, {
      content,
      timestamp: Date.now(),
    });

    // Implement cache size limit (max 100 entries)
    if (this.cache.size > 100) {
      // Remove oldest entry (first key in the map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [url, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.config.cacheTTL!) {
        this.cache.delete(url);
      }
    }
  }
}

/**
 * Factory function to create FetchTool instance
 */
export function createFetchTool(config: FetchConfig): FetchTool {
  return new FetchTool(config);
}
