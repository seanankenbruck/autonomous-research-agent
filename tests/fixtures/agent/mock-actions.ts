/**
 * Mock Action Fixtures
 * Provides realistic action data for testing agent execution
 */

import { v4 as uuidv4 } from 'uuid';
import type { Action, ActionType } from '../../../src/agent/types';

/**
 * Create a mock action with optional overrides
 */
export function createMockAction(overrides?: Partial<Action>): Action {
  const id = overrides?.id || uuidv4();
  const sessionId = overrides?.sessionId || uuidv4();
  const timestamp = overrides?.timestamp || new Date('2024-01-15T10:30:00Z');

  return {
    id,
    sessionId,
    type: overrides?.type || 'search',
    tool: overrides?.tool || 'search',
    parameters: overrides?.parameters || {},
    reasoning: overrides?.reasoning || 'Default reasoning for action',
    strategy: overrides?.strategy,
    timestamp,
  };
}

/**
 * Search action fixture
 */
export const searchAction: Action = {
  id: 'action-search-1',
  sessionId: 'session-1',
  type: 'search',
  tool: 'search',
  parameters: {
    query: 'autonomous research agents',
    maxResults: 10,
    searchDepth: 'advanced',
  },
  reasoning: 'Need to gather initial information on autonomous agents',
  strategy: 'comprehensive_research',
  timestamp: new Date('2024-01-15T10:30:00Z'),
};

/**
 * Fetch action fixture
 */
export const fetchAction: Action = {
  id: 'action-fetch-1',
  sessionId: 'session-1',
  type: 'fetch',
  tool: 'fetch',
  parameters: {
    url: 'https://example.com/article',
    extractContent: true,
    includeMetadata: true,
  },
  reasoning: 'Retrieve detailed content from promising source',
  strategy: 'comprehensive_research',
  timestamp: new Date('2024-01-15T10:35:00Z'),
};

/**
 * Analyze action fixture
 */
export const analyzeAction: Action = {
  id: 'action-analyze-1',
  sessionId: 'session-1',
  type: 'analyze',
  tool: 'analyze',
  parameters: {
    content: 'Sample content to analyze',
    analysisType: 'all',
    extractionTargets: {
      facts: true,
      entities: true,
      keyPhrases: true,
    },
  },
  reasoning: 'Extract key facts and entities from fetched content',
  strategy: 'comprehensive_research',
  timestamp: new Date('2024-01-15T10:40:00Z'),
};

/**
 * Synthesize action fixture
 */
export const synthesizeAction: Action = {
  id: 'action-synthesize-1',
  sessionId: 'session-1',
  type: 'synthesize',
  tool: 'synthesize',
  parameters: {
    sources: [
      { content: 'Source 1 content', url: 'https://example.com/1' },
      { content: 'Source 2 content', url: 'https://example.com/2' },
    ],
    synthesisGoal: 'Summarize key findings on autonomous agents',
    outputFormat: 'report',
  },
  reasoning: 'Combine findings into coherent summary',
  strategy: 'comprehensive_research',
  timestamp: new Date('2024-01-15T10:45:00Z'),
};

/**
 * Failed action fixture (for testing failure scenarios)
 */
export const failedAction: Action = {
  id: 'action-failed-1',
  sessionId: 'session-1',
  type: 'search',
  tool: 'search',
  parameters: {
    query: 'invalid query',
  },
  reasoning: 'Attempting search with invalid parameters',
  timestamp: new Date('2024-01-15T10:50:00Z'),
};

/**
 * Reflect action fixture
 */
export const reflectAction: Action = {
  id: 'action-reflect-1',
  sessionId: 'session-1',
  type: 'reflect',
  tool: 'reflect',
  parameters: {},
  reasoning: 'Time to reflect on progress and adjust strategy',
  strategy: 'comprehensive_research',
  timestamp: new Date('2024-01-15T10:55:00Z'),
};

/**
 * Replan action fixture
 */
export const replanAction: Action = {
  id: 'action-replan-1',
  sessionId: 'session-1',
  type: 'replan',
  tool: 'replan',
  parameters: {
    reason: 'Multiple failures detected',
  },
  reasoning: 'Current approach not working, need new plan',
  timestamp: new Date('2024-01-15T11:00:00Z'),
};

/**
 * Array of sample actions for batch testing
 */
export const mockActionArray: Action[] = [
  searchAction,
  fetchAction,
  analyzeAction,
  synthesizeAction,
];

/**
 * Actions by type for filtered testing
 */
export const actionsByType: Record<ActionType, Action[]> = {
  search: [searchAction],
  fetch: [fetchAction],
  analyze: [analyzeAction],
  extract: [],
  verify: [],
  synthesize: [synthesizeAction],
  reflect: [reflectAction],
  replan: [replanAction],
};

/**
 * Generate a sequence of actions for workflow testing
 */
export function generateActionSequence(
  sessionId: string,
  count: number,
  startTime: Date = new Date()
): Action[] {
  const actions: Action[] = [];
  const types: ActionType[] = ['search', 'fetch', 'analyze', 'synthesize'];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const timestamp = new Date(startTime.getTime() + i * 60000); // 1 minute apart

    actions.push(createMockAction({
      id: `action-${i + 1}`,
      sessionId,
      type,
      tool: type,
      reasoning: `Action ${i + 1}: ${type}`,
      timestamp,
    }));
  }

  return actions;
}

/**
 * Create actions with specific tool usage pattern
 */
export function createActionsWithToolPattern(
  sessionId: string,
  pattern: string[]
): Action[] {
  return pattern.map((tool, i) => {
    const type = tool as ActionType;
    return createMockAction({
      id: `action-${i + 1}`,
      sessionId,
      type,
      tool,
      reasoning: `Execute ${tool}`,
      timestamp: new Date(Date.now() + i * 60000),
    });
  });
}

/**
 * Create successful and failed actions for testing resilience
 */
export function createMixedSuccessActions(
  sessionId: string,
  successCount: number,
  failureCount: number
): { successful: Action[]; failed: Action[] } {
  const successful: Action[] = [];
  const failed: Action[] = [];

  for (let i = 0; i < successCount; i++) {
    successful.push(createMockAction({
      id: `action-success-${i + 1}`,
      sessionId,
      type: 'search',
      tool: 'search',
      reasoning: 'Successful search action',
    }));
  }

  for (let i = 0; i < failureCount; i++) {
    failed.push(createMockAction({
      id: `action-fail-${i + 1}`,
      sessionId,
      type: 'search',
      tool: 'search',
      reasoning: 'Failed search action',
    }));
  }

  return { successful, failed };
}
