import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk,
  LLMClientConfig,
  LLMError,
  ToolUseBlock
} from './types';
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

      // Create streaming request (note: we don't use retry logic for streaming)
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
    // Filter for text blocks
    // Concatenate text content
    // Return combined string
  }

  /**
   * Extract tool uses from a response
   * 
   * @param response - Completion response
   * @returns Array of tool use blocks
   */
  extractToolUses(response: CompletionResponse): ToolUseBlock[] {
    // Filter for tool_use blocks
    // Return typed array
  }

  /**
   * Check if response has tool uses
   */
  hasToolUses(response: CompletionResponse): boolean {
    // Check if any content blocks are tool_use
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
    // Try operation
    // Catch errors
    // Determine if retryable
    // Wait with exponential backoff
    // Retry or throw
  }

  /**
   * Handle API errors
   * 
   * @private
   * Converts Anthropic SDK errors to LLMError
   */
  private handleError(error: unknown): LLMError {
    // Check error type
    // Extract relevant info
    // Determine if retryable
    // Create and return LLMError
  }

  /**
   * Count tokens (estimate until Anthropic provides API)
   * 
   * Note: This is an approximation. Consider integrating tiktoken
   * or similar for more accurate counting
   */
  estimateTokens(text: string): number {
    // Simple estimation: ~4 chars per token
    // For production, use proper tokenizer
  }
}