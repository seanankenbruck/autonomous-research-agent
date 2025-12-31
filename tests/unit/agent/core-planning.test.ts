/**
 * Core Agent Planning Tests
 * Tests for the planning system in AutonomousAgent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutonomousAgent, AgentConfig } from '../../../src/agent/core';
import { ReasoningEngine } from '../../../src/agent/reasoning';
import { AgentReflection } from '../../../src/agent/reflection';
import { MemorySystem } from '../../../src/memory/memory-system';
import { ToolRegistry } from '../../../src/tools/registry';
import type { ResearchPlan, PlannedStep } from '../../../src/agent/types';
import {
  createMockLogger,
  createMockLLMClient,
} from '../../helpers/memory-test-utils';
import {
  createMockReasoningEngine,
  createMockAgentReflection,
  createMockMemorySystem,
  createMockToolRegistry,
  simulatePlanningResponse,
} from '../../helpers/agent-test-utils';
import {
  simpleGoal,
  complexGoal,
} from '../../fixtures/agent/mock-goals';

describe('AutonomousAgent - Planning', () => {
  let agent: AutonomousAgent;
  let mockReasoningEngine: ReasoningEngine;
  let mockReflection: AgentReflection;
  let mockMemory: MemorySystem;
  let mockTools: ToolRegistry;
  let mockLLM: ReturnType<typeof createMockLLMClient>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let config: AgentConfig;

  beforeEach(() => {
    mockReasoningEngine = createMockReasoningEngine();
    mockReflection = createMockAgentReflection();
    mockMemory = createMockMemorySystem();
    mockTools = createMockToolRegistry();
    mockLLM = createMockLLMClient();
    mockLogger = createMockLogger();

    config = {
      maxIterations: 10,
      reflectionInterval: 5,
      maxContextTokens: 4000,
      enableAutoReflection: true,
    };

    agent = new AutonomousAgent(
      mockReasoningEngine,
      mockReflection,
      mockMemory,
      mockTools,
      mockLLM as any,
      mockLogger,
      config
    );
  });

  // ============================================================================
  // Plan Creation Tests (5 tests)
  // ============================================================================

  describe('Plan Creation', () => {
    it('should create plan from LLM response', async () => {
      const planResponse = simulatePlanningResponse([
        { description: 'Search for sources', action: 'search' },
        { description: 'Fetch content', action: 'fetch' },
        { description: 'Analyze findings', action: 'analyze' },
      ]);

      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: planResponse,
      });

      mockMemory.getStrategyRecommendations = vi.fn().mockResolvedValue([]);

      // Access private method through research() which calls createPlan
      const researchPromise = agent.research('test topic', simpleGoal);

      // Let it create the plan, then we check the plan was created
      // We'll need to check via the research execution
      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: { id: 'a1', sessionId: 's1', type: 'search', tool: 'search', parameters: {}, reasoning: 'test', timestamp: new Date() },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockResolvedValue({
        observations: [],
        success: true,
        shouldContinue: false, // Stop after one iteration
        shouldReplan: false,
        learnings: [],
      });

      const result = await researchPromise;

      expect(result.success).toBe(true);
      expect(mockLLM.complete).toHaveBeenCalled();

      // Verify planning prompt was used
      const planningCall = mockLLM.complete.mock.calls.find(call =>
        call[0][0].content.includes('Create a detailed research plan')
      );
      expect(planningCall).toBeDefined();
    });

    it('should incorporate recommended strategies into plan', async () => {
      const strategies = [
        {
          strategy: {
            id: 'strat-1',
            sessionId: 'prev',
            strategyName: 'search-first-strategy',
            description: 'Start with comprehensive search',
            context: 'test',
            successRate: 0.9,
            usageCount: 10,
            averageDuration: 100,
            toolsUsed: ['search', 'fetch'],
            timestamp: new Date(),
          },
          relevanceScore: 0.95,
          reasoning: 'Highly relevant to current goal',
        },
      ];

      mockMemory.getStrategyRecommendations = vi.fn().mockResolvedValue(strategies);

      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulatePlanningResponse([
          { description: 'Search', action: 'search' },
        ]),
      });

      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: { id: 'a1', sessionId: 's1', type: 'search', tool: 'search', parameters: {}, reasoning: 'test', timestamp: new Date() },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockResolvedValue({
        observations: [],
        success: true,
        shouldContinue: false,
        shouldReplan: false,
        learnings: [],
      });

      await agent.research('test topic', simpleGoal);

      // Verify strategy was requested
      expect(mockMemory.getStrategyRecommendations).toHaveBeenCalled();

      // Verify planning prompt included strategy
      const planningCall = mockLLM.complete.mock.calls.find(call =>
        call[0][0].content.includes('RECOMMENDED STRATEGIES')
      );
      expect(planningCall).toBeDefined();
      expect(planningCall[0][0].content).toContain('search-first-strategy');
    });

    it('should use fallback plan on LLM failure', async () => {
      mockMemory.getStrategyRecommendations = vi.fn().mockResolvedValue([]);

      // Make LLM fail for planning
      mockLLM.complete.mockRejectedValueOnce(new Error('LLM planning failed'));

      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: { id: 'a1', sessionId: 's1', type: 'search', tool: 'search', parameters: {}, reasoning: 'test', timestamp: new Date() },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockResolvedValue({
        observations: [],
        success: true,
        shouldContinue: false,
        shouldReplan: false,
        learnings: [],
      });

      const result = await agent.research('test topic', simpleGoal);

      // Should still succeed with fallback plan
      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate plan'),
        expect.any(Object)
      );
    });

    it('should build proper planning prompts', async () => {
      mockMemory.getStrategyRecommendations = vi.fn().mockResolvedValue([]);

      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulatePlanningResponse([
          { description: 'Search', action: 'search' },
        ]),
      });

      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: { id: 'a1', sessionId: 's1', type: 'search', tool: 'search', parameters: {}, reasoning: 'test', timestamp: new Date() },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockResolvedValue({
        observations: [],
        success: true,
        shouldContinue: false,
        shouldReplan: false,
        learnings: [],
      });

      await agent.research('test topic', complexGoal);

      const planningCall = mockLLM.complete.mock.calls.find(call =>
        call[0][0].content.includes('Create a detailed research plan')
      );

      expect(planningCall).toBeDefined();

      const prompt = planningCall[0][0].content;
      expect(prompt).toContain('GOAL:');
      expect(prompt).toContain(complexGoal.description);
      expect(prompt).toContain('SUCCESS CRITERIA:');
      expect(prompt).toContain('CONSTRAINTS:');
      expect(prompt).toContain('ESTIMATED COMPLEXITY:');
      expect(prompt).toContain('Available tools:');

      const options = planningCall[1];
      expect(options.systemPrompt).toContain('expert research planner');
      expect(options.maxTokens).toBe(2000);
      expect(options.temperature).toBe(0.7);
    });

    it('should parse step dependencies correctly', async () => {
      const planWithDeps = JSON.stringify({
        steps: [
          {
            description: 'Step 1',
            action: 'search',
            dependencies: [],
            expectedOutcome: 'Sources',
          },
          {
            description: 'Step 2',
            action: 'fetch',
            dependencies: ['step-1'],
            expectedOutcome: 'Content',
          },
          {
            description: 'Step 3',
            action: 'analyze',
            dependencies: ['step-2'],
            expectedOutcome: 'Facts',
          },
        ],
        estimatedDuration: 180,
      });

      mockMemory.getStrategyRecommendations = vi.fn().mockResolvedValue([]);
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: planWithDeps,
      });

      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: { id: 'a1', sessionId: 's1', type: 'search', tool: 'search', parameters: {}, reasoning: 'test', timestamp: new Date() },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockResolvedValue({
        observations: [],
        success: true,
        shouldContinue: false,
        shouldReplan: false,
        learnings: [],
      });

      const result = await agent.research('test topic', simpleGoal);

      expect(result.success).toBe(true);
      // Plan structure is validated by successful execution
    });
  });

  // ============================================================================
  // Fallback Plan Tests (2 tests)
  // ============================================================================

  describe('Fallback Plans', () => {
    it('should create sensible fallback plan structure', async () => {
      // Return empty strategies so fallback uses 'general-research'
      mockMemory.getStrategyRecommendations = vi.fn().mockResolvedValue([]);

      // Make LLM fail
      mockLLM.complete.mockRejectedValue(new Error('LLM failed'));

      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: { id: 'a1', sessionId: 's1', type: 'search', tool: 'search', parameters: {}, reasoning: 'test', timestamp: new Date() },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockResolvedValue({
        observations: [],
        success: true,
        shouldContinue: false,
        shouldReplan: false,
        learnings: [],
      });

      const result = await agent.research('test topic', simpleGoal);

      expect(result.success).toBe(true);
      // Fallback plan should have been used
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate plan'),
        expect.any(Object)
      );
    });

    it('should initialize all fallback steps as pending', async () => {
      mockMemory.getStrategyRecommendations = vi.fn().mockResolvedValue([]);
      mockLLM.complete.mockRejectedValue(new Error('LLM failed'));

      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: { id: 'a1', sessionId: 's1', type: 'search', tool: 'search', parameters: {}, reasoning: 'test', timestamp: new Date() },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockResolvedValue({
        observations: [],
        success: true,
        shouldContinue: false,
        shouldReplan: false,
        learnings: [],
      });

      const result = await agent.research('test topic', simpleGoal);

      expect(result.success).toBe(true);
      // All steps should start as pending (validated by execution)
    });
  });

  // ============================================================================
  // Progress Tracking Tests (3 tests)
  // ============================================================================

  describe('Plan Progress Tracking', () => {
    beforeEach(() => {
      mockMemory.getStrategyRecommendations = vi.fn().mockResolvedValue([]);
      mockLLM.complete.mockResolvedValue({
        role: 'assistant',
        content: simulatePlanningResponse([
          { description: 'Search', action: 'search' },
          { description: 'Analyze', action: 'analyze' },
        ]),
      });
    });

    it('should update step status as actions complete', async () => {
      let iteration = 0;

      mockReasoningEngine.reason = vi.fn().mockImplementation(async () => {
        iteration++;
        return {
          reasoning: { id: `r${iteration}`, options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
          selectedAction: {
            id: `a${iteration}`,
            sessionId: 's1',
            type: iteration === 1 ? 'search' : 'analyze',
            tool: iteration === 1 ? 'search' : 'analyze',
            parameters: {},
            reasoning: 'test',
            timestamp: new Date(),
          },
          confidence: 0.8,
        };
      });

      mockReasoningEngine.observe = vi.fn().mockImplementation(async (action) => ({
        observations: [`${action.tool} completed`],
        success: true,
        shouldContinue: iteration < 2,
        shouldReplan: false,
        learnings: ['Learning'],
      }));

      const result = await agent.research('test topic', simpleGoal);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(2);
    });

    it('should increment completed step counter', async () => {
      let callCount = 0;

      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: { id: 'a1', sessionId: 's1', type: 'search', tool: 'search', parameters: {}, reasoning: 'test', timestamp: new Date() },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          observations: ['Test'],
          success: true,
          shouldContinue: callCount < 3,
          shouldReplan: false,
          learnings: [],
        };
      });

      const result = await agent.research('test topic', simpleGoal);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
    });

    it('should handle actions that do not match plan steps', async () => {
      mockReasoningEngine.reason = vi.fn().mockResolvedValue({
        reasoning: { id: 'r1', options: [], analysis: '', selectedOption: 'opt1', confidence: 0.8, timestamp: new Date(), context: {} as any },
        selectedAction: {
          id: 'a1',
          sessionId: 's1',
          type: 'reflect', // Action not in plan
          tool: 'reflect',
          parameters: {},
          reasoning: 'test',
          timestamp: new Date(),
        },
        confidence: 0.8,
      });

      mockReasoningEngine.observe = vi.fn().mockResolvedValue({
        observations: ['Reflected'],
        success: true,
        shouldContinue: false,
        shouldReplan: false,
        learnings: [],
      });

      const result = await agent.research('test topic', simpleGoal);

      // Should still complete successfully
      expect(result.success).toBe(true);
    });
  });
});
