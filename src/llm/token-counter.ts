/**
 * Token counting utilities
 *
 * For production use, integrate with:
 * - tiktoken (OpenAI's tokenizer, similar to Claude's)
 * - @anthropic-ai/tokenizer (when available)
 */

import { Message, ContentBlock } from './types';

export class TokenCounter {
  // Claude context window
  static readonly CLAUDE_SONNET_CONTEXT = 200000;
  
  // Common overhead values
  private static readonly MESSAGE_OVERHEAD = 4;
  private static readonly TOOL_USE_OVERHEAD = 10;
  private static readonly TOOL_RESULT_OVERHEAD = 10;

  /**
   * Estimate tokens in text
   *
   * Simple heuristic: ~4 characters per token
   * For more accuracy, use proper tokenizer
   */
  static estimate(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate tokens in a single content block
   */
  static estimateContentBlock(block: ContentBlock): number {
    if (block.type === 'text') {
      return this.estimate(block.text);
    } else if (block.type === 'tool_use') {
      return (
        this.TOOL_USE_OVERHEAD +
        this.estimate(block.name) +
        this.estimate(JSON.stringify(block.input))
      );
    } else if (block.type === 'tool_result') {
      return this.TOOL_RESULT_OVERHEAD + this.estimate(block.content);
    }
    return 0;
  }

  /**
   * Estimate tokens in a single message
   */
  static estimateMessage(message: Message): number {
    let tokens = this.MESSAGE_OVERHEAD;

    if (typeof message.content === 'string') {
      tokens += this.estimate(message.content);
    } else {
      for (const block of message.content) {
        tokens += this.estimateContentBlock(block);
      }
    }

    return tokens;
  }

  /**
   * Estimate tokens in messages
   */
  static estimateMessages(messages: Message[]): number {
    return messages.reduce((total, msg) => total + this.estimateMessage(msg), 0);
  }

  /**
   * Check if messages fit within context window
   */
  static fitsInContext(
    messages: Message[],
    maxTokens: number,
    systemPrompt?: string
  ): boolean {
    let totalTokens = this.estimateMessages(messages);

    if (systemPrompt) {
      totalTokens += this.estimate(systemPrompt);
    }

    return totalTokens <= maxTokens;
  }

  /**
   * Truncate messages to fit context
   *
   * Strategy: Keep most recent messages, remove oldest ones
   * Always preserves the most recent message (typically user's query)
   * 
   * @param messages - Messages to truncate
   * @param maxTokens - Maximum tokens allowed
   * @param preserveFirst - If true, also preserve the first message (typically system context)
   * @returns Truncated message array
   */
  static truncateToFit(
    messages: Message[],
    maxTokens: number,
    preserveFirst: boolean = false
  ): Message[] {
    // Calculate current size
    let currentTokens = this.estimateMessages(messages);

    // If already fits, return as-is
    if (currentTokens <= maxTokens) {
      return messages;
    }

    // Handle edge cases
    if (messages.length === 0) {
      return [];
    }
    if (messages.length === 1) {
      return messages;
    }

    // If preserving first, split into first + rest
    if (preserveFirst) {
      const first = messages[0];
      const rest = messages.slice(1);
      
      // Recursively truncate the rest
      const truncatedRest = this.truncateToFit(
        rest,
        maxTokens - this.estimateMessage(first),
        false
      );
      
      return [first, ...truncatedRest];
    }

    // Remove oldest messages until fits (keeping at least the last message)
    const truncated = [...messages];
    while (currentTokens > maxTokens && truncated.length > 1) {
      truncated.shift();
      currentTokens = this.estimateMessages(truncated);
    }

    return truncated;
  }

  /**
   * Calculate remaining tokens in context window
   * 
   * @param messages - Current messages
   * @param maxTokens - Maximum context size
   * @param systemPrompt - Optional system prompt
   * @param reserveForResponse - Tokens to reserve for model response
   * @returns Number of tokens remaining for input
   */
  static remainingTokens(
    messages: Message[],
    maxTokens: number,
    systemPrompt?: string,
    reserveForResponse: number = 4096
  ): number {
    let usedTokens = this.estimateMessages(messages);
    
    if (systemPrompt) {
      usedTokens += this.estimate(systemPrompt);
    }
    
    const available = maxTokens - usedTokens - reserveForResponse;
    return Math.max(0, available);
  }

  /**
   * Get summary of token usage
   * Useful for debugging and logging
   */
  static getSummary(messages: Message[], systemPrompt?: string): {
    total: number;
    byMessage: number[];
    system: number;
    breakdown: {
      messages: number;
      system: number;
    };
  } {
    const byMessage = messages.map(msg => this.estimateMessage(msg));
    const messagesTotal = byMessage.reduce((sum, count) => sum + count, 0);
    const systemTotal = systemPrompt ? this.estimate(systemPrompt) : 0;

    return {
      total: messagesTotal + systemTotal,
      byMessage,
      system: systemTotal,
      breakdown: {
        messages: messagesTotal,
        system: systemTotal,
      },
    };
  }

  /**
   * Format token count for human-readable display
   */
  static formatCount(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(2)}K`;
    }
    return tokens.toString();
  }
}