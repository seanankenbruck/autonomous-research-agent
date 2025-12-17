import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk,
  LLMClientConfig,
  ToolUseBlock
} from './types';
import { LLMError } from './types';
import { Logger, LogLevel } from '../utils/logger';

export class LLMClient {
  private client: Anthropic;
  private config: Required<LLMClientConfig>;
  private logger: Logger;

  constructor(config: LLMClientConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
    });

    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? 'https://api.anthropic.com',
      defaultModel: config.defaultModel ?? 'claude-sonnet-4-20250514',
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      timeout: config.timeout ?? 60000,
    };

    this.logger = new Logger({
      level: LogLevel.DEBUG,
      context: 'LLMClient',
      enableConsole: true,
      enableFile: true,
      logDir: './storage/logs',
    });
  }

  /**
   * Complete a conversation with Claude
   * 
   * @param messages - Conversation history
   * @param options - Completion options
   * @returns CompletionResponse with content and usage
   * 
   * Handles:
   * - API request formatting
   * - Error handling with retries
   * - Usage tracking
   * - Logging
   */
  async complete(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<CompletionResponse> {
    this.logger.info('Starting completion request', {
      messageCount: messages.length,
      model: options.model || this.config.defaultModel,
    });

    try {
      const startTime = Date.now();

      // Merge options with defaults
      const model = options.model ?? this.config.defaultModel;
      const maxTokens = options.maxTokens ?? 4096;
      const temperature = options.temperature ?? 1.0;

      // Validate messages
      if (!messages || messages.length === 0) {
        throw new Error('Messages array cannot be empty');
      }

      // Format request for Anthropic API
      const requestParams: Anthropic.MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        messages: messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string'
            ? msg.content
            : msg.content.map(block => {
                if (block.type === 'text') {
                  return { type: 'text', text: block.text };
                } else if (block.type === 'tool_use') {
                  return {
                    type: 'tool_use',
                    id: block.id,
                    name: block.name,
                    input: block.input,
                  };
                } else if (block.type === 'tool_result') {
                  return {
                    type: 'tool_result',
                    tool_use_id: block.tool_use_id,
                    content: block.content,
                    is_error: block.is_error,
                  };
                }
                return block;
              }),
        })),
        temperature,
      };

      // Add optional parameters
      if (options.systemPrompt) {
        requestParams.system = options.systemPrompt;
      }
      if (options.tools && options.tools.length > 0) {
        requestParams.tools = options.tools;
      }
      if (options.stopSequences && options.stopSequences.length > 0) {
        requestParams.stop_sequences = options.stopSequences;
      }

      // Execute with retry logic
      this.logger.debug('Sending completion request', { model, maxTokens });
      const response = await this.executeWithRetry(() =>
        this.client.messages.create(requestParams)
      );

      // Parse and return response
      const duration = Date.now() - startTime;
      this.logger.info('Completion successful', {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        duration,
      });

      return {
        id: response.id,
        type: 'message',
        role: 'assistant',
        content: response.content.map(block => {
          if (block.type === 'text') {
            return { type: 'text', text: block.text };
          } else if (block.type === 'tool_use') {
            return {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            };
          }
          return block as any;
        }),
        model: response.model,
        stopReason: response.stop_reason as 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use',
        stopSequence: response.stop_sequence ?? undefined,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      this.logger.error('Completion failed', error, {
        messageCount: messages.length,
      });
      throw error;
    }
  }

  /**
   * Stream a conversation with Claude
   * 
   * @param messages - Conversation history
   * @param options - Completion options
   * @yields StreamChunk events
   * 
   * Handles:
   * - Streaming API calls
   * - Chunk parsing
   * - Error handling
   */
  async *stream(
    messages: Message[],
    options: CompletionOptions = {}
  ): AsyncGenerator<StreamChunk, void, undefined> {
    this.logger.info('Starting streaming request', {
      messageCount: messages.length,
      model: options.model || this.config.defaultModel,
    });

    try {
      const startTime = Date.now();

      // Merge options with defaults
      const model = options.model ?? this.config.defaultModel;
      const maxTokens = options.maxTokens ?? 4096;
      const temperature = options.temperature ?? 1.0;

      // Validate messages
      if (!messages || messages.length === 0) {
        throw new Error('Messages array cannot be empty');
      }

      // Format request for Anthropic API
      const requestParams: Anthropic.MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        messages: messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string'
            ? msg.content
            : msg.content.map(block => {
                if (block.type === 'text') {
                  return { type: 'text', text: block.text };
                } else if (block.type === 'tool_use') {
                  return {
                    type: 'tool_use',
                    id: block.id,
                    name: block.name,
                    input: block.input,
                  };
                } else if (block.type === 'tool_result') {
                  return {
                    type: 'tool_result',
                    tool_use_id: block.tool_use_id,
                    content: block.content,
                    is_error: block.is_error,
                  };
                }
                return block;
              }),
        })),
        temperature,
      };

      // Add optional parameters
      if (options.systemPrompt) {
        requestParams.system = options.systemPrompt;
      }
      if (options.tools && options.tools.length > 0) {
        requestParams.tools = options.tools;
      }
      if (options.stopSequences && options.stopSequences.length > 0) {
        requestParams.stop_sequences = options.stopSequences;
      }

      // Create streaming request
      this.logger.debug('Starting stream', { model, maxTokens });
      const stream = this.client.messages.stream(requestParams);

      // Iterate through the stream and yield chunks
      for await (const event of stream) {
        // Map Anthropic stream events to our StreamChunk format
        if (event.type === 'message_start') {
          yield {
            type: 'message_start',
            usage: {
              inputTokens: event.message.usage.input_tokens,
              outputTokens: event.message.usage.output_tokens,
            },
          };
        } else if (event.type === 'content_block_start') {
          yield {
            type: 'content_block_start',
          };
        } else if (event.type === 'content_block_delta') {
          // Handle different delta types
          if (event.delta.type === 'text_delta') {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: event.delta.text },
            };
          } else if (event.delta.type === 'input_json_delta') {
            yield {
              type: 'content_block_delta',
              delta: { type: 'input_json_delta', partial_json: event.delta.partial_json },
            };
          }
        } else if (event.type === 'content_block_stop') {
          yield {
            type: 'content_block_stop',
          };
        } else if (event.type === 'message_delta') {
          yield {
            type: 'message_delta',
            usage: event.usage ? {
              inputTokens: 0,
              outputTokens: event.usage.output_tokens,
            } : undefined,
          };
        } else if (event.type === 'message_stop') {
          yield {
            type: 'message_stop',
          };
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info('Streaming completed', { duration });

    } catch (error) {
      this.logger.error('Streaming failed', error, {
        messageCount: messages.length,
      });
      throw error;
    }
  }

  /**
   * Extract text content from a response
   * 
   * @param response - Completion response
   * @returns Concatenated text from all text blocks
   */
  extractText(response: CompletionResponse): string {
    return response.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');
  }

  /**
   * Extract tool uses from a response
   * 
   * @param response - Completion response
   * @returns Array of tool use blocks
   */
  extractToolUses(response: CompletionResponse): ToolUseBlock[] {
    return response.content
      .filter(block => block.type === 'tool_use') as ToolUseBlock[];
  }

  /**
   * Check if response has tool uses
   */
  hasToolUses(response: CompletionResponse): boolean {
    return response.content.some(block => block.type === 'tool_use');
  }

  /**
   * Execute with retry logic
   * 
   * @private
   * Handles:
   * - Exponential backoff
   * - Retryable vs non-retryable errors
   * - Rate limiting
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
        const llmError = this.handleError(error);
        
        // If not retryable or out of retries, throw immediately
        if (!llmError.retryable || attempt === retries) {
          throw llmError;
        }
        
        // Calculate backoff delay with exponential increase
        const backoffDelay = this.config.retryDelay * Math.pow(2, attempt);
        
        this.logger.warn(`Request failed, retrying in ${backoffDelay}ms`, {
          attempt: attempt + 1,
          maxRetries: retries,
          error: llmError.message,
          code: llmError.code,
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    // Should never reach here, but TypeScript needs this
    throw this.handleError(lastError);
  }

  /**
   * Handle API errors
   * 
   * @private
   * Converts Anthropic SDK errors to LLMError
   */
  private handleError(error: unknown): LLMError {
    // If already an LLMError, return as-is
    if (error instanceof Error && error.name === 'LLMError') {
      return error as LLMError;
    }

    // Handle Anthropic SDK errors
    if (error instanceof Anthropic.APIError) {
      const statusCode = error.status;
      const message = error.message;
      
      // Determine error code and retryability
      let code: string;
      let retryable: boolean;
      
      if (statusCode === 429) {
        // Rate limit
        code = 'RATE_LIMIT';
        retryable = true;
      } else if (statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
        // Server errors
        code = 'SERVER_ERROR';
        retryable = true;
      } else if (statusCode === 401) {
        // Authentication
        code = 'AUTHENTICATION_ERROR';
        retryable = false;
      } else if (statusCode === 400) {
        // Bad request
        code = 'BAD_REQUEST';
        retryable = false;
      } else if (statusCode === 404) {
        // Not found (model doesn't exist, etc.)
        code = 'NOT_FOUND';
        retryable = false;
      } else {
        // Unknown API error
        code = 'API_ERROR';
        retryable = false;
      }
      
      const llmError = new Error(message) as LLMError;
      llmError.name = 'LLMError';
      llmError.code = code;
      llmError.statusCode = statusCode;
      llmError.retryable = retryable;
      
      return llmError;
    }
    
    // Handle network/timeout errors
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        const llmError = new Error(error.message) as LLMError;
        llmError.name = 'LLMError';
        llmError.code = 'TIMEOUT';
        llmError.retryable = true;
        return llmError;
      }
      
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        const llmError = new Error(error.message) as LLMError;
        llmError.name = 'LLMError';
        llmError.code = 'CONNECTION_ERROR';
        llmError.retryable = true;
        return llmError;
      }
    }
    
    // Unknown error
    const message = error instanceof Error ? error.message : String(error);
    const llmError = new Error(message) as LLMError;
    llmError.name = 'LLMError';
    llmError.code = 'UNKNOWN_ERROR';
    llmError.retryable = false;
    
    return llmError;
  }

  /**
   * Count tokens (estimate until Anthropic provides API)
   * 
   * Note: This is an approximation. Consider integrating tiktoken
   * or similar for more accurate counting
   */
  estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    // This is a rough approximation and should be replaced with
    // a proper tokenizer for production use
    return Math.ceil(text.length / 4);
  }
}