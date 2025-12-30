/**
 * Tool Registry Tests
 * Tests for tool registration, discovery, execution, and management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '../../../src/tools/registry';
import { Tool, ToolResult, ToolContext } from '../../../src/tools/types';
import { createMockLogger } from '../../helpers';

// Mock tool implementation for testing
class MockTool implements Tool {
  name = 'mock_tool';
  description = 'Mock tool for testing';
  version = '1.0.0';
  config = { enabled: true };

  executeCalled = false;
  shouldFail = false;

  async execute(_input: any, _context: ToolContext): Promise<ToolResult<any>> {
    this.executeCalled = true;

    if (this.shouldFail) {
      throw new Error('Mock tool error');
    }

    return {
      success: true,
      data: { result: 'mock result', _input },
    };
  }

  async validateInput(_input: any): Promise<boolean> {
    return true;
  }

  getInputSchema(): object {
    return {
      type: 'object',
      properties: {
        test: { type: 'string' },
      },
    };
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let logger: ReturnType<typeof createMockLogger>;
  let mockTool: MockTool;
  let context: ToolContext;

  beforeEach(() => {
    logger = createMockLogger();
    registry = new ToolRegistry(logger);
    mockTool = new MockTool();
    context = {
      logger,
      sessionId: 'test-session',
      userId: 'test-user',
    };
  });

  describe('Tool Registration', () => {
    it('should register a tool', () => {
      registry.register(mockTool);

      const retrieved = registry.getTool('mock_tool');
      expect(retrieved).toBe(mockTool);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Registered tool: mock_tool'),
        expect.any(Object)
      );
    });

    it('should register tool with options', () => {
      registry.register(mockTool, {
        category: 'testing',
        tags: ['mock', 'test'],
        enabled: true,
      });

      const tools = registry.getToolsByCategory('testing');
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(mockTool);

      const taggedTools = registry.getToolsByTag('mock');
      expect(taggedTools).toHaveLength(1);
    });

    it('should overwrite existing tool with warning', () => {
      registry.register(mockTool);
      const newMockTool = new MockTool();
      newMockTool.name = 'mock_tool';

      registry.register(newMockTool);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );
      expect(registry.getTool('mock_tool')).toBe(newMockTool);
    });

    it('should unregister a tool', () => {
      registry.register(mockTool);
      const result = registry.unregister('mock_tool');

      expect(result).toBe(true);
      expect(registry.getTool('mock_tool')).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Unregistered tool: mock_tool')
      );
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = registry.unregister('non_existent');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Tool not found')
      );
    });
  });

  describe('Tool Discovery', () => {
    beforeEach(() => {
      registry.register(mockTool, { category: 'test', tags: ['mock'] });
    });

    it('should get tool by name', () => {
      const tool = registry.getTool('mock_tool');

      expect(tool).toBe(mockTool);
    });

    it('should return null for non-existent tool', () => {
      const tool = registry.getTool('non_existent');

      expect(tool).toBeNull();
    });

    it('should get all registered tools', () => {
      const mockTool2 = new MockTool();
      mockTool2.name = 'mock_tool_2';
      registry.register(mockTool2);

      const tools = registry.getAllTools();

      expect(tools).toHaveLength(2);
      expect(tools).toContain(mockTool);
      expect(tools).toContain(mockTool2);
    });

    it('should get only enabled tools', () => {
      const disabledTool = new MockTool();
      disabledTool.name = 'disabled_tool';
      registry.register(disabledTool, { enabled: false });

      const enabledTools = registry.getEnabledTools();

      expect(enabledTools).toHaveLength(1);
      expect(enabledTools[0]).toBe(mockTool);
      expect(enabledTools).not.toContain(disabledTool);
    });

    it('should get tools by category', () => {
      const otherTool = new MockTool();
      otherTool.name = 'other_tool';
      registry.register(otherTool, { category: 'other' });

      const testTools = registry.getToolsByCategory('test');
      const otherTools = registry.getToolsByCategory('other');

      expect(testTools).toHaveLength(1);
      expect(testTools[0]).toBe(mockTool);
      expect(otherTools).toHaveLength(1);
      expect(otherTools[0]).toBe(otherTool);
    });

    it('should get tools by tag', () => {
      const taggedTool = new MockTool();
      taggedTool.name = 'tagged_tool';
      registry.register(taggedTool, { tags: ['mock', 'special'] });

      const mockTagged = registry.getToolsByTag('mock');
      const specialTagged = registry.getToolsByTag('special');

      expect(mockTagged).toHaveLength(2); // Both tools have 'mock' tag
      expect(specialTagged).toHaveLength(1);
      expect(specialTagged[0]).toBe(taggedTool);
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should execute tool successfully', async () => {
      const input = { test: 'value' };
      const result = await registry.executeTool('mock_tool', input, context);

      expect(result.success).toBe(true);
      expect((result.data as any)?.result).toBe('mock result');
      expect(mockTool.executeCalled).toBe(true);
    });

    it('should return error for non-existent tool', async () => {
      const result = await registry.executeTool('non_existent', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should return error for disabled tool', async () => {
      registry.disableTool('mock_tool');

      const result = await registry.executeTool('mock_tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should update usage count on execution', async () => {
      await registry.executeTool('mock_tool', {}, context);
      await registry.executeTool('mock_tool', {}, context);

      const stats = registry.getToolStatistics('mock_tool');
      expect(stats?.usageCount).toBe(2);
    });

    it('should update lastUsed timestamp', async () => {
      const before = new Date();
      await registry.executeTool('mock_tool', {}, context);

      const stats = registry.getToolStatistics('mock_tool');
      expect(stats?.lastUsed).toBeInstanceOf(Date);
      expect(stats?.lastUsed!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should log execution', async () => {
      await registry.executeTool('mock_tool', { test: 'value' }, context);

      const history = registry.getExecutionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].toolName).toBe('mock_tool');
      expect(history[0].success).toBe(true);
      expect(history[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle execution errors', async () => {
      mockTool.shouldFail = true;

      const result = await registry.executeTool('mock_tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Mock tool error');

      const history = registry.getExecutionHistory();
      expect(history[0].success).toBe(false);
      expect(history[0].error).toBeDefined();
    });
  });

  describe('Tool Management', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should enable a tool', () => {
      registry.disableTool('mock_tool');
      const result = registry.enableTool('mock_tool');

      expect(result).toBe(true);
      const enabledTools = registry.getEnabledTools();
      expect(enabledTools).toContain(mockTool);
    });

    it('should disable a tool', () => {
      const result = registry.disableTool('mock_tool');

      expect(result).toBe(true);
      const enabledTools = registry.getEnabledTools();
      expect(enabledTools).not.toContain(mockTool);
    });

    it('should return false when enabling non-existent tool', () => {
      const result = registry.enableTool('non_existent');

      expect(result).toBe(false);
    });

    it('should return false when disabling non-existent tool', () => {
      const result = registry.disableTool('non_existent');

      expect(result).toBe(false);
    });
  });

  describe('LLM Integration', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should get schemas for all enabled tools', () => {
      const schemas = registry.getToolSchemas();

      expect(schemas).toHaveLength(1);
      expect(schemas[0]).toHaveProperty('name', 'mock_tool');
      expect(schemas[0]).toHaveProperty('description', 'Mock tool for testing');
      expect(schemas[0]).toHaveProperty('input_schema');
    });

    it('should not include disabled tools in schemas', () => {
      registry.disableTool('mock_tool');

      const schemas = registry.getToolSchemas();

      expect(schemas).toHaveLength(0);
    });

    it('should get schemas for specific tools', () => {
      const mockTool2 = new MockTool();
      mockTool2.name = 'mock_tool_2';
      registry.register(mockTool2);

      const schemas = registry.getToolSchemasByName(['mock_tool']);

      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe('mock_tool');
    });

    it('should return correct Anthropic tool format', () => {
      const schemas = registry.getToolSchemas();

      expect(schemas[0]).toEqual({
        name: 'mock_tool',
        description: 'Mock tool for testing',
        input_schema: {
          type: 'object',
          properties: {
            test: { type: 'string' },
          },
        },
      });
    });

    it('should handle non-existent tools in getToolSchemasByName', () => {
      const schemas = registry.getToolSchemasByName(['non_existent', 'mock_tool']);

      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe('mock_tool');
    });
  });

  describe('Statistics and History', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should calculate tool usage statistics', async () => {
      await registry.executeTool('mock_tool', {}, context);
      await registry.executeTool('mock_tool', {}, context);

      const stats = registry.getToolStatistics('mock_tool');

      expect(stats).toBeDefined();
      expect(stats?.usageCount).toBe(2);
      expect(stats?.lastUsed).toBeInstanceOf(Date);
      expect(stats?.successRate).toBe(1);
      expect(stats?.averageDuration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate success rate', async () => {
      await registry.executeTool('mock_tool', {}, context);
      mockTool.shouldFail = true;
      await registry.executeTool('mock_tool', {}, context);

      const stats = registry.getToolStatistics('mock_tool');

      expect(stats?.successRate).toBe(0.5); // 1 success out of 2 attempts
    });

    it('should calculate average duration', async () => {
      await registry.executeTool('mock_tool', {}, context);
      await registry.executeTool('mock_tool', {}, context);

      const stats = registry.getToolStatistics('mock_tool');

      expect(stats?.averageDuration).toBeGreaterThanOrEqual(0);
    });

    it('should get execution history', async () => {
      await registry.executeTool('mock_tool', { test: 'value1' }, context);
      await registry.executeTool('mock_tool', { test: 'value2' }, context);

      const history = registry.getExecutionHistory();

      expect(history).toHaveLength(2);
      expect(history[0].toolName).toBe('mock_tool');
      expect(history[1].toolName).toBe('mock_tool');
    });

    it('should filter history by tool name', async () => {
      const mockTool2 = new MockTool();
      mockTool2.name = 'mock_tool_2';
      registry.register(mockTool2);

      await registry.executeTool('mock_tool', {}, context);
      await registry.executeTool('mock_tool_2', {}, context);
      await registry.executeTool('mock_tool', {}, context);

      const history = registry.getExecutionHistory({ toolName: 'mock_tool' });

      expect(history).toHaveLength(2);
      expect(history.every(h => h.toolName === 'mock_tool')).toBe(true);
    });

    it('should filter history by success', async () => {
      await registry.executeTool('mock_tool', {}, context);
      mockTool.shouldFail = true;
      await registry.executeTool('mock_tool', {}, context);

      const successHistory = registry.getExecutionHistory({ successOnly: true });

      expect(successHistory).toHaveLength(1);
      expect(successHistory[0].success).toBe(true);
    });

    it('should limit history results', async () => {
      await registry.executeTool('mock_tool', {}, context);
      await registry.executeTool('mock_tool', {}, context);
      await registry.executeTool('mock_tool', {}, context);

      const history = registry.getExecutionHistory({ limit: 2 });

      expect(history).toHaveLength(2);
    });

    it('should clear execution history', async () => {
      await registry.executeTool('mock_tool', {}, context);
      await registry.executeTool('mock_tool', {}, context);

      registry.clearHistory();

      const history = registry.getExecutionHistory();
      expect(history).toHaveLength(0);
    });

    it('should maintain max history size', async () => {
      // Execute tool 1100 times to exceed max history size (1000)
      for (let i = 0; i < 1100; i++) {
        await registry.executeTool('mock_tool', {}, context);
      }

      const history = registry.getExecutionHistory();

      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should return null for non-existent tool statistics', () => {
      const stats = registry.getToolStatistics('non_existent');

      expect(stats).toBeNull();
    });
  });
});
