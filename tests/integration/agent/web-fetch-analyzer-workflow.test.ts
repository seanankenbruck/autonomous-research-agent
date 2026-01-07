/**
 * Integration Test: Web Fetch → Content Analyzer Workflow
 *
 * This test verifies that the agent properly follows the workflow:
 * 1. web_search to find sources
 * 2. web_fetch to get full content
 * 3. content_analyzer to extract facts
 * 4. synthesizer to create final output
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReasoningEngine } from '../../../src/agent/reasoning';
import { LLMClient } from '../../../src/llm/client';
import { createLogger } from '../../../src/utils/logger';
import { Goal, Progress, WorkingMemory, Outcome } from '../../../src/agent/types';

describe('Web Fetch → Analyzer Workflow Integration', () => {
  let reasoningEngine: ReasoningEngine;
  let mockLLMClient: any;
  let logger: ReturnType<typeof createLogger>;

  const goal: Goal = {
    description: 'Research quantum computing',
    successCriteria: ['Find 5+ facts'],
    constraints: [],
    estimatedComplexity: 'moderate' as const,
  };

  const availableTools = [
    { name: 'web_search', category: 'search' as const },
    { name: 'web_fetch', category: 'fetch' as const },
    { name: 'content_analyzer', category: 'analysis' as const },
    { name: 'synthesizer', category: 'synthesis' as const },
  ];

  const memoryContext = {
    relevantEpisodes: [],
    relevantFacts: [],
    recommendedStrategies: [],
  };

  beforeEach(() => {
    logger = createLogger({ level: 'error' });
    mockLLMClient = {
      complete: vi.fn(),
      extractText: vi.fn((response: any) => response.content),
    };
    reasoningEngine = new ReasoningEngine(mockLLMClient as any, logger);
  });

  it('should suggest web_fetch after gathering sources', async () => {
    // Mock LLM to fail so we use fallback logic
    mockLLMClient.complete.mockRejectedValue(new Error('LLM failed'));

    const progress: Progress = {
      currentPhase: 'gathering',
      stepsCompleted: 1,
      stepsTotal: 5,
      sourcesGathered: 10, // Has sources
      factsExtracted: 0, // No facts yet
      confidence: 0.5,
    };

    const workingMemory: WorkingMemory = {
      recentActions: [],
      recentOutcomes: [
        // Simulate web_search results (short snippets)
        {
          actionId: 'action-1',
          success: true,
          result: {
            results: [
              { title: 'Article 1', url: 'http://example.com/1', snippet: 'Short snippet' },
              { title: 'Article 2', url: 'http://example.com/2', snippet: 'Another snippet' },
            ],
          },
          observations: [],
          duration: 1000,
          metadata: {},
          timestamp: new Date(),
        },
      ],
      keyFindings: [],
    };

    const result = await reasoningEngine.reason(
      goal,
      progress,
      workingMemory,
      availableTools as any,
      memoryContext,
      'session-1'
    );

    // Should suggest web_fetch to get full content
    expect(result.selectedAction.tool).toBe('web_fetch');
  });

  it('should suggest content_analyzer after fetching full content', async () => {
    // Mock LLM to fail so we use fallback logic
    mockLLMClient.complete.mockRejectedValue(new Error('LLM failed'));

    const progress: Progress = {
      currentPhase: 'analyzing',
      stepsCompleted: 2,
      stepsTotal: 5,
      sourcesGathered: 10,
      factsExtracted: 0, // No facts yet
      confidence: 0.6,
    };

    const workingMemory: WorkingMemory = {
      recentActions: [],
      recentOutcomes: [
        // Simulate web_fetch result (full content)
        {
          actionId: 'action-2',
          success: true,
          result: {
            content: 'Quantum computers use qubits that can be in superposition. This allows them to process multiple states simultaneously. IBM has developed systems with 127 qubits. Google achieved quantum supremacy in 2019 with their Sycamore processor, which performed a calculation in 200 seconds that would take classical computers 10,000 years. Applications include drug discovery, cryptography, and financial modeling. However, qubits are extremely fragile and require temperatures near absolute zero. Error rates remain too high for practical use, though error correction techniques are improving rapidly.'.repeat(2), // Make it > 500 chars
          },
          observations: [],
          duration: 2000,
          metadata: {},
          timestamp: new Date(),
        },
      ],
      keyFindings: [],
    };

    const result = await reasoningEngine.reason(
      goal,
      progress,
      workingMemory,
      availableTools as any,
      memoryContext,
      'session-1'
    );

    // Should suggest content_analyzer since we have full content
    expect(result.selectedAction.tool).toBe('content_analyzer');
  });

  it('should not suggest content_analyzer without fetched content', async () => {
    // Mock LLM to fail so we use fallback logic
    mockLLMClient.complete.mockRejectedValue(new Error('LLM failed'));

    const progress: Progress = {
      currentPhase: 'analyzing',
      stepsCompleted: 1,
      stepsTotal: 5,
      sourcesGathered: 10,
      factsExtracted: 0,
      confidence: 0.5,
    };

    const workingMemory: WorkingMemory = {
      recentActions: [],
      recentOutcomes: [
        // Only search results, no fetched content
        {
          actionId: 'action-1',
          success: true,
          result: {
            results: [
              { title: 'Article', url: 'http://example.com', snippet: 'Short snippet' },
            ],
          },
          observations: [],
          duration: 1000,
          metadata: {},
          timestamp: new Date(),
        },
      ],
      keyFindings: [],
    };

    const result = await reasoningEngine.reason(
      goal,
      progress,
      workingMemory,
      availableTools as any,
      memoryContext,
      'session-1'
    );

    // Should NOT suggest content_analyzer, should suggest web_fetch first
    expect(result.selectedAction.tool).toBe('web_fetch');
  });

  it('should suggest synthesizer after extracting facts', async () => {
    // Mock LLM to fail so we use fallback logic
    mockLLMClient.complete.mockRejectedValue(new Error('LLM failed'));

    const progress: Progress = {
      currentPhase: 'synthesizing',
      stepsCompleted: 4,
      stepsTotal: 5,
      sourcesGathered: 10,
      factsExtracted: 5, // Has facts
      confidence: 0.8,
    };

    const workingMemory: WorkingMemory = {
      recentActions: [],
      recentOutcomes: [],
      keyFindings: [
        { id: '1', content: 'Fact 1', confidence: 0.9, relevance: 0.8, verificationStatus: 'unverified', relatedFindings: [], source: { url: '', title: '', type: 'webpage', credibilityScore: 0.9 }, timestamp: new Date() },
        { id: '2', content: 'Fact 2', confidence: 0.9, relevance: 0.8, verificationStatus: 'unverified', relatedFindings: [], source: { url: '', title: '', type: 'webpage', credibilityScore: 0.9 }, timestamp: new Date() },
        { id: '3', content: 'Fact 3', confidence: 0.9, relevance: 0.8, verificationStatus: 'unverified', relatedFindings: [], source: { url: '', title: '', type: 'webpage', credibilityScore: 0.9 }, timestamp: new Date() },
        { id: '4', content: 'Fact 4', confidence: 0.9, relevance: 0.8, verificationStatus: 'unverified', relatedFindings: [], source: { url: '', title: '', type: 'webpage', credibilityScore: 0.9 }, timestamp: new Date() },
        { id: '5', content: 'Fact 5', confidence: 0.9, relevance: 0.8, verificationStatus: 'unverified', relatedFindings: [], source: { url: '', title: '', type: 'webpage', credibilityScore: 0.9 }, timestamp: new Date() },
      ],
    };

    const result = await reasoningEngine.reason(
      goal,
      progress,
      workingMemory,
      availableTools as any,
      memoryContext,
      'session-1'
    );

    // Should suggest synthesizer
    expect(result.selectedAction.tool).toBe('synthesizer');
  });
});
