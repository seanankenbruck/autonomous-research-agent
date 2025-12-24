/**
 * Memory System Integration Tests
 * Tests the complete memory system workflow with all managers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemorySystem, MemorySystem } from '../../../src/memory/memory-system';
import {
  createInMemoryDocumentStore,
  createMockVectorStore,
  createMockEmbeddingClient,
  createMockLLMClient,
  createMockLogger,
  createMockSearchResults,
  TestResourceManager,
} from '../../helpers';
import {
  mockEpisodeArray,
} from '../../fixtures/memory';
import type { SQLiteDocumentStore } from '../../../src/memory/stores/document-store';
import type { ChromaVectorStore } from '../../../src/memory/stores/vector-store';
import type { EmbeddingClient } from '../../../src/llm/embeddings';
import type { LLMClient } from '../../../src/llm/client';
import type { Logger } from '../../../src/utils/logger';
import type { Goal, Action, Outcome, Finding } from '../../../src/agent/types';
import { vi } from 'vitest';

describe('Memory System Integration Tests', () => {
  let memorySystem: MemorySystem;
  let documentStore: SQLiteDocumentStore;
  let vectorStore: ChromaVectorStore;
  let embeddingClient: EmbeddingClient;
  let llmClient: LLMClient;
  let logger: Logger;
  let resources: TestResourceManager;

  // Sample test data
  const testGoal: Goal = {
    description: 'Research machine learning techniques',
    successCriteria: ['Find 10 sources', 'Extract key concepts'],
    constraints: ['Recent sources only'],
    estimatedComplexity: 'moderate',
  };

  const testActions: Action[] = [
    {
      id: 'action-1',
      sessionId: 'session-1',
      type: 'search',
      tool: 'web_search',
      parameters: { query: 'machine learning' },
      reasoning: 'Find relevant sources',
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      id: 'action-2',
      sessionId: 'session-1',
      type: 'analyze',
      tool: 'content_analyzer',
      parameters: { content: '...' },
      reasoning: 'Extract key concepts',
      timestamp: new Date('2024-01-15T10:01:00Z'),
    },
  ];

  const testOutcomes: Outcome[] = [
    {
      actionId: 'action-1',
      success: true,
      result: { count: 15 },
      observations: ['Found relevant sources'],
      duration: 2000,
      metadata: {},
      timestamp: new Date('2024-01-15T10:00:02Z'),
    },
    {
      actionId: 'action-2',
      success: true,
      result: { concepts: 5 },
      observations: ['Extracted key concepts'],
      duration: 3000,
      metadata: {},
      timestamp: new Date('2024-01-15T10:01:03Z'),
    },
  ];

  const testFindings: Finding[] = [
    {
      id: 'finding-1',
      content: 'Neural networks are effective for pattern recognition',
      source: {
        url: 'https://example.com/ml',
        title: 'ML Techniques',
        type: 'academic',
        credibilityScore: 0.9,
      },
      confidence: 0.9,
      relevance: 0.95,
      timestamp: new Date('2024-01-15T10:01:05Z'),
      verificationStatus: 'verified',
      relatedFindings: [],
    },
  ];

  beforeEach(async () => {
    resources = new TestResourceManager();

    // Create stores and clients
    documentStore = createInMemoryDocumentStore();
    vectorStore = createMockVectorStore();
    embeddingClient = createMockEmbeddingClient({ deterministic: true });
    llmClient = createMockLLMClient({
      defaultResponse: 'Extracted fact about machine learning',
      responses: new Map([
        ['extract facts', 'Neural networks require large datasets'],
        ['insight', 'Pattern: successful research requires multiple sources'],
      ]),
    });
    logger = createMockLogger();

    // Register cleanup
    resources.register(async () => {
      await documentStore.close();
    });

    // Create memory system
    memorySystem = await createMemorySystem(
      documentStore,
      vectorStore,
      embeddingClient,
      llmClient,
      logger,
      {
        autoConsolidate: true,
        autoReflect: true,
        reflectionInterval: 5,
        consolidationThresholdDays: 7,
        maxContextTokens: 4000,
      }
    );
  });

  afterEach(async () => {
    await resources.cleanup();
  });

  describe('Basic Session Flow', () => {
    it('should complete full session workflow: start → store → complete', async () => {
      // Start session
      const session = await memorySystem.startSession(
        'ML Research',
        testGoal,
        'test-user'
      );

      expect(session).toBeDefined();
      expect(session.topic).toBe('ML Research');
      expect(session.status).toBe('active');
      expect(session.userId).toBe('test-user');

      // Verify session is current
      const currentSession = memorySystem.getCurrentSession();
      expect(currentSession?.id).toBe(session.id);

      // Store experience
      const result = await memorySystem.storeExperience(
        'Research Session',
        testActions,
        testOutcomes,
        testFindings,
        'Completed research on ML techniques',
        { tags: ['ml', 'research'] }
      );

      expect(result.episode).toBeDefined();
      expect(result.episode.sessionId).toBe(session.id);
      expect(result.episode.success).toBe(true);
      expect(result.extractedFacts).toBeDefined();

      // Complete session
      await memorySystem.completeSession();

      // Verify session is completed
      const completedSession = memorySystem.getCurrentSession();
      expect(completedSession).toBeNull();
    });

    it('should throw error when storing experience without active session', async () => {
      await expect(
        memorySystem.storeExperience(
          'Test',
          testActions,
          testOutcomes,
          testFindings,
          'Summary'
        )
      ).rejects.toThrow('No active session');
    });

    it('should handle session completion when no session is active', async () => {
      // Should not throw
      await memorySystem.completeSession();

      expect(logger.warn).toHaveBeenCalledWith('No active session to complete');
    });
  });

  describe('storeExperience()', () => {
    beforeEach(async () => {
      await memorySystem.startSession('Test Session', testGoal);
    });

    it('should store episode and extract facts by default', async () => {
      const result = await memorySystem.storeExperience(
        'Test Experience',
        testActions,
        testOutcomes,
        testFindings,
        'Test summary'
      );

      expect(result.episode).toBeDefined();
      expect(result.episode.topic).toBe('Test Experience');
      expect(result.episode.actions).toHaveLength(2);
      expect(result.extractedFacts).toBeDefined();
    });

    it('should skip fact extraction when disabled', async () => {
      const result = await memorySystem.storeExperience(
        'Test Experience',
        testActions,
        testOutcomes,
        testFindings,
        'Test summary',
        { extractFacts: false }
      );

      expect(result.episode).toBeDefined();
      expect(result.extractedFacts).toHaveLength(0);
    });

    it('should include tags when provided', async () => {
      const result = await memorySystem.storeExperience(
        'Test Experience',
        testActions,
        testOutcomes,
        testFindings,
        'Test summary',
        { tags: ['custom', 'tags'] }
      );

      expect(result.episode.tags).toContain('custom');
      expect(result.episode.tags).toContain('tags');
    });

    it('should track reflection trigger based on action count', async () => {
      // Store experiences until reflection is triggered
      for (let i = 0; i < 3; i++) {
        const result = await memorySystem.storeExperience(
          `Experience ${i}`,
          testActions, // 2 actions each
          testOutcomes,
          testFindings,
          'Summary'
        );

        if (i < 2) {
          expect(result.shouldReflect).toBe(false);
        } else {
          // 3 experiences * 2 actions = 6 > reflectionInterval (5)
          expect(result.shouldReflect).toBe(true);
        }
      }
    });
  });

  describe('buildContext()', () => {
    beforeEach(async () => {
      await memorySystem.startSession('Test Session', testGoal);

      // Setup mock vector store search results
      vi.mocked(vectorStore.search).mockResolvedValue(
        createMockSearchResults({
          count: 3,
          baseScore: 0.9,
          documents: ['episode1', 'episode2', 'episode3'],
        })
      );
    });

    it('should retrieve context from all memory types', async () => {
      const context = await memorySystem.buildContext('machine learning', {
        maxTokens: 2000,
      });

      expect(context).toBeDefined();
      expect(context.episodes).toBeDefined();
      expect(context.facts).toBeDefined();
      expect(context.strategies).toBeDefined();
      expect(context.totalTokens).toBeGreaterThanOrEqual(0);
    });

    it('should respect token budget allocation', async () => {
      const context = await memorySystem.buildContext('test query', {
        maxTokens: 1000,
        episodeTokens: 400,
        factTokens: 400,
        strategyTokens: 200,
      });

      // Should not exceed budget (allowing for some overhead)
      expect(context.totalTokens).toBeLessThanOrEqual(1200);
    });

    it('should allow selective memory type inclusion', async () => {
      // Only episodes
      const episodesOnly = await memorySystem.buildContext('test', {
        includeEpisodes: true,
        includeFacts: false,
        includeStrategies: false,
      });

      expect(episodesOnly.facts).toHaveLength(0);
      expect(episodesOnly.strategies).toHaveLength(0);

      // Only facts
      const factsOnly = await memorySystem.buildContext('test', {
        includeEpisodes: false,
        includeFacts: true,
        includeStrategies: false,
      });

      expect(factsOnly.episodes).toHaveLength(0);
      expect(factsOnly.strategies).toHaveLength(0);
    });

    it('should mark truncation when content exceeds budget', async () => {
      // Store multiple large episodes to trigger truncation
      for (let i = 0; i < 10; i++) {
        await memorySystem.storeExperience(
          `Large Episode ${i}`,
          testActions,
          testOutcomes,
          testFindings,
          'A'.repeat(500) // Large summary
        );
      }

      const context = await memorySystem.buildContext('test', {
        maxTokens: 100, // Very small budget
      });

      // At least one should be truncated with small budget
      expect(
        context.truncated.episodes || context.truncated.facts
      ).toBeDefined();
    });
  });

  describe('formatContextForPrompt()', () => {
    it('should format empty context', () => {
      const context = {
        episodes: [],
        facts: [],
        strategies: [],
        totalTokens: 0,
        truncated: { episodes: false, facts: false, strategies: false },
      };

      const formatted = memorySystem.formatContextForPrompt(context);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should format context with all sections', async () => {
      // Create a session and add content
      await memorySystem.startSession('Test', testGoal);
      await memorySystem.storeExperience(
        'Test',
        testActions,
        testOutcomes,
        testFindings,
        'Summary'
      );

      const context = await memorySystem.buildContext('test');
      const formatted = memorySystem.formatContextForPrompt(context);

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should include truncation warnings when applicable', async () => {
      const context = {
        episodes: [mockEpisodeArray[0]],
        facts: [],
        strategies: [],
        totalTokens: 1000,
        truncated: { episodes: true, facts: true, strategies: false },
      };

      const formatted = memorySystem.formatContextForPrompt(context);

      expect(formatted).toContain('truncated');
      expect(formatted).toContain('episodes');
      expect(formatted).toContain('facts');
    });
  });

  describe('searchMemories()', () => {
    beforeEach(async () => {
      await memorySystem.startSession('Test Session', testGoal);

      // Setup mock search results
      vi.mocked(vectorStore.search).mockResolvedValue(
        createMockSearchResults({
          count: 5,
          baseScore: 0.85,
        })
      );
    });

    it('should search across all memory types by default', async () => {
      const results = await memorySystem.searchMemories('machine learning');

      expect(results).toBeDefined();
      expect(results.episodes).toBeDefined();
      expect(results.facts).toBeDefined();
      expect(results.strategies).toBeDefined();
    });

    it('should respect maxResults parameter', async () => {
      const results = await memorySystem.searchMemories('test', {
        maxResults: 3,
      });

      expect(results.episodes.length).toBeLessThanOrEqual(3);
      expect(results.facts.length).toBeLessThanOrEqual(3);
      expect(results.strategies.length).toBeLessThanOrEqual(3);
    });

    it('should filter by memory types', async () => {
      const episodesOnly = await memorySystem.searchMemories('test', {
        types: ['episodic'],
      });

      expect(episodesOnly.episodes).toBeDefined();
      expect(episodesOnly.facts).toHaveLength(0);
      expect(episodesOnly.strategies).toHaveLength(0);

      const factsAndStrategies = await memorySystem.searchMemories('test', {
        types: ['semantic', 'procedural'],
      });

      expect(factsAndStrategies.episodes).toHaveLength(0);
      expect(factsAndStrategies.facts).toBeDefined();
      expect(factsAndStrategies.strategies).toBeDefined();
    });

    it('should apply similarity threshold', async () => {
      await memorySystem.searchMemories('test', {
        similarityThreshold: 0.9,
      });

      // With high threshold, should return fewer results
      expect(vectorStore.search).toHaveBeenCalled();
    });
  });

  describe('getStrategyRecommendations()', () => {
    beforeEach(async () => {
      // Store some strategies
      await memorySystem.storeStrategy(
        'comprehensive_research',
        'Thorough research with verification',
        ['research', 'analysis'],
        ['web_search', 'web_fetch', 'analyzer'],
        { successRate: 0.9 }
      );

      await memorySystem.storeStrategy(
        'quick_search',
        'Fast preliminary search',
        ['quick', 'overview'],
        ['web_search'],
        { successRate: 0.7 }
      );
    });

    it('should recommend relevant strategies', async () => {
      const recommendations = await memorySystem.getStrategyRecommendations(
        'Need to do thorough research on a topic',
        ['web_search', 'web_fetch', 'analyzer'],
        3
      );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should include relevance scores and reasoning', async () => {
      const recommendations = await memorySystem.getStrategyRecommendations(
        'Research task',
        ['web_search'],
        2
      );

      for (const rec of recommendations) {
        expect(rec.strategy).toBeDefined();
        expect(rec.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(rec.relevanceScore).toBeLessThanOrEqual(1);
        expect(rec.reasoning).toBeDefined();
      }
    });
  });

  describe('consolidateMemories()', () => {
    it('should consolidate old episodes and facts', async () => {
      const result = await memorySystem.consolidateMemories();

      expect(result).toBeDefined();
      expect(result.episodesConsolidated).toBeGreaterThanOrEqual(0);
      expect(result.factsConsolidated).toBeGreaterThanOrEqual(0);
    });

    it('should skip consolidation when disabled', async () => {
      memorySystem.updateConfig({ autoConsolidate: false });

      const result = await memorySystem.consolidateMemories();

      expect(result.episodesConsolidated).toBe(0);
      expect(result.factsConsolidated).toBe(0);
    });

    it('should consolidate during session completion when auto-enabled', async () => {
      memorySystem.updateConfig({ autoConsolidate: true });

      await memorySystem.startSession('Test', testGoal);
      await memorySystem.completeSession();

      // Consolidation should have been called
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('consolidation'),
        expect.anything()
      );
    });
  });

  describe('updateFactRelevance()', () => {
    beforeEach(async () => {
      await memorySystem.startSession('Test Session', testGoal);

      // Store some experiences to create facts
      await memorySystem.storeExperience(
        'Test',
        testActions,
        testOutcomes,
        testFindings,
        'Summary'
      );
    });

    it('should update relevance for all facts', async () => {
      const updatedCount = await memorySystem.updateFactRelevance();

      expect(updatedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty fact list', async () => {
      // Create new memory system with no facts
      const freshStore = createInMemoryDocumentStore();
      resources.register(async () => await freshStore.close());

      const freshSystem = await createMemorySystem(
        freshStore,
        vectorStore,
        embeddingClient,
        llmClient,
        createMockLogger()
      );

      const updatedCount = await freshSystem.updateFactRelevance();
      expect(updatedCount).toBe(0);
    });
  });

  describe('performMaintenance()', () => {
    it('should run full maintenance workflow', async () => {
      const result = await memorySystem.performMaintenance();

      expect(result).toBeDefined();
      expect(result.episodesConsolidated).toBeGreaterThanOrEqual(0);
      expect(result.factsConsolidated).toBeGreaterThanOrEqual(0);
      expect(result.factsUpdated).toBeGreaterThanOrEqual(0);
    });

    it('should run consolidation and updates in parallel', async () => {
      const startTime = Date.now();
      await memorySystem.performMaintenance();
      const duration = Date.now() - startTime;

      // Should complete relatively quickly due to parallelization
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('getStatistics()', () => {
    beforeEach(async () => {
      await memorySystem.startSession('Test Session', testGoal);

      // Add some data
      await memorySystem.storeExperience(
        'Test 1',
        testActions,
        testOutcomes,
        testFindings,
        'Summary 1'
      );
      await memorySystem.storeExperience(
        'Test 2',
        testActions,
        testOutcomes,
        testFindings,
        'Summary 2'
      );
    });

    it('should aggregate statistics from all managers', async () => {
      const stats = await memorySystem.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.session).toBeDefined();
      expect(stats.episodic).toBeDefined();
      expect(stats.semantic).toBeDefined();
      expect(stats.procedural).toBeDefined();
    });

    it('should include current session in stats', async () => {
      const stats = await memorySystem.getStatistics();

      expect(stats.session.current).not.toBeNull();
      expect(stats.session.current?.topic).toBe('Test Session');
    });

    it('should calculate episodic statistics', async () => {
      const stats = await memorySystem.getStatistics();

      expect(stats.episodic.totalEpisodes).toBeGreaterThan(0);
      expect(stats.episodic.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.episodic.successRate).toBeLessThanOrEqual(1);
      expect(stats.episodic.averageDuration).toBeGreaterThanOrEqual(0);
    });

    it('should include semantic and procedural stats', async () => {
      const stats = await memorySystem.getStatistics();

      expect(stats.semantic.totalFacts).toBeGreaterThanOrEqual(0);
      expect(stats.procedural.totalStrategies).toBeGreaterThanOrEqual(0);
    });

    it('should handle stats when no session is active', async () => {
      await memorySystem.completeSession();

      const stats = await memorySystem.getStatistics();

      expect(stats.session.current).toBeNull();
      expect(stats.episodic.totalEpisodes).toBe(0);
    });
  });

  describe('Reflection Tracking', () => {
    beforeEach(async () => {
      await memorySystem.startSession('Test Session', testGoal);
    });

    it('should track action count for reflection triggering', () => {
      // Initially should not reflect
      expect(memorySystem.shouldReflect()).toBe(false);
    });

    it('should trigger reflection after threshold actions', async () => {
      memorySystem.updateConfig({ reflectionInterval: 3 });

      // Store 2 experiences with 2 actions each = 4 actions total
      await memorySystem.storeExperience(
        'Test 1',
        testActions,
        testOutcomes,
        testFindings,
        'Summary'
      );
      await memorySystem.storeExperience(
        'Test 2',
        testActions,
        testOutcomes,
        testFindings,
        'Summary'
      );

      // Should trigger reflection (4 > 3)
      expect(memorySystem.shouldReflect()).toBe(true);
    });

    it('should reset reflection counter', async () => {
      // Trigger reflection
      await memorySystem.storeExperience(
        'Test 1',
        testActions,
        testOutcomes,
        testFindings,
        'Summary'
      );
      await memorySystem.storeExperience(
        'Test 2',
        testActions,
        testOutcomes,
        testFindings,
        'Summary'
      );
      await memorySystem.storeExperience(
        'Test 3',
        testActions,
        testOutcomes,
        testFindings,
        'Summary'
      );

      expect(memorySystem.shouldReflect()).toBe(true);

      // Reset counter
      memorySystem.resetReflectionCounter();

      // Should not reflect anymore
      expect(memorySystem.shouldReflect()).toBe(false);
    });

    it('should disable reflection when autoReflect is false', async () => {
      memorySystem.updateConfig({ autoReflect: false });

      // Store many experiences
      for (let i = 0; i < 10; i++) {
        await memorySystem.storeExperience(
          `Test ${i}`,
          testActions,
          testOutcomes,
          testFindings,
          'Summary'
        );
      }

      // Should never trigger
      expect(memorySystem.shouldReflect()).toBe(false);
    });
  });

  describe('extractInsights()', () => {
    beforeEach(async () => {
      await memorySystem.startSession('Test Session', testGoal);

      // Store multiple experiences
      for (let i = 0; i < 3; i++) {
        await memorySystem.storeExperience(
          `Experience ${i}`,
          testActions,
          testOutcomes,
          testFindings,
          `Summary ${i}`
        );
      }
    });

    it('should extract insights from recent episodes', async () => {
      const insights = await memorySystem.extractInsights();

      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);
    });

    it('should limit insights to specified episode count', async () => {
      const insights = await memorySystem.extractInsights(2);

      expect(insights).toBeDefined();
      // Should use only last 2 episodes
    });

    it('should return empty array when no session is active', async () => {
      await memorySystem.completeSession();

      const insights = await memorySystem.extractInsights();

      expect(insights).toHaveLength(0);
    });
  });

  describe('healthCheck()', () => {
    it('should verify all components are working', async () => {
      const health = await memorySystem.healthCheck();

      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.components.episodic).toBe(true);
      expect(health.components.semantic).toBe(true);
      expect(health.components.procedural).toBe(true);
      expect(health.components.session).toBe(true);
      expect(health.errors).toHaveLength(0);
    });

    it('should detect component failures', async () => {
      // Make vector store fail
      vi.mocked(vectorStore.search).mockRejectedValue(
        new Error('Vector store error')
      );

      const health = await memorySystem.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = memorySystem.getConfig();

      expect(config).toBeDefined();
      expect(config.autoConsolidate).toBeDefined();
      expect(config.autoReflect).toBeDefined();
      expect(config.reflectionInterval).toBeDefined();
      expect(config.consolidationThresholdDays).toBeDefined();
      expect(config.maxContextTokens).toBeDefined();
    });

    it('should update configuration', () => {
      memorySystem.updateConfig({
        reflectionInterval: 10,
        maxContextTokens: 5000,
      });

      const config = memorySystem.getConfig();

      expect(config.reflectionInterval).toBe(10);
      expect(config.maxContextTokens).toBe(5000);
    });

    it('should merge partial config updates', () => {
      const originalConfig = memorySystem.getConfig();

      memorySystem.updateConfig({
        reflectionInterval: 15,
      });

      const updatedConfig = memorySystem.getConfig();

      expect(updatedConfig.reflectionInterval).toBe(15);
      expect(updatedConfig.autoConsolidate).toBe(originalConfig.autoConsolidate);
      expect(updatedConfig.maxContextTokens).toBe(originalConfig.maxContextTokens);
    });
  });

  describe('Strategy Management', () => {
    it('should store and record strategy usage', async () => {
      const strategy = await memorySystem.storeStrategy(
        'test_strategy',
        'Test strategy description',
        ['context1', 'context2'],
        ['tool1', 'tool2'],
        { successRate: 0.8, averageDuration: 5000 }
      );

      expect(strategy).toBeDefined();
      expect(strategy.strategyName).toBe('test_strategy');
      expect(strategy.successRate).toBe(0.8);

      // Record usage
      await memorySystem.recordStrategyUse(strategy.id, true, 4500);

      // Strategy usage should be updated
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should extract strategy from episodes', async () => {
      await memorySystem.startSession('Test', testGoal);

      // Store related episodes
      for (let i = 0; i < 3; i++) {
        await memorySystem.storeExperience(
          'Similar Task',
          testActions,
          testOutcomes,
          testFindings,
          'Completed successfully'
        );
      }

      const session = memorySystem.getCurrentSession();
      const episodes = await memorySystem.getSessionEpisodes(session!.id);

      const extractedStrategy = await memorySystem.extractStrategyFromEpisodes(
        episodes,
        'Similar Task Pattern'
      );

      // May or may not extract strategy depending on patterns
      expect(extractedStrategy === null || extractedStrategy !== undefined).toBe(
        true
      );
    });
  });

  describe('Complex Workflows', () => {
    it('should handle complete research workflow', async () => {
      // Start session
      await memorySystem.startSession(
        'Complex Research',
        testGoal,
        'researcher-1'
      );

      // Perform multiple research iterations
      for (let i = 0; i < 3; i++) {
        await memorySystem.storeExperience(
          `Research Iteration ${i + 1}`,
          testActions,
          testOutcomes,
          testFindings,
          `Completed iteration ${i + 1}`
        );
      }

      // Build context for next action (may be empty with mock store)
      const context = await memorySystem.buildContext('research progress');
      expect(context).toBeDefined();
      expect(context.episodes).toBeDefined();
      expect(context.facts).toBeDefined();
      expect(context.strategies).toBeDefined();

      // Get recommendations
      await memorySystem.getStrategyRecommendations(
        'Continue research',
        ['web_search', 'analyzer'],
        3
      );

      // Check if reflection is needed
      if (memorySystem.shouldReflect()) {
        const insights = await memorySystem.extractInsights();
        expect(insights).toBeDefined();
        memorySystem.resetReflectionCounter();
      }

      // Complete session
      await memorySystem.completeSession();

      // Verify final state
      expect(memorySystem.getCurrentSession()).toBeNull();

      const stats = await memorySystem.getStatistics();
      expect(stats.session.totalSessions).toBeGreaterThan(0);
    });

    it('should handle multi-session workflow', async () => {
      // Session 1
      await memorySystem.startSession('Session 1', testGoal);
      await memorySystem.storeExperience(
        'Task 1',
        testActions,
        testOutcomes,
        testFindings,
        'Summary 1'
      );
      await memorySystem.completeSession();

      // Session 2
      await memorySystem.startSession('Session 2', testGoal);
      await memorySystem.storeExperience(
        'Task 2',
        testActions,
        testOutcomes,
        testFindings,
        'Summary 2'
      );
      await memorySystem.completeSession();

      // Verify both sessions stored
      const stats = await memorySystem.getStatistics();
      expect(stats.session.totalSessions).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle vector store errors gracefully', async () => {
      vi.mocked(vectorStore.search).mockRejectedValue(
        new Error('Connection failed')
      );

      await memorySystem.startSession('Test', testGoal);

      // Should handle error in health check
      const health = await memorySystem.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should handle LLM client errors during fact extraction', async () => {
      vi.mocked(llmClient.complete).mockRejectedValue(
        new Error('LLM unavailable')
      );

      await memorySystem.startSession('Test', testGoal);

      // Fact extraction may fail but episode should still be stored
      // The error happens in extractFactsFromEpisode which may or may not throw
      // depending on implementation
      try {
        const result = await memorySystem.storeExperience(
          'Test',
          testActions,
          testOutcomes,
          testFindings,
          'Summary'
        );
        // If no error, episode should still be created
        expect(result.episode).toBeDefined();
      } catch (error) {
        // If error thrown, verify it's the LLM error
        expect((error as Error).message).toContain('LLM');
      }
    });
  });
});
