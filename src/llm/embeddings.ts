/**
 * Embedding generation service
 *
 * Note: Anthropic doesn't provide embeddings directly.
 * This implementation uses Voyage AI (recommended by Anthropic)
 * with the voyage-3.5-lite model for cost efficiency.
 *
 * Voyage AI Pricing (voyage-3.5-lite):
 * - First 200M tokens: FREE
 * - After that: Cheapest option per 1K tokens
 */
import {
  EmbeddingConfig,
  EmbeddingResponse,
  VoyageEmbeddingRequest,
  VoyageEmbeddingResponse,
  EmbeddingError
} from './types';
import { Logger, LogLevel } from '../utils/logger';

export class EmbeddingClient {
  private config: Required<EmbeddingConfig>;
  private logger: Logger;

  constructor(config: EmbeddingConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? 'voyage-3.5-lite',
      baseURL: config.baseURL ?? 'https://api.voyageai.com/v1',
      maxBatchSize: config.maxBatchSize ?? 128, // Voyage AI supports up to 128 texts per batch
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };

    this.logger = new Logger({
      level: LogLevel.DEBUG,
      context: 'EmbeddingClient',
      enableConsole: true,
      enableFile: true,
      logDir: './storage/logs',
    });
  }

  /**
   * Generate embedding for a single text
   *
   * @param text - Text to embed
   * @param inputType - Type of input: 'query' for search queries, 'document' for documents
   * @returns Embedding vector
   */
  async embed(text: string, inputType: 'query' | 'document' = 'document'): Promise<number[]> {
    this.logger.debug('Generating embedding', {
      textLength: text.length,
      model: this.config.model,
      inputType
    });

    try {
      const response = await this.callVoyageAPI({
        input: text,
        model: this.config.model,
        input_type: inputType,
      });

      this.logger.info('Embedding generated', {
        model: response.model,
        tokensUsed: response.usage.total_tokens,
        vectorDimension: response.data[0].embedding.length,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error, {
        textLength: text.length,
      });
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batched)
   *
   * @param texts - Array of texts to embed
   * @param inputType - Type of input: 'query' for search queries, 'document' for documents
   * @returns Array of embedding vectors in the same order as input
   */
  async embedBatch(
    texts: string[],
    inputType: 'query' | 'document' = 'document'
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    this.logger.debug('Generating batch embeddings', {
      count: texts.length,
      model: this.config.model,
      inputType,
    });

    try {
      // Split into batches if needed
      const batches: string[][] = [];
      for (let i = 0; i < texts.length; i += this.config.maxBatchSize) {
        batches.push(texts.slice(i, i + this.config.maxBatchSize));
      }

      this.logger.debug(`Processing ${batches.length} batch(es)`, {
        totalTexts: texts.length,
        batchSize: this.config.maxBatchSize,
      });

      // Process all batches
      const results: number[][] = [];
      let totalTokens = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.debug(`Processing batch ${i + 1}/${batches.length}`, {
          batchSize: batch.length,
        });

        const response = await this.callVoyageAPI({
          input: batch,
          model: this.config.model,
          input_type: inputType,
        });

        // Sort by index to maintain order
        const sortedData = response.data.sort((a, b) => a.index - b.index);
        results.push(...sortedData.map(item => item.embedding));
        totalTokens += response.usage.total_tokens;

        // Add small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }

      this.logger.info('Batch embeddings generated', {
        count: results.length,
        batches: batches.length,
        totalTokens,
        model: this.config.model,
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to generate batch embeddings', error, {
        count: texts.length,
      });
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score between -1 and 1 (higher is more similar)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embedding vectors must have the same length');
    }

    // Calculate dot product
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }

    // Calculate magnitudes
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < a.length; i++) {
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    // Return cosine similarity
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Call Voyage AI API with retry logic
   *
   * @private
   */
  private async callVoyageAPI(request: VoyageEmbeddingRequest): Promise<VoyageEmbeddingResponse> {
    return this.executeWithRetry(async () => {
      const url = `${this.config.baseURL}/embeddings`;

      this.logger.debug('Calling Voyage AI API', { url, model: request.model });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Determine if error is retryable
        const retryable = response.status === 429 || 
                         response.status >= 500;
        
        this.logger.error('Voyage AI API error', undefined, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          retryable,
        });
        
        const error = new Error(
          `Voyage AI API error: ${response.status} ${response.statusText}\n${errorText}`
        ) as EmbeddingError;
        error.name = 'EmbeddingError';
        error.statusCode = response.status;
        error.retryable = retryable;
        
        throw error;
      }

      return await response.json() as VoyageEmbeddingResponse;
    });
  }

  /**
   * Execute with retry logic
   *
   * @private
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = (error as EmbeddingError).retryable ?? false;
        
        // If not retryable or out of retries, throw immediately
        if (!isRetryable || attempt === retries) {
          throw error;
        }

        // Calculate backoff delay with exponential increase
        const backoffDelay = this.config.retryDelay * Math.pow(2, attempt);

        this.logger.warn(`Request failed, retrying in ${backoffDelay}ms`, {
          attempt: attempt + 1,
          maxRetries: retries,
          error: (error as Error).message,
        });

        // Wait before retrying
        await this.delay(backoffDelay);
      }
    }

    throw lastError;
  }

  /**
   * Delay helper
   *
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}