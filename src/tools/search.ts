/**
 * Search Tool
 * Web search using Tavily API
 */

import { BaseTool } from './base-tool';
import { TavilyClient, TavilySearchResult } from "../llm/tavily-client";
import {
  SearchInput,
  SearchOutput,
  SearchConfig,
  SearchResult,
  ToolResult,
  ToolContext,
} from './types';

/**
 * SearchTool - Web search capability using Tavily API
 *
 * Tavily API docs: https://docs.tavily.com/
 *
 * Key features:
 * - Real-time web search
 * - Domain filtering (include/exclude)
 * - Date range filtering
 * - Configurable search depth (basic vs advanced)
 * - Result ranking and scoring
 */
export class SearchTool extends BaseTool<SearchInput, SearchOutput, SearchConfig> {
  readonly name = 'web_search';
  readonly description = 'Search the web for information using Tavily API';
  readonly version = '1.0.0';

  private tavilyClient: TavilyClient;

  constructor(config: SearchConfig) {
    super({
      enabled: true,
      timeout: 30000,
      defaultMaxResults: 10,
      defaultSearchDepth: 'basic',
      ...config,
    });

    // Initialize Tavily client with API key
    if (!this.config.apiKey) {
      throw new Error('Tavily API key is required');
    }
    this.tavilyClient = new TavilyClient(this.config.apiKey);
  }

  /**
   * Execute search query
   */
  protected async executeImpl(
    input: SearchInput,
    context: ToolContext
  ): Promise<ToolResult<SearchOutput>> {
    const startTime = Date.now();

    try {
      // Step 1 - Prepare search parameters
      const searchParams = {
        query: input.query,
        searchDepth: input.searchDepth || this.config.defaultSearchDepth,
        maxResults: input.maxResults || this.config.defaultMaxResults,
        includeDomains: input.includeDomains,
        excludeDomains: input.excludeDomains,
      };

      context.logger.debug(`[${this.name}] Executing search`, {
        query: input.query,
        params: searchParams,
      });

      // Step 2 - Execute search with retry logic
      const response = await this.withRetry(
        () => this.tavilyClient.search(searchParams),
        this.config.maxRetries || 3
      );

      // Step 3 - Transform results to SearchResult format
      let results = this.transformResults(response.results);

      // Step 4 - Apply date range filtering (Tavily doesn't support this natively)
      if (input.dateRange) {
        const originalCount = results.length;
        results = this.filterByDateRange(results, input.dateRange);

        context.logger.debug(`[${this.name}] Date filtering applied`, {
          originalCount,
          filteredCount: results.length,
          dateRange: input.dateRange,
        });
      }

      // Step 5 - Create output
      const output: SearchOutput = {
        results,
        totalResults: results.length,
        query: input.query,
        searchTime: Date.now() - startTime,
      };

      context.logger.info(`[${this.name}] Search completed`, {
        query: input.query,
        resultCount: output.results.length,
        searchTime: output.searchTime,
      });

      return this.createSuccessResult(output, {
        source: 'tavily',
        searchTime: output.searchTime,
        resultCount: output.results.length,
      });
    } catch (error) {
      context.logger.error(`[${this.name}] Search failed`, {
        query: input.query,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Validate search input
   */
  async validateInput(input: SearchInput): Promise<boolean> {
    // Check required fields
    if (!this.hasRequiredFields(input, ['query'])) {
      return false;
    }

    // Validate query is not empty
    if (input.query.trim().length === 0) {
      return false;
    }

    // Validate maxResults if provided
    if (input.maxResults !== undefined) {
      if (input.maxResults < 1 || input.maxResults > 100) {
        return false;
      }
    }

    // Validate searchDepth if provided
    if (input.searchDepth !== undefined) {
      if (!['basic', 'advanced'].includes(input.searchDepth)) {
        return false;
      }
    }

    // Validate date range if provided
    if (input.dateRange) {
      if (input.dateRange.from && input.dateRange.to) {
        if (input.dateRange.from > input.dateRange.to) {
          return false;
        }
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
        query: {
          type: 'string',
          description: 'The search query to execute',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (1-100)',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
        searchDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          description: 'Search depth: basic for quick results, advanced for comprehensive search',
          default: 'basic',
        },
        includeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only include results from these domains',
        },
        excludeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exclude results from these domains',
        },
        dateRange: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              format: 'date-time',
              description: 'Start date for filtering results',
            },
            to: {
              type: 'string',
              format: 'date-time',
              description: 'End date for filtering results',
            },
          },
        },
      },
      required: ['query'],
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Transform Tavily results to SearchResult format
   */
  private transformResults(tavilyResults: TavilySearchResult[]): SearchResult[] {
    return tavilyResults.map(result => ({
      title: result.title,
      url: result.url,
      snippet: result.content,
      publishedDate: result.publishedDate ? new Date(result.publishedDate) : undefined,
      score: result.score,
      domain: this.extractDomain(result.url),
    }));
  }

  /**
   * Filter results by date range
   */
  private filterByDateRange(
    results: SearchResult[],
    dateRange: { from?: Date; to?: Date }
  ): SearchResult[] {
    return results.filter(result => {
      // If no published date, include the result
      if (!result.publishedDate) return true;

      // Check if result is within date range
      if (dateRange.from && result.publishedDate < dateRange.from) {
        return false;
      }

      if (dateRange.to && result.publishedDate > dateRange.to) {
        return false;
      }

      return true;
    });
  }
}

/**
 * Factory function to create SearchTool instance
 */
export function createSearchTool(config: SearchConfig): SearchTool {
  return new SearchTool(config);
}
