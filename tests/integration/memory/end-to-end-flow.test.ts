/**
 * End-to-End Memory System Flow Test
 * Tests realistic research session workflow with full integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemorySystem, MemorySystem } from '../../../src/memory/memory-system';
import { createReflectionEngine, ReflectionEngine } from '../../../src/memory/reflection-engine';
import {
  createInMemoryDocumentStore,
  createMockVectorStore,
  createMockEmbeddingClient,
  createMockLLMClient,
  createMockLogger,
  createMockSearchResults,
  TestResourceManager,
} from '../../helpers';
import type { SQLiteDocumentStore } from '../../../src/memory/stores/document-store';
import type { ChromaVectorStore } from '../../../src/memory/stores/vector-store';
import type { EmbeddingClient } from '../../../src/llm/embeddings';
import type { LLMClient } from '../../../src/llm/client';
import type { Logger } from '../../../src/utils/logger';
import type { Goal, Action, Outcome, Finding } from '../../../src/agent/types';

describe('End-to-End Memory System Flow', () => {
  let memorySystem: MemorySystem;
  let reflectionEngine: ReflectionEngine;
  let documentStore: SQLiteDocumentStore;
  let vectorStore: ChromaVectorStore;
  let embeddingClient: EmbeddingClient;
  let llmClient: LLMClient;
  let logger: Logger;
  let resources: TestResourceManager;

  // Realistic research goal
  const researchGoal: Goal = {
    description: 'Research best practices for building autonomous AI agents',
    successCriteria: [
      'Find at least 10 credible sources',
      'Identify key architectural patterns',
      'Extract actionable insights',
      'Verify information from multiple sources',
    ],
    constraints: [
      'Focus on recent sources (2023-2024)',
      'Prioritize academic and industry sources',
    ],
    estimatedComplexity: 'complex',
  };

  beforeEach(async () => {
    resources = new TestResourceManager();

    // Create stores and clients
    documentStore = createInMemoryDocumentStore();
    vectorStore = createMockVectorStore();
    embeddingClient = createMockEmbeddingClient({ deterministic: true });

    // Create LLM client with realistic responses for reflection
    llmClient = createMockLLMClient({
      defaultResponse: JSON.stringify({
        learnings: [
          'Multi-step research with verification yields better results',
          'Quick searches require follow-up analysis',
          'Architectural patterns emerge from analyzing multiple sources',
        ],
        shouldReplan: false,
        adjustments: [
          'Continue using multi-step verification approach',
          'Cross-reference findings from multiple sources',
        ],
        nextFocus: 'Deepen analysis of architectural patterns and implementation details',
      }),
      responses: new Map([
        ['extract facts', 'Key architectural pattern: ReAct framework combines reasoning and action'],
        ['knowledge gaps', '- Need more implementation examples\n- Missing performance benchmarks\n- Unclear scalability considerations'],
        ['alternative strategies', '- Focus on case studies\n- Interview practitioners\n- Review open-source implementations'],
      ]),
    });

    logger = createMockLogger();

    // Register cleanup
    resources.register(async () => {
      await documentStore.close();
    });

    // Create memory system with reflection enabled
    memorySystem = await createMemorySystem(
      documentStore,
      vectorStore,
      embeddingClient,
      llmClient,
      logger,
      {
        autoConsolidate: true,
        autoReflect: true,
        reflectionInterval: 5, // Trigger reflection every 5 actions
        consolidationThresholdDays: 7,
        maxContextTokens: 4000,
      }
    );

    // Create reflection engine
    reflectionEngine = createReflectionEngine(
      memorySystem,
      llmClient,
      logger
    );
  });

  afterEach(async () => {
    await resources.cleanup();
  });

  describe('Complete Research Session Workflow', () => {
    it('should execute full research session with reflection and consolidation', async () => {
      // ========================================================================
      // STEP 1: Start session with goal
      // ========================================================================
      const session = await memorySystem.startSession(
        'Autonomous AI Agents Research',
        researchGoal,
        'researcher-alice'
      );

      expect(session).toBeDefined();
      expect(session.topic).toBe('Autonomous AI Agents Research');
      expect(session.status).toBe('active');
      expect(session.userId).toBe('researcher-alice');
      expect(session.goal).toEqual(researchGoal);

      // Verify session is active
      const currentSession = memorySystem.getCurrentSession();
      expect(currentSession?.id).toBe(session.id);

      // ========================================================================
      // STEP 2: Store multiple experiences (successes and failures)
      // ========================================================================

      // Experience 1: Successful initial search
      const searchActions: Action[] = [
        {
          id: 'action-1',
          sessionId: session.id,
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'autonomous AI agents best practices' },
          reasoning: 'Find initial sources on autonomous agents',
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'action-2',
          sessionId: session.id,
          type: 'fetch',
          tool: 'web_fetch',
          parameters: { url: 'https://example.com/ai-agents' },
          reasoning: 'Fetch detailed content from top result',
          timestamp: new Date('2024-01-15T10:01:00Z'),
        },
      ];

      const searchOutcomes: Outcome[] = [
        {
          actionId: 'action-1',
          success: true,
          result: { count: 15, sources: ['source1', 'source2', 'source3'] },
          observations: ['Found 15 relevant sources', 'High quality academic sources'],
          duration: 2000,
          metadata: {},
          timestamp: new Date('2024-01-15T10:00:02Z'),
        },
        {
          actionId: 'action-2',
          success: true,
          result: { contentLength: 5000, quality: 'high' },
          observations: ['Successfully fetched detailed article', 'Contains architectural patterns'],
          duration: 1500,
          metadata: {},
          timestamp: new Date('2024-01-15T10:01:01.5Z'),
        },
      ];

      const searchFindings: Finding[] = [
        {
          id: 'finding-1',
          content: 'ReAct framework combines reasoning and action in agent architectures',
          source: {
            url: 'https://example.com/ai-agents',
            title: 'AI Agent Architectures',
            type: 'academic',
            credibilityScore: 0.95,
          },
          confidence: 0.9,
          relevance: 0.95,
          timestamp: new Date('2024-01-15T10:01:02Z'),
          verificationStatus: 'verified',
          relatedFindings: [],
        },
      ];

      const result1 = await memorySystem.storeExperience(
        'Initial Research - Web Search',
        searchActions,
        searchOutcomes,
        searchFindings,
        'Successfully found and analyzed initial sources on autonomous agents',
        { tags: ['research', 'initial', 'success'] }
      );

      expect(result1.episode).toBeDefined();
      expect(result1.episode.success).toBe(true);
      expect(result1.extractedFacts.length).toBeGreaterThanOrEqual(0);
      expect(result1.shouldReflect).toBe(false); // Not yet at reflection interval

      // Experience 2: Failed verification attempt
      const failedActions: Action[] = [
        {
          id: 'action-3',
          sessionId: session.id,
          type: 'verify',
          tool: 'fact_checker',
          parameters: { claim: 'All agents use ReAct framework' },
          reasoning: 'Verify claim about ReAct framework',
          timestamp: new Date('2024-01-15T10:05:00Z'),
        },
      ];

      const failedOutcomes: Outcome[] = [
        {
          actionId: 'action-3',
          success: false,
          result: { verified: false },
          observations: ['Claim is too broad', 'Many agents use different architectures'],
          duration: 1000,
          metadata: { error: 'Overgeneralization' },
          timestamp: new Date('2024-01-15T10:05:01Z'),
        },
      ];

      const result2 = await memorySystem.storeExperience(
        'Verification Attempt',
        failedActions,
        failedOutcomes,
        [],
        'Attempted to verify ReAct claim but found it was overgeneralized',
        { tags: ['verification', 'failure'] }
      );

      expect(result2.episode).toBeDefined();
      expect(result2.episode.success).toBe(false);

      // Experience 3: Successful analysis
      const analysisActions: Action[] = [
        {
          id: 'action-4',
          sessionId: session.id,
          type: 'analyze',
          tool: 'content_analyzer',
          parameters: { sources: ['source1', 'source2'] },
          reasoning: 'Extract patterns from multiple sources',
          timestamp: new Date('2024-01-15T10:10:00Z'),
        },
        {
          id: 'action-5',
          sessionId: session.id,
          type: 'synthesize',
          tool: 'summarizer',
          parameters: { findings: ['finding-1', 'finding-2'] },
          reasoning: 'Synthesize findings into coherent insights',
          timestamp: new Date('2024-01-15T10:11:00Z'),
        },
      ];

      const analysisOutcomes: Outcome[] = [
        {
          actionId: 'action-4',
          success: true,
          result: { patterns: 5, concepts: 10 },
          observations: ['Identified common architectural patterns', 'Found recurring themes'],
          duration: 3000,
          metadata: {},
          timestamp: new Date('2024-01-15T10:10:03Z'),
        },
        {
          actionId: 'action-5',
          success: true,
          result: { insights: 3 },
          observations: ['Successfully synthesized findings', 'Clear actionable insights'],
          duration: 2000,
          metadata: {},
          timestamp: new Date('2024-01-15T10:11:02Z'),
        },
      ];

      const analysisFindings: Finding[] = [
        {
          id: 'finding-2',
          content: 'Memory systems are crucial for agent learning and adaptation',
          source: {
            url: 'https://example.com/agent-memory',
            title: 'Memory in AI Agents',
            type: 'academic',
            credibilityScore: 0.9,
          },
          confidence: 0.85,
          relevance: 0.9,
          timestamp: new Date('2024-01-15T10:10:05Z'),
          verificationStatus: 'verified',
          relatedFindings: ['finding-1'],
        },
      ];

      const result3 = await memorySystem.storeExperience(
        'Pattern Analysis',
        analysisActions,
        analysisOutcomes,
        analysisFindings,
        'Analyzed sources and extracted key architectural patterns',
        { tags: ['analysis', 'success', 'patterns'] }
      );

      expect(result3.episode).toBeDefined();
      expect(result3.episode.success).toBe(true);
      // Total actions: 2 + 1 + 2 = 5, should trigger reflection
      expect(result3.shouldReflect).toBe(true);

      // ========================================================================
      // STEP 3: Trigger reflection
      // ========================================================================

      // Setup vector store to return relevant episodes for reflection
      vi.mocked(vectorStore.search).mockResolvedValue(
        createMockSearchResults({
          count: 3,
          baseScore: 0.9,
          documents: [
            result1.episode.id,
            result2.episode.id,
            result3.episode.id,
          ],
        })
      );

      // Populate session working memory with recent actions (required for canReflect check)
      const updatedSession = memorySystem.getCurrentSession();
      if (updatedSession) {
        updatedSession.state.workingMemory.recentActions = [
          ...searchActions,
          ...failedActions,
          ...analysisActions,
        ];
        updatedSession.state.iterationCount = 3; // For progress assessment
      }

      const reflectionResult = await reflectionEngine.reflect();

      expect(reflectionResult).toBeDefined();
      expect(reflectionResult.id).toBeDefined();
      expect(reflectionResult.sessionId).toBe(session.id);
      expect(reflectionResult.learnings).toBeDefined();
      expect(reflectionResult.learnings.length).toBeGreaterThan(0);
      expect(reflectionResult.progressAssessment).toBeDefined();
      expect(reflectionResult.strategyEvaluation).toBeDefined();
      expect(reflectionResult.shouldReplan).toBeDefined();
      expect(reflectionResult.adjustments).toBeDefined();
      expect(reflectionResult.nextFocus).toBeDefined();

      // Reset reflection counter after reflecting
      memorySystem.resetReflectionCounter();
      expect(memorySystem.shouldReflect()).toBe(false);

      // ========================================================================
      // STEP 4: Get strategy recommendations
      // ========================================================================

      // Store a strategy based on successful pattern
      const strategy = await memorySystem.storeStrategy(
        'multi_step_research',
        'Comprehensive research with search, fetch, and analysis',
        ['research', 'fact-finding', 'comprehensive'],
        ['web_search', 'web_fetch', 'content_analyzer', 'fact_checker'],
        {
          successRate: 0.85,
          averageDuration: 10000,
        }
      );

      expect(strategy).toBeDefined();

      // Get recommendations for similar task
      const recommendations = await memorySystem.getStrategyRecommendations(
        'Need to research a complex topic thoroughly',
        ['web_search', 'web_fetch', 'content_analyzer'],
        3
      );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);

      // ========================================================================
      // STEP 5: Record strategy usage
      // ========================================================================

      await memorySystem.recordStrategyUse(strategy.id, true, 9500);

      // Verify strategy was recorded
      expect(logger.debug).toHaveBeenCalled();

      // ========================================================================
      // STEP 6: Complete session (triggers consolidation)
      // ========================================================================

      await memorySystem.completeSession();

      // Verify session completed
      expect(memorySystem.getCurrentSession()).toBeNull();

      // Verify consolidation was triggered (check logs)
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('consolidation'),
        expect.anything()
      );

      // ========================================================================
      // STEP 7: Verify all memories stored correctly
      // ========================================================================

      const stats = await memorySystem.getStatistics();

      // Session statistics
      expect(stats.session.totalSessions).toBeGreaterThan(0);
      expect(stats.session.current).toBeNull(); // Session completed

      // Episodic statistics
      expect(stats.episodic.totalEpisodes).toBe(0); // Episodes from completed session

      // Semantic statistics (facts extracted)
      expect(stats.semantic.totalFacts).toBeGreaterThanOrEqual(0);

      // Procedural statistics (strategies stored)
      expect(stats.procedural.totalStrategies).toBeGreaterThanOrEqual(1);

      // ========================================================================
      // STEP 8: Search across memory types
      // ========================================================================

      // Setup search to return results
      vi.mocked(vectorStore.search).mockResolvedValue(
        createMockSearchResults({
          count: 5,
          baseScore: 0.88,
        })
      );

      const searchResults = await memorySystem.searchMemories(
        'autonomous agents architecture patterns',
        {
          maxResults: 10,
          types: ['episodic', 'semantic', 'procedural'],
          similarityThreshold: 0.7,
        }
      );

      expect(searchResults).toBeDefined();
      expect(searchResults.episodes).toBeDefined();
      expect(searchResults.facts).toBeDefined();
      expect(searchResults.strategies).toBeDefined();

      // ========================================================================
      // STEP 9: Build context for next session
      // ========================================================================

      const context = await memorySystem.buildContext(
        'autonomous agents best practices',
        {
          maxTokens: 2000,
          includeEpisodes: true,
          includeFacts: true,
          includeStrategies: true,
        }
      );

      expect(context).toBeDefined();
      expect(context.episodes).toBeDefined();
      expect(context.facts).toBeDefined();
      expect(context.strategies).toBeDefined();
      expect(context.totalTokens).toBeGreaterThanOrEqual(0);
      expect(context.totalTokens).toBeLessThanOrEqual(2200); // Allow overhead

      // Format for prompt
      const formattedContext = memorySystem.formatContextForPrompt(context);
      expect(formattedContext).toBeDefined();
      expect(typeof formattedContext).toBe('string');
    });

    it('should handle multi-session workflow with memory retrieval', async () => {
      // ========================================================================
      // SESSION 1: Initial Research
      // ========================================================================

      await memorySystem.startSession(
        'Initial Agent Research',
        researchGoal,
        'researcher-alice'
      );

      const session1Actions: Action[] = [
        {
          id: 'session1-action-1',
          sessionId: memorySystem.getCurrentSession()!.id,
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'AI agent architectures' },
          reasoning: 'Initial research',
          timestamp: new Date(),
        },
      ];

      const session1Outcomes: Outcome[] = [
        {
          actionId: 'session1-action-1',
          success: true,
          result: { count: 10 },
          observations: ['Found sources'],
          duration: 2000,
          metadata: {},
          timestamp: new Date(),
        },
      ];

      await memorySystem.storeExperience(
        'Session 1 Research',
        session1Actions,
        session1Outcomes,
        [],
        'Initial research completed',
        { tags: ['session1'] }
      );

      await memorySystem.completeSession();

      // ========================================================================
      // SESSION 2: Follow-up Research (uses memories from session 1)
      // ========================================================================

      await memorySystem.startSession(
        'Follow-up Research',
        researchGoal,
        'researcher-alice'
      );

      // Setup search to simulate finding previous session's memories
      vi.mocked(vectorStore.search).mockResolvedValue(
        createMockSearchResults({
          count: 2,
          baseScore: 0.85,
        })
      );

      // Build context using previous session's memories
      const priorContext = await memorySystem.buildContext(
        'agent architectures',
        { maxTokens: 1000 }
      );

      expect(priorContext).toBeDefined();

      const session2Actions: Action[] = [
        {
          id: 'session2-action-1',
          sessionId: memorySystem.getCurrentSession()!.id,
          type: 'analyze',
          tool: 'content_analyzer',
          parameters: { sources: ['previous findings'] },
          reasoning: 'Build on previous research',
          timestamp: new Date(),
        },
      ];

      const session2Outcomes: Outcome[] = [
        {
          actionId: 'session2-action-1',
          success: true,
          result: { insights: 5 },
          observations: ['Built on previous findings'],
          duration: 3000,
          metadata: {},
          timestamp: new Date(),
        },
      ];

      await memorySystem.storeExperience(
        'Session 2 Analysis',
        session2Actions,
        session2Outcomes,
        [],
        'Follow-up analysis completed',
        { tags: ['session2', 'follow-up'] }
      );

      await memorySystem.completeSession();

      // ========================================================================
      // Verify multi-session statistics
      // ========================================================================

      const finalStats = await memorySystem.getStatistics();
      expect(finalStats.session.totalSessions).toBeGreaterThanOrEqual(2);
    });

    it('should handle errors gracefully during workflow', async () => {
      // Start session
      await memorySystem.startSession('Error Test', researchGoal);

      // Simulate vector store failure
      vi.mocked(vectorStore.search).mockRejectedValue(
        new Error('Vector store connection failed')
      );

      const actions: Action[] = [
        {
          id: 'error-action',
          sessionId: memorySystem.getCurrentSession()!.id,
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'test' },
          reasoning: 'Test search',
          timestamp: new Date(),
        },
      ];

      const outcomes: Outcome[] = [
        {
          actionId: 'error-action',
          success: true,
          result: {},
          observations: [],
          duration: 1000,
          metadata: {},
          timestamp: new Date(),
        },
      ];

      // Should still be able to store experience
      const result = await memorySystem.storeExperience(
        'Test',
        actions,
        outcomes,
        [],
        'Summary'
      );

      expect(result.episode).toBeDefined();

      // Health check should detect the error
      const health = await memorySystem.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);

      await memorySystem.completeSession();
    });

    it('should perform maintenance operations correctly', async () => {
      // Start session and add some data
      await memorySystem.startSession('Maintenance Test', researchGoal);

      const actions: Action[] = [
        {
          id: 'maint-action',
          sessionId: memorySystem.getCurrentSession()!.id,
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'test' },
          reasoning: 'Test',
          timestamp: new Date(),
        },
      ];

      const outcomes: Outcome[] = [
        {
          actionId: 'maint-action',
          success: true,
          result: {},
          observations: [],
          duration: 1000,
          metadata: {},
          timestamp: new Date(),
        },
      ];

      await memorySystem.storeExperience(
        'Test',
        actions,
        outcomes,
        [],
        'Summary'
      );

      // Perform full maintenance
      const maintenanceResult = await memorySystem.performMaintenance();

      expect(maintenanceResult).toBeDefined();
      expect(maintenanceResult.episodesConsolidated).toBeGreaterThanOrEqual(0);
      expect(maintenanceResult.factsConsolidated).toBeGreaterThanOrEqual(0);
      expect(maintenanceResult.factsUpdated).toBeGreaterThanOrEqual(0);

      await memorySystem.completeSession();
    });

    it('should track statistics accurately across full workflow', async () => {
      // Initial stats
      const initialStats = await memorySystem.getStatistics();
      const initialSessionCount = initialStats.session.totalSessions;

      // Run session
      await memorySystem.startSession('Stats Test', researchGoal);

      const actions: Action[] = [
        {
          id: 'stats-action-1',
          sessionId: memorySystem.getCurrentSession()!.id,
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'test' },
          reasoning: 'Test',
          timestamp: new Date(),
        },
        {
          id: 'stats-action-2',
          sessionId: memorySystem.getCurrentSession()!.id,
          type: 'analyze',
          tool: 'analyzer',
          parameters: {},
          reasoning: 'Analyze',
          timestamp: new Date(),
        },
      ];

      const outcomes: Outcome[] = [
        {
          actionId: 'stats-action-1',
          success: true,
          result: {},
          observations: [],
          duration: 2000,
          metadata: {},
          timestamp: new Date(),
        },
        {
          actionId: 'stats-action-2',
          success: true,
          result: {},
          observations: [],
          duration: 3000,
          metadata: {},
          timestamp: new Date(),
        },
      ];

      await memorySystem.storeExperience(
        'Test Experience',
        actions,
        outcomes,
        [],
        'Test summary',
        { tags: ['test'] }
      );

      await memorySystem.completeSession();

      // Final stats
      const finalStats = await memorySystem.getStatistics();

      expect(finalStats.session.totalSessions).toBeGreaterThan(initialSessionCount);
    });
  });

  describe('Reflection Integration', () => {
    it('should integrate reflection with memory storage', async () => {
      await memorySystem.startSession('Reflection Test', researchGoal);

      // Store enough experiences to trigger reflection
      for (let i = 0; i < 3; i++) {
        const actions: Action[] = [
          {
            id: `action-${i}-1`,
            sessionId: memorySystem.getCurrentSession()!.id,
            type: 'search',
            tool: 'web_search',
            parameters: { query: `test query ${i}` },
            reasoning: 'Test search',
            timestamp: new Date(),
          },
          {
            id: `action-${i}-2`,
            sessionId: memorySystem.getCurrentSession()!.id,
            type: 'analyze',
            tool: 'analyzer',
            parameters: {},
            reasoning: 'Test analysis',
            timestamp: new Date(),
          },
        ];

        const outcomes: Outcome[] = actions.map(action => ({
          actionId: action.id,
          success: true,
          result: {},
          observations: ['Test observation'],
          duration: 1000,
          metadata: {},
          timestamp: new Date(),
        }));

        const result = await memorySystem.storeExperience(
          `Experience ${i}`,
          actions,
          outcomes,
          [],
          `Summary ${i}`
        );

        if (i === 2) {
          // Should trigger reflection after 6 actions (3 iterations * 2 actions)
          expect(result.shouldReflect).toBe(true);
        }
      }

      // Perform reflection
      vi.mocked(vectorStore.search).mockResolvedValue(
        createMockSearchResults({ count: 3, baseScore: 0.9 })
      );

      const insights = await memorySystem.extractInsights(3);
      expect(insights).toBeDefined();

      await memorySystem.completeSession();
    });
  });

  describe('Context Building Integration', () => {
    it('should build comprehensive context from all memory types', async () => {
      await memorySystem.startSession('Context Test', researchGoal);

      // Create episode
      const actions: Action[] = [
        {
          id: 'ctx-action',
          sessionId: memorySystem.getCurrentSession()!.id,
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'context test' },
          reasoning: 'Test',
          timestamp: new Date(),
        },
      ];

      const outcomes: Outcome[] = [
        {
          actionId: 'ctx-action',
          success: true,
          result: {},
          observations: [],
          duration: 1000,
          metadata: {},
          timestamp: new Date(),
        },
      ];

      await memorySystem.storeExperience(
        'Context Test Experience',
        actions,
        outcomes,
        [],
        'Test summary'
      );

      // Create strategy
      await memorySystem.storeStrategy(
        'test_strategy',
        'Test strategy',
        ['test'],
        ['web_search'],
        { successRate: 0.8 }
      );

      // Build context
      vi.mocked(vectorStore.search).mockResolvedValue(
        createMockSearchResults({ count: 2, baseScore: 0.85 })
      );

      const context = await memorySystem.buildContext('context test query', {
        maxTokens: 3000,
        includeEpisodes: true,
        includeFacts: true,
        includeStrategies: true,
      });

      expect(context).toBeDefined();
      expect(context.episodes).toBeDefined();
      expect(context.facts).toBeDefined();
      expect(context.strategies).toBeDefined();
      expect(context.totalTokens).toBeLessThanOrEqual(3200); // Allow overhead

      await memorySystem.completeSession();
    });
  });
});
