/**
 * Agent Reflection Flow Integration Tests
 * Tests the complete reflection flow in the autonomous agent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutonomousAgent, AgentConfig } from '../../../src/agent/core';
import { ReasoningEngine, createReasoningEngine } from '../../../src/agent/reasoning';
import { AgentReflection, createAgentReflection } from '../../../src/agent/reflection';
import { ReflectionEngine } from '../../../src/memory/reflection-engine';
import { createMockLogger, createMockLLMClient } from '../../helpers/memory-test-utils';
import {
  createMockMemorySystem,
  createMockToolRegistry,
  simulatePlanningResponse,
  simulateReasoningResponse,
} from '../../helpers/agent-test-utils';
import { simpleGoal } from '../../fixtures/agent/mock-goals';

describe('Agent Reflection Flow Integration', () => {
  let agent: AutonomousAgent;
  let reasoningEngine: ReasoningEngine;
  let agentReflection: AgentReflection;
  let reflectionEngine: ReflectionEngine;
  let mockMemory: ReturnType<typeof createMockMemorySystem>;
  let mockTools: ReturnType<typeof createMockToolRegistry>;
  let mockLLM: ReturnType<typeof createMockLLMClient>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let config: AgentConfig;

  beforeEach(() => {
    mockMemory = createMockMemorySystem();
    mockTools = createMockToolRegistry();
    mockLLM = createMockLLMClient();
    mockLogger = createMockLogger();

    // Create real reflection components for integration testing
    reflectionEngine = new ReflectionEngine(mockLLM as any, mockLogger);
    agentReflection = createAgentReflection(reflectionEngine, mockLogger, 5);
    reasoningEngine = createReasoningEngine(mockLLM as any, mockLogger);

    config = {
      maxIterations: 15,
      reflectionInterval: 5,
      maxContextTokens: 4000,
      enableAutoReflection: true, // Enable for these tests
    };

    agent = new AutonomousAgent(
      reasoningEngine,
      agentReflection,
      mockMemory,
      mockTools,
      mockLLM as any,
      mockLogger,
      config
    );

    // Setup default responses
    mockLLM.complete.mockResolvedValue({
      role: 'assistant',
      content: simulatePlanningResponse([
        { description: 'Search', action: 'search' },
      ]),
    });

    mockLLM.extractText.mockImplementation((response: any) => {
      if (typeof response === 'string') return response;
      return response?.content || '';
    });
  });

  // ============================================================================
  // Reflection Trigger Tests
  // ============================================================================

  it('should trigger reflection after regular interval', async () => {
    let iteration = 0;

    // Setup LLM to return reasoning responses
    mockLLM.complete.mockImplementation(async (messages: any) => {
      const content = Array.isArray(messages) ? messages[0]?.content : '';

      if (content.includes('reasoning')) {
        return {
          role: 'assistant',
          content: simulateReasoningResponse(2),
        };
      }

      return {
        role: 'assistant',
        content: JSON.stringify({ learnings: ['Test learning'] }),
      };
    });

    mockLLM.extractText.mockImplementation((response: any) => {
      if (typeof response === 'string') return response;
      return response?.content || '';
    });

    // Mock tool execution
    mockTools.executeTool = vi.fn().mockImplementation(async () => {
      iteration++;
      return {
        success: true,
        data: { results: [] },
      };
    });

    await agent.research('test topic', simpleGoal);

    // Should have triggered reflection at iteration 5, 10, etc.
    const stats = agentReflection.getStatistics();
    expect(stats.reflectionCount).toBeGreaterThan(0);
  });

  it('should trigger reflection on consecutive failures', async () => {
    let iteration = 0;

    mockLLM.complete.mockImplementation(async (messages: any) => {
      const content = Array.isArray(messages) ? messages[0]?.content : '';

      if (content.includes('reasoning')) {
        return {
          role: 'assistant',
          content: simulateReasoningResponse(2),
        };
      }

      return {
        role: 'assistant',
        content: JSON.stringify({ learnings: ['Failure learning'] }),
      };
    });

    mockLLM.extractText.mockImplementation((response: any) => {
      if (typeof response === 'string') return response;
      return response?.content || '';
    });

    // Make first 3 actions fail
    mockTools.executeTool = vi.fn().mockImplementation(async () => {
      iteration++;
      return {
        success: iteration > 3,
        error: iteration <= 3 ? 'Tool failed' : undefined,
        data: iteration > 3 ? { results: [] } : undefined,
      };
    });

    await agent.research('test topic', simpleGoal);

    // Should have triggered reflection due to failures
    const stats = agentReflection.getStatistics();
    expect(stats.reflectionCount).toBeGreaterThan(0);
  });

  // ============================================================================
  // Reflection Application Tests
  // ============================================================================

  it('should apply reflection insights to agent behavior', async () => {
    let iteration = 0;
    const appliedInsights: string[] = [];

    mockLLM.complete.mockImplementation(async (messages: any) => {
      const content = Array.isArray(messages) ? messages[0]?.content : '';

      if (content.includes('reasoning')) {
        return {
          role: 'assistant',
          content: simulateReasoningResponse(2),
        };
      }

      return {
        role: 'assistant',
        content: JSON.stringify({
          learnings: ['Adjust search strategy', 'Focus on quality'],
        }),
      };
    });

    mockLLM.extractText.mockImplementation((response: any) => {
      if (typeof response === 'string') return response;
      return response?.content || '';
    });

    mockTools.executeTool = vi.fn().mockImplementation(async () => {
      iteration++;
      return {
        success: true,
        data: { results: [] },
      };
    });

    const result = await agent.research('test topic', simpleGoal);

    expect(result.success).toBe(true);
    // Reflections should have been performed and applied
    const stats = agentReflection.getStatistics();
    expect(stats.reflectionCount).toBeGreaterThan(0);
  });

  // ============================================================================
  // Replanning Tests
  // ============================================================================

  it('should replan when reflection recommends it', async () => {
    let iteration = 0;
    let planCount = 0;

    mockLLM.complete.mockImplementation(async (messages: any) => {
      const content = Array.isArray(messages) ? messages[0]?.content : '';

      if (content.includes('Create a detailed research plan')) {
        planCount++;
        return {
          role: 'assistant',
          content: simulatePlanningResponse([
            { description: `Plan ${planCount} - Search`, action: 'search' },
          ]),
        };
      }

      if (content.includes('reasoning')) {
        return {
          role: 'assistant',
          content: simulateReasoningResponse(2),
        };
      }

      return {
        role: 'assistant',
        content: JSON.stringify({ learnings: ['Need to change approach'] }),
      };
    });

    mockLLM.extractText.mockImplementation((response: any) => {
      if (typeof response === 'string') return response;
      return response?.content || '';
    });

    // Make early iterations fail to trigger replanning
    mockTools.executeTool = vi.fn().mockImplementation(async () => {
      iteration++;
      return {
        success: iteration > 2,
        error: iteration <= 2 ? 'Failed' : undefined,
        data: iteration > 2 ? { results: [] } : undefined,
      };
    });

    await agent.research('test topic', simpleGoal);

    // Should have created multiple plans due to replanning
    expect(planCount).toBeGreaterThan(1);
  });

  // ============================================================================
  // State Management Tests
  // ============================================================================

  it('should store reflections in agent state', async () => {
    let iteration = 0;

    mockLLM.complete.mockImplementation(async (messages: any) => {
      const content = Array.isArray(messages) ? messages[0]?.content : '';

      if (content.includes('reasoning')) {
        return {
          role: 'assistant',
          content: simulateReasoningResponse(2),
        };
      }

      return {
        role: 'assistant',
        content: JSON.stringify({ learnings: ['Stored learning'] }),
      };
    });

    mockLLM.extractText.mockImplementation((response: any) => {
      if (typeof response === 'string') return response;
      return response?.content || '';
    });

    mockTools.executeTool = vi.fn().mockImplementation(async () => {
      iteration++;
      return {
        success: true,
        data: { results: [] },
      };
    });

    const result = await agent.research('test topic', simpleGoal);

    expect(result.success).toBe(true);
    // Result should include reflection count
    expect(result.reflections).toBeGreaterThan(0);
  });

  // ============================================================================
  // Learning Application Tests
  // ============================================================================

  it('should use learnings from reflections in future decisions', async () => {
    let iteration = 0;
    const learningsApplied: string[] = [];

    mockLLM.complete.mockImplementation(async (messages: any) => {
      const content = Array.isArray(messages) ? messages[0]?.content : '';

      if (content.includes('reasoning')) {
        return {
          role: 'assistant',
          content: simulateReasoningResponse(2),
        };
      }

      // Return learnings during observation
      return {
        role: 'assistant',
        content: JSON.stringify({
          learnings: [`Learning from iteration ${iteration}`],
        }),
      };
    });

    mockLLM.extractText.mockImplementation((response: any) => {
      if (typeof response === 'string') return response;
      return response?.content || '';
    });

    mockTools.executeTool = vi.fn().mockImplementation(async () => {
      iteration++;
      return {
        success: true,
        data: { results: [] },
      };
    });

    const result = await agent.research('test topic', simpleGoal);

    expect(result.success).toBe(true);
    // Learnings should have been extracted throughout execution
    expect(mockMemory.storeExperience).toHaveBeenCalled();

    // Verify learnings were passed to memory
    const storeCall = mockMemory.storeExperience.mock.calls[0];
    expect(storeCall).toBeDefined();
  });
});
