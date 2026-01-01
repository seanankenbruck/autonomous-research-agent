/**
 * Mock Outcome Fixtures
 * Provides realistic outcome data for testing action execution
 */

import { v4 as uuidv4 } from 'uuid';
import type { Outcome } from '../../../src/agent/types';

/**
 * Create a mock outcome with optional overrides
 */
export function createMockOutcome(overrides?: Partial<Outcome>): Outcome {
  const actionId = overrides?.actionId || uuidv4();
  const timestamp = overrides?.timestamp || new Date('2024-01-15T10:30:00Z');

  return {
    actionId,
    success: overrides?.success !== undefined ? overrides.success : true,
    result: overrides?.result,
    error: overrides?.error,
    observations: overrides?.observations || ['Action completed successfully'],
    duration: overrides?.duration || 1000,
    metadata: overrides?.metadata || {},
    timestamp,
  };
}

/**
 * Successful outcome fixture
 */
export const successfulOutcome: Outcome = {
  actionId: 'action-search-1',
  success: true,
  result: {
    message: 'Search completed successfully',
  },
  observations: [
    'Successfully executed search',
    'Found relevant results',
  ],
  duration: 850,
  metadata: {
    source: 'test',
  },
  timestamp: new Date('2024-01-15T10:30:01Z'),
};

/**
 * Failed outcome fixture
 */
export const failedOutcome: Outcome = {
  actionId: 'action-failed-1',
  success: false,
  error: 'Network timeout',
  observations: [
    'Failed to execute search: Network timeout',
  ],
  duration: 5000,
  metadata: {
    retries: 3,
  },
  timestamp: new Date('2024-01-15T10:50:05Z'),
};

/**
 * Search outcome with results
 */
export const searchOutcome: Outcome = {
  actionId: 'action-search-1',
  success: true,
  result: {
    results: [
      {
        title: 'Autonomous Research Agents: A Survey',
        url: 'https://example.com/paper1',
        snippet: 'This paper surveys recent advances in autonomous research agents...',
        score: 0.95,
      },
      {
        title: 'Memory Systems for AI Agents',
        url: 'https://example.com/paper2',
        snippet: 'We present a novel memory architecture for autonomous agents...',
        score: 0.88,
      },
      {
        title: 'ReAct: Reasoning and Acting in Language Models',
        url: 'https://example.com/paper3',
        snippet: 'ReAct combines reasoning traces with task-specific actions...',
        score: 0.85,
      },
    ],
    totalResults: 3,
    query: 'autonomous research agents',
  },
  observations: [
    'Successfully executed search',
    'Found 3 results',
  ],
  duration: 1200,
  metadata: {
    searchEngine: 'test',
  },
  timestamp: new Date('2024-01-15T10:30:01Z'),
};

/**
 * Fetch outcome with content
 */
export const fetchOutcome: Outcome = {
  actionId: 'action-fetch-1',
  success: true,
  result: {
    content: {
      url: 'https://example.com/article',
      title: 'Understanding Autonomous Agents',
      content: 'Autonomous agents are systems that can perceive their environment...',
      contentType: 'text/html',
      contentLength: 5420,
      author: 'Dr. Jane Smith',
      publishedDate: new Date('2024-01-10'),
      metadata: {
        description: 'A comprehensive guide to autonomous agents',
        keywords: ['AI', 'agents', 'autonomy'],
      },
    },
    fetchTime: 800,
  },
  observations: [
    'Successfully executed fetch',
    'Fetched content (5420 chars)',
  ],
  duration: 800,
  metadata: {
    cached: false,
  },
  timestamp: new Date('2024-01-15T10:35:01Z'),
};

/**
 * Analyze outcome with extracted facts
 */
export const analyzeOutcome: Outcome = {
  actionId: 'action-analyze-1',
  success: true,
  result: {
    summary: 'Article discusses autonomous agent architectures...',
    facts: [
      {
        statement: 'Autonomous agents use memory systems for context',
        confidence: 0.95,
      },
      {
        statement: 'ReAct pattern combines reasoning and acting',
        confidence: 0.92,
      },
      {
        statement: 'Reflection improves agent performance',
        confidence: 0.88,
      },
    ],
    entities: [
      { text: 'ReAct', type: 'concept', confidence: 0.95 },
      { text: 'Memory Systems', type: 'concept', confidence: 0.90 },
    ],
    keyPhrases: [
      'autonomous agents',
      'memory architecture',
      'reasoning and acting',
    ],
  },
  observations: [
    'Successfully executed analyze',
    'Extracted 3 facts',
  ],
  duration: 2500,
  metadata: {
    model: 'test-model',
  },
  timestamp: new Date('2024-01-15T10:40:03Z'),
};

/**
 * Synthesize outcome with generated summary
 */
export const synthesizeOutcome: Outcome = {
  actionId: 'action-synthesize-1',
  success: true,
  result: {
    synthesis: 'Autonomous research agents combine multiple capabilities including memory systems, reasoning frameworks like ReAct, and reflection mechanisms to perform complex research tasks autonomously.',
    keyFindings: [
      'Memory systems are critical for context',
      'ReAct pattern is effective for combining reasoning and action',
      'Reflection enables continuous improvement',
    ],
    sources: [
      { url: 'https://example.com/1', title: 'Source 1', citationNumber: 1 },
      { url: 'https://example.com/2', title: 'Source 2', citationNumber: 2 },
    ],
    confidence: 0.87,
  },
  observations: [
    'Successfully executed synthesize',
    'Generated synthesis',
  ],
  duration: 3200,
  metadata: {
    sourcesUsed: 2,
  },
  timestamp: new Date('2024-01-15T10:45:04Z'),
};

/**
 * Partial success outcome (some errors but usable results)
 */
export const partialSuccessOutcome: Outcome = {
  actionId: 'action-search-2',
  success: true,
  result: {
    results: [
      {
        title: 'Partial Result',
        url: 'https://example.com/partial',
        snippet: 'Some content...',
        score: 0.65,
      },
    ],
    totalResults: 1,
  },
  observations: [
    'Successfully executed search',
    'Found 1 results',
    'Warning: Some sources were unavailable',
  ],
  duration: 2000,
  metadata: {
    warnings: ['Some sources failed to load'],
  },
  timestamp: new Date('2024-01-15T10:32:00Z'),
};

/**
 * Array of sample outcomes for batch testing
 */
export const mockOutcomeArray: Outcome[] = [
  successfulOutcome,
  searchOutcome,
  fetchOutcome,
  analyzeOutcome,
  synthesizeOutcome,
];

/**
 * Outcomes by success status
 */
export const outcomesByStatus = {
  successful: [successfulOutcome, searchOutcome, fetchOutcome, analyzeOutcome, synthesizeOutcome],
  failed: [failedOutcome],
  partial: [partialSuccessOutcome],
};

/**
 * Generate a sequence of outcomes matching actions
 */
export function generateOutcomeSequence(
  actionIds: string[],
  successRate: number = 0.8
): Outcome[] {
  return actionIds.map((actionId, i) => {
    const success = Math.random() < successRate;
    const timestamp = new Date(Date.now() + i * 1000);

    return createMockOutcome({
      actionId,
      success,
      result: success ? { data: `Result for ${actionId}` } : undefined,
      error: success ? undefined : 'Random failure',
      observations: success
        ? ['Action completed successfully']
        : [`Action failed: ${actionId}`],
      duration: 500 + Math.random() * 1500,
      timestamp,
    });
  });
}

/**
 * Create outcomes with varying durations
 */
export function createOutcomesWithDurations(
  actionIds: string[],
  minDuration: number,
  maxDuration: number
): Outcome[] {
  return actionIds.map(actionId => {
    const duration = minDuration + Math.random() * (maxDuration - minDuration);
    return createMockOutcome({
      actionId,
      success: true,
      duration,
      observations: [`Completed in ${Math.round(duration)}ms`],
    });
  });
}

/**
 * Create consecutive failures for testing resilience
 */
export function createConsecutiveFailures(
  actionIds: string[],
  errors: string[] = ['Network error', 'Timeout', 'API error']
): Outcome[] {
  return actionIds.map((actionId, i) => {
    const error = errors[i % errors.length];
    return createMockOutcome({
      actionId,
      success: false,
      error,
      observations: [`Failed to execute: ${error}`],
      duration: 5000,
    });
  });
}

/**
 * Create outcomes with specific result types for testing
 */
export function createTypedOutcomes(type: 'search' | 'fetch' | 'analyze' | 'synthesize'): Outcome {
  switch (type) {
    case 'search':
      return searchOutcome;
    case 'fetch':
      return fetchOutcome;
    case 'analyze':
      return analyzeOutcome;
    case 'synthesize':
      return synthesizeOutcome;
    default:
      return successfulOutcome;
  }
}
