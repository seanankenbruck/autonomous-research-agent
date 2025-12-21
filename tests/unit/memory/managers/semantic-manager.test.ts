/**
 * SemanticManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticManager } from '../../../../src/memory/managers/semantic-manager';
import type { SQLiteDocumentStore } from '../../../../src/memory/stores/document-store';
import type { ChromaVectorStore } from '../../../../src/memory/stores/vector-store';
import type { EmbeddingClient } from '../../../../src/llm/embeddings';
import type { LLMClient } from '../../../../src/llm/client';
import type { Logger } from '../../../../src/utils/logger';
import type {
  SemanticMemory,
  EpisodicMemory,
  Action,
  Outcome,
  Finding,
} from '../../../../src/agent/types';
import type { Message } from '../../../../src/llm/types';

describe('SemanticManager', () => {
  let manager: SemanticManager;
  let mockDocStore: SQLiteDocumentStore;
  let mockVectorStore: ChromaVectorStore;
  let mockEmbeddingClient: EmbeddingClient;
  let mockLLMClient: LLMClient;
  let mockLogger: Logger;

  // Sample test data
  const sampleFact: SemanticMemory = {
    id: 'fact-1',
    content: 'Claude API supports function calling through tools parameter',
    category: 'method',
    subcategory: 'api-feature',
    source: 'episode:ep-123',
    confidence: 0.95,
    relevance: 1.0,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    lastAccessed: new Date('2024-01-15T10:00:00Z'),
    accessCount: 0,
    lastModified: new Date('2024-01-15T10:00:00Z'),
    tags: ['claude', 'api', 'tools'],
    relatedFacts: [],
  };

  const sampleEpisode: EpisodicMemory = {
    id: 'episode-1',
    sessionId: 'session-1',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    topic: 'Claude API Research',
    actions: [] as Action[],
    outcomes: [] as Outcome[],
    findings: [] as Finding[],
    duration: 5000,
    success: true,
    summary: 'Successfully researched Claude API and discovered tool calling features',
    tags: ['ai', 'api'],
  };

  beforeEach(() => {
    // Create mocks
    mockDocStore = {
      storeFact: vi.fn(),
      getFact: vi.fn(),
      listFacts: vi.fn(),
      updateFact: vi.fn(),
      deleteFact: vi.fn(),
    } as unknown as SQLiteDocumentStore;

    mockVectorStore = {
      storeEmbedding: vi.fn(),
      storeBatch: vi.fn(),
      search: vi.fn(),
      delete: vi.fn(),
    } as unknown as ChromaVectorStore;

    mockEmbeddingClient = {
      embed: vi.fn(),
      cosineSimilarity: vi.fn(),
    } as unknown as EmbeddingClient;

    mockLLMClient = {
      complete: vi.fn(),
      extractText: vi.fn(),
    } as unknown as LLMClient;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    manager = new SemanticManager(
      mockDocStore,
      mockVectorStore,
      mockEmbeddingClient,
      mockLLMClient,
      mockLogger
    );
  });

  describe('storeFact', () => {
    it('should store a fact with embedding', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      await manager.storeFact(sampleFact);

      // Should store in document store
      expect(mockDocStore.storeFact).toHaveBeenCalledWith(sampleFact);

      // Should generate embedding
      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
        sampleFact.content,
        'document'
      );

      // Should store embedding in vector store
      expect(mockVectorStore.storeEmbedding).toHaveBeenCalledWith(
        'fact_vectors',
        sampleFact.id,
        mockEmbedding,
        expect.objectContaining({
          category: sampleFact.category,
          subcategory: sampleFact.subcategory,
          confidence: sampleFact.confidence,
          relevance: sampleFact.relevance,
          tags: sampleFact.tags,
        }),
        sampleFact.content
      );
    });

    it('should still store fact if embedding fails', async () => {
      vi.mocked(mockEmbeddingClient.embed).mockRejectedValue(
        new Error('Embedding service unavailable')
      );

      await manager.storeFact(sampleFact);

      // Should still store in document store
      expect(mockDocStore.storeFact).toHaveBeenCalledWith(sampleFact);

      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate embedding for fact',
        expect.any(Error)
      );

      // Vector store should not be called
      expect(mockVectorStore.storeEmbedding).not.toHaveBeenCalled();
    });

    it('should handle fact with no subcategory', async () => {
      const factNoSubcat = { ...sampleFact, subcategory: undefined };
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      await manager.storeFact(factNoSubcat);

      expect(mockVectorStore.storeEmbedding).toHaveBeenCalledWith(
        'fact_vectors',
        factNoSubcat.id,
        mockEmbedding,
        expect.objectContaining({
          subcategory: '',
        }),
        factNoSubcat.content
      );
    });
  });

  describe('getFact', () => {
    it('should retrieve a fact by ID', async () => {
      vi.mocked(mockDocStore.getFact).mockResolvedValue(sampleFact);

      const result = await manager.getFact('fact-1');

      expect(result).toEqual(sampleFact);
      expect(mockDocStore.getFact).toHaveBeenCalledWith('fact-1');
    });

    it('should return null if fact not found', async () => {
      vi.mocked(mockDocStore.getFact).mockResolvedValue(null);

      const result = await manager.getFact('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchFacts', () => {
    it('should perform semantic search with default options', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'fact-1', score: 0.95, document: 'Fact 1', metadata: {} },
        { id: 'fact-2', score: 0.85, document: 'Fact 2', metadata: {} },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);
      vi.mocked(mockDocStore.getFact)
        .mockResolvedValueOnce({ ...sampleFact, id: 'fact-1' })
        .mockResolvedValueOnce({ ...sampleFact, id: 'fact-2' });

      const result = await manager.searchFacts('claude api');

      // Should generate query embedding
      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith('claude api', 'query');

      // Should search with defaults
      expect(mockVectorStore.search).toHaveBeenCalledWith(
        'fact_vectors',
        mockEmbedding,
        {
          limit: 10,
          where: undefined,
          minScore: 0.7,
        }
      );

      expect(result).toHaveLength(2);
    });

    it('should apply category filter', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([]);

      await manager.searchFacts('test query', {
        category: 'method',
        maxResults: 5,
        similarityThreshold: 0.8,
      });

      expect(mockVectorStore.search).toHaveBeenCalledWith(
        'fact_vectors',
        mockEmbedding,
        {
          limit: 5,
          where: { category: 'method' },
          minScore: 0.8,
        }
      );
    });

    it('should filter by confidence in memory', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'fact-1', score: 0.95, document: 'Fact 1', metadata: {} },
        { id: 'fact-2', score: 0.85, document: 'Fact 2', metadata: {} },
        { id: 'fact-3', score: 0.80, document: 'Fact 3', metadata: {} },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);
      vi.mocked(mockDocStore.getFact)
        .mockResolvedValueOnce({ ...sampleFact, id: 'fact-1', confidence: 0.9 })
        .mockResolvedValueOnce({ ...sampleFact, id: 'fact-2', confidence: 0.6 }) // Below threshold
        .mockResolvedValueOnce({ ...sampleFact, id: 'fact-3', confidence: 0.85 });

      const result = await manager.searchFacts('test query', {
        minConfidence: 0.8,
      });

      // Should fetch more results to account for filtering
      expect(mockVectorStore.search).toHaveBeenCalledWith(
        'fact_vectors',
        mockEmbedding,
        expect.objectContaining({
          limit: 20, // 10 * 2 for filtering
        })
      );

      // Should only include facts meeting confidence threshold
      expect(result).toHaveLength(2);
      expect(result.map(f => f.id)).toEqual(['fact-1', 'fact-3']);
    });

    it('should filter by relevance in memory', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'fact-1', score: 0.95, document: 'Fact 1', metadata: {} },
        { id: 'fact-2', score: 0.85, document: 'Fact 2', metadata: {} },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);
      vi.mocked(mockDocStore.getFact)
        .mockResolvedValueOnce({ ...sampleFact, id: 'fact-1', relevance: 0.9 })
        .mockResolvedValueOnce({ ...sampleFact, id: 'fact-2', relevance: 0.5 }); // Below threshold

      const result = await manager.searchFacts('test query', {
        minRelevance: 0.7,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('fact-1');
    });

    it('should handle facts not found in document store', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'fact-1', score: 0.95, document: 'Fact 1', metadata: {} },
        { id: 'fact-2', score: 0.85, document: 'Fact 2', metadata: {} },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);
      vi.mocked(mockDocStore.getFact)
        .mockResolvedValueOnce({ ...sampleFact, id: 'fact-1' })
        .mockResolvedValueOnce(null); // Not found

      const result = await manager.searchFacts('test query');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('fact-1');
    });
  });

  describe('buildKnowledgeContext', () => {
    it('should build context within token budget', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockFacts: SemanticMemory[] = [
        {
          ...sampleFact,
          id: 'fact-1',
          content: 'Short fact one',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          accessCount: 5,
        },
        {
          ...sampleFact,
          id: 'fact-2',
          content: 'Short fact two',
          createdAt: new Date('2024-01-14T10:00:00Z'),
          accessCount: 2,
        },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'fact-1', score: 0.95, document: 'Short fact one', metadata: {} },
        { id: 'fact-2', score: 0.90, document: 'Short fact two', metadata: {} },
      ]);

      mockFacts.forEach(fact => {
        vi.mocked(mockDocStore.getFact).mockResolvedValueOnce(fact);
      });

      const result = await manager.buildKnowledgeContext('test query', 1000);

      expect(result.facts).toHaveLength(2);
      expect(result.totalTokens).toBeLessThanOrEqual(1000);
      expect(result.truncated).toBe(false);
    });

    it('should truncate when exceeding token budget', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const largeFact1 = 'This is a very long fact that contains many words and will take up significant token space. '.repeat(10);
      const largeFact2 = 'Another extremely lengthy fact with lots of detailed information that uses many tokens. '.repeat(10);

      const mockFacts: SemanticMemory[] = [
        { ...sampleFact, id: 'fact-1', content: largeFact1 },
        { ...sampleFact, id: 'fact-2', content: largeFact2 },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'fact-1', score: 0.95, document: largeFact1, metadata: {} },
        { id: 'fact-2', score: 0.90, document: largeFact2, metadata: {} },
      ]);

      mockFacts.forEach(fact => {
        vi.mocked(mockDocStore.getFact).mockResolvedValueOnce(fact);
      });

      const result = await manager.buildKnowledgeContext('test query', 100);

      expect(result.truncated).toBe(true);
      expect(result.totalTokens).toBeLessThanOrEqual(100);
    });

    it('should return empty for no results', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([]);

      const result = await manager.buildKnowledgeContext('test query', 1000);

      expect(result.facts).toEqual([]);
      expect(result.totalTokens).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('should score facts by confidence, recency, and access count', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      const mockFacts: SemanticMemory[] = [
        {
          ...sampleFact,
          id: 'fact-old-low-confidence',
          content: 'Old fact',
          confidence: 0.6,
          createdAt: new Date('2024-01-01T10:00:00Z'), // Old
          accessCount: 0,
        },
        {
          ...sampleFact,
          id: 'fact-recent-high-confidence',
          content: 'Recent fact',
          confidence: 0.95,
          createdAt: new Date('2024-01-14T10:00:00Z'), // Recent
          accessCount: 10,
        },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'fact-old-low-confidence', score: 0.90, document: 'Old fact', metadata: {} },
        { id: 'fact-recent-high-confidence', score: 0.85, document: 'Recent fact', metadata: {} },
      ]);

      mockFacts.forEach(fact => {
        vi.mocked(mockDocStore.getFact).mockResolvedValueOnce(fact);
      });

      const result = await manager.buildKnowledgeContext('test query', 1000);

      // Recent, high-confidence, frequently accessed fact should be first
      expect(result.facts[0].id).toBe('fact-recent-high-confidence');
    });
  });

  describe('extractFactsFromEpisode', () => {
    it('should extract facts from episode using LLM', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [
          {
            type: 'text' as const,
            text: `[
  {
    "content": "Claude API supports function calling",
    "category": "method",
    "subcategory": "api-feature",
    "confidence": 0.95,
    "tags": ["claude", "api"]
  },
  {
    "content": "Tools parameter enables structured outputs",
    "category": "concept",
    "subcategory": "api-design",
    "confidence": 0.9,
    "tags": ["tools", "structured-output"]
  }
]`,
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 200 },
      };

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue(
        mockLLMResponse.content[0].text
      );

      const result = await manager.extractFactsFromEpisode(sampleEpisode);

      // Should call LLM with episode info
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining(sampleEpisode.summary) }],
        { maxTokens: 2000 }
      );

      // Should extract and store facts
      expect(result.totalExtracted).toBe(2);
      expect(result.facts).toHaveLength(2);
      expect(result.facts[0].content).toBe('Claude API supports function calling');
      expect(result.facts[0].source).toBe(`episode:${sampleEpisode.id}`);
      expect(result.facts[0].confidence).toBe(0.95);

      // Should store each fact
      expect(mockDocStore.storeFact).toHaveBeenCalledTimes(2);
    });

    it('should handle LLM response with no JSON', async () => {
      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [{ type: 'text' as const, text: 'No facts found' }],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 20 },
      };

      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue('No facts found');

      const result = await manager.extractFactsFromEpisode(sampleEpisode);

      expect(result.totalExtracted).toBe(0);
      expect(result.facts).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('No facts extracted from episode');
    });

    it('should handle LLM errors gracefully', async () => {
      vi.mocked(mockLLMClient.complete).mockRejectedValue(
        new Error('LLM service unavailable')
      );

      const result = await manager.extractFactsFromEpisode(sampleEpisode);

      expect(result.totalExtracted).toBe(0);
      expect(result.facts).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to extract facts from episode',
        expect.any(Error)
      );
    });
  });

  describe('extractFactsFromMessages', () => {
    it('should extract facts from message history', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const messages: Message[] = [
        { role: 'user', content: 'Tell me about Claude API' },
        { role: 'assistant', content: 'Claude API supports function calling through tools' },
      ];

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [
          {
            type: 'text' as const,
            text: `[
  {
    "content": "Claude API has tool calling feature",
    "category": "finding",
    "confidence": 0.9,
    "tags": ["claude", "api"]
  }
]`,
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 150 },
      };

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue(
        mockLLMResponse.content[0].text
      );

      const result = await manager.extractFactsFromMessages(messages, 'Claude API');

      // Should include conversation in prompt
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('User: Tell me about Claude API') }],
        { maxTokens: 2000 }
      );

      expect(result.totalExtracted).toBe(1);
      expect(result.facts[0].source).toBe('conversation:Claude API');
    });

    it('should handle messages with content blocks', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
          ],
        },
      ];

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [{ type: 'text' as const, text: '[]' }],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 10 },
      };

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue('[]');

      await manager.extractFactsFromMessages(messages, 'Test Topic');

      // Should combine text blocks
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('First part\nSecond part') }],
        { maxTokens: 2000 }
      );
    });
  });

  describe('findSimilarFacts', () => {
    it('should find similar facts using cosine similarity', async () => {
      const factEmbedding = new Array(1536).fill(0.5);
      const similar1Embedding = new Array(1536).fill(0.51);
      const similar2Embedding = new Array(1536).fill(0.49);

      const similarFacts: SemanticMemory[] = [
        { ...sampleFact, id: 'similar-1', content: 'Very similar fact' },
        { ...sampleFact, id: 'similar-2', content: 'Somewhat similar fact' },
      ];

      vi.mocked(mockEmbeddingClient.embed)
        .mockResolvedValueOnce(factEmbedding) // Source fact
        .mockResolvedValueOnce(similar1Embedding) // Similar 1
        .mockResolvedValueOnce(similar2Embedding); // Similar 2

      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'similar-1', score: 0.85, document: 'Very similar fact', metadata: {} },
        { id: 'similar-2', score: 0.75, document: 'Somewhat similar fact', metadata: {} },
      ]);

      vi.mocked(mockDocStore.getFact)
        .mockResolvedValueOnce(similarFacts[0])
        .mockResolvedValueOnce(similarFacts[1]);

      vi.mocked(mockEmbeddingClient.cosineSimilarity)
        .mockReturnValueOnce(0.92) // High similarity
        .mockReturnValueOnce(0.87); // Also high

      const result = await manager.findSimilarFacts(sampleFact, 0.85);

      expect(result).toHaveLength(2);
      expect(result[0].similarity).toBe(0.92);
      expect(result[0].fact1).toEqual(sampleFact);
      expect(result[0].fact2).toEqual(similarFacts[0]);

      // Should be sorted by similarity descending
      expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
    });

    it('should filter by similarity threshold', async () => {
      const factEmbedding = new Array(1536).fill(0.5);
      const similar1Embedding = new Array(1536).fill(0.51);

      vi.mocked(mockEmbeddingClient.embed)
        .mockResolvedValueOnce(factEmbedding)
        .mockResolvedValueOnce(similar1Embedding);

      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'similar-1', score: 0.75, document: 'Fact', metadata: {} },
      ]);

      vi.mocked(mockDocStore.getFact).mockResolvedValueOnce({
        ...sampleFact,
        id: 'similar-1',
      });

      vi.mocked(mockEmbeddingClient.cosineSimilarity).mockReturnValueOnce(0.75); // Below threshold

      const result = await manager.findSimilarFacts(sampleFact, 0.85);

      expect(result).toHaveLength(0);
    });

    it('should exclude the source fact itself', async () => {
      const factEmbedding = new Array(1536).fill(0.5);

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValueOnce(factEmbedding);

      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'fact-1', score: 1.0, document: 'Same fact', metadata: {} },
      ]);

      vi.mocked(mockDocStore.getFact).mockResolvedValueOnce(sampleFact);

      const result = await manager.findSimilarFacts(sampleFact);

      // Should not include itself even if returned from search
      expect(result).toHaveLength(0);
    });
  });

  describe('mergeFacts', () => {
    it('should merge two facts using LLM', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const fact1: SemanticMemory = {
        ...sampleFact,
        id: 'fact-1',
        content: 'Claude supports function calling',
        confidence: 0.9,
        tags: ['claude', 'api'],
        relatedFacts: [],
      };

      const fact2: SemanticMemory = {
        ...sampleFact,
        id: 'fact-2',
        content: 'Claude API enables structured outputs via tools',
        confidence: 0.95,
        tags: ['api', 'tools'],
        relatedFacts: [],
      };

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [
          {
            type: 'text' as const,
            text: 'Claude API supports function calling and structured outputs via tools parameter',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 50 },
      };

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue(
        'Claude API supports function calling and structured outputs via tools parameter'
      );

      const result = await manager.mergeFacts(fact1, fact2);

      // Should call LLM with both facts
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('Claude supports function calling') }],
        { maxTokens: 500 }
      );

      // Should create merged fact with combined metadata
      expect(result.content).toBe(
        'Claude API supports function calling and structured outputs via tools parameter'
      );
      expect(result.confidence).toBe(0.95); // Max of the two
      expect(result.source).toContain('merged:');
      expect(result.tags).toEqual(['claude', 'api', 'tools']); // Union of tags
      expect(result.relatedFacts).toContain('fact-1');
      expect(result.relatedFacts).toContain('fact-2');

      // Should store the merged fact
      expect(mockDocStore.storeFact).toHaveBeenCalled();
    });

    it('should handle LLM errors when merging', async () => {
      vi.mocked(mockLLMClient.complete).mockRejectedValue(
        new Error('LLM error')
      );

      await expect(
        manager.mergeFacts(sampleFact, { ...sampleFact, id: 'fact-2' })
      ).rejects.toThrow('LLM error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to merge facts',
        expect.any(Error)
      );
    });
  });

  describe('consolidateFacts', () => {
    it('should consolidate similar facts', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const facts: SemanticMemory[] = [
        { ...sampleFact, id: 'fact-1', content: 'Fact 1' },
        { ...sampleFact, id: 'fact-2', content: 'Similar fact' },
      ];

      vi.mocked(mockDocStore.listFacts).mockResolvedValue(facts);

      // Mock findSimilarFacts to return one candidate
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search)
        .mockResolvedValueOnce([
          { id: 'fact-2', score: 0.95, document: 'Similar fact', metadata: {} },
        ])
        .mockResolvedValueOnce([]); // Second fact has no similar

      vi.mocked(mockDocStore.getFact).mockResolvedValue(facts[1]);
      vi.mocked(mockEmbeddingClient.cosineSimilarity).mockReturnValue(0.92);

      // Mock mergeFacts
      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [{ type: 'text' as const, text: 'Merged fact content' }],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 50 },
      };

      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue('Merged fact content');

      const result = await manager.consolidateFacts('method', 0.9);

      expect(result.mergedCount).toBe(2);
      expect(result.newFacts).toHaveLength(1);
    });

    it('should not merge already processed facts', async () => {
      const facts: SemanticMemory[] = [
        { ...sampleFact, id: 'fact-1' },
        { ...sampleFact, id: 'fact-2' },
      ];

      vi.mocked(mockDocStore.listFacts).mockResolvedValue(facts);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(new Array(1536).fill(0.1));
      vi.mocked(mockVectorStore.search).mockResolvedValue([]);

      const result = await manager.consolidateFacts();

      expect(result.mergedCount).toBe(0);
      expect(result.newFacts).toHaveLength(0);
    });
  });

  describe('updateFactRelevance', () => {
    it('should decay relevance based on time since last access', async () => {
      const oldFact: SemanticMemory = {
        ...sampleFact,
        relevance: 1.0,
        lastAccessed: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        accessCount: 0,
      };

      await manager.updateFactRelevance(oldFact);

      // Should update with decayed relevance
      expect(mockDocStore.updateFact).toHaveBeenCalledWith(
        oldFact.id,
        expect.objectContaining({
          relevance: expect.any(Number),
        })
      );

      const updateCall = vi.mocked(mockDocStore.updateFact).mock.calls[0];
      const newRelevance = updateCall[1].relevance as number;

      // Should be significantly decayed after 60 days (half-life is 60 days)
      expect(newRelevance).toBeLessThan(oldFact.relevance);
      expect(newRelevance).toBeGreaterThan(0);
    });

    it('should boost relevance for frequently accessed facts', async () => {
      const popularFact: SemanticMemory = {
        ...sampleFact,
        relevance: 0.8,
        lastAccessed: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        accessCount: 50,
      };

      await manager.updateFactRelevance(popularFact);

      const updateCall = vi.mocked(mockDocStore.updateFact).mock.calls[0];
      const newRelevance = updateCall[1].relevance as number;

      // Should have access boost
      expect(newRelevance).toBeGreaterThan(0);
    });

    it('should cap relevance at 1.0', async () => {
      const highAccessFact: SemanticMemory = {
        ...sampleFact,
        relevance: 0.95,
        lastAccessed: new Date(),
        accessCount: 100,
      };

      await manager.updateFactRelevance(highAccessFact);

      if (vi.mocked(mockDocStore.updateFact).mock.calls.length > 0) {
        const updateCall = vi.mocked(mockDocStore.updateFact).mock.calls[0];
        const newRelevance = updateCall[1].relevance as number;
        expect(newRelevance).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe('formatFactsAsContext', () => {
    it('should format facts as markdown context', () => {
      const facts: SemanticMemory[] = [
        {
          ...sampleFact,
          category: 'method',
          content: 'Fact about methods',
          confidence: 0.95,
          tags: ['tag1', 'tag2'],
        },
        {
          ...sampleFact,
          category: 'concept',
          content: 'Fact about concepts',
          confidence: 0.85,
          tags: [],
        },
      ];

      const result = manager.formatFactsAsContext(facts);

      expect(result).toContain('## Relevant Knowledge');
      expect(result).toContain('### Method');
      expect(result).toContain('### Concept');
      expect(result).toContain('Fact about methods (confidence: 95%)');
      expect(result).toContain('Tags: tag1, tag2');
      expect(result).toContain('Fact about concepts (confidence: 85%)');
    });

    it('should return empty string for no facts', () => {
      const result = manager.formatFactsAsContext([]);
      expect(result).toBe('');
    });

    it('should group facts by category', () => {
      const facts: SemanticMemory[] = [
        { ...sampleFact, category: 'method', content: 'Method 1' },
        { ...sampleFact, category: 'concept', content: 'Concept 1' },
        { ...sampleFact, category: 'method', content: 'Method 2' },
      ];

      const result = manager.formatFactsAsContext(facts);

      // Should have one Method section with 2 facts
      const methodMatches = result.match(/### Method/g);
      expect(methodMatches).toHaveLength(1);
      expect(result).toContain('Method 1');
      expect(result).toContain('Method 2');
    });
  });

  describe('getStats', () => {
    it('should calculate statistics for all facts', async () => {
      const facts: SemanticMemory[] = [
        { ...sampleFact, category: 'method', confidence: 0.9, relevance: 0.8, tags: ['ai', 'api'] },
        { ...sampleFact, category: 'method', confidence: 0.8, relevance: 0.9, tags: ['api', 'tools'] },
        { ...sampleFact, category: 'concept', confidence: 0.95, relevance: 0.85, tags: ['ai'] },
      ];

      vi.mocked(mockDocStore.listFacts).mockResolvedValue(facts);

      const result = await manager.getStats();

      expect(result.totalFacts).toBe(3);
      expect(result.averageConfidence).toBeCloseTo((0.9 + 0.8 + 0.95) / 3);
      expect(result.averageRelevance).toBeCloseTo((0.8 + 0.9 + 0.85) / 3);

      expect(result.topCategories).toHaveLength(2);
      expect(result.topCategories[0]).toEqual({ category: 'method', count: 2 });
      expect(result.topCategories[1]).toEqual({ category: 'concept', count: 1 });

      expect(result.topTags.length).toBeGreaterThan(0);
      const aiTag = result.topTags.find(t => t.tag === 'ai');
      expect(aiTag?.count).toBe(2);
    });

    it('should filter stats by category', async () => {
      const facts: SemanticMemory[] = [
        { ...sampleFact, category: 'method', confidence: 0.9 },
      ];

      vi.mocked(mockDocStore.listFacts).mockResolvedValue(facts);

      await manager.getStats('method');

      expect(mockDocStore.listFacts).toHaveBeenCalledWith({ category: 'method' });
    });

    it('should return zero stats for no facts', async () => {
      vi.mocked(mockDocStore.listFacts).mockResolvedValue([]);

      const result = await manager.getStats();

      expect(result.totalFacts).toBe(0);
      expect(result.averageConfidence).toBe(0);
      expect(result.averageRelevance).toBe(0);
      expect(result.topCategories).toEqual([]);
      expect(result.topTags).toEqual([]);
    });

    it('should limit top categories to 5 and top tags to 10', async () => {
      const facts: SemanticMemory[] = Array.from({ length: 20 }, (_, i) => ({
        ...sampleFact,
        category: `category-${i % 8}`, // 8 categories
        tags: [`tag-${i % 15}`], // 15 tags
      }));

      vi.mocked(mockDocStore.listFacts).mockResolvedValue(facts);

      const result = await manager.getStats();

      expect(result.topCategories.length).toBeLessThanOrEqual(5);
      expect(result.topTags.length).toBeLessThanOrEqual(10);
    });
  });
});
