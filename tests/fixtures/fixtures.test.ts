/**
 * Fixtures Validation Tests
 * Ensures all fixtures are valid and can be used in tests
 */

import { describe, it, expect } from 'vitest';
import {
  mockSessions,
  mockSessionArray,
  createMockSession,
} from './memory/mock-sessions';
import {
  mockEpisodes,
  mockEpisodeArray,
  createMockEpisode,
} from './memory/mock-episodes';
import {
  mockFacts,
  mockFactArray,
  createMockFact,
  getAllCategorizedFacts,
} from './memory/mock-facts';
import {
  mockStrategies,
  mockStrategyArray,
  createMockStrategy,
} from './memory/mock-strategies';
import {
  mockConversations,
  mockConversationArray,
  extractConversationActions,
  extractConversationOutcomes,
} from './memory/mock-conversations';

describe('Test Fixtures Validation', () => {
  describe('Mock Sessions', () => {
    it('should have all required session fixtures', () => {
      expect(mockSessions.activeSession).toBeDefined();
      expect(mockSessions.completedSession).toBeDefined();
      expect(mockSessions.failedSession).toBeDefined();
      expect(mockSessions.pausedSession).toBeDefined();
      expect(mockSessions.withReflections).toBeDefined();
      expect(mockSessions.parentSession).toBeDefined();
      expect(mockSessions.childSession).toBeDefined();
    });

    it('should have valid session array', () => {
      expect(mockSessionArray).toHaveLength(5);
      expect(mockSessionArray.every((s) => s.id && s.topic && s.goal)).toBe(
        true
      );
    });

    it('should create session with factory', () => {
      const session = createMockSession({ topic: 'Custom Topic' });
      expect(session.topic).toBe('Custom Topic');
      expect(session.id).toBeDefined();
      expect(session.state).toBeDefined();
    });

    it('should have parent-child relationship', () => {
      expect(mockSessions.childSession.parentSessionId).toBe(
        mockSessions.parentSession.id
      );
    });
  });

  describe('Mock Episodes', () => {
    it('should have all required episode fixtures', () => {
      expect(mockEpisodes.successfulResearch).toBeDefined();
      expect(mockEpisodes.failedSearch).toBeDefined();
      expect(mockEpisodes.partialSuccess).toBeDefined();
      expect(mockEpisodes.multiActionEpisode).toBeDefined();
      expect(mockEpisodes.withFeedback).toBeDefined();
    });

    it('should have valid episode array', () => {
      expect(mockEpisodeArray).toHaveLength(5);
      expect(
        mockEpisodeArray.every((e) => e.id && e.sessionId && e.topic)
      ).toBe(true);
    });

    it('should create episode with factory', () => {
      const episode = createMockEpisode({ topic: 'Custom Topic' });
      expect(episode.topic).toBe('Custom Topic');
      expect(episode.id).toBeDefined();
      expect(episode.actions).toBeDefined();
    });

    it('should have successful research with multiple actions', () => {
      const episode = mockEpisodes.successfulResearch;
      expect(episode.success).toBe(true);
      expect(episode.actions.length).toBeGreaterThan(1);
      expect(episode.outcomes.length).toBeGreaterThan(1);
      expect(episode.findings.length).toBeGreaterThan(0);
    });

    it('should have failed search with no findings', () => {
      const episode = mockEpisodes.failedSearch;
      expect(episode.success).toBe(false);
      expect(episode.findings).toHaveLength(0);
    });
  });

  describe('Mock Facts', () => {
    it('should have all required fact fixtures', () => {
      expect(mockFacts.highConfidence).toBeDefined();
      expect(mockFacts.lowConfidence).toBeDefined();
      expect(mockFacts.categorizedFacts).toBeDefined();
      expect(mockFacts.relatedFacts).toBeDefined();
      expect(mockFacts.frequentlyAccessed).toBeDefined();
      expect(mockFacts.rarelyAccessed).toBeDefined();
      expect(mockFacts.recentlyModified).toBeDefined();
    });

    it('should have high confidence facts with appropriate confidence', () => {
      expect(mockFacts.highConfidence.every((f) => f.confidence >= 0.9)).toBe(
        true
      );
    });

    it('should have low confidence facts with appropriate confidence', () => {
      expect(mockFacts.lowConfidence.every((f) => f.confidence < 0.5)).toBe(
        true
      );
    });

    it('should have categorized facts', () => {
      expect(mockFacts.categorizedFacts.size).toBeGreaterThan(0);
      expect(mockFacts.categorizedFacts.has('machine-learning')).toBe(true);
      expect(mockFacts.categorizedFacts.has('deep-learning')).toBe(true);
      expect(mockFacts.categorizedFacts.has('nlp')).toBe(true);
    });

    it('should create fact with factory', () => {
      const fact = createMockFact({ content: 'Custom fact' });
      expect(fact.content).toBe('Custom fact');
      expect(fact.id).toBeDefined();
      expect(fact.category).toBeDefined();
    });

    it('should have related facts with bidirectional links', () => {
      const fact1 = mockFacts.relatedFacts.find(
        (f) => f.id === 'fact-related-1'
      );
      const fact2 = mockFacts.relatedFacts.find(
        (f) => f.id === 'fact-related-2'
      );

      expect(fact1?.relatedFacts).toContain('fact-related-2');
      expect(fact2?.relatedFacts).toContain('fact-related-1');
    });

    it('should get all categorized facts', () => {
      const allFacts = getAllCategorizedFacts();
      expect(allFacts.length).toBeGreaterThan(0);
    });
  });

  describe('Mock Strategies', () => {
    it('should have all required strategy fixtures', () => {
      expect(mockStrategies.highSuccess).toBeDefined();
      expect(mockStrategies.lowSuccess).toBeDefined();
      expect(mockStrategies.frequentlyUsed).toBeDefined();
      expect(mockStrategies.recentlyRefined).toBeDefined();
      expect(mockStrategies.technical).toBeDefined();
      expect(mockStrategies.experimental).toBeDefined();
      expect(mockStrategies.highlyRefined).toBeDefined();
    });

    it('should have high success strategy with appropriate rate', () => {
      expect(mockStrategies.highSuccess.successRate).toBeGreaterThan(0.9);
    });

    it('should have low success strategy with appropriate rate', () => {
      expect(mockStrategies.lowSuccess.successRate).toBeLessThan(0.5);
    });

    it('should have frequently used strategy with high usage count', () => {
      expect(mockStrategies.frequentlyUsed.timesUsed).toBeGreaterThan(100);
    });

    it('should create strategy with factory', () => {
      const strategy = createMockStrategy({ strategyName: 'custom_strategy' });
      expect(strategy.strategyName).toBe('custom_strategy');
      expect(strategy.id).toBeDefined();
      expect(strategy.requiredTools).toBeDefined();
    });

    it('should have highly refined strategy with multiple refinements', () => {
      expect(mockStrategies.highlyRefined.refinements.length).toBeGreaterThan(
        3
      );
    });
  });

  describe('Mock Conversations', () => {
    it('should have all required conversation fixtures', () => {
      expect(mockConversations.technicalDiscussion).toBeDefined();
      expect(mockConversations.researchSession).toBeDefined();
      expect(mockConversations.debuggingSession).toBeDefined();
      expect(mockConversations.brainstormingSession).toBeDefined();
      expect(mockConversations.partialSuccess).toBeDefined();
    });

    it('should have valid conversation array', () => {
      expect(mockConversationArray).toHaveLength(5);
      expect(
        mockConversationArray.every((c) => c.id && c.topic && c.turns)
      ).toBe(true);
    });

    it('should have conversations with multiple turns', () => {
      expect(mockConversations.technicalDiscussion.turns.length).toBeGreaterThan(
        2
      );
    });

    it('should extract actions from conversation', () => {
      const actions = extractConversationActions(
        mockConversations.technicalDiscussion
      );
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should extract outcomes from conversation', () => {
      const outcomes = extractConversationOutcomes(
        mockConversations.technicalDiscussion
      );
      expect(outcomes.length).toBeGreaterThan(0);
    });

    it('should have conversation with success outcome', () => {
      expect(mockConversations.technicalDiscussion.outcome).toBe('success');
    });

    it('should have conversation with partial outcome', () => {
      expect(mockConversations.partialSuccess.outcome).toBe('partial');
    });
  });
});
