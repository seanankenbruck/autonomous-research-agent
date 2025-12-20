/**
 * EpisodicManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EpisodicManager } from '../../../../src/memory/managers/episodic-manager';
import type { SQLiteDocumentStore } from '../../../../src/memory/stores/document-store';
import type { ChromaVectorStore } from '../../../../src/memory/stores/vector-store';
import type { EmbeddingClient } from '../../../../src/llm/embeddings';
import type { LLMClient } from '../../../../src/llm/client';
import type { Logger } from '../../../../src/utils/logger';
import type {
  EpisodicMemory,
  Action,
  Outcome,
  Finding,
  UserFeedback,
} from '../../../../src/agent/types';

describe('EpisodicManager', () => {
  let manager: EpisodicManager;
  let mockDocStore: SQLiteDocumentStore;
  let mockVectorStore: ChromaVectorStore;
  let mockEmbeddingClient: EmbeddingClient;
  let mockLLMClient: LLMClient;
  let mockLogger: Logger;

  // Sample test data
  const sampleAction: Action = {
    id: 'action-1',
    sessionId: 'session-1',
    type: 'search',
    tool: 'web_search',
    parameters: { query: 'autonomous agents' },
    reasoning: 'Need to gather information',
    timestamp: new Date('2024-01-15T10:00:00Z'),
  };

  const sampleOutcome: Outcome = {
    actionId: 'action-1',
    success: true,
    result: { count: 10 },
    observations: ['Found relevant sources'],
    duration: 2000,
    metadata: {},
    timestamp: new Date('2024-01-15T10:00:02Z'),
  };

  const sampleFinding: Finding = {
    id: 'finding-1',
    content: 'Autonomous agents can reason and plan',
    source: {
      url: 'https://example.com/article',
      title: 'AI Agents',
      type: 'webpage',
    },
    confidence: 0.9,
    relevance: 0.95,
    timestamp: new Date('2024-01-15T10:00:05Z'),
    verificationStatus: 'verified',
    relatedFindings: [],
  };

  const sampleEpisodeInput: Omit<EpisodicMemory, 'id'> = {
    sessionId: 'session-1',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    topic: 'Autonomous Agents Research',
    actions: [sampleAction],
    outcomes: [sampleOutcome],
    findings: [sampleFinding],
    duration: 5000,
    success: true,
    summary: 'Successfully researched autonomous agents and found key insights',
    tags: ['ai', 'agents'],
  };

  beforeEach(() => {
    // Create mocks
    mockDocStore = {
      storeEpisode: vi.fn(),
      getEpisode: vi.fn(),
      listEpisodes: vi.fn(),
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

    manager = new EpisodicManager(
      mockDocStore,
      mockVectorStore,
      mockEmbeddingClient,
      mockLLMClient,
      mockLogger
    );
  });

  describe('storeEpisode', () => {
    it('should store an episode and generate embedding', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      const result = await manager.storeEpisode(sampleEpisodeInput);

      // Should have generated an ID
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Should include all input data
      expect(result.sessionId).toBe(sampleEpisodeInput.sessionId);
      expect(result.topic).toBe(sampleEpisodeInput.topic);
      expect(result.summary).toBe(sampleEpisodeInput.summary);

      // Should store in document store
      expect(mockDocStore.storeEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.id,
          sessionId: sampleEpisodeInput.sessionId,
          topic: sampleEpisodeInput.topic,
        })
      );

      // Should generate embedding from summary
      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
        sampleEpisodeInput.summary,
        'document'
      );

      // Should store embedding in vector store
      expect(mockVectorStore.storeEmbedding).toHaveBeenCalledWith(
        'episode_vectors',
        result.id,
        mockEmbedding,
        expect.objectContaining({
          sessionId: sampleEpisodeInput.sessionId,
          topic: sampleEpisodeInput.topic,
          success: sampleEpisodeInput.success,
        }),
        sampleEpisodeInput.summary
      );
    });

    it('should still store episode even if embedding fails', async () => {
      vi.mocked(mockEmbeddingClient.embed).mockRejectedValue(
        new Error('Embedding service unavailable')
      );

      const result = await manager.storeEpisode(sampleEpisodeInput);

      // Episode should still be stored
      expect(result.id).toBeDefined();
      expect(mockDocStore.storeEpisode).toHaveBeenCalled();

      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate embedding for episode',
        expect.any(Error)
      );

      // Vector store should not be called
      expect(mockVectorStore.storeEmbedding).not.toHaveBeenCalled();
    });

    it('should handle episodes with feedback', async () => {
      const feedback: UserFeedback = {
        sessionId: 'session-1',
        timestamp: new Date(),
        rating: 5,
        helpful: true,
        comments: 'Great results!',
        specificFeedback: {
          accuracy: 'very_accurate',
          relevance: 'highly_relevant',
        },
      };

      const episodeWithFeedback = {
        ...sampleEpisodeInput,
        feedback,
      };

      const result = await manager.storeEpisode(episodeWithFeedback);

      expect(result.feedback).toEqual(feedback);
      expect(mockDocStore.storeEpisode).toHaveBeenCalledWith(
        expect.objectContaining({ feedback })
      );
    });
  });

  describe('getEpisode', () => {
    it('should retrieve an episode by ID', async () => {
      const mockEpisode: EpisodicMemory = {
        id: 'episode-123',
        ...sampleEpisodeInput,
      };

      vi.mocked(mockDocStore.getEpisode).mockResolvedValue(mockEpisode);

      const result = await manager.getEpisode('episode-123');

      expect(result).toEqual(mockEpisode);
      expect(mockDocStore.getEpisode).toHaveBeenCalledWith('episode-123');
    });

    it('should return null if episode not found', async () => {
      vi.mocked(mockDocStore.getEpisode).mockResolvedValue(null);

      const result = await manager.getEpisode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getSessionEpisodes', () => {
    it('should retrieve all episodes for a session', async () => {
      const mockEpisodes: EpisodicMemory[] = [
        { id: 'ep-1', ...sampleEpisodeInput },
        {
          id: 'ep-2',
          ...sampleEpisodeInput,
          topic: 'Different topic',
          timestamp: new Date('2024-01-15T11:00:00Z'),
        },
      ];

      vi.mocked(mockDocStore.listEpisodes).mockResolvedValue(mockEpisodes);

      const result = await manager.getSessionEpisodes('session-1');

      expect(result).toEqual(mockEpisodes);
      expect(result).toHaveLength(2);
      expect(mockDocStore.listEpisodes).toHaveBeenCalledWith('session-1');
    });

    it('should return empty array for session with no episodes', async () => {
      vi.mocked(mockDocStore.listEpisodes).mockResolvedValue([]);

      const result = await manager.getSessionEpisodes('empty-session');

      expect(result).toEqual([]);
    });
  });

  describe('searchSimilar', () => {
    it('should perform semantic search with default options', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'ep-1', score: 0.95, document: 'Episode 1 summary', metadata: {} },
        { id: 'ep-2', score: 0.85, document: 'Episode 2 summary', metadata: {} },
      ];
      const mockEpisodes: EpisodicMemory[] = [
        { id: 'ep-1', ...sampleEpisodeInput },
        { id: 'ep-2', ...sampleEpisodeInput, topic: 'Related topic' },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);
      vi.mocked(mockDocStore.getEpisode)
        .mockResolvedValueOnce(mockEpisodes[0])
        .mockResolvedValueOnce(mockEpisodes[1]);

      const result = await manager.searchSimilar('autonomous agents research');

      // Should generate query embedding
      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
        'autonomous agents research',
        'query'
      );

      // Should search vector store with defaults
      expect(mockVectorStore.search).toHaveBeenCalledWith(
        'episode_vectors',
        mockEmbedding,
        {
          limit: 10,
          where: undefined,
          minScore: 0.7,
        }
      );

      // Should retrieve full episodes
      expect(result).toEqual(mockEpisodes);
      expect(mockDocStore.getEpisode).toHaveBeenCalledTimes(2);
    });

    it('should apply filters for session and topic', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([]);

      await manager.searchSimilar('test query', {
        sessionId: 'session-123',
        topic: 'AI Research',
        maxResults: 5,
        similarityThreshold: 0.8,
      });

      expect(mockVectorStore.search).toHaveBeenCalledWith(
        'episode_vectors',
        mockEmbedding,
        {
          limit: 5,
          where: {
            sessionId: 'session-123',
            topic: 'AI Research',
          },
          minScore: 0.8,
        }
      );
    });

    it('should handle episodes that are not found in document store', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockSearchResults = [
        { id: 'ep-1', score: 0.95, document: 'Episode 1', metadata: {} },
        { id: 'ep-2', score: 0.85, document: 'Episode 2', metadata: {} },
        { id: 'ep-3', score: 0.80, document: 'Episode 3', metadata: {} },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue(mockSearchResults);
      vi.mocked(mockDocStore.getEpisode)
        .mockResolvedValueOnce({ id: 'ep-1', ...sampleEpisodeInput })
        .mockResolvedValueOnce(null) // ep-2 not found
        .mockResolvedValueOnce({ id: 'ep-3', ...sampleEpisodeInput });

      const result = await manager.searchSimilar('test');

      // Should only include found episodes
      expect(result).toHaveLength(2);
      expect(result.map(e => e.id)).toEqual(['ep-1', 'ep-3']);
    });
  });

  describe('buildContext', () => {
    it('should build context within token budget', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockEpisodes: EpisodicMemory[] = [
        {
          id: 'ep-1',
          ...sampleEpisodeInput,
          summary: 'Short summary one', // ~3 tokens
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'ep-2',
          ...sampleEpisodeInput,
          summary: 'Short summary two', // ~3 tokens
          timestamp: new Date('2024-01-14T10:00:00Z'), // Older
        },
        {
          id: 'ep-3',
          ...sampleEpisodeInput,
          summary: 'Short summary three', // ~3 tokens
          timestamp: new Date('2024-01-13T10:00:00Z'), // Oldest
        },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'ep-1', score: 0.95, document: 'Short summary one', metadata: {} },
        { id: 'ep-2', score: 0.90, document: 'Short summary two', metadata: {} },
        { id: 'ep-3', score: 0.85, document: 'Short summary three', metadata: {} },
      ]);

      // Setup getEpisode to return episodes
      mockEpisodes.forEach((ep) => {
        vi.mocked(mockDocStore.getEpisode).mockResolvedValueOnce(ep);
      });

      const result = await manager.buildContext('test query', 100);

      expect(result.episodes.length).toBeGreaterThan(0);
      expect(result.totalTokens).toBeLessThanOrEqual(100);
      expect(result.truncated).toBe(false);

      // Episodes should be sorted chronologically (oldest first)
      for (let i = 1; i < result.episodes.length; i++) {
        expect(result.episodes[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          result.episodes[i - 1].timestamp.getTime()
        );
      }
    });

    it('should truncate when exceeding token budget', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      // Create summaries that are definitely larger than budget
      const largeSummary1 = 'This is a very long summary that contains many words and will definitely exceed our small token budget. '.repeat(10);
      const largeSummary2 = 'Another extremely lengthy summary with lots of content that takes up many tokens in the budget calculation. '.repeat(10);

      const mockEpisodes: EpisodicMemory[] = [
        {
          id: 'ep-1',
          ...sampleEpisodeInput,
          summary: largeSummary1,
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'ep-2',
          ...sampleEpisodeInput,
          summary: largeSummary2,
          timestamp: new Date('2024-01-14T10:00:00Z'),
        },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'ep-1', score: 0.95, document: largeSummary1, metadata: {} },
        { id: 'ep-2', score: 0.90, document: largeSummary2, metadata: {} },
      ]);

      mockEpisodes.forEach(ep => {
        vi.mocked(mockDocStore.getEpisode).mockResolvedValueOnce(ep);
      });

      const result = await manager.buildContext('test query', 100); // Small budget

      expect(result.truncated).toBe(true);
      expect(result.totalTokens).toBeLessThanOrEqual(100);
    });

    it('should prioritize recent and relevant episodes', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockEpisodes: EpisodicMemory[] = [
        {
          id: 'ep-recent',
          ...sampleEpisodeInput,
          summary: 'Recent episode',
          timestamp: new Date(now.getTime() - 1000 * 60 * 60), // 1 hour ago
        },
        {
          id: 'ep-old',
          ...sampleEpisodeInput,
          summary: 'Old episode',
          timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
        },
      ];

      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([
        { id: 'ep-old', score: 0.90, document: 'Old episode', metadata: {} }, // Higher relevance but older
        { id: 'ep-recent', score: 0.85, document: 'Recent episode', metadata: {} }, // Lower relevance but newer
      ]);

      mockEpisodes.forEach(ep => {
        vi.mocked(mockDocStore.getEpisode).mockResolvedValueOnce(ep);
      });

      const result = await manager.buildContext('test query', 1000);

      // Both should be included given large budget
      expect(result.episodes).toHaveLength(2);
    });

    it('should handle session filter in search', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(mockVectorStore.search).mockResolvedValue([]);

      await manager.buildContext('test query', 1000, {
        sessionId: 'session-123',
      });

      expect(mockVectorStore.search).toHaveBeenCalledWith(
        'episode_vectors',
        mockEmbedding,
        expect.objectContaining({
          where: { sessionId: 'session-123' },
        })
      );
    });
  });

  describe('consolidateOldEpisodes', () => {
    it('should return stub result for now', async () => {
      const result = await manager.consolidateOldEpisodes(30);

      expect(result).toEqual({
        consolidatedCount: 0,
        newEpisodes: [],
      });
    });

    it('should accept optional sessionId parameter', async () => {
      const result = await manager.consolidateOldEpisodes(30, 'session-123');

      expect(result).toEqual({
        consolidatedCount: 0,
        newEpisodes: [],
      });
    });

    it('should log the consolidation attempt', async () => {
      await manager.consolidateOldEpisodes(30);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Consolidating episodes older than 30 days'
      );
    });
  });

  describe('extractInsights', () => {
    it('should extract insights from episodes using LLM', async () => {
      const mockEpisodes: EpisodicMemory[] = [
        {
          id: 'ep-1',
          ...sampleEpisodeInput,
          summary: 'Successfully used web search to find AI papers',
        },
        {
          id: 'ep-2',
          ...sampleEpisodeInput,
          summary: 'Failed to access paywalled content, used alternative sources',
        },
      ];

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [
          {
            type: 'text' as const,
            text: `- Web search is effective for finding AI research papers
- Paywalled content requires alternative approaches
- Open access sources provide good coverage
- Search strategies should include multiple source types`,
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 50 },
      };

      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue(
        mockLLMResponse.content[0].text
      );

      const result = await manager.extractInsights(mockEpisodes);

      // Should call LLM with episode summaries
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        [
          {
            role: 'user',
            content: expect.stringContaining('Successfully used web search'),
          },
        ],
        { maxTokens: 500 }
      );

      // Should extract and parse insights
      expect(result).toHaveLength(4);
      expect(result[0]).toBe('Web search is effective for finding AI research papers');
      expect(result[1]).toBe('Paywalled content requires alternative approaches');
    });

    it('should return empty array for no episodes', async () => {
      const result = await manager.extractInsights([]);

      expect(result).toEqual([]);
      expect(mockLLMClient.complete).not.toHaveBeenCalled();
    });

    it('should handle different bullet point formats', async () => {
      const mockEpisodes: EpisodicMemory[] = [
        { id: 'ep-1', ...sampleEpisodeInput },
      ];

      const mockLLMResponse = {
        id: 'response-1',
        type: 'message' as const,
        content: [
          {
            type: 'text' as const,
            text: `* Insight with asterisk
• Insight with bullet
- Insight with dash
Regular text without bullet`,
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant' as const,
        stopReason: 'end_turn' as const,
        usage: { inputTokens: 100, outputTokens: 50 },
      };

      vi.mocked(mockLLMClient.complete).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockLLMClient.extractText).mockReturnValue(
        mockLLMResponse.content[0].text
      );

      const result = await manager.extractInsights(mockEpisodes);

      // Should extract all bullet points but not regular text
      expect(result).toHaveLength(3);
      expect(result).toContain('Insight with asterisk');
      expect(result).toContain('Insight with bullet');
      expect(result).toContain('Insight with dash');
      expect(result).not.toContain('Regular text without bullet');
    });
  });

  describe('createEpisode', () => {
    it('should create episode from individual components', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      const actions: Action[] = [
        {
          ...sampleAction,
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          ...sampleAction,
          id: 'action-2',
          timestamp: new Date('2024-01-15T10:00:05Z'),
        },
      ];

      const outcomes: Outcome[] = [
        { ...sampleOutcome, success: true },
        { ...sampleOutcome, actionId: 'action-2', success: true },
      ];

      const findings: Finding[] = [sampleFinding];

      const result = await manager.createEpisode(
        'session-1',
        'Test Topic',
        actions,
        outcomes,
        findings,
        'Test summary',
        { tags: ['test', 'demo'] }
      );

      // Should calculate duration from action timestamps
      expect(result.duration).toBe(5000); // 5 seconds between actions

      // Should determine success from outcomes
      expect(result.success).toBe(true);

      // Should include all components
      expect(result.actions).toEqual(actions);
      expect(result.outcomes).toEqual(outcomes);
      expect(result.findings).toEqual(findings);
      expect(result.summary).toBe('Test summary');
      expect(result.tags).toEqual(['test', 'demo']);

      // Should store the episode
      expect(mockDocStore.storeEpisode).toHaveBeenCalled();
    });

    it('should mark episode as failed if any outcome failed', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      const actions: Action[] = [sampleAction];
      const outcomes: Outcome[] = [
        { ...sampleOutcome, success: true },
        { ...sampleOutcome, actionId: 'action-2', success: false },
      ];

      const result = await manager.createEpisode(
        'session-1',
        'Test Topic',
        actions,
        outcomes,
        [],
        'Test summary'
      );

      expect(result.success).toBe(false);
    });

    it('should handle single action with zero duration', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      const actions: Action[] = [sampleAction];
      const outcomes: Outcome[] = [sampleOutcome];

      const result = await manager.createEpisode(
        'session-1',
        'Test Topic',
        actions,
        outcomes,
        [],
        'Test summary'
      );

      expect(result.duration).toBe(0);
    });

    it('should include optional feedback', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      const feedback: UserFeedback = {
        sessionId: 'session-1',
        timestamp: new Date(),
        rating: 4,
        helpful: true,
        specificFeedback: {},
      };

      const result = await manager.createEpisode(
        'session-1',
        'Test Topic',
        [sampleAction],
        [sampleOutcome],
        [],
        'Test summary',
        { feedback }
      );

      expect(result.feedback).toEqual(feedback);
    });

    it('should use empty tags array if not provided', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockEmbeddingClient.embed).mockResolvedValue(mockEmbedding);

      const result = await manager.createEpisode(
        'session-1',
        'Test Topic',
        [sampleAction],
        [sampleOutcome],
        [],
        'Test summary'
      );

      expect(result.tags).toEqual([]);
    });
  });
});
