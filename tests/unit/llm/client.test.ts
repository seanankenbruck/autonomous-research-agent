import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { LLMClient } from '../../../src/llm/client';
import { EmbeddingClient } from '../../../src/llm/embeddings';
import type { Message, CompletionResponse, Tool } from '../../../src/llm/types';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk');

// Mock the Logger
vi.mock('../../../src/utils/logger', () => {
  return {
    Logger: class MockLogger {
      info = vi.fn();
      debug = vi.fn();
      warn = vi.fn();
      error = vi.fn();
    },
    LogLevel: {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
    },
  };
});

describe('LLMClient', () => {
  let client: LLMClient;
  let mockAnthropicClient: any;

  beforeEach(() => {
    // Create mock Anthropic client
    mockAnthropicClient = {
      messages: {
        create: vi.fn(),
        stream: vi.fn(),
      },
    };

    // Mock the Anthropic constructor
    (Anthropic as any).mockImplementation(function(this: any) {
      return mockAnthropicClient;
    });

    (Anthropic as any).APIError = class APIError extends Error {
      constructor(public status: number, message: string) {
        super(message);
        this.name = 'APIError';
      }
    };

    // Create client instance
    client = new LLMClient({
      apiKey: 'test-api-key',
      defaultModel: 'claude-sonnet-4-20250514',
      maxRetries: 2,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('complete', () => {
    test('should complete a simple conversation', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello, Claude!' },
      ];

      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello! How can I help you today?' },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const response = await client.complete(messages);

      expect(response).toEqual({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
        model: 'claude-sonnet-4-20250514',
        stopReason: 'end_turn',
        stopSequence: undefined,
        usage: {
          inputTokens: 10,
          outputTokens: 20,
        },
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: 'Hello, Claude!' }],
          temperature: 1.0,
        })
      );
    });

    test('should handle tool use responses', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'What is the weather in San Francisco?' },
      ];

      const tools: Tool[] = [
        {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          input_schema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      ];

      const mockResponse = {
        id: 'msg_456',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'get_weather',
            input: { location: 'San Francisco' },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 50,
          output_tokens: 30,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const response = await client.complete(messages, { tools });

      expect(response.stopReason).toBe('tool_use');
      expect(response.content[0]).toEqual({
        type: 'tool_use',
        id: 'tool_123',
        name: 'get_weather',
        input: { location: 'San Francisco' },
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools,
        })
      );
    });

    test('should retry on rate limit errors', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test message' },
      ];

      const rateLimitError = new (Anthropic as any).APIError(429, 'Rate limit exceeded');
      const mockResponse = {
        id: 'msg_789',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Success after retry' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 15,
        },
      };

      // First call fails with rate limit, second succeeds
      mockAnthropicClient.messages.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockResponse);

      const response = await client.complete(messages);

      expect(response.content[0]).toEqual({
        type: 'text',
        text: 'Success after retry',
      });
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(2);
    });

    test('should throw on non-retryable errors', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test message' },
      ];

      const authError = new (Anthropic as any).APIError(401, 'Invalid API key');
      mockAnthropicClient.messages.create.mockRejectedValue(authError);

      await expect(client.complete(messages)).rejects.toMatchObject({
        name: 'LLMError',
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401,
        retryable: false,
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });

    test('should respect max tokens', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Tell me a story' },
      ];

      const mockResponse = {
        id: 'msg_999',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Once upon a time...' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'max_tokens',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 2048,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      await client.complete(messages, { maxTokens: 2048 });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
        })
      );
    });

    test('should include system prompt when provided', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
      ];

      const mockResponse = {
        id: 'msg_111',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 20,
          output_tokens: 10,
        },
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      await client.complete(messages, {
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant.',
        })
      );
    });
  });

  describe('stream', () => {
    test('should stream response chunks', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Count to three' },
      ];

      const mockStreamEvents = [
        {
          type: 'message_start',
          message: {
            usage: { input_tokens: 10, output_tokens: 0 },
          },
        },
        { type: 'content_block_start' },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'One' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: ', two' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: ', three' },
        },
        { type: 'content_block_stop' },
        {
          type: 'message_delta',
          usage: { output_tokens: 5 },
        },
        { type: 'message_stop' },
      ];

      // Create async generator for mock stream
      async function* mockStreamGenerator() {
        for (const event of mockStreamEvents) {
          yield event;
        }
      }

      mockAnthropicClient.messages.stream.mockReturnValue(mockStreamGenerator());

      const chunks = [];
      for await (const chunk of client.stream(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(8);
      expect(chunks[0]).toEqual({
        type: 'message_start',
        usage: { inputTokens: 10, outputTokens: 0 },
      });
      expect(chunks[2]).toEqual({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'One' },
      });
      expect(chunks[7]).toEqual({ type: 'message_stop' });
    });

    test('should handle streaming errors', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test' },
      ];

      async function* errorStreamGenerator() {
        yield { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } };
        throw new Error('Stream error');
      }

      mockAnthropicClient.messages.stream.mockReturnValue(errorStreamGenerator());

      const streamIterator = client.stream(messages);

      // First chunk should work
      const first = await streamIterator.next();
      expect(first.done).toBe(false);

      // Second should throw
      await expect(streamIterator.next()).rejects.toThrow('Stream error');
    });

    test('should yield complete message at end', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hi' },
      ];

      const mockStreamEvents = [
        {
          type: 'message_start',
          message: { usage: { input_tokens: 5, output_tokens: 0 } },
        },
        { type: 'content_block_start' },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello!' },
        },
        { type: 'content_block_stop' },
        {
          type: 'message_delta',
          usage: { output_tokens: 2 },
        },
        { type: 'message_stop' },
      ];

      async function* mockStreamGenerator() {
        for (const event of mockStreamEvents) {
          yield event;
        }
      }

      mockAnthropicClient.messages.stream.mockReturnValue(mockStreamGenerator());

      const chunks = [];
      for await (const chunk of client.stream(messages)) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.type).toBe('message_stop');
    });
  });

  describe('extractText', () => {
    test('should extract text from single text block', () => {
      const response: CompletionResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, world!' }],
        model: 'claude-sonnet-4-20250514',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 5 },
      };

      const text = client.extractText(response);
      expect(text).toBe('Hello, world!');
    });

    test('should concatenate multiple text blocks', () => {
      const response: CompletionResponse = {
        id: 'msg_456',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'First part. ' },
          { type: 'text', text: 'Second part.' },
        ],
        model: 'claude-sonnet-4-20250514',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 10 },
      };

      const text = client.extractText(response);
      expect(text).toBe('First part. Second part.');
    });

    test('should return empty string for no text blocks', () => {
      const response: CompletionResponse = {
        id: 'msg_789',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'get_weather',
            input: { location: 'NYC' },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stopReason: 'tool_use',
        usage: { inputTokens: 10, outputTokens: 15 },
      };

      const text = client.extractText(response);
      expect(text).toBe('');
    });
  });

  describe('extractToolUses', () => {
    test('should extract tool use blocks', () => {
      const response: CompletionResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'calculator',
            input: { operation: 'add', a: 5, b: 3 },
          },
          {
            type: 'tool_use',
            id: 'tool_2',
            name: 'search',
            input: { query: 'weather' },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stopReason: 'tool_use',
        usage: { inputTokens: 20, outputTokens: 30 },
      };

      const toolUses = client.extractToolUses(response);
      expect(toolUses).toHaveLength(2);
      expect(toolUses[0].name).toBe('calculator');
      expect(toolUses[1].name).toBe('search');
    });

    test('should return empty array when no tools', () => {
      const response: CompletionResponse = {
        id: 'msg_456',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'No tools here' }],
        model: 'claude-sonnet-4-20250514',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 5 },
      };

      const toolUses = client.extractToolUses(response);
      expect(toolUses).toEqual([]);
    });
  });

  describe('error handling', () => {
    test('should convert API errors to LLMError', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const apiError = new (Anthropic as any).APIError(400, 'Bad request');

      mockAnthropicClient.messages.create.mockRejectedValue(apiError);

      await expect(client.complete(messages)).rejects.toMatchObject({
        name: 'LLMError',
        code: 'BAD_REQUEST',
        statusCode: 400,
      });
    });

    test('should mark rate limit errors as retryable', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const rateLimitError = new (Anthropic as any).APIError(429, 'Rate limit exceeded');

      mockAnthropicClient.messages.create.mockRejectedValue(rateLimitError);

      try {
        await client.complete(messages);
      } catch (error: any) {
        expect(error.name).toBe('LLMError');
        expect(error.code).toBe('RATE_LIMIT');
        expect(error.retryable).toBe(true);
      }

      // Should have retried 3 times (initial + 2 retries)
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(3);
    });

    test('should mark auth errors as non-retryable', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const authError = new (Anthropic as any).APIError(401, 'Invalid API key');

      mockAnthropicClient.messages.create.mockRejectedValue(authError);

      try {
        await client.complete(messages);
      } catch (error: any) {
        expect(error.name).toBe('LLMError');
        expect(error.code).toBe('AUTHENTICATION_ERROR');
        expect(error.retryable).toBe(false);
      }

      // Should not retry
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });
  });
});

describe('EmbeddingClient', () => {
  let client: EmbeddingClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Mock fetch
    originalFetch = global.fetch;
    global.fetch = vi.fn();

    // Create client instance
    client = new EmbeddingClient({
      apiKey: 'test-voyage-key',
      model: 'voyage-3.5-lite',
      maxBatchSize: 128,
      maxRetries: 2,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('embed', () => {
    test('should generate embedding for text', async () => {
      const mockResponse = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3, 0.4],
            index: 0,
          },
        ],
        model: 'voyage-3.5-lite',
        usage: {
          total_tokens: 10,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const embedding = await client.embed('Hello, world!');

      expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.voyageai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-voyage-key',
          }),
          body: expect.stringContaining('Hello, world!'),
        })
      );
    });

    test('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid input',
      });

      await expect(client.embed('Test')).rejects.toMatchObject({
        name: 'EmbeddingError',
        statusCode: 400,
        retryable: false,
      });
    });
  });

  describe('embedBatch', () => {
    test('should generate embeddings for multiple texts', async () => {
      const mockResponse = {
        data: [
          { embedding: [0.1, 0.2], index: 0 },
          { embedding: [0.3, 0.4], index: 1 },
          { embedding: [0.5, 0.6], index: 2 },
        ],
        model: 'voyage-3.5-lite',
        usage: {
          total_tokens: 30,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const embeddings = await client.embedBatch(['First', 'Second', 'Third']);

      expect(embeddings).toHaveLength(3);
      expect(embeddings[0]).toEqual([0.1, 0.2]);
      expect(embeddings[1]).toEqual([0.3, 0.4]);
      expect(embeddings[2]).toEqual([0.5, 0.6]);
    });

    test('should handle batching correctly', async () => {
      // Create client with small batch size
      const smallBatchClient = new EmbeddingClient({
        apiKey: 'test-key',
        maxBatchSize: 2,
      });

      const mockResponse1 = {
        data: [
          { embedding: [0.1, 0.2], index: 0 },
          { embedding: [0.3, 0.4], index: 1 },
        ],
        model: 'voyage-3.5-lite',
        usage: { total_tokens: 20 },
      };

      const mockResponse2 = {
        data: [
          { embedding: [0.5, 0.6], index: 0 },
        ],
        model: 'voyage-3.5-lite',
        usage: { total_tokens: 10 },
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        });

      const embeddings = await smallBatchClient.embedBatch(['A', 'B', 'C']);

      expect(embeddings).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('cosineSimilarity', () => {
    test('should calculate similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [0.7071, 0.7071, 0];

      const similarity = client.cosineSimilarity(a, b);

      // cos(45°) ≈ 0.7071
      expect(similarity).toBeCloseTo(0.7071, 4);
    });

    test('should return 1.0 for identical vectors', () => {
      const a = [1, 2, 3, 4];
      const b = [1, 2, 3, 4];

      const similarity = client.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1.0, 10);
    });

    test('should return 0.0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      const similarity = client.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(0.0, 10);
    });

    test('should throw for vectors of different lengths', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(() => client.cosineSimilarity(a, b)).toThrow(
        'Embedding vectors must have the same length'
      );
    });
  });
});
