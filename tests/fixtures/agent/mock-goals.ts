/**
 * Mock Goal Fixtures
 * Provides realistic goal data for testing planning and execution
 */

import type { Goal } from '../../../src/agent/types';

/**
 * Create a mock goal with optional overrides
 */
export function createMockGoal(overrides?: Partial<Goal>): Goal {
  return {
    description: overrides?.description || 'Research topic',
    successCriteria: overrides?.successCriteria || ['Gather information', 'Analyze findings'],
    constraints: overrides?.constraints,
    estimatedComplexity: overrides?.estimatedComplexity || 'moderate',
  };
}

/**
 * Simple goal fixture - straightforward research
 */
export const simpleGoal: Goal = {
  description: 'Find information about machine learning basics',
  successCriteria: [
    'Find at least 5 credible sources',
    'Extract key definitions and concepts',
  ],
  estimatedComplexity: 'simple',
};

/**
 * Moderate complexity goal
 */
export const moderateGoal: Goal = {
  description: 'Research autonomous research agents and their capabilities',
  successCriteria: [
    'Find at least 10 credible sources',
    'Extract key concepts and definitions',
    'Identify current state-of-the-art approaches',
    'Summarize main architectural patterns',
  ],
  constraints: [
    'Focus on sources from last 3 years',
    'Prioritize academic sources',
  ],
  estimatedComplexity: 'moderate',
};

/**
 * Complex goal with many criteria
 */
export const complexGoal: Goal = {
  description: 'Comprehensive analysis of memory systems in autonomous agents',
  successCriteria: [
    'Identify all major memory system architectures',
    'Compare effectiveness across different approaches',
    'Extract implementation details and trade-offs',
    'Find empirical performance data',
    'Identify gaps in current research',
    'Synthesize recommendations for best practices',
  ],
  constraints: [
    'Only peer-reviewed sources',
    'Must include quantitative comparisons',
    'Cover at least 5 different memory architectures',
  ],
  estimatedComplexity: 'complex',
};

/**
 * Goal with strict constraints
 */
export const constrainedGoal: Goal = {
  description: 'Research recent developments in large language models',
  successCriteria: [
    'Find developments from 2024',
    'Extract key breakthroughs',
    'Identify industry applications',
  ],
  constraints: [
    'Only sources from 2024',
    'Exclude opinion pieces',
    'Maximum 20 sources',
    'Focus on GPT-4 and later models',
  ],
  estimatedComplexity: 'moderate',
};

/**
 * Technical research goal
 */
export const technicalGoal: Goal = {
  description: 'Investigate vector database implementations for embedding storage',
  successCriteria: [
    'Compare at least 3 vector database solutions',
    'Extract performance benchmarks',
    'Identify use cases and limitations',
    'Find implementation examples',
  ],
  constraints: [
    'Focus on production-ready solutions',
    'Include cost analysis',
  ],
  estimatedComplexity: 'moderate',
};

/**
 * Exploratory research goal (less defined)
 */
export const exploratoryGoal: Goal = {
  description: 'Explore emerging trends in AI agent architectures',
  successCriteria: [
    'Identify new patterns and approaches',
    'Find recent innovations',
    'Understand current research directions',
  ],
  estimatedComplexity: 'complex',
};

/**
 * Quick fact-finding goal
 */
export const quickGoal: Goal = {
  description: 'Find the capital of France',
  successCriteria: [
    'Identify the correct answer',
    'Verify from multiple sources',
  ],
  estimatedComplexity: 'simple',
};

/**
 * Comparative analysis goal
 */
export const comparativeGoal: Goal = {
  description: 'Compare React vs Vue.js for modern web development',
  successCriteria: [
    'List key differences in architecture',
    'Compare performance characteristics',
    'Identify use case recommendations',
    'Find recent community sentiment',
  ],
  constraints: [
    'Use data from 2023-2024',
    'Include both technical and ecosystem factors',
  ],
  estimatedComplexity: 'moderate',
};

/**
 * Historical research goal
 */
export const historicalGoal: Goal = {
  description: 'Trace the evolution of neural network architectures',
  successCriteria: [
    'Identify major milestones from 1980s to present',
    'Extract key innovations at each stage',
    'Connect developments to modern architectures',
  ],
  constraints: [
    'Focus on image processing domain',
    'Include AlexNet, ResNet, Transformers',
  ],
  estimatedComplexity: 'complex',
};

/**
 * Goals by complexity for filtered testing
 */
export const goalsByComplexity = {
  simple: [simpleGoal, quickGoal],
  moderate: [moderateGoal, constrainedGoal, technicalGoal, comparativeGoal],
  complex: [complexGoal, exploratoryGoal, historicalGoal],
};

/**
 * Array of sample goals for batch testing
 */
export const mockGoalArray: Goal[] = [
  simpleGoal,
  moderateGoal,
  complexGoal,
  constrainedGoal,
  technicalGoal,
];

/**
 * Generate goals with varying criteria counts
 */
export function generateGoalsWithCriteria(
  baseDescription: string,
  criteriaCount: number
): Goal {
  const criteria: string[] = [];
  for (let i = 1; i <= criteriaCount; i++) {
    criteria.push(`Success criterion ${i}`);
  }

  return createMockGoal({
    description: baseDescription,
    successCriteria: criteria,
    estimatedComplexity: criteriaCount <= 2 ? 'simple' : criteriaCount <= 4 ? 'moderate' : 'complex',
  });
}

/**
 * Generate goals with varying constraint counts
 */
export function generateGoalsWithConstraints(
  baseDescription: string,
  constraintCount: number
): Goal {
  const constraints: string[] = [];
  for (let i = 1; i <= constraintCount; i++) {
    constraints.push(`Constraint ${i}`);
  }

  return createMockGoal({
    description: baseDescription,
    successCriteria: ['Complete the task'],
    constraints,
    estimatedComplexity: 'moderate',
  });
}

/**
 * Create a goal matching a specific complexity level
 */
export function createGoalWithComplexity(
  complexity: 'simple' | 'moderate' | 'complex'
): Goal {
  const goals = goalsByComplexity[complexity];
  return goals[0];
}
