import { tavily } from '@tavily/core';

export class TavilyClient {
    private client: ReturnType<typeof tavily>;

    constructor(apiKey: string) {
        this.client = tavily({ apiKey });
    }

    async search(
        query: string,
        maxResults: number = 5
    ): Promise<string> {
        try {
            const response = await this.client.search(query, {
                maxResults: maxResults
            });

            // Extract results array from response
            const results = response.results || [];
            
            if (results.length === 0) {
                return "No search results found.";
            }

            // Format and return as readable text
            const formattedResults = this.formatResults(results);
            console.log(`Formatted Results from Tavily: \n${formattedResults}`);
            return formattedResults;
            
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Tavily API error: ${error.message}`);
            }
            throw error;
        }
    }

    // Helper to format results into readable text for the agent
    private formatResults(results: any[]): string {
        return results
            .map((result, index) => {
                return `${index + 1}. ${result.title}\n   Content: ${result.content}\n   Source: ${result.url}`;
            })
            .join('\n\n');
    }
}