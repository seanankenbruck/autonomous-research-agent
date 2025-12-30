import { tavily } from '@tavily/core';

export interface TavilySearchOptions {
    query: string;
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
}

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score?: number;
    publishedDate?: string;
}

export interface TavilySearchResponse {
    results: TavilySearchResult[];
    query: string;
    responseTime?: number;
}

export class TavilyClient {
    private client: ReturnType<typeof tavily>;

    constructor(apiKey: string) {
        this.client = tavily({ apiKey });
    }

    /**
     * Execute a search query with full options support
     */
    async search(options: TavilySearchOptions): Promise<TavilySearchResponse> {
        try {
            const searchOptions: any = {
                maxResults: options.maxResults || 5,
            };

            // Add search depth if specified
            if (options.searchDepth) {
                searchOptions.searchDepth = options.searchDepth;
            }

            // Add domain filters if specified
            if (options.includeDomains && options.includeDomains.length > 0) {
                searchOptions.includeDomains = options.includeDomains;
            }

            if (options.excludeDomains && options.excludeDomains.length > 0) {
                searchOptions.excludeDomains = options.excludeDomains;
            }

            const response = await this.client.search(options.query, searchOptions);

            // Extract and transform results
            const results: TavilySearchResult[] = (response.results || []).map((result: any) => ({
                title: result.title || '',
                url: result.url || '',
                content: result.content || '',
                score: result.score,
                publishedDate: result.published_date,
            }));

            return {
                results,
                query: options.query,
                responseTime: response.responseTime,
            };
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Tavily API error: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Legacy method for simple searches - kept for backward compatibility
     * @deprecated Use search(options) instead
     */
    async simpleSearch(query: string, maxResults: number = 5): Promise<string> {
        try {
            const response = await this.search({
                query,
                maxResults,
            });

            const results = response.results || [];

            if (results.length === 0) {
                return "No search results found.";
            }

            return this.formatResults(results);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Tavily API error: ${error.message}`);
            }
            throw error;
        }
    }

    // Helper to format results into readable text
    private formatResults(results: TavilySearchResult[]): string {
        return results
            .map((result, index) => {
                return `${index + 1}. ${result.title}\n   Content: ${result.content}\n   Source: ${result.url}`;
            })
            .join('\n\n');
    }
}