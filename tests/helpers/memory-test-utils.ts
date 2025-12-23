/**
 * Memory Test Utilities
 * Reusable utilities for testing memory system components
 */

import { vi } from 'vitest';
import { SQLiteDocumentStore } from '../../src/memory/stores/document-store';
import { ChromaVectorStore } from '../../src/memory/stores/vector-store';
import type { EmbeddingClient } from '../../src/llm/embeddings';
import type { LLMClient } from '../../src/llm/client';
import type { Logger } from '../../src/utils/logger';
import type { SearchMatch } from '../../src/agent/types';

/**
 * Create in-memory SQLite document store for testing
 * Uses :memory: mode for fast, isolated tests
 */
export function createInMemoryDocumentStore(): SQLiteDocumentStore {
  return new SQLiteDocumentStore(':memory:');
}

/**
 * Create mock vector store for testing
 * Returns a mock that simulates vector operations
 */
export function createMockVectorStore(): ChromaVectorStore {
  return {
    createCollection: vi.fn().mockResolvedValue(undefined),
    deleteCollection: vi.fn().mockResolvedValue(undefined),
    storeEmbedding: vi.fn().mockResolvedValue(undefined),
    storeBatch: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChromaVectorStore;
}

/**
 * Create mock embedding client for testing
 * Returns deterministic embeddings for consistent tests
 */
export function createMockEmbeddingClient(
  options: {
    dimension?: number;
    deterministic?: boolean;
  } = {}
): EmbeddingClient {
  const dimension = options.dimension || 384;
  const deterministic = options.deterministic !== false;

  return {
    embed: vi.fn().mockImplementation((text: string) => {
      if (deterministic) {
        // Generate deterministic embedding based on text hash
        const embedding = generateDeterministicEmbedding(text, dimension);
        return Promise.resolve(embedding);
      } else {
        // Generate random embedding
        return Promise.resolve(generateRandomEmbedding(dimension));
      }
    }),
    embedBatch: vi.fn().mockImplementation((texts: string[]) => {
      return Promise.resolve(
        texts.map((text) =>
          deterministic
            ? generateDeterministicEmbedding(text, dimension)
            : generateRandomEmbedding(dimension)
        )
      );
    }),
  } as unknown as EmbeddingClient;
}

/**
 * Create mock LLM client for testing
 * Returns configurable test responses
 */
export function createMockLLMClient(options: {
  defaultResponse?: string;
  responses?: Map<string, string>;
} = {}): LLMClient {
  const defaultResponse = options.defaultResponse || 'Mock LLM response';
  const responses = options.responses || new Map();

  return {
    complete: vi.fn().mockImplementation((prompt: string) => {
      // Check if specific response is configured for this prompt
      for (const [key, response] of responses.entries()) {
        if (prompt.includes(key)) {
          return Promise.resolve(response);
        }
      }
      return Promise.resolve(defaultResponse);
    }),
    extractText: vi.fn().mockImplementation((response: any) => {
      if (typeof response === 'string') return response;
      return response?.text || defaultResponse;
    }),
    completeWithTools: vi.fn().mockResolvedValue({
      text: defaultResponse,
      toolCalls: [],
    }),
  } as unknown as LLMClient;
}

/**
 * Create mock logger for testing
 */
export function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLevel: vi.fn(),
  } as unknown as Logger;
}

/**
 * Generate deterministic embedding based on text
 * Uses simple hash function for consistency
 */
function generateDeterministicEmbedding(text: string, dimension: number): number[] {
  const embedding: number[] = [];
  let hash = 0;

  // Simple hash function
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate embedding values based on hash
  for (let i = 0; i < dimension; i++) {
    // Use hash and position to generate deterministic value
    const seed = hash + i * 1234567;
    const value = (Math.sin(seed) + 1) / 2; // Normalize to [0, 1]
    embedding.push(value);
  }

  // Normalize to unit vector
  return normalizeEmbedding(embedding);
}

/**
 * Generate random embedding
 */
function generateRandomEmbedding(dimension: number): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < dimension; i++) {
    embedding.push(Math.random());
  }
  return normalizeEmbedding(embedding);
}

/**
 * Normalize embedding to unit vector
 */
function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );
  return embedding.map((val) => val / magnitude);
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimension');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Custom matcher for checking if embeddings are similar
 */
export function expectSimilarEmbeddings(
  embedding1: number[],
  embedding2: number[],
  minSimilarity: number = 0.8
): void {
  const similarity = cosineSimilarity(embedding1, embedding2);
  if (similarity < minSimilarity) {
    throw new Error(
      `Embeddings are not similar enough. Similarity: ${similarity.toFixed(
        3
      )}, Expected: >= ${minSimilarity}`
    );
  }
}

/**
 * Create similar embeddings for testing similarity search
 * Returns base embedding and similar variants
 */
export function createSimilarEmbeddings(
  baseText: string,
  count: number,
  dimension: number = 384
): { base: number[]; similar: number[][] } {
  const base = generateDeterministicEmbedding(baseText, dimension);
  const similar: number[][] = [];

  for (let i = 0; i < count; i++) {
    // Create similar embedding by adding small noise
    const variant = base.map((val) => {
      const noise = (Math.random() - 0.5) * 0.1; // Small noise
      return Math.max(0, Math.min(1, val + noise));
    });
    similar.push(normalizeEmbedding(variant));
  }

  return { base, similar };
}

/**
 * Wait for async operations to complete
 * Useful for testing async workflows
 */
export async function waitForAsync(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush all pending promises
 * Ensures all async operations complete
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Create mock search results for vector store
 */
export function createMockSearchResults(options: {
  count: number;
  baseScore?: number;
  documents?: string[];
  metadata?: Record<string, any>[];
}): SearchMatch[] {
  const {
    count,
    baseScore = 0.9,
    documents = [],
    metadata = [],
  } = options;

  const results: SearchMatch[] = [];
  for (let i = 0; i < count; i++) {
    results.push({
      id: `result-${i}`,
      score: baseScore - i * 0.05, // Decreasing scores
      document: documents[i] || `Document ${i}`,
      metadata: metadata[i] || { index: i },
    });
  }

  return results;
}

/**
 * Assert that an array contains items in any order
 */
export function assertContainsAll<T>(
  actual: T[],
  expected: T[],
  compareFn?: (a: T, b: T) => boolean
): void {
  const compare = compareFn || ((a, b) => a === b);

  for (const expectedItem of expected) {
    const found = actual.some((actualItem) => compare(actualItem, expectedItem));
    if (!found) {
      throw new Error(
        `Expected array to contain ${JSON.stringify(
          expectedItem
        )}, but it was not found`
      );
    }
  }
}

/**
 * Create a mock date range for testing
 */
export function createDateRange(
  startDate: Date,
  count: number,
  intervalMs: number = 60000
): Date[] {
  const dates: Date[] = [];
  let currentTime = startDate.getTime();

  for (let i = 0; i < count; i++) {
    dates.push(new Date(currentTime));
    currentTime += intervalMs;
  }

  return dates;
}

/**
 * Mock timer utilities for testing time-dependent behavior
 */
export class MockTimer {
  private currentTime: number;
  private timers: Map<number, { callback: () => void; time: number }>;
  private nextId: number;

  constructor(initialTime: Date = new Date()) {
    this.currentTime = initialTime.getTime();
    this.timers = new Map();
    this.nextId = 1;
  }

  now(): number {
    return this.currentTime;
  }

  advance(ms: number): void {
    this.currentTime += ms;
    this.executeTimers();
  }

  setTimeout(callback: () => void, delay: number): number {
    const id = this.nextId++;
    this.timers.set(id, {
      callback,
      time: this.currentTime + delay,
    });
    return id;
  }

  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  private executeTimers(): void {
    const toExecute: Array<() => void> = [];

    for (const [id, timer] of this.timers.entries()) {
      if (timer.time <= this.currentTime) {
        toExecute.push(timer.callback);
        this.timers.delete(id);
      }
    }

    toExecute.forEach((callback) => callback());
  }
}

/**
 * Batch operation helper for testing bulk operations
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Cleanup helper for test resources
 */
export class TestResourceManager {
  private resources: Array<() => Promise<void> | void> = [];

  register(cleanup: () => Promise<void> | void): void {
    this.resources.push(cleanup);
  }

  async cleanup(): Promise<void> {
    for (const cleanup of this.resources.reverse()) {
      await cleanup();
    }
    this.resources = [];
  }
}

/**
 * Create a spy that tracks calls with arguments
 */
export function createCallTracker<T extends any[]>() {
  const calls: T[] = [];

  return {
    track: (...args: T) => {
      calls.push(args);
    },
    getCalls: () => calls,
    getCallCount: () => calls.length,
    wasCalledWith: (...args: T) => {
      return calls.some(
        (call) => JSON.stringify(call) === JSON.stringify(args)
      );
    },
    reset: () => {
      calls.length = 0;
    },
  };
}

/**
 * Helper to assert async errors
 */
export async function expectAsyncError(
  fn: () => Promise<any>,
  expectedMessage?: string
): Promise<void> {
  let error: Error | null = null;

  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  if (!error) {
    throw new Error('Expected function to throw an error, but it did not');
  }

  if (expectedMessage && !error.message.includes(expectedMessage)) {
    throw new Error(
      `Expected error message to include "${expectedMessage}", but got "${error.message}"`
    );
  }
}
