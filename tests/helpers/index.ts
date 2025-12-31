/**
 * Test Helpers Index
 * Centralized exports for all test utilities
 */

// Memory test utilities
export {
  createInMemoryDocumentStore,
  createMockVectorStore,
  createMockEmbeddingClient,
  createMockLLMClient,
  createMockLogger,
  cosineSimilarity,
  expectSimilarEmbeddings,
  createSimilarEmbeddings,
  waitForAsync,
  flushPromises,
  createMockSearchResults,
  assertContainsAll,
  createDateRange,
  MockTimer,
  batchProcess,
  TestResourceManager,
  createCallTracker,
  expectAsyncError,
} from './memory-test-utils';

// Agent test utilities
export {
  createMockReasoningEngine,
  createMockAgentReflection,
  createMockMemorySystem,
  createMockToolRegistry,
  generateRandomActions,
  generateRandomOutcomes,
  generateReasoningContext,
  expectReasoningResult,
  expectReflection,
  expectResearchResult,
  runAgentIterations,
  simulateReflectionTrigger,
  captureAgentLogs,
  simulatePlanningResponse,
  simulateReasoningResponse,
  simulateLearningResponse,
  createTestLLMClient,
  nextTick,
  expectArrayContains,
  createMethodSpy,
} from './agent-test-utils';
