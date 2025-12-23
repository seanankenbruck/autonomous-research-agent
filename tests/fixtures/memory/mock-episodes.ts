/**
 * Mock Episodic Memory Fixtures
 * Provides realistic episode data for testing
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  EpisodicMemory,
  Action,
  Outcome,
  Finding,
  UserFeedback,
} from '../../../src/agent/types';

/**
 * Create a mock episodic memory with optional overrides
 */
export function createMockEpisode(
  overrides?: Partial<EpisodicMemory>
): EpisodicMemory {
  const id = overrides?.id || uuidv4();
  const sessionId = overrides?.sessionId || 'session-1';
  const timestamp = overrides?.timestamp || new Date('2024-01-15T10:00:00Z');

  const defaultActions: Action[] = [
    {
      id: 'action-1',
      sessionId,
      type: 'search',
      tool: 'web_search',
      parameters: { query: 'autonomous agents research' },
      reasoning: 'Need to find recent research on autonomous agents',
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
  ];

  const defaultOutcomes: Outcome[] = [
    {
      actionId: 'action-1',
      success: true,
      result: { resultsFound: 10 },
      observations: ['Found 10 relevant papers', 'Good mix of recent and foundational work'],
      duration: 2000,
      metadata: { provider: 'web_search' },
      timestamp: new Date('2024-01-15T10:00:02Z'),
    },
  ];

  const defaultFindings: Finding[] = [
    {
      id: 'finding-1',
      content: 'Autonomous agents use planning and reasoning to achieve goals',
      source: {
        url: 'https://example.com/agent-research',
        title: 'Modern Autonomous Agents',
        type: 'academic',
        author: 'Dr. Jane Smith',
        publishDate: new Date('2023-06-15'),
        credibilityScore: 0.9,
      },
      confidence: 0.9,
      relevance: 0.95,
      timestamp: new Date('2024-01-15T10:00:05Z'),
      verificationStatus: 'verified',
      relatedFindings: [],
    },
  ];

  return {
    id,
    sessionId,
    timestamp,
    topic: overrides?.topic || 'Research on Autonomous Agents',
    actions: overrides?.actions || defaultActions,
    outcomes: overrides?.outcomes || defaultOutcomes,
    findings: overrides?.findings || defaultFindings,
    duration: overrides?.duration || 5000,
    success: overrides?.success !== undefined ? overrides.success : true,
    summary:
      overrides?.summary ||
      'Successfully searched for and analyzed research on autonomous agents',
    tags: overrides?.tags || ['research', 'autonomous-agents', 'ai'],
    embedding: overrides?.embedding,
    feedback: overrides?.feedback,
  };
}

/**
 * Successful research episode
 */
export const successfulResearch: EpisodicMemory = createMockEpisode({
  id: 'episode-success-1',
  sessionId: 'session-active-1',
  topic: 'Deep Learning Optimization',
  success: true,
  actions: [
    {
      id: 'action-search-1',
      sessionId: 'session-active-1',
      type: 'search',
      tool: 'web_search',
      parameters: { query: 'deep learning optimization techniques' },
      reasoning: 'Find latest optimization methods',
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      id: 'action-fetch-1',
      sessionId: 'session-active-1',
      type: 'fetch',
      tool: 'web_fetch',
      parameters: { url: 'https://example.com/dl-optimization' },
      reasoning: 'Retrieve full content of promising paper',
      timestamp: new Date('2024-01-15T10:01:00Z'),
    },
    {
      id: 'action-analyze-1',
      sessionId: 'session-active-1',
      type: 'analyze',
      tool: 'content_analyzer',
      parameters: { content: '...' },
      reasoning: 'Extract key concepts and methods',
      timestamp: new Date('2024-01-15T10:02:00Z'),
    },
  ],
  outcomes: [
    {
      actionId: 'action-search-1',
      success: true,
      result: { count: 15 },
      observations: ['Found 15 recent papers', 'Mix of academic and industry sources'],
      duration: 1500,
      metadata: {},
      timestamp: new Date('2024-01-15T10:00:01.5Z'),
    },
    {
      actionId: 'action-fetch-1',
      success: true,
      result: { wordCount: 5000 },
      observations: ['Comprehensive technical paper', 'Includes implementation details'],
      duration: 2000,
      metadata: {},
      timestamp: new Date('2024-01-15T10:01:02Z'),
    },
    {
      actionId: 'action-analyze-1',
      success: true,
      result: { conceptsExtracted: 12 },
      observations: ['Identified 12 key optimization techniques', 'Clear methodology'],
      duration: 3000,
      metadata: {},
      timestamp: new Date('2024-01-15T10:02:03Z'),
    },
  ],
  findings: [
    {
      id: 'finding-opt-1',
      content: 'Adam optimizer with learning rate scheduling improves convergence',
      source: {
        url: 'https://example.com/dl-optimization',
        title: 'Deep Learning Optimization Techniques',
        type: 'academic',
        author: 'Dr. John Doe',
        publishDate: new Date('2023-09-01'),
        credibilityScore: 0.95,
      },
      confidence: 0.9,
      relevance: 0.95,
      timestamp: new Date('2024-01-15T10:02:05Z'),
      verificationStatus: 'verified',
      relatedFindings: ['finding-opt-2'],
    },
    {
      id: 'finding-opt-2',
      content: 'Gradient clipping prevents exploding gradients in RNNs',
      source: {
        url: 'https://example.com/dl-optimization',
        title: 'Deep Learning Optimization Techniques',
        type: 'academic',
        publishDate: new Date('2023-09-01'),
        credibilityScore: 0.95,
      },
      confidence: 0.85,
      relevance: 0.9,
      timestamp: new Date('2024-01-15T10:02:06Z'),
      verificationStatus: 'verified',
      relatedFindings: ['finding-opt-1'],
    },
  ],
  duration: 6500,
  summary: 'Researched deep learning optimization, found 15 sources, extracted key techniques',
  tags: ['deep-learning', 'optimization', 'neural-networks'],
});

/**
 * Failed search episode
 */
export const failedSearch: EpisodicMemory = createMockEpisode({
  id: 'episode-failed-1',
  sessionId: 'session-failed-1',
  topic: 'Obscure Technical Topic',
  success: false,
  actions: [
    {
      id: 'action-search-fail-1',
      sessionId: 'session-failed-1',
      type: 'search',
      tool: 'web_search',
      parameters: { query: 'very specific obscure topic' },
      reasoning: 'Attempt to find information on niche topic',
      timestamp: new Date('2024-01-13T14:00:00Z'),
    },
  ],
  outcomes: [
    {
      actionId: 'action-search-fail-1',
      success: false,
      error: 'No results found',
      observations: ['Query too specific', 'May need to broaden search terms'],
      duration: 1000,
      metadata: {},
      timestamp: new Date('2024-01-13T14:00:01Z'),
    },
  ],
  findings: [],
  duration: 1000,
  summary: 'Failed to find information on topic - no results',
  tags: ['failed', 'no-results'],
});

/**
 * Partial success episode
 */
export const partialSuccess: EpisodicMemory = createMockEpisode({
  id: 'episode-partial-1',
  sessionId: 'session-active-1',
  topic: 'Emerging AI Technologies',
  success: true,
  actions: [
    {
      id: 'action-partial-1',
      sessionId: 'session-active-1',
      type: 'search',
      tool: 'web_search',
      parameters: { query: 'emerging AI technologies 2024' },
      reasoning: 'Find latest AI developments',
      timestamp: new Date('2024-01-15T11:00:00Z'),
    },
    {
      id: 'action-partial-2',
      sessionId: 'session-active-1',
      type: 'fetch',
      tool: 'web_fetch',
      parameters: { url: 'https://example.com/broken-link' },
      reasoning: 'Retrieve detailed article',
      timestamp: new Date('2024-01-15T11:01:00Z'),
    },
  ],
  outcomes: [
    {
      actionId: 'action-partial-1',
      success: true,
      result: { count: 8 },
      observations: ['Found 8 sources', 'Some sources may be outdated'],
      duration: 1500,
      metadata: {},
      timestamp: new Date('2024-01-15T11:00:01.5Z'),
    },
    {
      actionId: 'action-partial-2',
      success: false,
      error: '404 Not Found',
      observations: ['Link is broken', 'Need to find alternative source'],
      duration: 500,
      metadata: {},
      timestamp: new Date('2024-01-15T11:01:00.5Z'),
    },
  ],
  findings: [
    {
      id: 'finding-partial-1',
      content: 'Large language models are becoming more efficient',
      source: {
        url: 'https://example.com/ai-trends',
        title: 'AI Technology Trends 2024',
        type: 'news',
        publishDate: new Date('2024-01-01'),
        credibilityScore: 0.7,
      },
      confidence: 0.7,
      relevance: 0.8,
      timestamp: new Date('2024-01-15T11:00:05Z'),
      verificationStatus: 'unverified',
      relatedFindings: [],
    },
  ],
  duration: 2000,
  summary: 'Partially successful research - found some sources but encountered errors',
  tags: ['partial', 'ai-trends'],
});

/**
 * Multi-action episode with various action types
 */
export const multiActionEpisode: EpisodicMemory = createMockEpisode({
  id: 'episode-multi-1',
  sessionId: 'session-active-1',
  topic: 'Comprehensive Research Process',
  success: true,
  actions: [
    {
      id: 'action-multi-1',
      sessionId: 'session-active-1',
      type: 'search',
      tool: 'web_search',
      parameters: { query: 'machine learning pipelines' },
      reasoning: 'Initial broad search',
      timestamp: new Date('2024-01-15T12:00:00Z'),
    },
    {
      id: 'action-multi-2',
      sessionId: 'session-active-1',
      type: 'fetch',
      tool: 'web_fetch',
      parameters: { url: 'https://example.com/ml-pipeline' },
      reasoning: 'Get detailed content',
      timestamp: new Date('2024-01-15T12:01:00Z'),
    },
    {
      id: 'action-multi-3',
      sessionId: 'session-active-1',
      type: 'analyze',
      tool: 'content_analyzer',
      parameters: { content: '...' },
      reasoning: 'Extract structured information',
      timestamp: new Date('2024-01-15T12:02:00Z'),
    },
    {
      id: 'action-multi-4',
      sessionId: 'session-active-1',
      type: 'verify',
      tool: 'fact_checker',
      parameters: { claim: 'ML pipelines improve reproducibility' },
      reasoning: 'Verify key claim',
      timestamp: new Date('2024-01-15T12:03:00Z'),
    },
    {
      id: 'action-multi-5',
      sessionId: 'session-active-1',
      type: 'synthesize',
      tool: 'synthesizer',
      parameters: { findings: ['finding-1', 'finding-2'] },
      reasoning: 'Combine findings into coherent summary',
      timestamp: new Date('2024-01-15T12:04:00Z'),
    },
  ],
  outcomes: [
    {
      actionId: 'action-multi-1',
      success: true,
      result: { count: 20 },
      observations: ['Broad topic with many sources'],
      duration: 1500,
      metadata: {},
      timestamp: new Date('2024-01-15T12:00:01.5Z'),
    },
    {
      actionId: 'action-multi-2',
      success: true,
      result: { wordCount: 3000 },
      observations: ['Technical documentation'],
      duration: 2000,
      metadata: {},
      timestamp: new Date('2024-01-15T12:01:02Z'),
    },
    {
      actionId: 'action-multi-3',
      success: true,
      result: { entitiesExtracted: 15 },
      observations: ['Well-structured content'],
      duration: 2500,
      metadata: {},
      timestamp: new Date('2024-01-15T12:02:02.5Z'),
    },
    {
      actionId: 'action-multi-4',
      success: true,
      result: { verified: true },
      observations: ['Claim supported by multiple sources'],
      duration: 1000,
      metadata: {},
      timestamp: new Date('2024-01-15T12:03:01Z'),
    },
    {
      actionId: 'action-multi-5',
      success: true,
      result: { summaryLength: 500 },
      observations: ['Coherent synthesis produced'],
      duration: 3000,
      metadata: {},
      timestamp: new Date('2024-01-15T12:04:03Z'),
    },
  ],
  findings: [
    {
      id: 'finding-multi-1',
      content: 'ML pipelines automate the workflow from data to deployment',
      source: {
        url: 'https://example.com/ml-pipeline',
        title: 'Machine Learning Pipeline Guide',
        type: 'webpage',
        credibilityScore: 0.85,
      },
      confidence: 0.9,
      relevance: 0.95,
      timestamp: new Date('2024-01-15T12:02:05Z'),
      verificationStatus: 'verified',
      relatedFindings: ['finding-multi-2'],
    },
    {
      id: 'finding-multi-2',
      content: 'Version control is essential for ML pipeline reproducibility',
      source: {
        url: 'https://example.com/ml-pipeline',
        title: 'Machine Learning Pipeline Guide',
        type: 'webpage',
        credibilityScore: 0.85,
      },
      confidence: 0.85,
      relevance: 0.9,
      timestamp: new Date('2024-01-15T12:02:06Z'),
      verificationStatus: 'verified',
      relatedFindings: ['finding-multi-1'],
    },
  ],
  duration: 10000,
  summary: 'Comprehensive research with search, fetch, analyze, verify, and synthesis actions',
  tags: ['ml-pipelines', 'comprehensive', 'verified'],
});

/**
 * Episode with user feedback
 */
export const episodeWithFeedback: EpisodicMemory = createMockEpisode({
  id: 'episode-feedback-1',
  sessionId: 'session-completed-1',
  topic: 'User Research with Feedback',
  success: true,
  duration: 8000,
  feedback: {
    sessionId: 'session-completed-1',
    timestamp: new Date('2024-01-14T11:05:00Z'),
    rating: 5,
    helpful: true,
    comments: 'Excellent research, very thorough and accurate',
    specificFeedback: {
      sources: 'good',
      depth: 'good',
      accuracy: 'very_accurate',
      relevance: 'highly_relevant',
    },
  },
  tags: ['high-quality', 'user-approved'],
});

/**
 * Collection of all mock episodes
 */
export const mockEpisodes = {
  successfulResearch,
  failedSearch,
  partialSuccess,
  multiActionEpisode,
  withFeedback: episodeWithFeedback,
};

/**
 * Array of diverse episodes for bulk testing
 */
export const mockEpisodeArray: EpisodicMemory[] = [
  successfulResearch,
  failedSearch,
  partialSuccess,
  multiActionEpisode,
  episodeWithFeedback,
];
