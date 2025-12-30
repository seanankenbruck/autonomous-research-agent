/**
 * Fetch Tool Tests
 * Tests for web content fetching and extraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FetchTool } from '../../../src/tools/fetch';
import { FetchConfig } from '../../../src/tools/types';
import { createMockLogger } from '../../helpers';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('FetchTool', () => {
  let fetchTool: FetchTool;
  let logger: ReturnType<typeof createMockLogger>;
  let context: any;

  beforeEach(() => {
    logger = createMockLogger();
    context = {
      logger,
      sessionId: 'test-session',
      userId: 'test-user',
    };

    const config: FetchConfig = {
      enabled: true,
      timeout: 30000,
      cacheEnabled: false, // Disable cache for testing
    };

    // Mock axios.create
    const mockAxiosInstance = {
      get: vi.fn(),
    };
    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);

    fetchTool = new FetchTool(config);
  });

  describe('execute()', () => {
    it('should fetch HTML content successfully', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <article>
              <h1>Main Content</h1>
              <p>This is the main content of the page.</p>
            </article>
          </body>
        </html>
      `;

      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' },
      });

      const input = { url: 'https://example.com' };
      const result = await fetchTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.content.url).toBe('https://example.com');
      expect(result.data?.content.content).toContain('Main Content');
      expect(result.data?.fetchTime).toBeGreaterThanOrEqual(0);
      expect(result.data?.cached).toBe(false);
    });

    it('should extract metadata from HTML', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
            <meta name="author" content="Test Author">
            <meta property="og:title" content="OG Title">
          </head>
          <body><p>Content</p></body>
        </html>
      `;

      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get.mockResolvedValue({
        data: mockHtml,
        headers: { 'content-type': 'text/html' },
      });

      const input = { url: 'https://example.com', includeMetadata: true };
      const result = await fetchTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.content.metadata).toBeDefined();
      expect(result.data?.content.metadata?.description).toBe('Test description');
      expect(result.data?.content.metadata?.author).toBe('Test Author');
      expect(result.data?.content.metadata?.ogTitle).toBe('OG Title');
    });

    it('should handle non-HTML content', async () => {
      const mockText = 'Plain text content';

      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get.mockResolvedValue({
        data: mockText,
        headers: { 'content-type': 'text/plain' },
      });

      const input = { url: 'https://example.com/file.txt' };
      const result = await fetchTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.content.content).toBe(mockText);
      expect(result.data?.content.contentType).toBe('text/plain');
    });

    it('should handle fetch errors', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const input = { url: 'https://example.com' };
      const result = await fetchTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect custom timeout', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get.mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/plain' },
      });

      const input = { url: 'https://example.com', timeout: 5000 };
      await fetchTool.execute(input, context);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ timeout: 5000 })
      );
    });
  });

  describe('validateInput()', () => {
    it('should validate required URL field', async () => {
      const input = {};
      const result = await fetchTool.execute(input as any, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should validate URL format', async () => {
      const input = { url: 'not-a-valid-url' };
      const result = await fetchTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should validate timeout range', async () => {
      const input = { url: 'https://example.com', timeout: 500 }; // Too low
      const isValid = await fetchTool.validateInput(input);

      expect(isValid).toBe(false);
    });
  });

  describe('getInputSchema()', () => {
    it('should return valid JSON schema', () => {
      const schema = fetchTool.getInputSchema();

      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
      expect((schema as any).required).toContain('url');
    });

    it('should include all input properties', () => {
      const schema = fetchTool.getInputSchema() as any;

      expect(schema.properties).toHaveProperty('url');
      expect(schema.properties).toHaveProperty('extractContent');
      expect(schema.properties).toHaveProperty('includeMetadata');
      expect(schema.properties).toHaveProperty('timeout');
    });
  });

  describe('caching', () => {
    it('should cache results when enabled', async () => {
      const cachingTool = new FetchTool({
        enabled: true,
        cacheEnabled: true,
        cacheTTL: 60000,
      });

      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get.mockResolvedValue({
        data: 'content',
        headers: { 'content-type': 'text/plain' },
      });

      const input = { url: 'https://example.com' };

      // First fetch
      const result1 = await cachingTool.execute(input, context);
      expect(result1.data?.cached).toBe(false);

      // Second fetch should be cached
      const result2 = await cachingTool.execute(input, context);
      expect(result2.data?.cached).toBe(true);

      // Should only call axios once
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });
});
