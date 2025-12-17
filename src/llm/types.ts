// Core message types matching Anthropic's API
export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export type ContentBlock = 
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock;

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// Tool definition for Claude
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Request options
export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  tools?: Tool[];
  stopSequences?: string[];
}

// Response from Claude
export interface CompletionResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stopSequence?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Streaming response chunk
export interface StreamChunk {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 
        'content_block_stop' | 'message_delta' | 'message_stop';
  // ... varies by type
  delta?: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Error types
export class LLMError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export interface LLMClientConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}