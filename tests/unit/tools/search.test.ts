/**
 * Search Tool Tests
 * Tests for web search using Tavily API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchTool } from '../../../src/tools/search';
import { SearchConfig } from '../../../src/tools/types';
import { createMockLogger } from '../../helpers';
import { TavilyClient } from '../../../src/llm/tavily-client';

// Mock TavilyClient
vi.mock('../../../src/llm/tavily-client', () => {
  return {
    TavilyClient: vi.fn(),
  };
});

describe('SearchTool', () => {
  let searchTool: SearchTool;
  let logger: ReturnType<typeof createMockLogger>;
  let mockTavilyClient: any;
  let context: any;

  beforeEach(() => {
    logger = createMockLogger();
    context = {
      logger,
      sessionId: 'test-session',
      userId: 'test-user',
    };

    // Create mock Tavily client instance
    mockTavilyClient = {
      search: vi.fn().mockResolvedValue({
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/1',
            content: 'This is test content 1',
            score: 0.95,
            publishedDate: '2024-01-15',
          },
          {
            title: 'Test Result 2',
            url: 'https://example.com/2',
            content: 'This is test content 2',
            score: 0.85,
          },
        ],
        query: 'test query',
      }),
    };

    // Setup the mock constructor to return our mock instance
    vi.mocked(TavilyClient).mockImplementation(function(this: any) {
      return mockTavilyClient;
    } as any);

    const config: SearchConfig = {
      apiKey: 'test-api-key',
      enabled: true,
      defaultMaxResults: 10,
      defaultSearchDepth: 'basic',
    };

    searchTool = new SearchTool(config);
  });

  describe('execute()', () => {
    it('should execute basic search successfully', async () => {
      const input = { query: 'test query' };
      const result = await searchTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(2);
      expect(result.data?.query).toBe('test query');
      expect(result.data?.totalResults).toBe(2);
      expect(result.data?.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should respect maxResults parameter', async () => {
      const input = { query: 'test query', maxResults: 5 };
      await searchTool.execute(input, context);

      expect(mockTavilyClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 5 })
      );
    });

    it('should use default maxResults when not specified', async () => {
      const input = { query: 'test query' };
      await searchTool.execute(input, context);

      expect(mockTavilyClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 10 })
      );
    });

    it('should filter by includeDomains', async () => {
      const input = {
        query: 'test query',
        includeDomains: ['example.com', 'test.com'],
      };
      await searchTool.execute(input, context);

      expect(mockTavilyClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          includeDomains: ['example.com', 'test.com'],
        })
      );
    });

    it('should filter by excludeDomains', async () => {
      const input = {
        query: 'test query',
        excludeDomains: ['spam.com', 'ads.com'],
      };
      await searchTool.execute(input, context);

      expect(mockTavilyClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeDomains: ['spam.com', 'ads.com'],
        })
      );
    });

    it('should filter by date range', async () => {
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-12-31');

      const input = {
        query: 'test query',
        dateRange: { from: fromDate, to: toDate },
      };

      const result = await searchTool.execute(input, context);

      expect(result.success).toBe(true);
      // First result has publishedDate, should be included if in range
      expect(result.data?.results).toBeDefined();
    });

    it('should use basic search depth by default', async () => {
      const input = { query: 'test query' };
      await searchTool.execute(input, context);

      expect(mockTavilyClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ searchDepth: 'basic' })
      );
    });

    it('should use advanced search depth when specified', async () => {
      const input = {
        query: 'test query',
        searchDepth: 'advanced' as const,
      };
      await searchTool.execute(input, context);

      expect(mockTavilyClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ searchDepth: 'advanced' })
      );
    });

    it('should handle Tavily API errors', async () => {
      mockTavilyClient.search.mockRejectedValue(new Error('API error'));

      const input = { query: 'test query' };
      const result = await searchTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should transform results correctly', async () => {
      const input = { query: 'test query' };
      const result = await searchTool.execute(input, context);

      expect(result.success).toBe(true);
      const firstResult = result.data?.results[0];

      expect(firstResult).toHaveProperty('title', 'Test Result 1');
      expect(firstResult).toHaveProperty('url', 'https://example.com/1');
      expect(firstResult).toHaveProperty('snippet', 'This is test content 1');
      expect(firstResult).toHaveProperty('score', 0.95);
      expect(firstResult).toHaveProperty('domain', 'example.com');
      expect(firstResult).toHaveProperty('publishedDate');
    });

    it('should extract domain from URL', async () => {
      const input = { query: 'test query' };
      const result = await searchTool.execute(input, context);

      expect(result.data?.results[0].domain).toBe('example.com');
      expect(result.data?.results[1].domain).toBe('example.com');
    });

    it('should handle missing published dates', async () => {
      const input = { query: 'test query' };
      const result = await searchTool.execute(input, context);

      // Second result doesn't have publishedDate
      expect(result.data?.results[1].publishedDate).toBeUndefined();
    });
  });

  describe('validateInput()', () => {
    it('should validate required query field', async () => {
      const input = {};
      const result = await searchTool.execute(input as any, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should reject empty query', async () => {
      const input = { query: '' };
      const result = await searchTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should validate maxResults range', async () => {
      const inputTooLow = { query: 'test', maxResults: 0 };
      expect(await searchTool.validateInput(inputTooLow)).toBe(false);

      const inputTooHigh = { query: 'test', maxResults: 150 };
      expect(await searchTool.validateInput(inputTooHigh)).toBe(false);

      const inputValid = { query: 'test', maxResults: 50 };
      expect(await searchTool.validateInput(inputValid)).toBe(true);
    });

    it('should validate searchDepth values', async () => {
      const inputInvalid = { query: 'test', searchDepth: 'super' };
      expect(await searchTool.validateInput(inputInvalid as any)).toBe(false);

      const inputBasic = { query: 'test', searchDepth: 'basic' };
      expect(await searchTool.validateInput(inputBasic as any)).toBe(true);

      const inputAdvanced = { query: 'test', searchDepth: 'advanced' };
      expect(await searchTool.validateInput(inputAdvanced as any)).toBe(true);
    });

    it('should validate date range', async () => {
      const invalidRange = {
        query: 'test',
        dateRange: {
          from: new Date('2024-12-31'),
          to: new Date('2024-01-01'),
        },
      };
      expect(await searchTool.validateInput(invalidRange)).toBe(false);

      const validRange = {
        query: 'test',
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };
      expect(await searchTool.validateInput(validRange)).toBe(true);
    });
  });

  describe('getInputSchema()', () => {
    it('should return valid JSON schema', () => {
      const schema = searchTool.getInputSchema();

      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
    });

    it('should include all input properties', () => {
      const schema = searchTool.getInputSchema() as any;

      expect(schema.properties).toHaveProperty('query');
      expect(schema.properties).toHaveProperty('maxResults');
      expect(schema.properties).toHaveProperty('searchDepth');
      expect(schema.properties).toHaveProperty('includeDomains');
      expect(schema.properties).toHaveProperty('excludeDomains');
      expect(schema.properties).toHaveProperty('dateRange');
    });

    it('should mark query as required', () => {
      const schema = searchTool.getInputSchema() as any;

      expect(schema.required).toContain('query');
    });

    it('should define searchDepth enum', () => {
      const schema = searchTool.getInputSchema() as any;

      expect(schema.properties.searchDepth.enum).toEqual(['basic', 'advanced']);
    });
  });

  describe('metadata', () => {
    it('should have required metadata properties', () => {
      expect(searchTool.name).toBe('web_search');
      expect(searchTool.description).toBeDefined();
      expect(searchTool.version).toBe('1.0.0');
    });

    it('should include metadata in results', async () => {
      const input = { query: 'test query' };
      const result = await searchTool.execute(input, context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty('source', 'tavily');
      expect(result.metadata).toHaveProperty('searchTime');
      expect(result.metadata).toHaveProperty('resultCount');
    });
  });

  describe('retry logic', () => {
    it('should retry on failure', async () => {
      let attemptCount = 0;
      mockTavilyClient.search.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({
          results: [{ title: 'Success', url: 'https://example.com', content: 'Content', score: 0.9 }],
          query: 'test',
        });
      });

      const input = { query: 'test query' };
      const result = await searchTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(attemptCount).toBeGreaterThan(1);
    });
  });
});
