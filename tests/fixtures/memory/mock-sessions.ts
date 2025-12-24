/**
 * Mock Session Fixtures
 * Provides realistic session data for testing
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Session,
  Goal,
  AgentState,
  SessionStatus,
} from '../../../src/agent/types';

/**
 * Create a mock session with optional overrides
 */
export function createMockSession(overrides?: Partial<Session>): Session {
  const id = overrides?.id || uuidv4();
  const createdAt = overrides?.createdAt || new Date('2024-01-15T10:00:00Z');

  const defaultGoal: Goal = {
    description: 'Research autonomous agents and their capabilities',
    successCriteria: [
      'Find at least 10 credible sources',
      'Extract key concepts and definitions',
      'Identify current state-of-the-art approaches',
    ],
    constraints: ['Focus on sources from last 3 years', 'Prioritize academic sources'],
    estimatedComplexity: 'moderate',
  };

  const defaultState: AgentState = {
    sessionId: id,
    currentGoal: overrides?.goal || defaultGoal,
    plan: {
      id: uuidv4(),
      strategy: 'comprehensive_research',
      steps: [
        {
          id: 'step-1',
          description: 'Search for recent papers on autonomous agents',
          action: 'web_search',
          dependencies: [],
          status: 'completed',
          expectedOutcome: 'List of relevant papers',
        },
        {
          id: 'step-2',
          description: 'Analyze top sources for key concepts',
          action: 'analyze_content',
          dependencies: ['step-1'],
          status: 'in_progress',
          expectedOutcome: 'Extracted concepts and definitions',
        },
      ],
      estimatedDuration: 1800,
      createdAt,
    },
    progress: {
      stepsCompleted: 1,
      stepsTotal: 5,
      sourcesGathered: 12,
      factsExtracted: 8,
      currentPhase: 'analyzing',
      confidence: 0.7,
    },
    workingMemory: {
      recentActions: [],
      recentOutcomes: [],
      keyFindings: [],
      openQuestions: [
        'What are the main architectural patterns?',
        'How do agents handle uncertainty?',
      ],
      hypotheses: [
        {
          id: 'hyp-1',
          statement: 'Agents with reflection capabilities perform better',
          confidence: 0.8,
          supportingEvidence: ['finding-1', 'finding-2'],
          contradictingEvidence: [],
          status: 'active',
        },
      ],
    },
    reflections: [],
    iterationCount: 5,
    lastActionTimestamp: createdAt,
  };

  return {
    id,
    userId: 'test-user-1',
    topic: 'Autonomous Agents Research',
    goal: overrides?.goal || defaultGoal,
    state: overrides?.state || defaultState,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

/**
 * Active session - currently in progress
 */
export const activeSession: Session = createMockSession({
  id: 'session-active-1',
  topic: 'Machine Learning Best Practices',
  status: 'active',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:30:00Z'),
});

/**
 * Completed session - successfully finished
 */
export const completedSession: Session = createMockSession({
  id: 'session-completed-1',
  topic: 'Neural Network Architectures',
  status: 'completed',
  createdAt: new Date('2024-01-14T09:00:00Z'),
  updatedAt: new Date('2024-01-14T11:00:00Z'),
  completedAt: new Date('2024-01-14T11:00:00Z'),
  state: {
    ...createMockSession().state,
    progress: {
      stepsCompleted: 5,
      stepsTotal: 5,
      sourcesGathered: 25,
      factsExtracted: 40,
      currentPhase: 'completed',
      confidence: 0.95,
    },
  },
});

/**
 * Failed session - encountered errors
 */
export const failedSession: Session = createMockSession({
  id: 'session-failed-1',
  topic: 'Quantum Computing Applications',
  status: 'failed',
  createdAt: new Date('2024-01-13T14:00:00Z'),
  updatedAt: new Date('2024-01-13T14:15:00Z'),
  completedAt: new Date('2024-01-13T14:15:00Z'),
  state: {
    ...createMockSession().state,
    progress: {
      stepsCompleted: 1,
      stepsTotal: 5,
      sourcesGathered: 2,
      factsExtracted: 0,
      currentPhase: 'gathering',
      confidence: 0.2,
    },
  },
});

/**
 * Paused session - temporarily suspended
 */
export const pausedSession: Session = createMockSession({
  id: 'session-paused-1',
  topic: 'Distributed Systems Design',
  status: 'paused',
  createdAt: new Date('2024-01-12T08:00:00Z'),
  updatedAt: new Date('2024-01-12T09:30:00Z'),
});

/**
 * Session with reflections - has reflection data
 */
export const sessionWithReflections: Session = createMockSession({
  id: 'session-reflections-1',
  topic: 'Agent Reasoning Patterns',
  status: 'active',
  createdAt: new Date('2024-01-15T08:00:00Z'),
  state: {
    ...createMockSession().state,
    reflections: [
      {
        id: 'reflection-1',
        sessionId: 'session-reflections-1',
        iterationNumber: 3,
        timestamp: new Date('2024-01-15T08:15:00Z'),
        actionsSinceLastReflection: ['action-1', 'action-2', 'action-3'],
        outcomesSinceLastReflection: ['outcome-1', 'outcome-2'],
        progressAssessment: {
          isOnTrack: true,
          progressRate: 0.5,
          estimatedCompletion: 10,
          blockers: [],
          achievements: ['Found 5 high-quality sources'],
        },
        strategyEvaluation: {
          currentStrategy: 'comprehensive_research',
          effectiveness: 0.8,
          strengths: ['Good source diversity', 'High-quality findings'],
          weaknesses: ['Could be faster'],
          alternativeStrategies: ['focused_deep_dive'],
          recommendation: 'continue',
        },
        learnings: ['Academic sources provide better depth', 'Need to verify claims'],
        shouldReplan: false,
        adjustments: [],
        nextFocus: 'Continue analyzing gathered sources',
      },
    ],
    iterationCount: 8,
  },
});

/**
 * Parent session for testing hierarchies
 */
export const parentSession: Session = createMockSession({
  id: 'session-parent-1',
  topic: 'AI Safety Overview',
  status: 'completed',
  createdAt: new Date('2024-01-10T10:00:00Z'),
  completedAt: new Date('2024-01-10T12:00:00Z'),
});

/**
 * Child session that references parent
 */
export const childSession: Session = createMockSession({
  id: 'session-child-1',
  topic: 'AI Safety - Alignment Problem',
  status: 'active',
  parentSessionId: 'session-parent-1',
  createdAt: new Date('2024-01-11T10:00:00Z'),
});

/**
 * Collection of all mock sessions
 */
export const mockSessions = {
  activeSession,
  completedSession,
  failedSession,
  pausedSession,
  withReflections: sessionWithReflections,
  parentSession,
  childSession,
};

/**
 * Array of diverse sessions for bulk testing
 */
export const mockSessionArray: Session[] = [
  activeSession,
  completedSession,
  failedSession,
  pausedSession,
  sessionWithReflections,
];

/**
 * Sessions grouped by status
 */
export const sessionsByStatus: Record<SessionStatus, Session[]> = {
  active: [activeSession, sessionWithReflections, childSession],
  completed: [completedSession, parentSession],
  failed: [failedSession],
  paused: [pausedSession],
  cancelled: [],
};
