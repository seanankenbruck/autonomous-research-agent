/**
 * Mock Procedural Memory (Strategies) Fixtures
 * Provides realistic strategy data for testing
 */

import { v4 as uuidv4 } from 'uuid';
import type { ProceduralMemory, Refinement } from '../../../src/agent/types';

/**
 * Create a mock procedural memory (strategy) with optional overrides
 */
export function createMockStrategy(
  overrides?: Partial<ProceduralMemory>
): ProceduralMemory {
  const id = overrides?.id || uuidv4();
  const createdAt = overrides?.createdAt || new Date('2024-01-10T10:00:00Z');

  return {
    id,
    strategyName: overrides?.strategyName || 'basic_search_strategy',
    description:
      overrides?.description ||
      'Basic strategy for searching and gathering information',
    applicableContexts: overrides?.applicableContexts || [
      'general research',
      'information gathering',
    ],
    requiredTools: overrides?.requiredTools || ['web_search', 'web_fetch'],
    successRate: overrides?.successRate !== undefined ? overrides.successRate : 0.75,
    averageDuration:
      overrides?.averageDuration !== undefined ? overrides.averageDuration : 5000,
    timesUsed: overrides?.timesUsed !== undefined ? overrides.timesUsed : 10,
    refinements: overrides?.refinements || [],
    createdAt,
    lastUsed: overrides?.lastUsed || createdAt,
    lastRefined: overrides?.lastRefined || createdAt,
  };
}

/**
 * High success rate strategy
 */
export const highSuccessStrategy: ProceduralMemory = createMockStrategy({
  id: 'strategy-high-success-1',
  strategyName: 'comprehensive_research',
  description:
    'Thorough research strategy with verification and cross-referencing',
  applicableContexts: [
    'academic research',
    'technical investigation',
    'fact-checking',
  ],
  requiredTools: [
    'web_search',
    'web_fetch',
    'content_analyzer',
    'fact_checker',
    'synthesizer',
  ],
  successRate: 0.92,
  averageDuration: 12000,
  timesUsed: 45,
  refinements: [
    {
      id: 'refinement-1',
      timestamp: new Date('2024-01-12T10:00:00Z'),
      reason: 'Added fact-checking step to improve accuracy',
      change: 'Included fact_checker tool in workflow',
      expectedImprovement: 'Increase accuracy by 10%',
      actualImprovement: 0.12,
    },
  ],
  createdAt: new Date('2023-12-01T10:00:00Z'),
  lastUsed: new Date('2024-01-15T10:00:00Z'),
  lastRefined: new Date('2024-01-12T10:00:00Z'),
});

/**
 * Low success rate strategy (needs improvement)
 */
export const lowSuccessStrategy: ProceduralMemory = createMockStrategy({
  id: 'strategy-low-success-1',
  strategyName: 'quick_scan',
  description: 'Fast but shallow information gathering',
  applicableContexts: ['quick overview', 'preliminary research'],
  requiredTools: ['web_search'],
  successRate: 0.45,
  averageDuration: 2000,
  timesUsed: 20,
  refinements: [
    {
      id: 'refinement-low-1',
      timestamp: new Date('2024-01-11T10:00:00Z'),
      reason: 'Too shallow, missing important details',
      change: 'Attempted to add more search terms',
      expectedImprovement: 'Increase coverage by 20%',
      actualImprovement: 0.05,
    },
  ],
  createdAt: new Date('2024-01-05T10:00:00Z'),
  lastUsed: new Date('2024-01-14T10:00:00Z'),
  lastRefined: new Date('2024-01-11T10:00:00Z'),
});

/**
 * Frequently used strategy
 */
export const frequentlyUsedStrategy: ProceduralMemory = createMockStrategy({
  id: 'strategy-frequent-1',
  strategyName: 'standard_research',
  description: 'Balanced approach for most research tasks',
  applicableContexts: [
    'general research',
    'topic exploration',
    'information synthesis',
  ],
  requiredTools: ['web_search', 'web_fetch', 'content_analyzer', 'synthesizer'],
  successRate: 0.78,
  averageDuration: 8000,
  timesUsed: 120,
  refinements: [
    {
      id: 'refinement-freq-1',
      timestamp: new Date('2023-12-15T10:00:00Z'),
      reason: 'Added synthesis step for better summaries',
      change: 'Included synthesizer tool',
      expectedImprovement: 'Improve output quality',
      actualImprovement: 0.08,
    },
    {
      id: 'refinement-freq-2',
      timestamp: new Date('2024-01-08T10:00:00Z'),
      reason: 'Optimized search parameters',
      change: 'Refined search query generation',
      expectedImprovement: 'Better source relevance',
      actualImprovement: 0.05,
    },
  ],
  createdAt: new Date('2023-11-01T10:00:00Z'),
  lastUsed: new Date('2024-01-15T14:00:00Z'),
  lastRefined: new Date('2024-01-08T10:00:00Z'),
});

/**
 * Recently refined strategy
 */
export const recentlyRefinedStrategy: ProceduralMemory = createMockStrategy({
  id: 'strategy-refined-1',
  strategyName: 'iterative_deepening',
  description: 'Progressive research with depth refinement',
  applicableContexts: ['complex topics', 'multi-layered research'],
  requiredTools: ['web_search', 'web_fetch', 'content_analyzer'],
  successRate: 0.82,
  averageDuration: 15000,
  timesUsed: 25,
  refinements: [
    {
      id: 'refinement-recent-1',
      timestamp: new Date('2024-01-15T09:00:00Z'),
      reason: 'Added iterative depth control',
      change: 'Implemented progressive depth levels',
      expectedImprovement: 'Better coverage without information overload',
      actualImprovement: 0.15,
    },
  ],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  lastUsed: new Date('2024-01-15T12:00:00Z'),
  lastRefined: new Date('2024-01-15T09:00:00Z'),
});

/**
 * Specialized strategy for technical content
 */
export const technicalStrategy: ProceduralMemory = createMockStrategy({
  id: 'strategy-technical-1',
  strategyName: 'technical_deep_dive',
  description: 'Specialized strategy for technical and academic content',
  applicableContexts: [
    'technical documentation',
    'academic papers',
    'code analysis',
  ],
  requiredTools: [
    'web_search',
    'web_fetch',
    'content_analyzer',
    'fact_checker',
  ],
  successRate: 0.88,
  averageDuration: 10000,
  timesUsed: 35,
  refinements: [
    {
      id: 'refinement-tech-1',
      timestamp: new Date('2024-01-10T10:00:00Z'),
      reason: 'Improved technical term extraction',
      change: 'Enhanced content analyzer with technical lexicon',
      expectedImprovement: 'Better concept identification',
      actualImprovement: 0.1,
    },
  ],
  createdAt: new Date('2023-12-20T10:00:00Z'),
  lastUsed: new Date('2024-01-15T11:00:00Z'),
  lastRefined: new Date('2024-01-10T10:00:00Z'),
});

/**
 * Experimental strategy with few uses
 */
export const experimentalStrategy: ProceduralMemory = createMockStrategy({
  id: 'strategy-experimental-1',
  strategyName: 'multi_source_verification',
  description: 'Cross-verify information across multiple independent sources',
  applicableContexts: ['controversial topics', 'fact verification', 'journalism'],
  requiredTools: [
    'web_search',
    'web_fetch',
    'fact_checker',
    'source_evaluator',
  ],
  successRate: 0.68,
  averageDuration: 18000,
  timesUsed: 5,
  refinements: [],
  createdAt: new Date('2024-01-13T10:00:00Z'),
  lastUsed: new Date('2024-01-14T10:00:00Z'),
  lastRefined: new Date('2024-01-13T10:00:00Z'),
});

/**
 * Strategy with many refinements
 */
export const highlyRefinedStrategy: ProceduralMemory = createMockStrategy({
  id: 'strategy-highly-refined-1',
  strategyName: 'adaptive_research',
  description: 'Adaptive strategy that adjusts based on content type',
  applicableContexts: ['varied content', 'mixed media', 'adaptive research'],
  requiredTools: ['web_search', 'web_fetch', 'content_analyzer', 'synthesizer'],
  successRate: 0.85,
  averageDuration: 9000,
  timesUsed: 60,
  refinements: [
    {
      id: 'refinement-adaptive-1',
      timestamp: new Date('2023-12-10T10:00:00Z'),
      reason: 'Initial refinement for content type detection',
      change: 'Added content type classifier',
      expectedImprovement: 'Better tool selection',
      actualImprovement: 0.07,
    },
    {
      id: 'refinement-adaptive-2',
      timestamp: new Date('2023-12-20T10:00:00Z'),
      reason: 'Improved academic content handling',
      change: 'Enhanced academic paper processing',
      expectedImprovement: 'Better academic source extraction',
      actualImprovement: 0.06,
    },
    {
      id: 'refinement-adaptive-3',
      timestamp: new Date('2024-01-05T10:00:00Z'),
      reason: 'Added multimedia content support',
      change: 'Integrated video transcript analysis',
      expectedImprovement: 'Broader source coverage',
      actualImprovement: 0.05,
    },
    {
      id: 'refinement-adaptive-4',
      timestamp: new Date('2024-01-12T10:00:00Z'),
      reason: 'Optimized performance',
      change: 'Reduced redundant processing steps',
      expectedImprovement: 'Faster execution',
      actualImprovement: 0.04,
    },
  ],
  createdAt: new Date('2023-12-01T10:00:00Z'),
  lastUsed: new Date('2024-01-15T13:00:00Z'),
  lastRefined: new Date('2024-01-12T10:00:00Z'),
});

/**
 * Collection of all mock strategies
 */
export const mockStrategies = {
  highSuccess: highSuccessStrategy,
  lowSuccess: lowSuccessStrategy,
  frequentlyUsed: frequentlyUsedStrategy,
  recentlyRefined: recentlyRefinedStrategy,
  technical: technicalStrategy,
  experimental: experimentalStrategy,
  highlyRefined: highlyRefinedStrategy,
};

/**
 * Array of all strategies for bulk testing
 */
export const mockStrategyArray: ProceduralMemory[] = [
  highSuccessStrategy,
  lowSuccessStrategy,
  frequentlyUsedStrategy,
  recentlyRefinedStrategy,
  technicalStrategy,
  experimentalStrategy,
  highlyRefinedStrategy,
];

/**
 * Strategies grouped by success rate
 */
export const strategiesBySuccessRate = {
  high: [highSuccessStrategy, technicalStrategy, highlyRefinedStrategy],
  medium: [frequentlyUsedStrategy, recentlyRefinedStrategy, experimentalStrategy],
  low: [lowSuccessStrategy],
};

/**
 * Strategies grouped by usage frequency
 */
export const strategiesByUsage = {
  frequent: [frequentlyUsedStrategy, highlyRefinedStrategy],
  moderate: [highSuccessStrategy, technicalStrategy],
  rare: [lowSuccessStrategy, recentlyRefinedStrategy, experimentalStrategy],
};
