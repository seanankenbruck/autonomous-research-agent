/**
 * ProceduralManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProceduralManager } from '../../../../src/memory/managers/procedural-manager';
import type { SQLiteDocumentStore } from '../../../../src/memory/stores/document-store';
import type { ChromaVectorStore } from '../../../../src/memory/stores/vector-store';
import type { EmbeddingClient } from '../../../../src/llm/embeddings';
import type { LLMClient } from '../../../../src/llm/client';
import type { Logger } from '../../../../src/utils/logger';
import type {
  ProceduralMemory,
  Refinement,
  EpisodicMemory,
  Action,
  Outcome,
  Finding,
} from '../../../../src/agent/types';

describe('ProceduralManager', () => {
  let manager: ProceduralManager;
  let mockDocStore: SQLiteDocumentStore;
  let mockVectorStore: ChromaVectorStore;
  let mockEmbeddingClient: EmbeddingClient;
  let mockLLMClient: LLMClient;
  let mockLogger: Logger;

  // Sample test data
  const sampleStrategyInput: Omit<ProceduralMemory, 'id' | 'createdAt' | 'lastRefined'> = {
    strategyName: 'Web Search Strategy',
    description: 'Use web search for broad topic exploration',
    applicableContexts: ['initial research', 'broad topics'],
    requiredTools: ['web_search', 'url_fetch'],
    successRate: 0.85,
    averageDuration: 5000,
    timesUsed: 10,
    refinements: [],
    lastUsed: new Date('2024-01-15T10:00:00Z'),
  };

  const sampleStrategy: ProceduralMemory = {
    id: 'strategy-1',
    ...sampleStrategyInput,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    lastRefined: new Date('2024-01-01T10:00:00Z'),
  };

  const sampleEpisode: EpisodicMemory = {
    id: 'episode-1',
    sessionId: 'session-1',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    topic: 'AI Research',
    actions: [] as Action[],
    outcomes: [] as Outcome[],
    findings: [] as Finding[],
    duration: 5000,
    success: true,
    summary: 'Used web search to find AI papers successfully',
    tags: ['ai', 'research'],
  };

  beforeEach(() => {
    // Create mocks
    mockDocStore = {
      storeStrategy: vi.fn(),
      getStrategy: vi.fn(),
      listStrategies: vi.fn(),
      updateStrategy: vi.fn(),
    } as unknown as SQLiteDocumentStore;

    mockVectorStore = {
      storeEmbedding: vi.fn(),
      storeBatch: vi.fn(),
      search: vi.fn(),
    } as unknown as ChromaVectorStore;

    mockEmbeddingClient = {
      embed: vi.fn(),
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

    manager = new ProceduralManager(
      mockDocStore,
      mockVectorStore,
      mockEmbeddingClient,
      mockLLMClient,
      mockLogger
    );
  });

  describe('storeStrategy', () => {
    it('should store strategy with embedding', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      const result = await manager.storeStrategy(sampleStrategyInput);

      // Should have generated an ID
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Should include all input data
      expect(result.strategyName).toBe(sampleStrategyInput.strategyName);
      expect(result.description).toBe(sampleStrategyInput.description);
      expect(result.applicableContexts).toEqual(sampleStrategyInput.applicableContexts);

      // Should have timestamps
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.lastRefined).toBeInstanceOf(Date);

      // Should store in document store
      expect(mockDocStore.storeStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.id,
          strategyName: sampleStrategyInput.strategyName,
        })
      );

      // Should generate embedding from description + applicable contexts
      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
        expect.stringContaining(sampleStrategyInput.description),
        'document'
      );

      // Should store embedding in vector store
      expect(mockVectorStore.storeEmbedding).toHaveBeenCalledWith(
        'strategy_vectors',
        result.id,
        mockEmbedding,
        expect.objectContaining({
          strategyName: sampleStrategyInput.strategyName,
          successRate: sampleStrategyInput.successRate,
          timesUsed: sampleStrategyInput.timesUsed,
        }),
        expect.any(String)
      );
    });

    it('should still store strategy if embedding fails', async () => {
      vi.mocked(mockEmbeddingClient.embed).mockRejectedValue(
        new Error('Embedding service unavailable')
      );

      const result = await manager.storeStrategy(sampleStrategyInput);

      // Strategy should still be stored
      expect(result.id).toBeDefined();
      expect(mockDocStore.storeStrategy).toHaveBeenCalled();

      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate embedding for strategy',
        expect.any(Error)
      );

      // Vector store should not be called
      expect(mockVectorStore.storeEmbedding).not.toHaveBeenCalled();
    });

    it('should handle strategy with no refinements', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      const strategyNoRefinements = {
        ...sampleStrategyInput,
        refinements: [],
      };

      const result = await manager.storeStrategy(strategyNoRefinements);

      expect(result.refinements).toEqual([]);
    });
  });

  describe('getStrategy', () => {
    it('should retrieve a strategy by ID', async () => {
      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(sampleStrategy);

      const result = await manager.getStrategy('strategy-1');

      expect(result).toEqual(sampleStrategy);
      expect(mockDocStore.getStrategy).toHaveBeenCalledWith('strategy-1');
    });

    it('should return null if strategy not found', async () => {
      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(null);

      const result = await manager.getStrategy('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getStrategyByName', () => {
    it('should retrieve a strategy by name', async () => {
      vi.mocked(mockDocStore.listStrategies).mockResolvedValue([
        sampleStrategy,
        { ...sampleStrategy, id: 'strategy-2', strategyName: 'Other Strategy' },
      ]);

      const result = await manager.getStrategyByName('Web Search Strategy');

      expect(result).toEqual(sampleStrategy);
      expect(result?.strategyName).toBe('Web Search Strategy');
    });

    it('should return null if strategy name not found', async () => {
      vi.mocked(mockDocStore.listStrategies).mockResolvedValue([sampleStrategy]);

      const result = await manager.getStrategyByName('Nonexistent Strategy');

      expect(result).toBeNull();
    });

    it('should handle empty strategy list', async () => {
      vi.mocked(mockDocStore.listStrategies).mockResolvedValue([]);

      const result = await manager.getStrategyByName('Any Strategy');

      expect(result).toBeNull();
    });
  });

  describe('searchStrategies', () => {
    it('should perform semantic search with default options', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'strategy-1', score: 0.95, document: 'Strategy 1', metadata: {} },
        { id: 'strategy-2', score: 0.85, document: 'Strategy 2', metadata: {} },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);
      vi.mocked(mockDocStore.getStrategy)
        .mockResolvedValueOnce(sampleStrategy)
        .mockResolvedValueOnce({ ...sampleStrategy, id: 'strategy-2' });

      const result = await manager.searchStrategies('web search for articles');

      // Should generate query embedding
      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
        'web search for articles',
        'query'
      );

      // Should search with defaults
      expect(mockVectorStore.search).toHaveBeenCalledWith(
        'strategy_vectors',
        mockEmbedding,
        {
          limit: 20, // maxResults * 2 for filtering
          minScore: 0.7,
        }
      );

      expect(result).toHaveLength(2);
    });

    it('should apply filters for success rate and required tools', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'strategy-1', score: 0.95, document: 'Strategy 1', metadata: {} },
        { id: 'strategy-2', score: 0.90, document: 'Strategy 2', metadata: {} },
        { id: 'strategy-3', score: 0.85, document: 'Strategy 3', metadata: {} },
      ];

      const strategies: ProceduralMemory[] = [
        { ...sampleStrategy, id: 'strategy-1', successRate: 0.9, requiredTools: ['web_search'] },
        { ...sampleStrategy, id: 'strategy-2', successRate: 0.6, requiredTools: ['web_search'] }, // Below min
        { ...sampleStrategy, id: 'strategy-3', successRate: 0.85, requiredTools: ['arxiv_search'] }, // Missing tool
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);

      strategies.forEach(strategy => {
        vi.mocked(mockDocStore.getStrategy).mockResolvedValueOnce(strategy);
      });

      const result = await manager.searchStrategies('test query', {
        minSuccessRate: 0.8,
        requiredTools: ['web_search'],
        maxResults: 5,
      });

      // Should only include strategy-1 (meets both filters)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('strategy-1');
    });

    it('should respect maxResults limit', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = Array.from({ length: 10 }, (_, i) => ({
        id: `strategy-${i}`,
        score: 0.9 - i * 0.05,
        document: `Strategy ${i}`,
        metadata: {},
      }));

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);

      mockSearchResults.forEach(sr => {
        vi.mocked(mockDocStore.getStrategy).mockResolvedValueOnce({
          ...sampleStrategy,
          id: sr.id,
        });
      });

      const result = await manager.searchStrategies('test query', { maxResults: 3 });

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle strategies not found in document store', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'strategy-1', score: 0.95, document: 'Strategy 1', metadata: {} },
        { id: 'strategy-2', score: 0.85, document: 'Strategy 2', metadata: {} },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);
      vi.mocked(mockDocStore.getStrategy)
        .mockResolvedValueOnce(sampleStrategy)
        .mockResolvedValueOnce(null); // Not found

      const result = await manager.searchStrategies('test query');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('strategy-1');
    });
  });

  describe('recommendStrategies', () => {
    it('should recommend strategies with multi-factor scoring', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const now = Date.now();

      const strategies: ProceduralMemory[] = [
        {
          ...sampleStrategy,
          id: 'high-success',
          strategyName: 'High Success Strategy',
          successRate: 0.95,
          timesUsed: 15,
          lastUsed: new Date(now - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          requiredTools: ['web_search'],
        },
        {
          ...sampleStrategy,
          id: 'frequent-use',
          strategyName: 'Frequently Used Strategy',
          successRate: 0.75,
          timesUsed: 30,
          lastUsed: new Date(now - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          requiredTools: ['web_search'],
        },
        {
          ...sampleStrategy,
          id: 'missing-tools',
          strategyName: 'Missing Tools Strategy',
          successRate: 0.9,
          timesUsed: 20,
          lastUsed: new Date(now - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          requiredTools: ['special_tool'], // Not available
        },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(
        strategies.map((s, idx) => ({ id: s.id, score: 0.9 - idx * 0.05, document: s.description, metadata: {} }))
      );

      strategies.forEach(strategy => {
        vi.mocked(mockDocStore.getStrategy).mockResolvedValueOnce(strategy);
      });

      const result = await manager.recommendStrategies(
        'web search context',
        ['web_search', 'url_fetch'],
        3
      );

      expect(result).toHaveLength(3);
      expect(result[0].strategy).toBeDefined();
      expect(result[0].relevanceScore).toBeGreaterThan(0);
      expect(result[0].reasoning).toBeDefined();

      // High success strategy should score well
      const highSuccessRec = result.find(r => r.strategy.id === 'high-success');
      expect(highSuccessRec).toBeDefined();
      expect(highSuccessRec!.relevanceScore).toBeGreaterThan(0.5);
    });

    it('should generate reasoning for recommendations', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const now = Date.now();

      const strategy: ProceduralMemory = {
        ...sampleStrategy,
        successRate: 0.95,
        timesUsed: 20,
        lastUsed: new Date(now - 3 * 24 * 60 * 60 * 1000),
        requiredTools: ['web_search'],
      };

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'strategy-1', score: 0.9, document: 'Test', metadata: {} },
      ]);
      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(strategy);

      const result = await manager.recommendStrategies(
        'test context',
        ['web_search'],
        1
      );

      expect(result[0].reasoning).toBeDefined();
      expect(result[0].reasoning).toContain('success rate');
      expect(result[0].reasoning).toContain('all required tools available');
    });

    it('should penalize strategies with missing tools', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      const strategies: ProceduralMemory[] = [
        {
          ...sampleStrategy,
          id: 'has-tools',
          successRate: 0.8,
          requiredTools: ['web_search'],
        },
        {
          ...sampleStrategy,
          id: 'missing-tools',
          successRate: 0.95, // Higher success but missing tools
          requiredTools: ['web_search', 'special_tool', 'another_tool'],
        },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(
        strategies.map(s => ({ id: s.id, score: 0.9, document: s.description, metadata: {} }))
      );

      strategies.forEach(strategy => {
        vi.mocked(mockDocStore.getStrategy).mockResolvedValueOnce(strategy);
      });

      const result = await manager.recommendStrategies(
        'test',
        ['web_search'], // Only web_search available
        2
      );

      // Strategy with all tools should score higher despite lower success rate
      expect(result[0].strategy.id).toBe('has-tools');
    });

    it('should respect maxRecommendations parameter', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const strategies = Array.from({ length: 10 }, (_, i) => ({
        ...sampleStrategy,
        id: `strategy-${i}`,
      }));

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(
        strategies.map((s, i) => ({ id: s.id, score: 0.9, document: 'Test', metadata: {} }))
      );

      strategies.forEach(strategy => {
        vi.mocked(mockDocStore.getStrategy).mockResolvedValueOnce(strategy);
      });

      const result = await manager.recommendStrategies('test', ['web_search'], 2);

      expect(result).toHaveLength(2);
    });
  });

  describe('recordStrategyUse', () => {
    it('should update statistics with running averages', async () => {
      const strategy: ProceduralMemory = {
        ...sampleStrategy,
        successRate: 0.8,
        averageDuration: 5000,
        timesUsed: 10,
      };

      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(strategy);

      await manager.recordStrategyUse('strategy-1', true, 6000);

      // Verify update was called with correct running averages
      expect(mockDocStore.updateStrategy).toHaveBeenCalledWith(
        'strategy-1',
        expect.objectContaining({
          successRate: expect.any(Number),
          averageDuration: expect.any(Number),
          timesUsed: 11,
          lastUsed: expect.any(Date),
        })
      );

      const updateCall = vi.mocked(mockDocStore.updateStrategy).mock.calls[0];
      const updates = updateCall[1];

      // Calculate expected values
      const expectedSuccessRate = (0.8 * 10 + 1) / 11; // ~0.818
      const expectedAvgDuration = (5000 * 10 + 6000) / 11; // ~5090.9

      expect(updates.successRate).toBeCloseTo(expectedSuccessRate, 2);
      expect(updates.averageDuration).toBeCloseTo(expectedAvgDuration, 1);
    });

    it('should handle failure in running average', async () => {
      const strategy: ProceduralMemory = {
        ...sampleStrategy,
        successRate: 0.9,
        averageDuration: 4000,
        timesUsed: 9,
      };

      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(strategy);

      await manager.recordStrategyUse('strategy-1', false, 5000);

      const updateCall = vi.mocked(mockDocStore.updateStrategy).mock.calls[0];
      const updates = updateCall[1];

      // Expected: (0.9 * 9 + 0) / 10 = 0.81
      expect(updates.successRate).toBeCloseTo(0.81, 2);
      expect(updates.timesUsed).toBe(10);
    });

    it('should handle first use correctly', async () => {
      const newStrategy: ProceduralMemory = {
        ...sampleStrategy,
        successRate: 0,
        averageDuration: 0,
        timesUsed: 0,
      };

      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(newStrategy);

      await manager.recordStrategyUse('strategy-1', true, 3000);

      const updateCall = vi.mocked(mockDocStore.updateStrategy).mock.calls[0];
      const updates = updateCall[1];

      expect(updates.successRate).toBe(1.0);
      expect(updates.averageDuration).toBe(3000);
      expect(updates.timesUsed).toBe(1);
    });

    it('should throw error if strategy not found', async () => {
      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(null);

      await expect(
        manager.recordStrategyUse('nonexistent', true, 1000)
      ).rejects.toThrow('Strategy not found: nonexistent');
    });

    it('should log the update', async () => {
      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(sampleStrategy);

      await manager.recordStrategyUse('strategy-1', true, 5000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Strategy')
      );
    });
  });

  describe('refineStrategy', () => {
    it('should add refinement with tracking', async () => {
      const strategy: ProceduralMemory = {
        ...sampleStrategy,
        refinements: [],
      };

      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(strategy);

      const refinementInput: Omit<Refinement, 'id' | 'timestamp'> = {
        reason: 'Low success rate in specific contexts',
        change: 'Added more specific search terms',
        expectedImprovement: 'Increase success rate by 10%',
      };

      await manager.refineStrategy('strategy-1', refinementInput);

      // Verify update was called with new refinement
      expect(mockDocStore.updateStrategy).toHaveBeenCalledWith(
        'strategy-1',
        expect.objectContaining({
          refinements: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              timestamp: expect.any(Date),
              reason: refinementInput.reason,
              change: refinementInput.change,
              expectedImprovement: refinementInput.expectedImprovement,
            }),
          ]),
          lastRefined: expect.any(Date),
        })
      );
    });

    it('should append to existing refinements', async () => {
      const existingRefinement: Refinement = {
        id: 'ref-1',
        timestamp: new Date('2024-01-10T10:00:00Z'),
        reason: 'Initial refinement',
        change: 'Original change',
        expectedImprovement: 'Original improvement',
      };

      const strategy: ProceduralMemory = {
        ...sampleStrategy,
        refinements: [existingRefinement],
      };

      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(strategy);

      await manager.refineStrategy('strategy-1', {
        reason: 'Second refinement',
        change: 'New change',
        expectedImprovement: 'New improvement',
      });

      const updateCall = vi.mocked(mockDocStore.updateStrategy).mock.calls[0];
      const updates = updateCall[1];

      expect(updates.refinements).toBeDefined();
      expect(updates.refinements).toHaveLength(2);
      expect(updates.refinements![0]).toEqual(existingRefinement);
    });

    it('should throw error if strategy not found', async () => {
      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(null);

      await expect(
        manager.refineStrategy('nonexistent', {
          reason: 'Test',
          change: 'Test',
          expectedImprovement: 'Test',
        })
      ).rejects.toThrow('Strategy not found: nonexistent');
    });
  });

  describe('extractStrategyFromEpisodes', () => {
    it('should extract strategy from successful episodes using LLM', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const episodes: EpisodicMemory[] = [
        {
          ...sampleEpisode,
          id: 'ep-1',
          summary: 'Used web search successfully to find papers',
          duration: 4000,
        },
        {
          ...sampleEpisode,
          id: 'ep-2',
          summary: 'Web search led to relevant articles',
          duration: 5000,
        },
      ];

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [
          {
            type: 'text' as const,
            text: `{
  "strategyName": "Web Search for Papers",
  "description": "Use web search engines to find academic papers and articles",
  "applicableContexts": ["academic research", "paper discovery"],
  "requiredTools": ["web_search", "url_fetch"]
}`,
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 200, outputTokens: 100 },
      };

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue(
        mockLLMResponse.content[0].text
      );

      const result = await manager.extractStrategyFromEpisodes(
        episodes,
        'Academic Research'
      );

      // Should call LLM with episode summaries
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('Episode 1:') }],
        { maxTokens: 1000 }
      );

      // Should extract and create strategy
      expect(result).toBeDefined();
      expect(result?.strategyName).toBe('Web Search for Papers');
      expect(result?.description).toBe('Use web search engines to find academic papers and articles');
      expect(result?.successRate).toBe(1.0); // Based on successful episodes
      expect(result?.timesUsed).toBe(2); // Number of episodes

      // Should store the strategy
      expect(mockDocStore.storeStrategy).toHaveBeenCalled();
    });

    it('should return null if no successful episodes', async () => {
      const episodes: EpisodicMemory[] = [
        { ...sampleEpisode, success: false },
        { ...sampleEpisode, success: false },
      ];

      const result = await manager.extractStrategyFromEpisodes(episodes, 'Test Topic');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No successful episodes to extract strategy from'
      );
      expect(mockLLMClient.complete).not.toHaveBeenCalled();
    });

    it('should return null if LLM response has no JSON', async () => {
      const episodes: EpisodicMemory[] = [{ ...sampleEpisode, success: true }];

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [{ type: 'text' as const, text: 'No JSON here' }],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 20 },
      };

      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue('No JSON here');

      const result = await manager.extractStrategyFromEpisodes(episodes, 'Test');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to extract strategy JSON from LLM response'
      );
    });

    it('should handle LLM errors gracefully', async () => {
      const episodes: EpisodicMemory[] = [{ ...sampleEpisode, success: true }];

      vi.mocked(mockLLMClient.complete).mockRejectedValue(
        new Error('LLM error')
      );

      const result = await manager.extractStrategyFromEpisodes(episodes, 'Test');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to extract strategy from episodes',
        expect.any(Error)
      );
    });

    it('should calculate average duration from episodes', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const episodes: EpisodicMemory[] = [
        { ...sampleEpisode, duration: 3000, success: true },
        { ...sampleEpisode, duration: 5000, success: true },
        { ...sampleEpisode, duration: 4000, success: true },
      ];

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [{
          type: 'text' as const,
          text: '{"strategyName":"Test","description":"Test","applicableContexts":[],"requiredTools":[]}',
        }],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 50 },
      };

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue(
        mockLLMResponse.content[0].text
      );

      await manager.extractStrategyFromEpisodes(episodes, 'Test');

      const storeCall = vi.mocked(mockDocStore.storeStrategy).mock.calls[0];
      const strategy = storeCall[0];

      // Average duration should be (3000 + 5000 + 4000) / 3 = 4000
      expect(strategy.averageDuration).toBe(4000);
    });
  });

  describe('compareStrategies', () => {
    it('should compare two strategies and provide insights', async () => {
      const strategy1: ProceduralMemory = {
        ...sampleStrategy,
        id: 'strategy-1',
        strategyName: 'Web Search',
        successRate: 0.85,
        timesUsed: 20,
        averageDuration: 3000,
      };

      const strategy2: ProceduralMemory = {
        ...sampleStrategy,
        id: 'strategy-2',
        strategyName: 'API Search',
        successRate: 0.75,
        timesUsed: 10,
        averageDuration: 5000,
      };

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [{
          type: 'text' as const,
          text: 'Web Search has higher success rate but API Search is more thorough. Use Web Search for quick queries, API Search for comprehensive research.',
        }],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 150, outputTokens: 80 },
      };

      vi.mocked(mockDocStore.getStrategy)
        .mockResolvedValueOnce(strategy1)
        .mockResolvedValueOnce(strategy2);
      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue(
        mockLLMResponse.content[0].text
      );

      const result = await manager.compareStrategies('strategy-1', 'strategy-2');

      // Should call LLM with both strategies
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('Strategy 1: Web Search') }],
        { maxTokens: 800 }
      );

      expect(result.comparison).toBeDefined();
      expect(result.recommendation).toBeDefined();
      expect(result.comparison).toContain('Web Search');
    });

    it('should throw error if strategy not found', async () => {
      vi.mocked(mockDocStore.getStrategy)
        .mockResolvedValueOnce(sampleStrategy)
        .mockResolvedValueOnce(null);

      await expect(
        manager.compareStrategies('strategy-1', 'nonexistent')
      ).rejects.toThrow('One or both strategies not found');
    });

    it('should include performance metrics in comparison', async () => {
      vi.mocked(mockDocStore.getStrategy)
        .mockResolvedValueOnce(sampleStrategy)
        .mockResolvedValueOnce({ ...sampleStrategy, id: 'strategy-2' });

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [{ type: 'text' as const, text: 'Comparison text' }],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 50 },
      };

      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue('Comparison text');

      await manager.compareStrategies('strategy-1', 'strategy-2');

      const promptArg = vi.mocked(mockLLMClient.complete).mock.calls[0][0][0].content;

      expect(promptArg).toContain('Success Rate:');
      expect(promptArg).toContain('Times Used:');
      expect(promptArg).toContain('Average Duration:');
    });
  });

  describe('analyzeStrategies', () => {
    it('should provide comprehensive analysis', async () => {
      const strategies: ProceduralMemory[] = [
        { ...sampleStrategy, id: 's-1', successRate: 0.9, timesUsed: 20, lastRefined: new Date('2024-01-15T10:00:00Z') },
        { ...sampleStrategy, id: 's-2', successRate: 0.8, timesUsed: 30, lastRefined: new Date('2024-01-14T10:00:00Z') },
        { ...sampleStrategy, id: 's-3', successRate: 0.6, timesUsed: 5, lastRefined: new Date('2024-01-13T10:00:00Z') },
      ];

      vi.mocked(mockDocStore.listStrategies).mockResolvedValue(strategies);

      const result = await manager.analyzeStrategies();

      expect(result.totalStrategies).toBe(3);
      expect(result.averageSuccessRate).toBeCloseTo((0.9 + 0.8 + 0.6) / 3, 2);

      // Most successful
      expect(result.mostSuccessful[0].id).toBe('s-1');

      // Least successful
      expect(result.leastSuccessful[0].id).toBe('s-3');

      // Most used
      expect(result.mostUsed[0].id).toBe('s-2');

      // Recently refined
      expect(result.recentlyRefined[0].id).toBe('s-1');
    });

    it('should return empty analysis for no strategies', async () => {
      vi.mocked(mockDocStore.listStrategies).mockResolvedValue([]);

      const result = await manager.analyzeStrategies();

      expect(result.totalStrategies).toBe(0);
      expect(result.averageSuccessRate).toBe(0);
      expect(result.mostSuccessful).toEqual([]);
      expect(result.leastSuccessful).toEqual([]);
      expect(result.mostUsed).toEqual([]);
      expect(result.recentlyRefined).toEqual([]);
    });

    it('should limit rankings to top 5', async () => {
      const strategies: ProceduralMemory[] = Array.from({ length: 10 }, (_, i) => ({
        ...sampleStrategy,
        id: `s-${i}`,
        successRate: 0.9 - i * 0.05,
        timesUsed: 20 - i,
        lastRefined: new Date(2024, 0, 15 - i),
      }));

      vi.mocked(mockDocStore.listStrategies).mockResolvedValue(strategies);

      const result = await manager.analyzeStrategies();

      expect(result.mostSuccessful.length).toBeLessThanOrEqual(5);
      expect(result.mostUsed.length).toBeLessThanOrEqual(5);
      expect(result.recentlyRefined.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getStrategyStats', () => {
    it('should return comprehensive statistics and rankings', async () => {
      const strategies: ProceduralMemory[] = [
        { ...sampleStrategy, id: 'strategy-1', successRate: 0.9, timesUsed: 20 },
        { ...sampleStrategy, id: 'strategy-2', successRate: 0.8, timesUsed: 30 },
        { ...sampleStrategy, id: 'strategy-3', successRate: 0.7, timesUsed: 10 },
      ];

      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(strategies[0]);
      vi.mocked(mockDocStore.listStrategies).mockResolvedValue(strategies);

      const result = await manager.getStrategyStats('strategy-1');

      // Should include strategy
      expect(result.strategy).toEqual(strategies[0]);

      // Performance stats
      expect(result.performance.successRate).toBe(0.9);
      expect(result.performance.totalUses).toBe(20);
      expect(result.performance.averageDuration).toBe(strategies[0].averageDuration);
      expect(result.performance.lastUsed).toBe(strategies[0].lastUsed);

      // Refinements
      expect(result.refinements.total).toBe(strategies[0].refinements.length);

      // Comparison
      expect(result.comparison.rankBySuccessRate).toBe(1); // Highest success rate
      expect(result.comparison.rankByUsage).toBe(2); // Second in usage
      expect(result.comparison.betterThanAverage).toBe(true);
    });

    it('should calculate correct rankings', async () => {
      const strategies: ProceduralMemory[] = [
        { ...sampleStrategy, id: 'strategy-1', successRate: 0.6, timesUsed: 5 },
        { ...sampleStrategy, id: 'strategy-2', successRate: 0.8, timesUsed: 15 },
        { ...sampleStrategy, id: 'strategy-3', successRate: 0.9, timesUsed: 25 },
      ];

      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(strategies[0]);
      vi.mocked(mockDocStore.listStrategies).mockResolvedValue(strategies);

      const result = await manager.getStrategyStats('strategy-1');

      expect(result.comparison.rankBySuccessRate).toBe(3); // Lowest
      expect(result.comparison.rankByUsage).toBe(3); // Lowest
      expect(result.comparison.betterThanAverage).toBe(false);
    });

    it('should include recent refinements', async () => {
      const refinements: Refinement[] = [
        { id: 'r-1', timestamp: new Date('2024-01-10'), reason: 'Test 1', change: 'Change 1', expectedImprovement: 'Imp 1' },
        { id: 'r-2', timestamp: new Date('2024-01-11'), reason: 'Test 2', change: 'Change 2', expectedImprovement: 'Imp 2' },
        { id: 'r-3', timestamp: new Date('2024-01-12'), reason: 'Test 3', change: 'Change 3', expectedImprovement: 'Imp 3' },
        { id: 'r-4', timestamp: new Date('2024-01-13'), reason: 'Test 4', change: 'Change 4', expectedImprovement: 'Imp 4' },
        { id: 'r-5', timestamp: new Date('2024-01-14'), reason: 'Test 5', change: 'Change 5', expectedImprovement: 'Imp 5' },
        { id: 'r-6', timestamp: new Date('2024-01-15'), reason: 'Test 6', change: 'Change 6', expectedImprovement: 'Imp 6' },
      ];

      const strategy: ProceduralMemory = {
        ...sampleStrategy,
        refinements,
      };

      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(strategy);
      vi.mocked(mockDocStore.listStrategies).mockResolvedValue([strategy]);

      const result = await manager.getStrategyStats('strategy-1');

      expect(result.refinements.total).toBe(6);
      expect(result.refinements.recent.length).toBeLessThanOrEqual(5);
      // Most recent should be first
      expect(result.refinements.recent[0].id).toBe('r-6');
    });

    it('should throw error if strategy not found', async () => {
      vi.mocked(mockDocStore.getStrategy).mockResolvedValue(null);

      await expect(
        manager.getStrategyStats('nonexistent')
      ).rejects.toThrow('Strategy not found: nonexistent');
    });
  });

  describe('formatStrategiesAsContext', () => {
    it('should format strategies as markdown context', () => {
      const strategies: ProceduralMemory[] = [
        {
          ...sampleStrategy,
          strategyName: 'Web Search',
          description: 'Search the web for information',
          successRate: 0.85,
          timesUsed: 20,
          averageDuration: 3000,
          requiredTools: ['web_search'],
          applicableContexts: ['general research'],
          refinements: [{
            id: 'r-1',
            timestamp: new Date(),
            reason: 'Improve accuracy',
            change: 'Added filters',
            expectedImprovement: 'Better results',
          }],
        },
      ];

      const result = manager.formatStrategiesAsContext(strategies);

      expect(result).toContain('## Available Strategies');
      expect(result).toContain('### Web Search');
      expect(result).toContain('Search the web for information');
      expect(result).toContain('Success Rate: 85%');
      expect(result).toContain('used 20 times');
      expect(result).toContain('Average Duration: 3.0s');
      expect(result).toContain('Required Tools: web_search');
      expect(result).toContain('Applicable Contexts: general research');
      expect(result).toContain('Latest Refinement: Added filters');
    });

    it('should return empty string for no strategies', () => {
      const result = manager.formatStrategiesAsContext([]);
      expect(result).toBe('');
    });

    it('should handle strategy with no refinements', () => {
      const strategies: ProceduralMemory[] = [
        {
          ...sampleStrategy,
          refinements: [],
        },
      ];

      const result = manager.formatStrategiesAsContext(strategies);

      expect(result).toContain('Web Search Strategy');
      expect(result).not.toContain('Latest Refinement:');
    });

    it('should format multiple strategies', () => {
      const strategies: ProceduralMemory[] = [
        { ...sampleStrategy, strategyName: 'Strategy 1' },
        { ...sampleStrategy, strategyName: 'Strategy 2' },
      ];

      const result = manager.formatStrategiesAsContext(strategies);

      expect(result).toContain('### Strategy 1');
      expect(result).toContain('### Strategy 2');
    });
  });
});
