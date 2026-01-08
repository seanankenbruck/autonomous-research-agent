/**
 * ReasoningEngine Unit Tests
 * Tests for the ReAct-style reasoning engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReasoningEngine } from '../../../src/agent/reasoning';
import type { Goal, Progress, WorkingMemory, Action, Outcome } from '../../../src/agent/types';
import type { ReasoningMemoryContext } from '../../../src/agent/reasoning';
import { createMockLogger, createMockLLMClient } from '../../helpers/memory-test-utils';
import {
  simulateReasoningResponse,
  simulateLearningResponse,
  generateReasoningContext,
} from '../../helpers/agent-test-utils';
import {
  simpleGoal,
  createMockGoal,
} from '../../fixtures/agent/mock-goals';
import {
  initialState,
  inProgressState,
} from '../../fixtures/agent/mock-states';
import {
  searchAction,
  fetchAction,
} from '../../fixtures/agent/mock-actions';
import {
  successfulOutcome,
  failedOutcome,
} from '../../fixtures/agent/mock-outcomes';

describe('ReasoningEngine', () => {
  let reasoningEngine: ReasoningEngine;
  let mockLLM: ReturnType<typeof createMockLLMClient>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockLLM = createMockLLMClient();
    reasoningEngine = new ReasoningEngine(mockLLM as any, mockLogger);
  });

  // ============================================================================
  // Reason Phase Tests (7 tests)
  // ============================================================================

  describe('reason()', () => {
    const sessionId = 'test-session';
    const availableTools = [
      { name: 'search', description: 'Search tool', version: '1.0.0', config: {} },
      { name: 'fetch', description: 'Fetch tool', version: '1.0.0', config: {} },
      { name: 'analyze', description: 'Analyze tool', version: '1.0.0', config: {} },
    ];
    const memoryContext: ReasoningMemoryContext = {
      relevantEpisodes: [],
      relevantFacts: [],
      recommendedStrategies: [],
    };

    it('should generate multiple reasoning options', async () => {
      // Setup LLM to return 3 options
      const responseContent = simulateReasoningResponse(3);
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: responseContent,
      });
      mockLLM.extractText.mockReturnValue(responseContent);

      const result = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        availableTools as any,
        memoryContext,
        sessionId
      );

      expect(result.reasoning.options).toHaveLength(3);
      expect(result.reasoning.options[0]).toHaveProperty('id');
      expect(result.reasoning.options[0]).toHaveProperty('action');
      expect(result.reasoning.options[0]).toHaveProperty('confidence');
    });

    it('should select best option by score', async () => {
      // Create options with different scores
      const options = JSON.stringify({
        options: [
          {
            id: 'option-1',
            action: 'search',
            rationale: 'Low confidence',
            expectedBenefit: 'Some benefit',
            potentialRisks: [],
            estimatedCost: 8,
            confidence: 0.4,
          },
          {
            id: 'option-2',
            action: 'fetch',
            rationale: 'High confidence',
            expectedBenefit: 'Great benefit',
            potentialRisks: [],
            estimatedCost: 3,
            confidence: 0.9,
          },
        ],
      });

      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: options,
      });
      mockLLM.extractText.mockReturnValue(options);

      const result = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        availableTools as any,
        memoryContext,
        sessionId
      );

      // Should select option-2 (higher confidence * 0.7 - lower cost * 0.3)
      expect(result.selectedAction.tool).toBe('fetch');
      expect(result.reasoning.selectedOption).toBe('option-2');
    });

    it('should incorporate memory context in reasoning', async () => {
      const contextWithMemories: ReasoningMemoryContext = {
        relevantEpisodes: [
          {
            id: 'episode-1',
            sessionId: 'prev-session',
            summary: 'Previous search was successful',
            actions: [],
            outcomes: [],
            keyFindings: [],
            context: {},
            timestamp: new Date(),
          },
        ],
        relevantFacts: [
          {
            id: 'fact-1',
            sessionId: 'prev-session',
            content: 'Search is effective for this topic',
            source: 'test',
            confidence: 0.9,
            category: 'strategy',
            relatedFacts: [],
            usageCount: 1,
            timestamp: new Date(),
          },
        ],
        recommendedStrategies: [
          {
            id: 'strategy-1',
            sessionId: 'prev-session',
            strategyName: 'search-first',
            description: 'Start with search',
            context: 'Similar goals',
            successRate: 0.85,
            usageCount: 5,
            averageDuration: 120,
            toolsUsed: ['search'],
            timestamp: new Date(),
          },
        ],
      };

      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulateReasoningResponse(2),
      });

      const result = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        availableTools as any,
        contextWithMemories,
        sessionId
      );

      // Check that LLM was called with context including memories
      expect(mockLLM.complete).toHaveBeenCalled();
      const callArgs = mockLLM.complete.mock.calls[0];
      const prompt = callArgs[0][0].content;

      expect(prompt).toContain('RELEVANT PAST EXPERIENCES');
      expect(result.selectedAction.strategy).toBe('search-first');
    });

    it('should handle LLM failures gracefully', async () => {
      // Make LLM fail
      mockLLM.complete.mockRejectedValue(new Error('LLM API error'));

      const result = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        availableTools as any,
        memoryContext,
        sessionId
      );

      // Should return fallback option
      expect(result.reasoning.options).toHaveLength(1);
      expect(result.reasoning.options[0].id).toBe('fallback-option');
      expect(result.confidence).toBe(0.3);
    });

    it('should adjust action type by research phase', async () => {
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulateReasoningResponse(1),
      });

      // Test gathering phase - should default to search on failure
      const gatheringProgress: Progress = {
        ...initialState.progress,
        currentPhase: 'gathering',
      };

      mockLLM.complete.mockRejectedValue(new Error('Fail'));

      const gatheringResult = await reasoningEngine.reason(
        simpleGoal,
        gatheringProgress,
        initialState.workingMemory,
        availableTools as any,
        memoryContext,
        sessionId
      );

      expect(gatheringResult.selectedAction.tool).toBe('web_search');

      // Test synthesis phase - should default to synthesize on failure
      const synthesisProgress: Progress = {
        ...initialState.progress,
        currentPhase: 'synthesizing',
        sourcesGathered: 10, // Has sources
        factsExtracted: 5, // Has facts, so should synthesize
      };

      const synthesisResult = await reasoningEngine.reason(
        simpleGoal,
        synthesisProgress,
        initialState.workingMemory,
        availableTools as any,
        memoryContext,
        sessionId
      );

      expect(synthesisResult.selectedAction.tool).toBe('synthesizer');
    });

    it('should build proper prompts with goal and progress', async () => {
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulateReasoningResponse(2),
      });

      await reasoningEngine.reason(
        simpleGoal,
        inProgressState.progress,
        inProgressState.workingMemory,
        availableTools as any,
        memoryContext,
        sessionId
      );

      expect(mockLLM.complete).toHaveBeenCalled();
      const callArgs = mockLLM.complete.mock.calls[0];
      const prompt = callArgs[0][0].content;
      const options = callArgs[1];

      // Check prompt structure
      expect(prompt).toContain('GOAL:');
      expect(prompt).toContain(simpleGoal.description);
      expect(prompt).toContain('SUCCESS CRITERIA:');
      expect(prompt).toContain('CURRENT PROGRESS:');
      expect(prompt).toContain('AVAILABLE TOOLS:');

      // Check options
      expect(options.systemPrompt).toContain('expert at strategic planning');
      expect(options.temperature).toBe(0.7);
    });

    it('should parse JSON responses correctly', async () => {
      // Test with clean JSON
      const cleanJSON = simulateReasoningResponse(2);
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: cleanJSON,
      });

      let result = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        availableTools as any,
        memoryContext,
        sessionId
      );

      expect(result.reasoning.options.length).toBeGreaterThan(0);

      // Test with JSON wrapped in markdown
      const markdownJSON = `Here's my response:\n\`\`\`json\n${simulateReasoningResponse(2)}\n\`\`\``;
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: markdownJSON,
      });

      result = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        availableTools as any,
        memoryContext,
        sessionId
      );

      expect(result.reasoning.options.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Observe Phase Tests (5 tests)
  // ============================================================================

  describe('observe()', () => {
    it('should extract learnings from successful outcomes', async () => {
      const learnings = ['Learning 1', 'Learning 2', 'Learning 3'];
      const responseContent = simulateLearningResponse(learnings);
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: responseContent,
      });
      mockLLM.extractText.mockReturnValue(responseContent);

      const result = await reasoningEngine.observe(
        searchAction,
        successfulOutcome,
        simpleGoal,
        initialState.progress,
        initialState.workingMemory
      );

      expect(result.success).toBe(true);
      expect(result.learnings).toHaveLength(3);
      expect(result.learnings).toEqual(learnings);
    });

    it('should extract learnings from failed outcomes', async () => {
      const learnings = ['Search failed due to timeout', 'Need better error handling'];
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulateLearningResponse(learnings),
      });

      const result = await reasoningEngine.observe(
        searchAction,
        failedOutcome,
        simpleGoal,
        initialState.progress,
        initialState.workingMemory
      );

      expect(result.success).toBe(false);
      expect(result.learnings.length).toBeGreaterThan(0);
    });

    it('should determine when to continue based on outcome', async () => {
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulateLearningResponse(['Test learning']),
      });

      // Should continue after success
      const successResult = await reasoningEngine.observe(
        searchAction,
        successfulOutcome,
        simpleGoal,
        initialState.progress,
        initialState.workingMemory
      );

      expect(successResult.shouldContinue).toBe(true);

      // Should not continue if completed
      const completedProgress: Progress = {
        ...initialState.progress,
        currentPhase: 'completed',
      };

      const completedResult = await reasoningEngine.observe(
        searchAction,
        successfulOutcome,
        simpleGoal,
        completedProgress,
        initialState.workingMemory
      );

      expect(completedResult.shouldContinue).toBe(false);

      // Should not continue if confidence is too low after failure
      const lowConfidenceProgress: Progress = {
        ...initialState.progress,
        confidence: 0.2,
      };

      const lowConfResult = await reasoningEngine.observe(
        searchAction,
        failedOutcome,
        simpleGoal,
        lowConfidenceProgress,
        initialState.workingMemory
      );

      expect(lowConfResult.shouldContinue).toBe(false);
    });

    it('should determine when to replan', async () => {
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulateLearningResponse(['Test learning']),
      });

      // Should replan after failure
      const failureResult = await reasoningEngine.observe(
        searchAction,
        failedOutcome,
        simpleGoal,
        initialState.progress,
        initialState.workingMemory
      );

      expect(failureResult.shouldReplan).toBe(true);

      // Should replan after multiple failures
      const workingMemoryWithFailures: WorkingMemory = {
        ...initialState.workingMemory,
        recentOutcomes: [
          { ...failedOutcome, actionId: 'action-1' },
          { ...failedOutcome, actionId: 'action-2' },
          { ...failedOutcome, actionId: 'action-3' },
        ],
      };

      const multiFailResult = await reasoningEngine.observe(
        searchAction,
        successfulOutcome,
        simpleGoal,
        initialState.progress,
        workingMemoryWithFailures
      );

      expect(multiFailResult.shouldReplan).toBe(true);

      // Should replan if confidence is low after several steps
      const lowConfidenceProgress: Progress = {
        ...initialState.progress,
        confidence: 0.35,
        stepsCompleted: 5,
      };

      const lowConfResult = await reasoningEngine.observe(
        searchAction,
        successfulOutcome,
        simpleGoal,
        lowConfidenceProgress,
        initialState.workingMemory
      );

      expect(lowConfResult.shouldReplan).toBe(true);
    });

    it('should handle malformed LLM responses in observation', async () => {
      // Return malformed JSON
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: 'This is not valid JSON at all',
      });

      const result = await reasoningEngine.observe(
        searchAction,
        successfulOutcome,
        simpleGoal,
        initialState.progress,
        initialState.workingMemory
      );

      // Should still return a result with fallback learning
      expect(result.learnings).toHaveLength(1);
      expect(result.learnings[0]).toContain('search');
      expect(result.learnings[0]).toContain('succeeded');
    });
  });

  // ============================================================================
  // Helper Methods Tests (3 tests)
  // ============================================================================

  describe('Helper Methods', () => {
    it('should infer action types correctly', async () => {
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: JSON.stringify({
          options: [
            { id: '1', action: 'search', rationale: 'test', expectedBenefit: 'test', potentialRisks: [], estimatedCost: 5, confidence: 0.8 },
            { id: '2', action: 'fetch', rationale: 'test', expectedBenefit: 'test', potentialRisks: [], estimatedCost: 5, confidence: 0.8 },
            { id: '3', action: 'analyze', rationale: 'test', expectedBenefit: 'test', potentialRisks: [], estimatedCost: 5, confidence: 0.8 },
            { id: '4', action: 'synthesize', rationale: 'test', expectedBenefit: 'test', potentialRisks: [], estimatedCost: 5, confidence: 0.8 },
          ],
        }),
      });

      const tools = [
        { name: 'web_search', description: 'Search', version: '1.0.0', config: {} },
        { name: 'web_fetch', description: 'Fetch', version: '1.0.0', config: {} },
        { name: 'content_analyzer', description: 'Analyze', version: '1.0.0', config: {} },
        { name: 'synthesizer', description: 'Synthesize', version: '1.0.0', config: {} },
      ];

      const result = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        tools as any,
        { relevantEpisodes: [], relevantFacts: [], recommendedStrategies: [] },
        'test-session'
      );

      // Check that the action type is correctly inferred from tool name
      expect(['search', 'fetch', 'analyze', 'synthesize']).toContain(result.selectedAction.type);
      // The type should be inferred from the tool name (e.g., 'web_search' -> 'search')
      if (result.selectedAction.tool === 'web_search') {
        expect(result.selectedAction.type).toBe('search');
      } else if (result.selectedAction.tool === 'web_fetch') {
        expect(result.selectedAction.type).toBe('fetch');
      } else if (result.selectedAction.tool === 'content_analyzer') {
        expect(result.selectedAction.type).toBe('analyze');
      } else if (result.selectedAction.tool === 'synthesizer') {
        expect(result.selectedAction.type).toBe('synthesize');
      }
    });

    it('should generate unique IDs for reasoning and actions', async () => {
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulateReasoningResponse(2),
      });

      const tools = [{ name: 'search', description: 'Search', version: '1.0.0', config: {} }];

      const result1 = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        tools as any,
        { relevantEpisodes: [], relevantFacts: [], recommendedStrategies: [] },
        'session-1'
      );

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 5));

      const result2 = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        tools as any,
        { relevantEpisodes: [], relevantFacts: [], recommendedStrategies: [] },
        'session-2'
      );

      // IDs should be unique
      expect(result1.reasoning.id).not.toBe(result2.reasoning.id);
      expect(result1.selectedAction.id).not.toBe(result2.selectedAction.id);

      // IDs should follow expected format
      expect(result1.reasoning.id).toMatch(/^reasoning_\d+_[a-z0-9]+$/);
      expect(result1.selectedAction.id).toMatch(/^reasoning_\d+_[a-z0-9]+$/);
    });

    it('should extract parameters from actions', async () => {
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulateReasoningResponse(1),
      });

      const tools = [{ name: 'search', description: 'Search', version: '1.0.0', config: {} }];

      const result = await reasoningEngine.reason(
        simpleGoal,
        initialState.progress,
        initialState.workingMemory,
        tools as any,
        { relevantEpisodes: [], relevantFacts: [], recommendedStrategies: [] },
        'test-session'
      );

      // Currently returns empty params (to be filled by agent core)
      expect(result.selectedAction.parameters).toBeDefined();
      expect(typeof result.selectedAction.parameters).toBe('object');
    });
  });
});
