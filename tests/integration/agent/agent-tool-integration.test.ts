/**
 * Agent-Tool Integration Tests
 * Tests integration between autonomous agent and tool system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutonomousAgent, AgentConfig } from '../../../src/agent/core';
import { ReasoningEngine } from '../../../src/agent/reasoning';
import { AgentReflection } from '../../../src/agent/reflection';
import { ToolRegistry } from '../../../src/tools/registry';
import { SearchTool } from '../../../src/tools/search';
import { FetchTool } from '../../../src/tools/fetch';
import { AnalyzeTool } from '../../../src/tools/analyze';
import { SynthesizeTool } from '../../../src/tools/synthesize';
import { createMockLogger, createMockLLMClient } from '../../helpers/memory-test-utils';
import {
  createMockReasoningEngine,
  createMockAgentReflection,
  createMockMemorySystem,
  simulatePlanningResponse,
} from '../../helpers/agent-test-utils';
import { simpleGoal } from '../../fixtures/agent/mock-goals';

describe('Agent-Tool Integration', () => {
  let agent: AutonomousAgent;
  let mockReasoningEngine: ReasoningEngine;
  let mockReflection: AgentReflection;
  let mockMemory: ReturnType<typeof createMockMemorySystem>;
  let toolRegistry: ToolRegistry;
  let mockLLM: ReturnType<typeof createMockLLMClient>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let config: AgentConfig;

  beforeEach(() => {
    mockReasoningEngine = createMockReasoningEngine();
    mockReflection = createMockAgentReflection();
    mockMemory = createMockMemorySystem();
    mockLLM = createMockLLMClient();
    mockLogger = createMockLogger();

    // Create real tool registry with mock tools
    toolRegistry = new ToolRegistry(mockLogger);

    config = {
      maxIterations: 10,
      reflectionInterval: 5,
      maxContextTokens: 4000,
      enableAutoReflection: false,
    };

    agent = new AutonomousAgent(
      mockReasoningEngine,
      mockReflection,
      mockMemory,
      toolRegistry,
      mockLLM as any,
      mockLogger,
      config
    );

    // Setup default LLM responses
    mockLLM.complete.mockResolvedValue({
      role: 'assistant',
      content: simulatePlanningResponse([
        { description: 'Test', action: 'search' },
      ]),
    });
  });

  // ============================================================================
  // Tool Execution Tests
  // ============================================================================

  it('should execute search tool correctly', async () => {
    // Register search tool with dummy API key
    const searchTool = new SearchTool({
      apiKey: 'test-key',
      maxResults: 10,
      includeSnippets: true,
    });
    toolRegistry.register(searchTool);

    // Mock search execution
    vi.spyOn(searchTool, 'execute').mockResolvedValue({
      success: true,
      data: {
        results: [
          { title: 'Result 1', url: 'http://example.com/1', snippet: 'Snippet 1' },
          { title: 'Result 2', url: 'http://example.com/2', snippet: 'Snippet 2' },
        ],
      },
    });

    mockReasoningEngine.reason = vi.fn().mockResolvedValue({
      reasoning: {
        id: 'r1',
        options: [],
        analysis: '',
        selectedOption: 'opt1',
        confidence: 0.8,
        timestamp: new Date(),
        context: {} as any,
      },
      selectedAction: {
        id: 'a1',
        sessionId: 'session-1',
        type: 'search',
        tool: 'web_search',
        parameters: { query: 'test query' },
        reasoning: 'Need to search',
        timestamp: new Date(),
      },
      confidence: 0.8,
    });

    mockReasoningEngine.observe = vi.fn().mockResolvedValue({
      observations: [],
      success: true,
      shouldContinue: false,
      shouldReplan: false,
      learnings: [],
    });

    const result = await agent.research('test topic', simpleGoal);

    expect(result.success).toBe(true);
    expect(searchTool.execute).toHaveBeenCalled();
  });

  it('should execute fetch tool correctly', async () => {
    const fetchTool = new FetchTool({
      timeout: 5000,
      maxContentLength: 10000,
    });
    toolRegistry.register(fetchTool);

    vi.spyOn(fetchTool, 'execute').mockResolvedValue({
      success: true,
      data: {
        content: 'Fetched content here',
        contentLength: 100,
        url: 'http://example.com',
      },
    });

    mockReasoningEngine.reason = vi.fn().mockResolvedValue({
      reasoning: {
        id: 'r1',
        options: [],
        analysis: '',
        selectedOption: 'opt1',
        confidence: 0.8,
        timestamp: new Date(),
        context: {} as any,
      },
      selectedAction: {
        id: 'a1',
        sessionId: 'session-1',
        type: 'fetch',
        tool: 'web_fetch',
        parameters: { url: 'http://example.com' },
        reasoning: 'Need to fetch content',
        timestamp: new Date(),
      },
      confidence: 0.8,
    });

    mockReasoningEngine.observe = vi.fn().mockResolvedValue({
      observations: [],
      success: true,
      shouldContinue: false,
      shouldReplan: false,
      learnings: [],
    });

    const result = await agent.research('test topic', simpleGoal);

    expect(result.success).toBe(true);
    expect(fetchTool.execute).toHaveBeenCalled();
  });

  it('should execute analyze tool correctly', async () => {
    const analyzeTool = new AnalyzeTool(mockLLM as any, {
      maxFacts: 20,
    });
    toolRegistry.register(analyzeTool);

    vi.spyOn(analyzeTool, 'execute').mockResolvedValue({
      success: true,
      data: {
        facts: ['Fact 1', 'Fact 2', 'Fact 3'],
        summary: 'Analysis summary',
      },
    });

    mockReasoningEngine.reason = vi.fn().mockResolvedValue({
      reasoning: {
        id: 'r1',
        options: [],
        analysis: '',
        selectedOption: 'opt1',
        confidence: 0.8,
        timestamp: new Date(),
        context: {} as any,
      },
      selectedAction: {
        id: 'a1',
        sessionId: 'session-1',
        type: 'analyze',
        tool: 'content_analyzer',
        parameters: { content: 'Content to analyze' },
        reasoning: 'Need to analyze',
        timestamp: new Date(),
      },
      confidence: 0.8,
    });

    mockReasoningEngine.observe = vi.fn().mockResolvedValue({
      observations: [],
      success: true,
      shouldContinue: false,
      shouldReplan: false,
      learnings: [],
    });

    const result = await agent.research('test topic', simpleGoal);

    expect(result.success).toBe(true);
    expect(analyzeTool.execute).toHaveBeenCalled();
  });

  it('should execute synthesize tool correctly', async () => {
    const synthesizeTool = new SynthesizeTool(mockLLM as any, {
      maxLength: 1000,
    });
    toolRegistry.register(synthesizeTool);

    vi.spyOn(synthesizeTool, 'execute').mockResolvedValue({
      success: true,
      data: {
        synthesis: 'Final synthesized result',
        keyPoints: ['Point 1', 'Point 2'],
      },
    });

    mockReasoningEngine.reason = vi.fn().mockResolvedValue({
      reasoning: {
        id: 'r1',
        options: [],
        analysis: '',
        selectedOption: 'opt1',
        confidence: 0.8,
        timestamp: new Date(),
        context: {} as any,
      },
      selectedAction: {
        id: 'a1',
        sessionId: 'session-1',
        type: 'synthesize',
        tool: 'synthesizer',
        parameters: { sources: [] },
        reasoning: 'Need to synthesize',
        timestamp: new Date(),
      },
      confidence: 0.8,
    });

    mockReasoningEngine.observe = vi.fn().mockResolvedValue({
      observations: [],
      success: true,
      shouldContinue: false,
      shouldReplan: false,
      learnings: [],
    });

    const result = await agent.research('test topic', simpleGoal);

    expect(result.success).toBe(true);
    expect(synthesizeTool.execute).toHaveBeenCalled();
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('should handle tool failures gracefully', async () => {
    const searchTool = new SearchTool({ apiKey: 'test-key' });
    toolRegistry.register(searchTool);

    // Make tool fail
    vi.spyOn(searchTool, 'execute').mockResolvedValue({
      success: false,
      error: 'Search API unavailable',
    });

    mockReasoningEngine.reason = vi.fn().mockResolvedValue({
      reasoning: {
        id: 'r1',
        options: [],
        analysis: '',
        selectedOption: 'opt1',
        confidence: 0.8,
        timestamp: new Date(),
        context: {} as any,
      },
      selectedAction: {
        id: 'a1',
        sessionId: 'session-1',
        type: 'search',
        tool: 'web_search',
        parameters: {},
        reasoning: 'test',
        timestamp: new Date(),
      },
      confidence: 0.8,
    });

    mockReasoningEngine.observe = vi.fn().mockResolvedValue({
      observations: ['Tool failed'],
      success: false,
      shouldContinue: false,
      shouldReplan: false,
      learnings: ['Tool can fail'],
    });

    const result = await agent.research('test topic', simpleGoal);

    // Agent should handle failure gracefully
    expect(result.success).toBe(true); // Overall research succeeds even if one tool fails
    expect(searchTool.execute).toHaveBeenCalled();
  });

  // ============================================================================
  // Tool Usage Tracking Tests
  // ============================================================================

  it('should track tool usage statistics', async () => {
    const searchTool = new SearchTool({ apiKey: 'test-key' });
    const fetchTool = new FetchTool({});
    toolRegistry.register(searchTool);
    toolRegistry.register(fetchTool);

    vi.spyOn(searchTool, 'execute').mockResolvedValue({
      success: true,
      data: { results: [] },
    });

    vi.spyOn(fetchTool, 'execute').mockResolvedValue({
      success: true,
      data: { content: 'test' },
    });

    let callCount = 0;
    mockReasoningEngine.reason = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        reasoning: {
          id: `r${callCount}`,
          options: [],
          analysis: '',
          selectedOption: 'opt1',
          confidence: 0.8,
          timestamp: new Date(),
          context: {} as any,
        },
        selectedAction: {
          id: `a${callCount}`,
          sessionId: 'session-1',
          type: callCount === 1 ? 'search' : 'fetch',
          tool: callCount === 1 ? 'web_search' : 'web_fetch',
          parameters: {},
          reasoning: 'test',
          timestamp: new Date(),
        },
        confidence: 0.8,
      };
    });

    mockReasoningEngine.observe = vi.fn().mockImplementation(async () => ({
      observations: [],
      success: true,
      shouldContinue: callCount < 2,
      shouldReplan: false,
      learnings: [],
    }));

    const result = await agent.research('test topic', simpleGoal);

    expect(result.success).toBe(true);
    expect(searchTool.execute).toHaveBeenCalledTimes(1);
    expect(fetchTool.execute).toHaveBeenCalledTimes(1);
  });
});
