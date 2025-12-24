/**
 * Memory Fixtures Index
 * Centralized exports for all memory-related test fixtures
 */

// Session fixtures
export {
  mockSessions,
  mockSessionArray,
  sessionsByStatus,
  createMockSession,
  activeSession,
  completedSession,
  failedSession,
  pausedSession,
  sessionWithReflections,
  parentSession,
  childSession,
} from './mock-sessions';

// Episode fixtures
export {
  mockEpisodes,
  mockEpisodeArray,
  createMockEpisode,
  successfulResearch,
  failedSearch,
  partialSuccess,
  multiActionEpisode,
  episodeWithFeedback,
} from './mock-episodes';

// Fact fixtures
export {
  mockFacts,
  mockFactArray,
  createMockFact,
  highConfidenceFacts,
  lowConfidenceFacts,
  categorizedFacts,
  relatedFacts,
  frequentlyAccessedFact,
  rarelyAccessedFact,
  recentlyModifiedFact,
  getAllCategorizedFacts,
} from './mock-facts';

// Strategy fixtures
export {
  mockStrategies,
  mockStrategyArray,
  createMockStrategy,
  highSuccessStrategy,
  lowSuccessStrategy,
  frequentlyUsedStrategy,
  recentlyRefinedStrategy,
  technicalStrategy,
  experimentalStrategy,
  highlyRefinedStrategy,
  strategiesBySuccessRate,
  strategiesByUsage,
} from './mock-strategies';

// Conversation fixtures
export {
  mockConversations,
  mockConversationArray,
  technicalDiscussion,
  researchSession,
  debuggingSession,
  brainstormingSession,
  extractConversationActions,
  extractConversationOutcomes,
} from './mock-conversations';
export type { ConversationTurn, TestConversation } from './mock-conversations';
