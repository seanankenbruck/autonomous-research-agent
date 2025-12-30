/**
 * Analyze Tool Tests
 * Tests for content analysis and information extraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyzeTool } from '../../../src/tools/analyze';
import { AnalyzeConfig } from '../../../src/tools/types';
import { createMockLogger, createMockLLMClient } from '../../helpers';

describe('AnalyzeTool', () => {
  let analyzeTool: AnalyzeTool;
  let logger: ReturnType<typeof createMockLogger>;
  let llmClient: ReturnType<typeof createMockLLMClient>;
  let context: any;

  beforeEach(() => {
    logger = createMockLogger();
    context = {
      logger,
      sessionId: 'test-session',
      userId: 'test-user',
    };

    // Create mock LLM client with specific responses
    llmClient = createMockLLMClient({
      responses: new Map([
        ['Extract factual statements', JSON.stringify([
          { statement: 'Fact 1', confidence: 0.9, sources: [] },
          { statement: 'Fact 2', confidence: 0.8, sources: [] },
        ])],
        ['Extract named entities', JSON.stringify([
          { text: 'Entity 1', type: 'person', confidence: 0.9 },
          { text: 'Entity 2', type: 'organization', confidence: 0.8 },
        ])],
        ['Extract the 5-10 most important', JSON.stringify(['phrase1', 'phrase2', 'phrase3'])],
        ['Identify the 3-7 main concepts', JSON.stringify(['concept1', 'concept2'])],
        ['Provide a concise summary', 'This is a summary of the content.'],
        ['Analyze the sentiment', JSON.stringify({ score: 0.5, label: 'neutral' })],
        ['Classify this content', JSON.stringify([{ category: 'technology', confidence: 0.9 }])],
      ]),
    });

    const config: AnalyzeConfig = {
      enabled: true,
      llmModel: 'claude-sonnet-4-5-20250929',
      maxTokens: 4000,
      temperature: 0.3,
    };

    analyzeTool = new AnalyzeTool(config, llmClient);
  });

  describe('execute() - full analysis', () => {
    it('should execute full analysis successfully', async () => {
      const input = {
        content: 'This is test content to analyze.',
        analysisType: 'all' as const,
      };

      const result = await analyzeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.facts).toBeDefined();
      expect(result.data?.entities).toBeDefined();
      expect(result.data?.keyPhrases).toBeDefined();
      expect(result.data?.concepts).toBeDefined();
      expect(result.data?.summary).toBeDefined();
      expect(result.data?.sentiment).toBeDefined();
      expect(result.data?.classification).toBeDefined();
    });

    it('should extract facts from content', async () => {
      const input = {
        content: 'The sky is blue. Water is wet.',
        analysisType: 'extract' as const,
      };

      const result = await analyzeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.facts).toBeInstanceOf(Array);
      expect(result.data?.facts?.length).toBeGreaterThan(0);
      expect(result.data?.facts?.[0]).toHaveProperty('statement');
      expect(result.data?.facts?.[0]).toHaveProperty('confidence');
    });

    it('should extract entities from content', async () => {
      const input = {
        content: 'John Smith works at Microsoft.',
        analysisType: 'extract' as const,
      };

      const result = await analyzeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.entities).toBeInstanceOf(Array);
      expect(result.data?.entities?.length).toBeGreaterThan(0);
      expect(result.data?.entities?.[0]).toHaveProperty('text');
      expect(result.data?.entities?.[0]).toHaveProperty('type');
    });

    it('should generate summary', async () => {
      const input = {
        content: 'Long content that needs to be summarized...',
        analysisType: 'summarize' as const,
      };

      const result = await analyzeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.summary).toBeDefined();
      expect(typeof result.data?.summary).toBe('string');
      expect(result.data?.summary).toContain('summary');
    });

    it('should analyze sentiment', async () => {
      const input = {
        content: 'This is a great product! I love it.',
        analysisType: 'sentiment' as const,
      };

      const result = await analyzeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.sentiment).toBeDefined();
      expect(result.data?.sentiment).toHaveProperty('score');
      expect(result.data?.sentiment).toHaveProperty('label');
      expect(['positive', 'negative', 'neutral']).toContain(result.data?.sentiment?.label);
    });

    it('should classify content', async () => {
      const input = {
        content: 'AI and machine learning are transforming technology.',
        analysisType: 'classify' as const,
      };

      const result = await analyzeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.classification).toBeInstanceOf(Array);
      expect(result.data?.classification?.length).toBeGreaterThan(0);
      expect(result.data?.classification?.[0]).toHaveProperty('category');
      expect(result.data?.classification?.[0]).toHaveProperty('confidence');
    });
  });

  describe('execute() - selective extraction', () => {
    it('should respect extraction targets', async () => {
      const input = {
        content: 'Test content',
        analysisType: 'extract' as const,
        extractionTargets: {
          facts: true,
          entities: false,
          keyPhrases: false,
          concepts: false,
        },
      };

      const result = await analyzeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.facts).toBeDefined();
      expect(result.data?.entities).toEqual([]);
      expect(result.data?.keyPhrases).toEqual([]);
      expect(result.data?.concepts).toEqual([]);
    });
  });

  describe('validateInput()', () => {
    it('should validate required content field', async () => {
      const input = {};
      const result = await analyzeTool.execute(input as any, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should reject empty content', async () => {
      const input = { content: '' };
      const result = await analyzeTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should reject content that is too long', async () => {
      const input = { content: 'a'.repeat(150000) }; // Over 100k limit
      const isValid = await analyzeTool.validateInput(input);

      expect(isValid).toBe(false);
    });

    it('should validate analysis type', async () => {
      const input = { content: 'test', analysisType: 'invalid' };
      const isValid = await analyzeTool.validateInput(input as any);

      expect(isValid).toBe(false);
    });
  });

  describe('getInputSchema()', () => {
    it('should return valid JSON schema', () => {
      const schema = analyzeTool.getInputSchema();

      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
      expect((schema as any).required).toContain('content');
    });

    it('should include all input properties', () => {
      const schema = analyzeTool.getInputSchema() as any;

      expect(schema.properties).toHaveProperty('content');
      expect(schema.properties).toHaveProperty('analysisType');
      expect(schema.properties).toHaveProperty('extractionTargets');
    });

    it('should define valid analysis types', () => {
      const schema = analyzeTool.getInputSchema() as any;

      expect(schema.properties.analysisType.enum).toEqual([
        'extract',
        'summarize',
        'classify',
        'sentiment',
        'all',
      ]);
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      const errorClient = createMockLLMClient();
      errorClient.complete = vi.fn().mockRejectedValue(new Error('LLM error'));

      const errorTool = new AnalyzeTool({
        enabled: true,
        llmModel: 'claude-sonnet-4-5-20250929',
      }, errorClient);

      const input = { content: 'test content', analysisType: 'all' as const };
      const result = await errorTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid JSON responses', async () => {
      const invalidClient = createMockLLMClient({
        defaultResponse: 'Not valid JSON',
      });

      const invalidTool = new AnalyzeTool({
        enabled: true,
        llmModel: 'claude-sonnet-4-5-20250929',
      }, invalidClient);

      const input = { content: 'test', analysisType: 'extract' as const };
      const result = await invalidTool.execute(input, context);

      // Should fallback gracefully or return empty arrays
      expect(result.success).toBe(true);
    });
  });

  describe('metadata', () => {
    it('should have required metadata properties', () => {
      expect(analyzeTool.name).toBe('content_analyzer');
      expect(analyzeTool.description).toBeDefined();
      expect(analyzeTool.version).toBe('1.0.0');
    });
  });
});
