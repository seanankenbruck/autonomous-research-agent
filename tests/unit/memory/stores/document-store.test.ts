/**
 * Document Store Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { SQLiteDocumentStore } from '../../../../src/memory/stores/document-store';
import type { Session, EpisodicMemory, SemanticMemory, ProceduralMemory } from '../../../../src/agent/types';

const TEST_DB_PATH = resolve(__dirname, '../../../storage/test-db.sqlite');

describe('SQLiteDocumentStore', () => {
  let store: SQLiteDocumentStore;

  beforeEach(() => {
    // Ensure test directory exists
    const dir = resolve(TEST_DB_PATH, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Create fresh database for each test
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    store = new SQLiteDocumentStore(TEST_DB_PATH);
  });

  afterEach(async () => {
    await store.close();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Session Operations', () => {
    it('should create a new session', async () => {
      const session = await store.createSession({
        topic: 'Test Research Topic',
        goal: {
          description: 'Learn about autonomous agents',
          successCriteria: ['Understand core concepts', 'Find examples'],
          estimatedComplexity: 'moderate',
        },
        state: {
          sessionId: 'temp',
          currentGoal: {
            description: 'Learn about autonomous agents',
            successCriteria: ['Understand core concepts'],
            estimatedComplexity: 'moderate',
          },
          plan: {
            id: 'plan-1',
            strategy: 'broad-then-deep',
            steps: [],
            estimatedDuration: 300,
            createdAt: new Date(),
          },
          progress: {
            stepsCompleted: 0,
            stepsTotal: 5,
            sourcesGathered: 0,
            factsExtracted: 0,
            currentPhase: 'planning',
            confidence: 0.5,
          },
          workingMemory: {
            recentActions: [],
            recentOutcomes: [],
            keyFindings: [],
            openQuestions: [],
            hypotheses: [],
          },
          reflections: [],
          iterationCount: 0,
          lastActionTimestamp: new Date(),
        },
        status: 'active',
      });

      expect(session.id).toBeDefined();
      expect(session.topic).toBe('Test Research Topic');
      expect(session.status).toBe('active');
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should retrieve a session by id', async () => {
      const created = await store.createSession({
        topic: 'Test Topic',
        goal: {
          description: 'Test goal',
          successCriteria: [],
          estimatedComplexity: 'simple',
        },
        state: {
          sessionId: 'temp',
          currentGoal: {
            description: 'Test goal',
            successCriteria: [],
            estimatedComplexity: 'simple',
          },
          plan: {
            id: 'plan-1',
            strategy: 'test',
            steps: [],
            estimatedDuration: 100,
            createdAt: new Date(),
          },
          progress: {
            stepsCompleted: 0,
            stepsTotal: 1,
            sourcesGathered: 0,
            factsExtracted: 0,
            currentPhase: 'planning',
            confidence: 0.5,
          },
          workingMemory: {
            recentActions: [],
            recentOutcomes: [],
            keyFindings: [],
            openQuestions: [],
            hypotheses: [],
          },
          reflections: [],
          iterationCount: 0,
          lastActionTimestamp: new Date(),
        },
        status: 'active',
      });

      const retrieved = await store.getSession(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.topic).toBe('Test Topic');
    });

    it('should update a session', async () => {
      const session = await store.createSession({
        topic: 'Original Topic',
        goal: {
          description: 'Test',
          successCriteria: [],
          estimatedComplexity: 'simple',
        },
        state: {
          sessionId: 'temp',
          currentGoal: {
            description: 'Test',
            successCriteria: [],
            estimatedComplexity: 'simple',
          },
          plan: {
            id: 'plan-1',
            strategy: 'test',
            steps: [],
            estimatedDuration: 100,
            createdAt: new Date(),
          },
          progress: {
            stepsCompleted: 0,
            stepsTotal: 1,
            sourcesGathered: 0,
            factsExtracted: 0,
            currentPhase: 'planning',
            confidence: 0.5,
          },
          workingMemory: {
            recentActions: [],
            recentOutcomes: [],
            keyFindings: [],
            openQuestions: [],
            hypotheses: [],
          },
          reflections: [],
          iterationCount: 0,
          lastActionTimestamp: new Date(),
        },
        status: 'active',
      });

      await store.updateSession(session.id, {
        status: 'completed',
        completedAt: new Date(),
      });

      const updated = await store.getSession(session.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeInstanceOf(Date);
    });

    it('should list sessions with filters', async () => {
      // Create multiple sessions
      await store.createSession({
        userId: 'user1',
        topic: 'Topic A',
        goal: { description: 'A', successCriteria: [], estimatedComplexity: 'simple' },
        state: createTestState(),
        status: 'active',
      });

      await store.createSession({
        userId: 'user1',
        topic: 'Topic B',
        goal: { description: 'B', successCriteria: [], estimatedComplexity: 'simple' },
        state: createTestState(),
        status: 'completed',
      });

      await store.createSession({
        userId: 'user2',
        topic: 'Topic C',
        goal: { description: 'C', successCriteria: [], estimatedComplexity: 'simple' },
        state: createTestState(),
        status: 'active',
      });

      // Filter by user
      const user1Sessions = await store.listSessions({ userId: 'user1' });
      expect(user1Sessions).toHaveLength(2);

      // Filter by status
      const activeSessions = await store.listSessions({ status: 'active' });
      expect(activeSessions).toHaveLength(2);

      // Filter by user and status
      const user1Active = await store.listSessions({ userId: 'user1', status: 'active' });
      expect(user1Active).toHaveLength(1);
    });
  });

  describe('Episode Operations', () => {
    it('should store and retrieve an episode', async () => {
      const session = await store.createSession({
        topic: 'Test',
        goal: { description: 'Test', successCriteria: [], estimatedComplexity: 'simple' },
        state: createTestState(),
        status: 'active',
      });

      const episode: EpisodicMemory = {
        id: 'episode-1',
        sessionId: session.id,
        timestamp: new Date(),
        topic: 'Test Topic',
        actions: [],
        outcomes: [],
        findings: [],
        duration: 120,
        success: true,
        summary: 'Test episode summary',
        tags: ['test', 'example'],
      };

      await store.storeEpisode(episode);

      const retrieved = await store.getEpisode(episode.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.sessionId).toBe(session.id);
      expect(retrieved?.success).toBe(true);
    });

    it('should list episodes for a session', async () => {
      const session = await store.createSession({
        topic: 'Test',
        goal: { description: 'Test', successCriteria: [], estimatedComplexity: 'simple' },
        state: createTestState(),
        status: 'active',
      });

      // Create multiple episodes
      for (let i = 0; i < 3; i++) {
        await store.storeEpisode({
          id: `episode-${i}`,
          sessionId: session.id,
          timestamp: new Date(Date.now() + i * 1000),
          topic: 'Test',
          actions: [],
          outcomes: [],
          findings: [],
          duration: 100,
          success: true,
          summary: `Episode ${i}`,
          tags: [],
        });
      }

      const episodes = await store.listEpisodes(session.id);
      expect(episodes).toHaveLength(3);
    });
  });

  describe('Semantic Memory Operations', () => {
    it('should store and retrieve a fact', async () => {
      const fact: SemanticMemory = {
        id: 'fact-1',
        content: 'Autonomous agents use LLMs for reasoning',
        category: 'ai-concepts',
        source: 'research-session-1',
        confidence: 0.9,
        relevance: 0.85,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        lastModified: new Date(),
        tags: ['ai', 'agents', 'llm'],
        relatedFacts: [],
      };

      await store.storeFact(fact);

      const retrieved = await store.getFact(fact.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe(fact.content);
      expect(retrieved?.category).toBe('ai-concepts');
      // Access count should increment
      expect(retrieved?.accessCount).toBe(1);
    });

    it('should update a fact', async () => {
      const fact: SemanticMemory = {
        id: 'fact-1',
        content: 'Original content',
        category: 'test',
        source: 'test',
        confidence: 0.5,
        relevance: 0.5,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        lastModified: new Date(),
        tags: [],
        relatedFacts: [],
      };

      await store.storeFact(fact);

      await store.updateFact(fact.id, {
        confidence: 0.9,
        relevance: 0.8,
        tags: ['updated'],
      });

      const updated = await store.getFact(fact.id);
      expect(updated?.confidence).toBe(0.9);
      expect(updated?.relevance).toBe(0.8);
      expect(updated?.tags).toContain('updated');
    });

    it('should list facts with filters', async () => {
      // Create multiple facts
      await store.storeFact(createTestFact('fact-1', 'ai-concepts', 0.9, 0.8));
      await store.storeFact(createTestFact('fact-2', 'ai-concepts', 0.7, 0.6));
      await store.storeFact(createTestFact('fact-3', 'general', 0.5, 0.4));

      // Filter by category
      const aiConcepts = await store.listFacts({ category: 'ai-concepts' });
      expect(aiConcepts).toHaveLength(2);

      // Filter by confidence
      const highConfidence = await store.listFacts({ minConfidence: 0.8 });
      expect(highConfidence).toHaveLength(1);

      // Multiple filters
      const filtered = await store.listFacts({
        category: 'ai-concepts',
        minConfidence: 0.7,
      });
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Procedural Memory Operations', () => {
    it('should store and retrieve a strategy', async () => {
      const strategy: ProceduralMemory = {
        id: 'strategy-1',
        strategyName: 'Test Strategy',
        description: 'A test research strategy',
        applicableContexts: ['testing'],
        requiredTools: ['search', 'analyze'],
        successRate: 0.75,
        averageDuration: 300,
        timesUsed: 0,
        refinements: [],
        createdAt: new Date(),
        lastUsed: new Date(),
        lastRefined: new Date(),
      };

      await store.storeStrategy(strategy);

      const retrieved = await store.getStrategy(strategy.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.strategyName).toBe('Test Strategy');
      expect(retrieved?.successRate).toBe(0.75);
    });

    it('should update strategy metrics', async () => {
      const strategy: ProceduralMemory = {
        id: 'strategy-1',
        strategyName: 'Test Strategy',
        description: 'Test',
        applicableContexts: ['test'],
        requiredTools: ['search'],
        successRate: 0.5,
        averageDuration: 100,
        timesUsed: 1,
        refinements: [],
        createdAt: new Date(),
        lastUsed: new Date(),
        lastRefined: new Date(),
      };

      await store.storeStrategy(strategy);

      await store.updateStrategy(strategy.id, {
        successRate: 0.75,
        timesUsed: 2,
        lastUsed: new Date(),
      });

      const updated = await store.getStrategy(strategy.id);
      expect(updated?.successRate).toBe(0.75);
      expect(updated?.timesUsed).toBe(2);
      expect(updated?.lastUsed).toBeInstanceOf(Date);
    });
  });
});

// Helper functions
function createTestState(): any {
  return {
    sessionId: 'temp',
    currentGoal: {
      description: 'Test',
      successCriteria: [],
      estimatedComplexity: 'simple' as const,
    },
    plan: {
      id: 'plan-1',
      strategy: 'test',
      steps: [],
      estimatedDuration: 100,
      createdAt: new Date(),
    },
    progress: {
      stepsCompleted: 0,
      stepsTotal: 1,
      sourcesGathered: 0,
      factsExtracted: 0,
      currentPhase: 'planning' as const,
      confidence: 0.5,
    },
    workingMemory: {
      recentActions: [],
      recentOutcomes: [],
      keyFindings: [],
      openQuestions: [],
      hypotheses: [],
    },
    reflections: [],
    iterationCount: 0,
    lastActionTimestamp: new Date(),
  };
}

function createTestFact(
  id: string,
  category: string,
  confidence: number,
  relevance: number
): SemanticMemory {
  return {
    id,
    content: `Test fact ${id}`,
    category,
    source: 'test',
    confidence,
    relevance,
    createdAt: new Date(),
    lastAccessed: new Date(),
    accessCount: 0,
    lastModified: new Date(),
    tags: [],
    relatedFacts: [],
  };
}