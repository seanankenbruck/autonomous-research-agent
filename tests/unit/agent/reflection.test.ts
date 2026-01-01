/**
 * AgentReflection Unit Tests
 * Tests for meta-cognitive reflection capabilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentReflection } from '../../../src/agent/reflection';
import { ReflectionEngine } from '../../../src/memory/reflection-engine';
import type { AgentState, Action, Outcome, Reflection } from '../../../src/agent/types';
import { createMockLogger } from '../../helpers/memory-test-utils';
import {
  initialState,
  inProgressState,
  lowConfidenceState,
  highIterationState,
} from '../../fixtures/agent/mock-states';
import {
  searchAction,
  fetchAction,
  failedAction,
  generateActionSequence,
} from '../../fixtures/agent/mock-actions';
import {
  successfulOutcome,
  failedOutcome,
  generateOutcomeSequence,
  createConsecutiveFailures,
} from '../../fixtures/agent/mock-outcomes';

describe('AgentReflection', () => {
  let agentReflection: AgentReflection;
  let mockReflectionEngine: ReflectionEngine;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockReflectionEngine = {
      reflect: vi.fn(),
    } as any;
    agentReflection = new AgentReflection(mockReflectionEngine, mockLogger, 5);
  });

  // ============================================================================
  // Triggering Tests (5 tests)
  // ============================================================================

  describe('shouldReflect() - Triggering', () => {
    it('should trigger at regular intervals', () => {
      const state: AgentState = {
        ...initialState,
        iterationCount: 5,
      };

      const result = agentReflection.shouldReflect(state, [], []);

      expect(result.shouldReflect).toBe(true);
      expect(result.reason).toContain('Regular reflection interval');
      expect(result.reason).toContain('5 iterations');
    });

    it('should trigger on multiple consecutive failures', () => {
      const failures = createConsecutiveFailures(['a1', 'a2', 'a3']);

      const result = agentReflection.shouldReflect(
        initialState,
        generateActionSequence('test-session', 3),
        failures
      );

      expect(result.shouldReflect).toBe(true);
      expect(result.reason).toContain('Multiple recent failures');
    });

    it('should trigger on low confidence', () => {
      const state: AgentState = {
        ...lowConfidenceState,
        iterationCount: 4, // Less than interval to avoid interval trigger
      };

      const result = agentReflection.shouldReflect(state, [], []);

      expect(result.shouldReflect).toBe(true);
      expect(result.reason).toContain('Low confidence');
    });

    it('should trigger when approaching iteration limits', () => {
      const maxIterations = 50;

      // Create a new reflection instance that has already triggered at iteration 37
      // so the next regular interval would be at 42 (37 + 5)
      const testReflection = new AgentReflection(
        mockReflectionEngine,
        mockLogger,
        5
      );

      // Manually call reflect once to set lastReflectionIteration to 37
      const setupState: AgentState = {
        ...initialState,
        iterationCount: 37,
        progress: {
          ...initialState.progress,
          confidence: 0.7,
        },
      };

      testReflection.reflect('test-session', setupState, [], []);

      // Now test at iteration 41 (82% of 50, > 80%)
      // Last reflection was at 37, so 41-37=4 iterations since last (not at interval of 5)
      const state: AgentState = {
        ...initialState,
        iterationCount: 41,
        progress: {
          ...initialState.progress,
          currentPhase: 'gathering', // Not completed
          confidence: 0.7, // Good confidence
        },
      };

      const result = testReflection.shouldReflect(state, [], []);

      expect(result.shouldReflect).toBe(true);
      expect(result.reason).toContain('Approaching iteration limit');
    });

    it('should not trigger when no conditions are met', () => {
      const state: AgentState = {
        ...initialState,
        iterationCount: 3, // Less than interval
        progress: {
          ...initialState.progress,
          confidence: 0.7, // Good confidence
        },
      };

      const successfulOutcomes = [successfulOutcome, successfulOutcome, successfulOutcome];

      const result = agentReflection.shouldReflect(state, [], successfulOutcomes);

      expect(result.shouldReflect).toBe(false);
      expect(result.reason).toContain('No reflection trigger met');
    });
  });

  // ============================================================================
  // Progress Assessment Tests (4 tests)
  // ============================================================================

  describe('reflect() - Progress Assessment', () => {
    beforeEach(() => {
      // Mock reflection engine to capture and return the reflection
      mockReflectionEngine.reflect = vi.fn();
    });

    it('should assess on-track status accurately', async () => {
      const state: AgentState = {
        ...initialState,
        iterationCount: 10,
        progress: {
          ...initialState.progress,
          stepsCompleted: 2, // Good progress (> 10 * 0.15 = 1.5)
          confidence: 0.7,
        },
      };

      const actionIds = ['a1', 'a2', 'a3', 'a4', 'a5'];
      const reflection = await agentReflection.reflect(
        'test-session',
        state,
        generateActionSequence('test-session', 5),
        generateOutcomeSequence(actionIds, 0.8)
      );

      expect(reflection.progressAssessment.isOnTrack).toBe(true);
      expect(reflection.progressAssessment.progressRate).toBeGreaterThan(0);
    });

    it('should identify blockers correctly', async () => {
      const failures = createConsecutiveFailures(['a1', 'a2', 'a3', 'a4']);
      const state: AgentState = {
        ...lowConfidenceState,
        iterationCount: 6,
        workingMemory: {
          ...initialState.workingMemory,
          openQuestions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'],
        },
        progress: {
          ...lowConfidenceState.progress,
          sourcesGathered: 1,
        },
      };

      const reflection = await agentReflection.reflect(
        'test-session',
        state,
        generateActionSequence('test-session', 4),
        failures
      );

      expect(reflection.progressAssessment.blockers.length).toBeGreaterThan(0);
      expect(reflection.progressAssessment.blockers).toContain('Frequent action failures');
      expect(reflection.progressAssessment.blockers).toContain('Low confidence in current approach');
      expect(reflection.progressAssessment.blockers).toContain('Too many unanswered questions');
      expect(reflection.progressAssessment.blockers).toContain('Insufficient sources gathered');
    });

    it('should track achievements', async () => {
      const state: AgentState = {
        ...inProgressState,
        progress: {
          ...inProgressState.progress,
          sourcesGathered: 8,
          factsExtracted: 15,
          confidence: 0.75,
        },
        workingMemory: {
          ...inProgressState.workingMemory,
          keyFindings: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'],
        },
      };

      const actionIds = ['a1', 'a2', 'a3', 'a4', 'a5'];
      const reflection = await agentReflection.reflect(
        'test-session',
        state,
        generateActionSequence('test-session', 5),
        generateOutcomeSequence(actionIds, 0.9)
      );

      expect(reflection.progressAssessment.achievements.length).toBeGreaterThan(0);
      expect(reflection.progressAssessment.achievements.some(a => a.includes('sources'))).toBe(true);
      expect(reflection.progressAssessment.achievements.some(a => a.includes('facts'))).toBe(true);
    });

    it('should calculate progress rate accurately', async () => {
      const state: AgentState = {
        ...initialState,
        iterationCount: 10,
        progress: {
          ...initialState.progress,
          stepsCompleted: 3,
          stepsTotal: 10,
        },
      };

      const actionIds = ['a1', 'a2', 'a3', 'a4', 'a5'];
      const reflection = await agentReflection.reflect(
        'test-session',
        state,
        generateActionSequence('test-session', 5),
        generateOutcomeSequence(actionIds, 0.8)
      );

      // Progress rate = steps completed / iterations = 3 / 10 = 0.3
      expect(reflection.progressAssessment.progressRate).toBe(0.3);

      // Estimated completion = steps remaining / progress rate = 7 / 0.3 ≈ 24
      expect(reflection.progressAssessment.estimatedCompletion).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Strategy Evaluation Tests (4 tests)
  // ============================================================================

  describe('reflect() - Strategy Evaluation', () => {
    it('should calculate strategy effectiveness', async () => {
      const actions = generateActionSequence('test-session', 10);
      // Create outcomes with exactly 7 successes (70%)
      const outcomes = [
        { ...successfulOutcome, actionId: 'a1', success: true },
        { ...successfulOutcome, actionId: 'a2', success: true },
        { ...successfulOutcome, actionId: 'a3', success: true },
        { ...successfulOutcome, actionId: 'a4', success: true },
        { ...successfulOutcome, actionId: 'a5', success: true },
        { ...successfulOutcome, actionId: 'a6', success: true },
        { ...successfulOutcome, actionId: 'a7', success: true },
        { ...failedOutcome, actionId: 'a8', success: false },
        { ...failedOutcome, actionId: 'a9', success: false },
        { ...failedOutcome, actionId: 'a10', success: false },
      ];

      const reflection = await agentReflection.reflect(
        'test-session',
        inProgressState,
        actions,
        outcomes
      );

      expect(reflection.strategyEvaluation.effectiveness).toBeCloseTo(0.7, 1);
    });

    it('should identify strategy strengths', async () => {
      const actions = [
        { ...searchAction, id: 'a1', tool: 'search' },
        { ...searchAction, id: 'a2', tool: 'search' },
        { ...searchAction, id: 'a3', tool: 'search' },
        { ...fetchAction, id: 'a4', tool: 'fetch' },
      ];
      const outcomes = [
        { ...successfulOutcome, actionId: 'a1' },
        { ...successfulOutcome, actionId: 'a2' },
        { ...successfulOutcome, actionId: 'a3' },
        { ...failedOutcome, actionId: 'a4' },
      ];

      const state: AgentState = {
        ...inProgressState,
        progress: {
          ...inProgressState.progress,
          confidence: 0.75,
        },
      };

      const reflection = await agentReflection.reflect(
        'test-session',
        state,
        actions as Action[],
        outcomes
      );

      expect(reflection.strategyEvaluation.strengths.length).toBeGreaterThan(0);
      expect(reflection.strategyEvaluation.strengths.some(s => s.includes('search'))).toBe(true);
    });

    it('should identify strategy weaknesses', async () => {
      const failures = createConsecutiveFailures(['a1', 'a2', 'a3', 'a4', 'a5']);
      const state: AgentState = {
        ...inProgressState,
        iterationCount: 15,
        plan: {
          ...inProgressState.plan,
          steps: [
            {
              id: 'step-1',
              description: 'Test step',
              action: 'search',
              dependencies: [],
              status: 'in_progress',
              expectedOutcome: 'Test',
            },
          ],
        },
      };

      const reflection = await agentReflection.reflect(
        'test-session',
        state,
        generateActionSequence('test-session', 5),
        failures
      );

      expect(reflection.strategyEvaluation.weaknesses.length).toBeGreaterThan(0);
      expect(reflection.strategyEvaluation.weaknesses).toContain('High failure rate');
    });

    it('should recommend strategy adjustments', async () => {
      const actions = generateActionSequence('test-session', 10);

      // Create deterministic outcomes for 75% success
      const goodOutcomes = [
        ...Array(8).fill(null).map((_, i) => ({ ...successfulOutcome, actionId: `a${i+1}`, success: true })),
        ...Array(2).fill(null).map((_, i) => ({ ...failedOutcome, actionId: `a${i+9}`, success: false })),
      ];

      // Test "continue" recommendation
      const goodState: AgentState = {
        ...inProgressState,
        progress: {
          ...inProgressState.progress,
          confidence: 0.8,
        },
      };

      const goodReflection = await agentReflection.reflect(
        'test-session',
        goodState,
        actions,
        goodOutcomes
      );

      expect(goodReflection.strategyEvaluation.recommendation).toBe('continue');

      // Create deterministic outcomes for 50% success
      const okOutcomes = [
        ...Array(5).fill(null).map((_, i) => ({ ...successfulOutcome, actionId: `a${i+1}`, success: true })),
        ...Array(5).fill(null).map((_, i) => ({ ...failedOutcome, actionId: `a${i+6}`, success: false })),
      ];

      // Test "adjust" recommendation
      const okState: AgentState = {
        ...inProgressState,
        progress: {
          ...inProgressState.progress,
          confidence: 0.5,
        },
      };

      const okReflection = await agentReflection.reflect(
        'test-session',
        okState,
        actions,
        okOutcomes
      );

      expect(okReflection.strategyEvaluation.recommendation).toBe('adjust');

      // Create deterministic outcomes for 30% success
      const badOutcomes = [
        ...Array(3).fill(null).map((_, i) => ({ ...successfulOutcome, actionId: `a${i+1}`, success: true })),
        ...Array(7).fill(null).map((_, i) => ({ ...failedOutcome, actionId: `a${i+4}`, success: false })),
      ];

      // Test "change" recommendation
      const badState: AgentState = {
        ...inProgressState,
        progress: {
          ...inProgressState.progress,
          confidence: 0.3,
        },
      };

      const badReflection = await agentReflection.reflect(
        'test-session',
        badState,
        actions,
        badOutcomes
      );

      expect(badReflection.strategyEvaluation.recommendation).toBe('change');
    });
  });

  // ============================================================================
  // Learning Extraction Tests (3 tests)
  // ============================================================================

  describe('reflect() - Learning Extraction', () => {
    it('should extract learnings from success patterns', async () => {
      const actions = [
        { ...searchAction, id: 'a1', tool: 'search' },
        { ...searchAction, id: 'a2', tool: 'search' },
        { ...searchAction, id: 'a3', tool: 'search' },
      ];
      const outcomes = [
        { ...successfulOutcome, actionId: 'a1', success: true },
        { ...successfulOutcome, actionId: 'a2', success: true },
        { ...successfulOutcome, actionId: 'a3', success: true },
      ];

      const reflection = await agentReflection.reflect(
        'test-session',
        inProgressState,
        actions as Action[],
        outcomes
      );

      expect(reflection.learnings.length).toBeGreaterThan(0);
      expect(reflection.learnings.some(l => l.includes('search'))).toBe(true);
      expect(reflection.learnings.some(l => l.includes('effective'))).toBe(true);
    });

    it('should extract learnings from failure patterns', async () => {
      const actions = [
        { ...fetchAction, id: 'a1', tool: 'fetch' },
        { ...fetchAction, id: 'a2', tool: 'fetch' },
      ];
      const outcomes = [
        { ...failedOutcome, actionId: 'a1', success: false },
        { ...failedOutcome, actionId: 'a2', success: false },
      ];

      const reflection = await agentReflection.reflect(
        'test-session',
        inProgressState,
        actions as Action[],
        outcomes
      );

      expect(reflection.learnings.length).toBeGreaterThan(0);
      expect(reflection.learnings.some(l => l.includes('fetch'))).toBe(true);
      expect(reflection.learnings.some(l => l.toLowerCase().includes('improvement'))).toBe(true);
    });

    it('should detect repetitive behavior patterns', async () => {
      const sameTypeActions = [
        { ...searchAction, id: 'a1', type: 'search' as const },
        { ...searchAction, id: 'a2', type: 'search' as const },
        { ...searchAction, id: 'a3', type: 'search' as const },
        { ...searchAction, id: 'a4', type: 'search' as const },
        { ...searchAction, id: 'a5', type: 'search' as const },
        { ...searchAction, id: 'a6', type: 'search' as const },
      ];

      const actionIds = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
      const reflection = await agentReflection.reflect(
        'test-session',
        inProgressState,
        sameTypeActions as Action[],
        generateOutcomeSequence(actionIds, 0.5)
      );

      expect(reflection.learnings.some(l => l.includes('diversity'))).toBe(true);
    });
  });

  // ============================================================================
  // Application Tests (3 tests)
  // ============================================================================

  describe('applyReflection()', () => {
    it('should determine when replanning is needed', () => {
      const replanReflection: Reflection = {
        id: 'reflection-1',
        sessionId: 'test-session',
        iterationNumber: 10,
        timestamp: new Date(),
        actionsSinceLastReflection: [],
        outcomesSinceLastReflection: [],
        progressAssessment: {
          isOnTrack: false,
          progressRate: 0.1,
          estimatedCompletion: 50,
          blockers: ['Major blocker'],
          achievements: [],
        },
        strategyEvaluation: {
          currentStrategy: 'test-strategy',
          effectiveness: 0.3,
          strengths: [],
          weaknesses: ['High failure rate'],
          alternativeStrategies: ['Try different approach'],
          recommendation: 'change',
        },
        learnings: [],
        shouldReplan: true,
        adjustments: ['Replan due to being off track'],
        nextFocus: 'Change approach',
      };

      const result = agentReflection.applyReflection(replanReflection, inProgressState);

      expect(result.shouldReplan).toBe(true);
      expect(result.strategyRecommendation).toBe('change');
    });

    it('should generate appropriate adjustments', () => {
      const reflection: Reflection = {
        id: 'reflection-1',
        sessionId: 'test-session',
        iterationNumber: 10,
        timestamp: new Date(),
        actionsSinceLastReflection: [],
        outcomesSinceLastReflection: [],
        progressAssessment: {
          isOnTrack: true,
          progressRate: 0.3,
          estimatedCompletion: 20,
          blockers: ['Minor issue'],
          achievements: ['Good progress'],
        },
        strategyEvaluation: {
          currentStrategy: 'test-strategy',
          effectiveness: 0.6,
          strengths: ['Working well'],
          weaknesses: [],
          alternativeStrategies: [],
          recommendation: 'adjust',
        },
        learnings: ['Learning 1', 'Learning 2'],
        shouldReplan: false,
        adjustments: ['Minor adjustment needed'],
        nextFocus: 'Continue with improvements',
      };

      const result = agentReflection.applyReflection(reflection, inProgressState);

      expect(result.adjustmentsMade.length).toBeGreaterThan(0);
      expect(result.adjustmentsMade.some(a => a.includes('Learning 1'))).toBe(true);
      expect(result.adjustmentsMade.some(a => a.includes('Learning 2'))).toBe(true);
    });

    it('should set appropriate next focus', () => {
      const reflection: Reflection = {
        id: 'reflection-1',
        sessionId: 'test-session',
        iterationNumber: 10,
        timestamp: new Date(),
        actionsSinceLastReflection: [],
        outcomesSinceLastReflection: [],
        progressAssessment: {
          isOnTrack: true,
          progressRate: 0.3,
          estimatedCompletion: 15,
          blockers: [],
          achievements: [],
        },
        strategyEvaluation: {
          currentStrategy: 'test-strategy',
          effectiveness: 0.8,
          strengths: [],
          weaknesses: [],
          alternativeStrategies: [],
          recommendation: 'continue',
        },
        learnings: [],
        shouldReplan: false,
        adjustments: [],
        nextFocus: 'Focus on synthesis phase',
      };

      const result = agentReflection.applyReflection(reflection, inProgressState);

      expect(result.newFocus).toBe('Focus on synthesis phase');
      expect(result.strategyRecommendation).toBe('continue');
    });
  });

  // ============================================================================
  // State Management Tests (2 tests)
  // ============================================================================

  describe('State Management', () => {
    it('should track reflection statistics', async () => {
      // Initial stats
      let stats = agentReflection.getStatistics();
      expect(stats.reflectionCount).toBe(0);
      expect(stats.lastReflectionIteration).toBe(0);
      expect(stats.reflectionInterval).toBe(5);

      // After first reflection
      await agentReflection.reflect(
        'test-session',
        { ...initialState, iterationCount: 5 },
        [],
        []
      );

      stats = agentReflection.getStatistics();
      expect(stats.reflectionCount).toBe(1);
      expect(stats.lastReflectionIteration).toBe(5);

      // After second reflection
      await agentReflection.reflect(
        'test-session',
        { ...initialState, iterationCount: 10 },
        [],
        []
      );

      stats = agentReflection.getStatistics();
      expect(stats.reflectionCount).toBe(2);
      expect(stats.lastReflectionIteration).toBe(10);
    });

    it('should reset state correctly', async () => {
      // Perform some reflections
      await agentReflection.reflect(
        'test-session',
        { ...initialState, iterationCount: 5 },
        [],
        []
      );
      await agentReflection.reflect(
        'test-session',
        { ...initialState, iterationCount: 10 },
        [],
        []
      );

      let stats = agentReflection.getStatistics();
      expect(stats.reflectionCount).toBeGreaterThan(0);

      // Reset
      agentReflection.reset();

      stats = agentReflection.getStatistics();
      expect(stats.reflectionCount).toBe(0);
      expect(stats.lastReflectionIteration).toBe(0);
    });
  });
});
