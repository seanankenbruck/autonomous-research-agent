/**
 * Mock Agent State Fixtures
 * Provides realistic agent state data for testing execution
 */

import { v4 as uuidv4 } from 'uuid';
import type { AgentState, WorkingMemory, Progress, ResearchPhase } from '../../../src/agent/types';
import { basicPlan, adaptivePlan } from './mock-plans';
import { moderateGoal, simpleGoal } from './mock-goals';

/**
 * Create a mock agent state with optional overrides
 */
export function createMockState(overrides?: Partial<AgentState>): AgentState {
  const sessionId = overrides?.sessionId || uuidv4();

  const defaultWorkingMemory: WorkingMemory = {
    recentActions: [],
    recentOutcomes: [],
    keyFindings: [],
    openQuestions: [],
    hypotheses: [],
  };

  const defaultProgress: Progress = {
    stepsCompleted: 0,
    stepsTotal: 5,
    sourcesGathered: 0,
    factsExtracted: 0,
    currentPhase: 'planning',
    confidence: 0.5,
  };

  return {
    sessionId,
    currentGoal: overrides?.currentGoal || simpleGoal,
    plan: overrides?.plan || basicPlan,
    progress: overrides?.progress || defaultProgress,
    workingMemory: overrides?.workingMemory || defaultWorkingMemory,
    reflections: overrides?.reflections || [],
    iterationCount: overrides?.iterationCount || 0,
    lastActionTimestamp: overrides?.lastActionTimestamp || new Date('2024-01-15T10:00:00Z'),
  };
}

/**
 * Initial state (just started)
 */
export const initialState: AgentState = {
  sessionId: 'session-initial-1',
  currentGoal: simpleGoal,
  plan: basicPlan,
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
  lastActionTimestamp: new Date('2024-01-15T10:00:00Z'),
};

/**
 * In-progress state (mid-execution)
 */
export const inProgressState: AgentState = {
  sessionId: 'session-progress-1',
  currentGoal: moderateGoal,
  plan: adaptivePlan,
  progress: {
    stepsCompleted: 2,
    stepsTotal: 5,
    sourcesGathered: 8,
    factsExtracted: 12,
    currentPhase: 'analyzing',
    confidence: 0.7,
  },
  workingMemory: {
    recentActions: [],
    recentOutcomes: [],
    keyFindings: [
      {
        id: 'finding-1',
        content: 'Autonomous agents use memory systems for context management',
        source: {
          url: 'https://example.com/paper1',
          title: 'Memory Systems for Agents',
          type: 'academic',
          author: 'Dr. Smith',
        },
        confidence: 0.9,
        relevance: 0.95,
        timestamp: new Date('2024-01-15T10:15:00Z'),
        verificationStatus: 'verified',
        relatedFindings: [],
      },
      {
        id: 'finding-2',
        content: 'ReAct pattern combines reasoning and acting effectively',
        source: {
          url: 'https://example.com/paper2',
          title: 'ReAct Framework',
          type: 'academic',
          author: 'Dr. Jones',
        },
        confidence: 0.85,
        relevance: 0.9,
        timestamp: new Date('2024-01-15T10:20:00Z'),
        verificationStatus: 'verified',
        relatedFindings: ['finding-1'],
      },
    ],
    openQuestions: [
      'How do agents handle uncertainty in decision-making?',
      'What are the scalability limits of current memory systems?',
    ],
    hypotheses: [
      {
        id: 'hyp-1',
        statement: 'Reflection mechanisms improve agent performance over time',
        confidence: 0.75,
        supportingEvidence: ['finding-1'],
        contradictingEvidence: [],
        status: 'active',
      },
    ],
  },
  reflections: [],
  iterationCount: 5,
  lastActionTimestamp: new Date('2024-01-15T10:20:00Z'),
};

/**
 * Completed state (research finished)
 */
export const completedState: AgentState = {
  sessionId: 'session-completed-1',
  currentGoal: simpleGoal,
  plan: basicPlan,
  progress: {
    stepsCompleted: 5,
    stepsTotal: 5,
    sourcesGathered: 15,
    factsExtracted: 25,
    currentPhase: 'completed',
    confidence: 0.9,
  },
  workingMemory: {
    recentActions: [],
    recentOutcomes: [],
    keyFindings: [
      {
        id: 'finding-1',
        content: 'Comprehensive finding 1',
        source: {
          url: 'https://example.com/1',
          title: 'Source 1',
          type: 'academic',
        },
        confidence: 0.95,
        relevance: 1.0,
        timestamp: new Date('2024-01-15T10:30:00Z'),
        verificationStatus: 'verified',
        relatedFindings: [],
      },
    ],
    openQuestions: [],
    hypotheses: [
      {
        id: 'hyp-1',
        statement: 'Hypothesis confirmed',
        confidence: 0.95,
        supportingEvidence: ['finding-1'],
        contradictingEvidence: [],
        status: 'confirmed',
      },
    ],
  },
  reflections: [],
  iterationCount: 12,
  lastActionTimestamp: new Date('2024-01-15T10:35:00Z'),
};

/**
 * Low confidence state (struggling)
 */
export const lowConfidenceState: AgentState = {
  sessionId: 'session-lowconf-1',
  currentGoal: moderateGoal,
  plan: basicPlan,
  progress: {
    stepsCompleted: 3,
    stepsTotal: 5,
    sourcesGathered: 4,
    factsExtracted: 2,
    currentPhase: 'gathering',
    confidence: 0.3,
  },
  workingMemory: {
    recentActions: [],
    recentOutcomes: [],
    keyFindings: [],
    openQuestions: [
      'Unable to find reliable sources',
      'Conflicting information found',
      'Need more specific search terms',
    ],
    hypotheses: [],
  },
  reflections: [],
  iterationCount: 8,
  lastActionTimestamp: new Date('2024-01-15T10:25:00Z'),
};

/**
 * High iteration state (many attempts)
 */
export const highIterationState: AgentState = {
  sessionId: 'session-highiter-1',
  currentGoal: moderateGoal,
  plan: adaptivePlan,
  progress: {
    stepsCompleted: 2,
    stepsTotal: 5,
    sourcesGathered: 20,
    factsExtracted: 30,
    currentPhase: 'analyzing',
    confidence: 0.65,
  },
  workingMemory: {
    recentActions: [],
    recentOutcomes: [],
    keyFindings: [],
    openQuestions: ['Need to synthesize findings'],
    hypotheses: [],
  },
  reflections: [],
  iterationCount: 45,
  lastActionTimestamp: new Date('2024-01-15T11:00:00Z'),
};

/**
 * State with many reflections
 */
export const reflectiveState: AgentState = {
  sessionId: 'session-reflective-1',
  currentGoal: moderateGoal,
  plan: adaptivePlan,
  progress: {
    stepsCompleted: 3,
    stepsTotal: 5,
    sourcesGathered: 12,
    factsExtracted: 18,
    currentPhase: 'synthesizing',
    confidence: 0.75,
  },
  workingMemory: {
    recentActions: [],
    recentOutcomes: [],
    keyFindings: [],
    openQuestions: [],
    hypotheses: [],
  },
  reflections: [
    {
      id: 'reflection-1',
      sessionId: 'session-reflective-1',
      iterationNumber: 5,
      timestamp: new Date('2024-01-15T10:10:00Z'),
      actionsSinceLastReflection: ['search', 'fetch'],
      outcomesSinceLastReflection: ['SUCCESS', 'SUCCESS'],
      progressAssessment: {
        isOnTrack: true,
        progressRate: 0.8,
        estimatedCompletion: 5,
        blockers: [],
        achievements: ['Found good sources'],
      },
      strategyEvaluation: {
        currentStrategy: 'comprehensive_research',
        effectiveness: 0.8,
        strengths: ['Good source quality'],
        weaknesses: [],
        alternativeStrategies: [],
        recommendation: 'continue',
      },
      learnings: ['Search strategy is working well'],
      shouldReplan: false,
      adjustments: [],
      nextFocus: 'Continue gathering',
    },
    {
      id: 'reflection-2',
      sessionId: 'session-reflective-1',
      iterationNumber: 10,
      timestamp: new Date('2024-01-15T10:20:00Z'),
      actionsSinceLastReflection: ['analyze', 'search'],
      outcomesSinceLastReflection: ['SUCCESS', 'FAILURE'],
      progressAssessment: {
        isOnTrack: true,
        progressRate: 0.75,
        estimatedCompletion: 5,
        blockers: ['One failed search'],
        achievements: ['Good analysis results'],
      },
      strategyEvaluation: {
        currentStrategy: 'comprehensive_research',
        effectiveness: 0.75,
        strengths: ['Good analysis'],
        weaknesses: ['Some search failures'],
        alternativeStrategies: ['Try different keywords'],
        recommendation: 'adjust',
      },
      learnings: ['Analyze works well', 'Need better search terms'],
      shouldReplan: false,
      adjustments: ['Improve search queries'],
      nextFocus: 'Refine search approach',
    },
  ],
  iterationCount: 15,
  lastActionTimestamp: new Date('2024-01-15T10:30:00Z'),
};

/**
 * States by phase
 */
export const statesByPhase: Record<ResearchPhase, AgentState> = {
  planning: initialState,
  gathering: lowConfidenceState,
  analyzing: inProgressState,
  synthesizing: reflectiveState,
  verifying: inProgressState,
  completed: completedState,
};

/**
 * Array of sample states for batch testing
 */
export const mockStateArray: AgentState[] = [
  initialState,
  inProgressState,
  completedState,
  lowConfidenceState,
  highIterationState,
  reflectiveState,
];

/**
 * Generate state at specific progress level
 */
export function generateStateAtProgress(
  sessionId: string,
  stepsCompleted: number,
  stepsTotal: number,
  confidence: number
): AgentState {
  const phase: ResearchPhase =
    stepsCompleted === 0 ? 'planning' :
    stepsCompleted < stepsTotal * 0.4 ? 'gathering' :
    stepsCompleted < stepsTotal * 0.7 ? 'analyzing' :
    stepsCompleted < stepsTotal ? 'synthesizing' :
    'completed';

  return createMockState({
    sessionId,
    progress: {
      stepsCompleted,
      stepsTotal,
      sourcesGathered: stepsCompleted * 3,
      factsExtracted: stepsCompleted * 2,
      currentPhase: phase,
      confidence,
    },
    iterationCount: stepsCompleted * 2,
  });
}

/**
 * Generate state with specific working memory size
 */
export function generateStateWithMemorySize(
  sessionId: string,
  actionCount: number,
  findingCount: number
): AgentState {
  const actions = Array(actionCount).fill(null);
  const findings = Array(findingCount).fill(null).map((_, i) => ({
    id: `finding-${i}`,
    content: `Finding ${i}`,
    source: {
      url: `https://example.com/${i}`,
      title: `Source ${i}`,
      type: 'webpage' as const,
    },
    confidence: 0.8,
    relevance: 0.8,
    timestamp: new Date(),
    verificationStatus: 'unverified' as const,
    relatedFindings: [],
  }));

  return createMockState({
    sessionId,
    workingMemory: {
      recentActions: actions,
      recentOutcomes: [],
      keyFindings: findings,
      openQuestions: [],
      hypotheses: [],
    },
  });
}

/**
 * Create state in specific phase
 */
export function createStateInPhase(phase: ResearchPhase): AgentState {
  return statesByPhase[phase];
}
