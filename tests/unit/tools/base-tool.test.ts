/**
 * Base Tool Tests
 * Tests for base tool functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseTool } from '../../../src/tools/base-tool';
import { ToolResult, ToolContext, ToolConfig } from '../../../src/tools/types';
import { createMockLogger } from '../../helpers';

// Concrete test implementation of BaseTool
class TestTool extends BaseTool<any, any, ToolConfig> {
  readonly name = 'test_tool';
  readonly description = 'Test tool for unit testing';
  readonly version = '1.0.0';

  public executeImplCalled = false;
  public shouldFail = false;
  public executeDelay = 0;

  protected async executeImpl(input: any, context: ToolContext): Promise<ToolResult<any>> {
    this.executeImplCalled = true;

    if (this.executeDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executeDelay));
    }

    if (this.shouldFail) {
      throw new Error('Test error');
    }

    return this.createSuccessResult({ result: 'success', input });
  }

  async validateInput(input: any): Promise<boolean> {
    if (!this.hasRequiredFields(input, ['required'])) {
      return false;
    }
    return true;
  }

  getInputSchema(): object {
    return {
      type: 'object',
      properties: {
        required: { type: 'string' },
        optional: { type: 'string' },
      },
      required: ['required'],
    };
  }
}

describe('BaseTool', () => {
  let testTool: TestTool;
  let logger: ReturnType<typeof createMockLogger>;
  let context: ToolContext;

  beforeEach(() => {
    logger = createMockLogger();
    context = {
      logger,
      sessionId: 'test-session',
      userId: 'test-user',
    };

    testTool = new TestTool({
      enabled: true,
      timeout: 5000,
    });
  });

  describe('execute()', () => {
    it('should execute tool successfully with valid input', async () => {
      const input = { required: 'test value' };
      const result = await testTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.result).toBe('success');
      expect(result.data?.input).toEqual(input);
      expect(testTool.executeImplCalled).toBe(true);
    });

    it('should return error for invalid input', async () => {
      const input = { optional: 'test' }; // Missing required field
      const result = await testTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('validation failed');
      expect(testTool.executeImplCalled).toBe(false);
    });

    it('should handle execution errors gracefully', async () => {
      testTool.shouldFail = true;
      const input = { required: 'test value' };
      const result = await testTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should respect tool enabled/disabled state', async () => {
      const disabledTool = new TestTool({
        enabled: false,
        timeout: 5000,
      });

      const input = { required: 'test value' };
      const result = await disabledTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should handle execution timeout', async () => {
      const timeoutTool = new TestTool({
        enabled: true,
        timeout: 100, // 100ms timeout
      });
      timeoutTool.executeDelay = 200; // Execution takes 200ms

      const input = { required: 'test value' };
      const result = await timeoutTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });
  });

  describe('retry logic', () => {
    it('should retry on failure', async () => {
      const retryTool = new TestTool({
        enabled: true,
        maxRetries: 3,
      });

      let attemptCount = 0;
      const testFn = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Retry error');
        }
        return 'success';
      });

      const result = await retryTool['withRetry'](testFn, 3);
      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should fail after max retries', async () => {
      const retryTool = new TestTool({
        enabled: true,
        maxRetries: 2,
      });

      const testFn = vi.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(retryTool['withRetry'](testFn, 2)).rejects.toThrow('Persistent error');
      expect(testFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('createSuccessResult()', () => {
    it('should create standardized success result', async () => {
      const data = { key: 'value' };
      const metadata = { source: 'test' };

      const result = testTool['createSuccessResult'](data, metadata);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.metadata).toEqual(metadata);
      expect(result.error).toBeUndefined();
    });
  });

  describe('createErrorResult()', () => {
    it('should create standardized error result', async () => {
      const error = 'Test error message';
      const startTime = Date.now();

      const result = testTool['createErrorResult'](error, startTime);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
      expect(result.data).toBeUndefined();
    });
  });

  describe('helper methods', () => {
    it('should validate required fields correctly', () => {
      const validInput = { field1: 'value1', field2: 'value2' };
      const invalidInput = { field1: 'value1' };

      // Type assertion to bypass strict keyof checking in tests
      expect(testTool['hasRequiredFields'](validInput as any, ['field1', 'field2'])).toBe(true);
      expect(testTool['hasRequiredFields'](invalidInput as any, ['field1', 'field2'])).toBe(false);
      expect(testTool['hasRequiredFields'](validInput, ['field1'])).toBe(true);
    });

    it('should sanitize input strings', () => {
      const input = '<script>alert("xss")</script> Hello World';
      const sanitized = testTool['sanitizeString'](input);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello World');
    });

    it('should truncate text correctly', () => {
      const longText = 'a'.repeat(1000);
      const truncated = testTool['truncateText'](longText, 100);

      expect(truncated.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(truncated).toContain('...');
    });

    it('should not truncate text shorter than limit', () => {
      const shortText = 'short text';
      const result = testTool['truncateText'](shortText, 100);

      expect(result).toBe(shortText);
      expect(result).not.toContain('...');
    });

    it('should extract domain from URL', () => {
      expect(testTool['extractDomain']('https://example.com/path')).toBe('example.com');
      expect(testTool['extractDomain']('http://subdomain.example.com')).toBe('subdomain.example.com');
      expect(testTool['extractDomain']('https://example.com:8080/path')).toBe('example.com');
    });

    it('should handle invalid URLs in extractDomain', () => {
      expect(testTool['extractDomain']('not-a-url')).toBe('');
      expect(testTool['extractDomain']('')).toBe('');
    });
  });

  describe('getInputSchema()', () => {
    it('should return valid JSON schema', () => {
      const schema = testTool.getInputSchema();

      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
    });
  });

  describe('metadata properties', () => {
    it('should have required metadata properties', () => {
      expect(testTool.name).toBe('test_tool');
      expect(testTool.description).toBe('Test tool for unit testing');
      expect(testTool.version).toBe('1.0.0');
    });
  });
});
