/**
 * Agent Test Utilities
 * Reusable utilities for testing agent components
 */

import { vi } from 'vitest';
import type { ReasoningEngine } from '../../src/agent/reasoning';
import type { AgentReflection } from '../../src/agent/reflection';
import type { MemorySystem } from '../../src/memory/memory-system';
import type { ToolRegistry } from '../../src/tools/registry';
import type { LLMClient } from '../../src/llm/client';
import type { Logger } from '../../src/utils/logger';
import type {
  Reasoning,
  ReasoningOption,
  Reflection,
  ResearchResult,
  ProceduralMemory,
  EpisodicMemory,
  SemanticMemory,
} from '../../src/agent/types';
import { createMockLogger, createMockLLMClient } from './memory-test-utils';

// ============================================================================
// Mock Creators
// ============================================================================

/**
 * Create mock ReasoningEngine for testing
 */
export function createMockReasoningEngine(): ReasoningEngine {
  return {
    reason: vi.fn().mockResolvedValue({
      reasoning: createDefaultReasoning(),
      selectedAction: {
        id: 'action-1',
        sessionId: 'session-1',
        type: 'search',
        tool: 'search',
        parameters: {},
        reasoning: 'Default reasoning',
        timestamp: new Date(),
      },
      confidence: 0.8,
    }),
    observe: vi.fn().mockResolvedValue({
      observations: ['Action completed'],
      success: true,
      shouldContinue: true,
      shouldReplan: false,
      learnings: ['Learning extracted'],
    }),
  } as unknown as ReasoningEngine;
}

/**
 * Create mock AgentReflection for testing
 */
export function createMockAgentReflection(): AgentReflection {
  return {
    shouldReflect: vi.fn().mockReturnValue({
      shouldReflect: false,
      reason: 'No trigger met',
    }),
    reflect: vi.fn().mockResolvedValue(createDefaultReflection()),
    applyReflection: vi.fn().mockReturnValue({
      adjustmentsMade: [],
      shouldReplan: false,
      newFocus: 'Continue current approach',
      strategyRecommendation: 'continue' as const,
    }),
    reset: vi.fn(),
    getStatistics: vi.fn().mockReturnValue({
      reflectionCount: 0,
      lastReflectionIteration: 0,
      reflectionInterval: 5,
    }),
  } as unknown as AgentReflection;
}

/**
 * Create mock MemorySystem for testing
 */
export function createMockMemorySystem(): MemorySystem {
  return {
    startSession: vi.fn().mockResolvedValue({
      id: 'session-1',
      userId: undefined,
      topic: 'test topic',
      goal: {
        description: 'test goal',
        successCriteria: [],
        estimatedComplexity: 'simple' as const,
      },
      state: {} as any,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    completeSession: vi.fn().mockResolvedValue(undefined),
    buildContext: vi.fn().mockResolvedValue({
      episodes: [],
      facts: [],
      strategies: [],
      totalTokens: 0,
      truncated: {
        episodes: false,
        facts: false,
        strategies: false,
      },
    }),
    getStrategyRecommendations: vi.fn().mockResolvedValue([]),
    storeExperience: vi.fn().mockResolvedValue({
      episode: {} as EpisodicMemory,
      extractedFacts: [],
      shouldReflect: false,
    }),
  } as unknown as MemorySystem;
}

/**
 * Create mock ToolRegistry for testing
 */
export function createMockToolRegistry(): ToolRegistry {
  return {
    getTool: vi.fn().mockReturnValue({
      name: 'search',
      description: 'Search tool',
      version: '1.0.0',
      config: {},
      execute: vi.fn().mockResolvedValue({ success: true }),
      validateInput: vi.fn().mockResolvedValue(true),
      getInputSchema: vi.fn().mockReturnValue({}),
    }),
    getEnabledTools: vi.fn().mockReturnValue([
      { name: 'search', description: 'Search tool', version: '1.0.0' },
      { name: 'fetch', description: 'Fetch tool', version: '1.0.0' },
      { name: 'analyze', description: 'Analyze tool', version: '1.0.0' },
      { name: 'synthesize', description: 'Synthesize tool', version: '1.0.0' },
    ]),
    executeTool: vi.fn().mockResolvedValue({
      success: true,
      data: { message: 'Tool executed' },
    }),
    getToolSchemas: vi.fn().mockReturnValue([]),
  } as unknown as ToolRegistry;
}

// ============================================================================
// Data Generators
// ============================================================================

/**
 * Generate random actions for testing
 */
export function generateRandomActions(count: number) {
  const actions = [];
  const types = ['search', 'fetch', 'analyze', 'synthesize'];

  for (let i = 0; i < count; i++) {
    actions.push({
      id: `action-${i}`,
      sessionId: 'session-1',
      type: types[i % types.length],
      tool: types[i % types.length],
      parameters: {},
      reasoning: `Reasoning for action ${i}`,
      timestamp: new Date(Date.now() + i * 1000),
    });
  }

  return actions;
}

/**
 * Generate random outcomes for testing
 */
export function generateRandomOutcomes(count: number, successRate: number = 0.8) {
  const outcomes = [];

  for (let i = 0; i < count; i++) {
    const success = Math.random() < successRate;
    outcomes.push({
      actionId: `action-${i}`,
      success,
      result: success ? { data: `Result ${i}` } : undefined,
      error: success ? undefined : 'Random error',
      observations: [success ? 'Success' : 'Failed'],
      duration: 1000 + Math.random() * 2000,
      metadata: {},
      timestamp: new Date(Date.now() + i * 1000),
    });
  }

  return outcomes;
}

/**
 * Generate reasoning context for testing
 */
export function generateReasoningContext(overrides?: any) {
  return {
    currentGoal: {
      description: 'Test goal',
      successCriteria: ['Criterion 1'],
      estimatedComplexity: 'simple' as const,
    },
    currentProgress: {
      stepsCompleted: 1,
      stepsTotal: 5,
      sourcesGathered: 3,
      factsExtracted: 5,
      currentPhase: 'gathering' as const,
      confidence: 0.7,
    },
    recentActions: ['search: Find sources'],
    recentOutcomes: ['SUCCESS: Found 3 sources'],
    availableTools: ['search', 'fetch', 'analyze', 'synthesize'],
    relevantMemories: [],
    constraints: [],
    ...overrides,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Validate reasoning result structure
 */
export function expectReasoningResult(result: any): void {
  if (!result.reasoning || !result.selectedAction || typeof result.confidence !== 'number') {
    throw new Error('Invalid reasoning result structure');
  }

  if (!result.reasoning.id || !result.reasoning.analysis || !result.reasoning.options) {
    throw new Error('Invalid reasoning structure');
  }

  if (!result.selectedAction.id || !result.selectedAction.tool) {
    throw new Error('Invalid selected action structure');
  }

  if (result.confidence < 0 || result.confidence > 1) {
    throw new Error(`Invalid confidence value: ${result.confidence}`);
  }
}

/**
 * Validate reflection structure
 */
export function expectReflection(reflection: any): void {
  if (!reflection.id || !reflection.sessionId || typeof reflection.iterationNumber !== 'number') {
    throw new Error('Invalid reflection structure');
  }

  if (!reflection.progressAssessment || !reflection.strategyEvaluation) {
    throw new Error('Missing required reflection fields');
  }

  if (!Array.isArray(reflection.learnings)) {
    throw new Error('Learnings must be an array');
  }

  if (typeof reflection.shouldReplan !== 'boolean') {
    throw new Error('shouldReplan must be boolean');
  }
}

/**
 * Validate research result structure
 */
export function expectResearchResult(result: any): void {
  if (!result.sessionId || !result.topic || !result.goal) {
    throw new Error('Missing required result fields');
  }

  if (!result.synthesis || !Array.isArray(result.keyFindings)) {
    throw new Error('Invalid result structure');
  }

  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
    throw new Error(`Invalid confidence: ${result.confidence}`);
  }

  if (typeof result.totalActions !== 'number' || result.totalActions < 0) {
    throw new Error(`Invalid totalActions: ${result.totalActions}`);
  }
}

// ============================================================================
// Execution Helpers
// ============================================================================

/**
 * Run agent for N iterations (for testing loops)
 */
export async function runAgentIterations(
  agent: any,
  count: number,
  onIteration?: (iteration: number) => void
): Promise<void> {
  for (let i = 0; i < count; i++) {
    if (onIteration) {
      onIteration(i);
    }
    // Simulate iteration
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

/**
 * Simulate reflection trigger
 */
export function simulateReflectionTrigger(
  agentReflection: AgentReflection,
  reason: string = 'Test trigger'
): void {
  const mock = agentReflection as any;
  if (mock.shouldReflect && mock.shouldReflect.mockReturnValue) {
    mock.shouldReflect.mockReturnValue({
      shouldReflect: true,
      reason,
    });
  }
}

/**
 * Capture agent logs for assertions
 */
export function captureAgentLogs() {
  const logs: Array<{ level: string; message: string; data?: any }> = [];

  const logger = {
    info: (message: string, data?: any) => logs.push({ level: 'info', message, data }),
    debug: (message: string, data?: any) => logs.push({ level: 'debug', message, data }),
    warn: (message: string, data?: any) => logs.push({ level: 'warn', message, data }),
    error: (message: string, data?: any) => logs.push({ level: 'error', message, data }),
  };

  return {
    logger,
    getLogs: () => logs,
    getLogsByLevel: (level: string) => logs.filter(log => log.level === level),
    hasLog: (message: string) => logs.some(log => log.message.includes(message)),
    clear: () => { logs.length = 0; },
  };
}

// ============================================================================
// LLM Response Simulators
// ============================================================================

/**
 * Simulate LLM planning response
 */
export function simulatePlanningResponse(steps: Array<{description: string; action: string}>) {
  return JSON.stringify({
    steps: steps.map((step, i) => ({
      description: step.description,
      action: step.action,
      dependencies: i > 0 ? [`step-${i}`] : [],
      expectedOutcome: `Outcome for ${step.description}`,
    })),
    estimatedDuration: steps.length * 60,
  });
}

/**
 * Simulate LLM reasoning response
 */
export function simulateReasoningResponse(optionCount: number = 3) {
  const options: ReasoningOption[] = [];

  for (let i = 0; i < optionCount; i++) {
    options.push({
      id: `option-${i + 1}`,
      action: ['search', 'fetch', 'analyze'][i % 3],
      rationale: `Rationale for option ${i + 1}`,
      expectedBenefit: `Benefit ${i + 1}`,
      potentialRisks: [`Risk ${i + 1}`],
      estimatedCost: (i + 1) * 2,
      confidence: 0.9 - i * 0.1,
    });
  }

  return JSON.stringify({ options });
}

/**
 * Simulate LLM learning extraction response
 */
export function simulateLearningResponse(learnings: string[]) {
  return JSON.stringify({ learnings });
}

// ============================================================================
// Default Test Data
// ============================================================================

/**
 * Create default reasoning for mocks
 */
function createDefaultReasoning(): Reasoning {
  return {
    id: 'reasoning-1',
    context: generateReasoningContext(),
    analysis: 'Test analysis',
    options: [
      {
        id: 'option-1',
        action: 'search',
        rationale: 'Search for information',
        expectedBenefit: 'Find sources',
        potentialRisks: [],
        estimatedCost: 3,
        confidence: 0.8,
      },
    ],
    selectedOption: 'option-1',
    confidence: 0.8,
    timestamp: new Date(),
  };
}

/**
 * Create default reflection for mocks
 */
function createDefaultReflection(): Reflection {
  return {
    id: 'reflection-1',
    sessionId: 'session-1',
    iterationNumber: 5,
    timestamp: new Date(),
    actionsSinceLastReflection: [],
    outcomesSinceLastReflection: [],
    progressAssessment: {
      isOnTrack: true,
      progressRate: 0.5,
      estimatedCompletion: 10,
      blockers: [],
      achievements: [],
    },
    strategyEvaluation: {
      currentStrategy: 'test-strategy',
      effectiveness: 0.7,
      strengths: [],
      weaknesses: [],
      alternativeStrategies: [],
      recommendation: 'continue',
    },
    learnings: [],
    shouldReplan: false,
    adjustments: [],
    nextFocus: 'Continue',
  };
}

/**
 * Create test LLM client with configurable responses
 */
export function createTestLLMClient(responses: Record<string, string> = {}) {
  const defaultResponses = {
    'reasoning': simulateReasoningResponse(3),
    'planning': simulatePlanningResponse([
      { description: 'Search', action: 'search' },
      { description: 'Analyze', action: 'analyze' },
    ]),
    'learning': simulateLearningResponse(['Test learning']),
  };

  const allResponses = { ...defaultResponses, ...responses };

  return createMockLLMClient({
    defaultResponse: JSON.stringify({ options: [] }),
    responses: new Map(Object.entries(allResponses)),
  });
}

/**
 * Wait for next tick (useful for async tests)
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create expectation matcher for arrays containing items
 */
export function expectArrayContains<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
): void {
  const found = array.some(predicate);
  if (!found) {
    throw new Error(message || 'Expected array to contain matching item');
  }
}

/**
 * Create spy for tracking method calls
 */
export function createMethodSpy<T extends (...args: any[]) => any>() {
  const calls: Parameters<T>[] = [];

  const spy = vi.fn((...args: Parameters<T>) => {
    calls.push(args);
  });

  return {
    spy,
    calls,
    getCallCount: () => calls.length,
    getCall: (index: number) => calls[index],
    wasCalledWith: (...args: Parameters<T>) =>
      calls.some(call => JSON.stringify(call) === JSON.stringify(args)),
    reset: () => {
      calls.length = 0;
      spy.mockClear();
    },
  };
}
