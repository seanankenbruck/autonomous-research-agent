/**
 * Mock Research Plan Fixtures
 * Provides realistic plan data for testing planning and execution
 */

import { v4 as uuidv4 } from 'uuid';
import type { ResearchPlan, PlannedStep } from '../../../src/agent/types';

/**
 * Create a mock research plan with optional overrides
 */
export function createMockPlan(overrides?: Partial<ResearchPlan>): ResearchPlan {
  const id = overrides?.id || uuidv4();
  const createdAt = overrides?.createdAt || new Date('2024-01-15T10:00:00Z');

  return {
    id,
    strategy: overrides?.strategy || 'general-research',
    steps: overrides?.steps || [],
    estimatedDuration: overrides?.estimatedDuration || 300,
    createdAt,
    revisedAt: overrides?.revisedAt,
    revisionReason: overrides?.revisionReason,
  };
}

/**
 * Create a mock planned step
 */
export function createMockStep(overrides?: Partial<PlannedStep>): PlannedStep {
  return {
    id: overrides?.id || `step-${Date.now()}`,
    description: overrides?.description || 'Execute step',
    action: overrides?.action || 'search',
    dependencies: overrides?.dependencies || [],
    status: overrides?.status || 'pending',
    expectedOutcome: overrides?.expectedOutcome || 'Expected result',
  };
}

/**
 * Basic linear plan (no dependencies)
 */
export const basicPlan: ResearchPlan = {
  id: 'plan-basic-1',
  strategy: 'comprehensive_research',
  steps: [
    {
      id: 'step-1',
      description: 'Search for initial information',
      action: 'search',
      dependencies: [],
      status: 'pending',
      expectedOutcome: 'List of relevant sources',
    },
    {
      id: 'step-2',
      description: 'Fetch content from top sources',
      action: 'fetch',
      dependencies: ['step-1'],
      status: 'pending',
      expectedOutcome: 'Detailed content from sources',
    },
    {
      id: 'step-3',
      description: 'Analyze content for key facts',
      action: 'analyze',
      dependencies: ['step-2'],
      status: 'pending',
      expectedOutcome: 'Extracted facts and entities',
    },
    {
      id: 'step-4',
      description: 'Search for additional information to fill gaps',
      action: 'search',
      dependencies: ['step-3'],
      status: 'pending',
      expectedOutcome: 'Additional sources addressing gaps',
    },
    {
      id: 'step-5',
      description: 'Synthesize findings into final output',
      action: 'synthesize',
      dependencies: ['step-3', 'step-4'],
      status: 'pending',
      expectedOutcome: 'Comprehensive synthesis',
    },
  ],
  estimatedDuration: 300,
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

/**
 * Complex plan with parallel branches and dependencies
 */
export const complexPlan: ResearchPlan = {
  id: 'plan-complex-1',
  strategy: 'parallel_research',
  steps: [
    {
      id: 'step-1',
      description: 'Search academic sources',
      action: 'search',
      dependencies: [],
      status: 'pending',
      expectedOutcome: 'Academic papers and articles',
    },
    {
      id: 'step-2',
      description: 'Search industry sources',
      action: 'search',
      dependencies: [],
      status: 'pending',
      expectedOutcome: 'Industry reports and blogs',
    },
    {
      id: 'step-3',
      description: 'Fetch academic content',
      action: 'fetch',
      dependencies: ['step-1'],
      status: 'pending',
      expectedOutcome: 'Academic content',
    },
    {
      id: 'step-4',
      description: 'Fetch industry content',
      action: 'fetch',
      dependencies: ['step-2'],
      status: 'pending',
      expectedOutcome: 'Industry content',
    },
    {
      id: 'step-5',
      description: 'Analyze academic sources',
      action: 'analyze',
      dependencies: ['step-3'],
      status: 'pending',
      expectedOutcome: 'Academic insights',
    },
    {
      id: 'step-6',
      description: 'Analyze industry sources',
      action: 'analyze',
      dependencies: ['step-4'],
      status: 'pending',
      expectedOutcome: 'Industry insights',
    },
    {
      id: 'step-7',
      description: 'Synthesize all findings',
      action: 'synthesize',
      dependencies: ['step-5', 'step-6'],
      status: 'pending',
      expectedOutcome: 'Integrated synthesis',
    },
  ],
  estimatedDuration: 450,
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

/**
 * Adaptive plan (revised during execution)
 */
export const adaptivePlan: ResearchPlan = {
  id: 'plan-adaptive-1',
  strategy: 'adaptive_research',
  steps: [
    {
      id: 'step-1',
      description: 'Initial search',
      action: 'search',
      dependencies: [],
      status: 'completed',
      expectedOutcome: 'Initial sources',
    },
    {
      id: 'step-2',
      description: 'Fetch promising sources',
      action: 'fetch',
      dependencies: ['step-1'],
      status: 'completed',
      expectedOutcome: 'Source content',
    },
    {
      id: 'step-3',
      description: 'Deep dive search based on initial findings',
      action: 'search',
      dependencies: ['step-2'],
      status: 'in_progress',
      expectedOutcome: 'More specific sources',
    },
    {
      id: 'step-4',
      description: 'Analyze all gathered content',
      action: 'analyze',
      dependencies: ['step-3'],
      status: 'pending',
      expectedOutcome: 'Comprehensive analysis',
    },
  ],
  estimatedDuration: 240,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  revisedAt: new Date('2024-01-15T10:15:00Z'),
  revisionReason: 'Initial search revealed need for more specific queries',
};

/**
 * Quick plan for simple tasks
 */
export const quickPlan: ResearchPlan = {
  id: 'plan-quick-1',
  strategy: 'quick_lookup',
  steps: [
    {
      id: 'step-1',
      description: 'Search for answer',
      action: 'search',
      dependencies: [],
      status: 'pending',
      expectedOutcome: 'Direct answer',
    },
    {
      id: 'step-2',
      description: 'Verify from multiple sources',
      action: 'search',
      dependencies: [],
      status: 'pending',
      expectedOutcome: 'Verification',
    },
  ],
  estimatedDuration: 60,
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

/**
 * Iterative plan with repeated steps
 */
export const iterativePlan: ResearchPlan = {
  id: 'plan-iterative-1',
  strategy: 'iterative_deepening',
  steps: [
    {
      id: 'step-1',
      description: 'Broad search - iteration 1',
      action: 'search',
      dependencies: [],
      status: 'completed',
      expectedOutcome: 'Initial landscape',
    },
    {
      id: 'step-2',
      description: 'Analyze initial results',
      action: 'analyze',
      dependencies: ['step-1'],
      status: 'completed',
      expectedOutcome: 'Key themes identified',
    },
    {
      id: 'step-3',
      description: 'Focused search - iteration 2',
      action: 'search',
      dependencies: ['step-2'],
      status: 'in_progress',
      expectedOutcome: 'Deeper information',
    },
    {
      id: 'step-4',
      description: 'Analyze focused results',
      action: 'analyze',
      dependencies: ['step-3'],
      status: 'pending',
      expectedOutcome: 'Detailed insights',
    },
    {
      id: 'step-5',
      description: 'Final synthesis',
      action: 'synthesize',
      dependencies: ['step-2', 'step-4'],
      status: 'pending',
      expectedOutcome: 'Complete synthesis',
    },
  ],
  estimatedDuration: 360,
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

/**
 * Failed plan (many steps failed)
 */
export const failedPlan: ResearchPlan = {
  id: 'plan-failed-1',
  strategy: 'comprehensive_research',
  steps: [
    {
      id: 'step-1',
      description: 'Search for sources',
      action: 'search',
      dependencies: [],
      status: 'failed',
      expectedOutcome: 'Sources',
    },
    {
      id: 'step-2',
      description: 'Fetch content',
      action: 'fetch',
      dependencies: ['step-1'],
      status: 'skipped',
      expectedOutcome: 'Content',
    },
    {
      id: 'step-3',
      description: 'Analyze content',
      action: 'analyze',
      dependencies: ['step-2'],
      status: 'skipped',
      expectedOutcome: 'Analysis',
    },
  ],
  estimatedDuration: 180,
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

/**
 * Plans by strategy type
 */
export const plansByStrategy = {
  comprehensive: [basicPlan],
  parallel: [complexPlan],
  adaptive: [adaptivePlan],
  quick: [quickPlan],
  iterative: [iterativePlan],
};

/**
 * Array of sample plans for batch testing
 */
export const mockPlanArray: ResearchPlan[] = [
  basicPlan,
  complexPlan,
  adaptivePlan,
  quickPlan,
  iterativePlan,
];

/**
 * Generate a plan with specified number of steps
 */
export function generatePlanWithSteps(
  stepCount: number,
  withDependencies: boolean = true
): ResearchPlan {
  const steps: PlannedStep[] = [];

  for (let i = 0; i < stepCount; i++) {
    const stepId = `step-${i + 1}`;
    const dependencies: string[] = [];

    // Add dependency on previous step if requested
    if (withDependencies && i > 0) {
      dependencies.push(`step-${i}`);
    }

    steps.push({
      id: stepId,
      description: `Step ${i + 1} description`,
      action: ['search', 'fetch', 'analyze', 'synthesize'][i % 4],
      dependencies,
      status: 'pending',
      expectedOutcome: `Outcome ${i + 1}`,
    });
  }

  return createMockPlan({
    steps,
    estimatedDuration: stepCount * 60,
  });
}

/**
 * Generate a plan with steps in various states
 */
export function generatePlanWithMixedStatuses(
  completed: number,
  inProgress: number,
  pending: number,
  failed: number
): ResearchPlan {
  const steps: PlannedStep[] = [];
  let stepNum = 1;

  const addSteps = (count: number, status: PlannedStep['status']) => {
    for (let i = 0; i < count; i++) {
      steps.push({
        id: `step-${stepNum}`,
        description: `Step ${stepNum}`,
        action: 'search',
        dependencies: stepNum > 1 ? [`step-${stepNum - 1}`] : [],
        status,
        expectedOutcome: `Outcome ${stepNum}`,
      });
      stepNum++;
    }
  };

  addSteps(completed, 'completed');
  addSteps(inProgress, 'in_progress');
  addSteps(pending, 'pending');
  addSteps(failed, 'failed');

  return createMockPlan({
    steps,
    estimatedDuration: steps.length * 60,
  });
}

/**
 * Create a plan with parallel branches
 */
export function createParallelPlan(branchCount: number): ResearchPlan {
  const steps: PlannedStep[] = [];
  let stepNum = 1;

  // Create initial step
  steps.push({
    id: `step-${stepNum++}`,
    description: 'Initial step',
    action: 'search',
    dependencies: [],
    status: 'pending',
    expectedOutcome: 'Initial results',
  });

  // Create parallel branches
  const branchHeads: string[] = [];
  for (let i = 0; i < branchCount; i++) {
    const branchStepId = `step-${stepNum++}`;
    steps.push({
      id: branchStepId,
      description: `Branch ${i + 1} step`,
      action: ['fetch', 'analyze'][i % 2],
      dependencies: ['step-1'],
      status: 'pending',
      expectedOutcome: `Branch ${i + 1} result`,
    });
    branchHeads.push(branchStepId);
  }

  // Create final synthesis step depending on all branches
  steps.push({
    id: `step-${stepNum}`,
    description: 'Synthesize all branches',
    action: 'synthesize',
    dependencies: branchHeads,
    status: 'pending',
    expectedOutcome: 'Final synthesis',
  });

  return createMockPlan({
    steps,
    strategy: 'parallel_research',
    estimatedDuration: (branchCount + 2) * 60,
  });
}
