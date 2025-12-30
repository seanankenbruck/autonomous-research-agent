/**
 * Synthesize Tool Tests
 * Tests for multi-source information synthesis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SynthesizeTool } from '../../../src/tools/synthesize';
import { SynthesizeConfig } from '../../../src/tools/types';
import { createMockLogger, createMockLLMClient } from '../../helpers';

describe('SynthesizeTool', () => {
  let synthesizeTool: SynthesizeTool;
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

    llmClient = createMockLLMClient({
      defaultResponse: 'This is a synthesized summary of multiple sources with citations [1], [2].',
    });

    const config: SynthesizeConfig = {
      enabled: true,
      llmModel: 'claude-sonnet-4-5-20250929',
      maxTokens: 8000,
      temperature: 0.4,
      citationStyle: 'inline',
    };

    synthesizeTool = new SynthesizeTool(config, llmClient);
  });

  describe('execute()', () => {
    it('should synthesize multiple sources successfully', async () => {
      const input = {
        sources: [
          { content: 'Source 1 content', title: 'Source 1', url: 'https://example.com/1' },
          { content: 'Source 2 content', title: 'Source 2', url: 'https://example.com/2' },
        ],
        synthesisGoal: 'Summarize the key findings',
        outputFormat: 'summary' as const,
      };

      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.synthesis).toBeDefined();
      expect(result.data?.sources).toHaveLength(2);
      expect(result.data?.confidence).toBeGreaterThan(0);
      expect(result.data?.confidence).toBeLessThanOrEqual(1);
    });

    it('should generate report format with sections', async () => {
      llmClient.extractText = vi.fn().mockReturnValue(`
## Introduction
This is the introduction with citations [1].

## Key Findings
- Finding 1 from source [1]
- Finding 2 from source [2]

## Conclusion
Summary of all findings [1], [2].
      `.trim());

      const input = {
        sources: [
          { content: 'Content 1' },
          { content: 'Content 2' },
        ],
        synthesisGoal: 'Create a detailed report',
        outputFormat: 'report' as const,
      };

      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.sections).toBeDefined();
      expect(result.data?.sections?.length).toBeGreaterThan(0);
      expect(result.data?.keyFindings).toBeDefined();
    });

    it('should handle structured JSON output', async () => {
      llmClient.extractText = vi.fn().mockReturnValue(JSON.stringify({
        sections: [
          {
            heading: 'Overview',
            content: 'Overview content [1]',
            sources: ['1'],
          },
          {
            heading: 'Details',
            content: 'Detailed info [1], [2]',
            sources: ['1', '2'],
          },
        ],
        keyFindings: ['Finding 1', 'Finding 2'],
      }));

      const input = {
        sources: [
          { content: 'Source 1' },
          { content: 'Source 2' },
        ],
        synthesisGoal: 'Structured analysis',
        outputFormat: 'structured' as const,
      };

      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.sections).toBeInstanceOf(Array);
      expect(result.data?.keyFindings).toBeInstanceOf(Array);
    });

    it('should handle bullet point format', async () => {
      llmClient.extractText = vi.fn().mockReturnValue(`
- Key point 1 from research [1]
- Key point 2 supported by [2]
- Combined insight from [1], [2]
      `.trim());

      const input = {
        sources: [
          { content: 'Research content' },
          { content: 'Supporting evidence' },
        ],
        synthesisGoal: 'List key insights',
        outputFormat: 'bullets' as const,
      };

      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.synthesis).toContain('-');
    });

    it('should include citations in output', async () => {
      const input = {
        sources: [
          { content: 'Content 1', url: 'https://example.com/1', title: 'Title 1' },
          { content: 'Content 2', url: 'https://example.com/2', title: 'Title 2' },
        ],
        synthesisGoal: 'Synthesize with citations',
      };

      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(result.data?.sources).toHaveLength(2);
      expect(result.data?.sources?.[0]).toHaveProperty('citationNumber', 1);
      expect(result.data?.sources?.[0]).toHaveProperty('url');
      expect(result.data?.sources?.[0]).toHaveProperty('title');
    });

    it('should calculate confidence based on source count', async () => {
      const inputFewSources = {
        sources: [
          { content: 'Content 1' },
        ],
        synthesisGoal: 'Synthesize',
      };

      const resultFew = await synthesizeTool.execute(inputFewSources, context);

      const inputManySources = {
        sources: [
          { content: 'Content 1' },
          { content: 'Content 2' },
          { content: 'Content 3' },
          { content: 'Content 4' },
        ],
        synthesisGoal: 'Synthesize',
      };

      const resultMany = await synthesizeTool.execute(inputManySources, context);

      expect(resultMany.data?.confidence).toBeGreaterThan(resultFew.data?.confidence!);
    });

    it('should respect maxLength parameter', async () => {
      const input = {
        sources: [
          { content: 'Long content that needs to be synthesized' },
          { content: 'More long content to be included' },
        ],
        synthesisGoal: 'Summarize briefly',
        maxLength: 500, // Set to valid range (100-10000)
      };

      const result = await synthesizeTool.execute(input, context);

      // Should successfully complete synthesis with maxLength parameter
      expect(result.success).toBe(true);
      expect(result.data?.synthesis).toBeDefined();
    });

    it('should warn when given only one source', async () => {
      const input = {
        sources: [
          { content: 'Single source content' },
        ],
        synthesisGoal: 'Try to synthesize',
      };

      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('validateInput()', () => {
    it('should validate required sources field', async () => {
      const input = { synthesisGoal: 'Test' };
      const result = await synthesizeTool.execute(input as any, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should validate required synthesisGoal field', async () => {
      const input = { sources: [{ content: 'test' }] };
      const result = await synthesizeTool.execute(input as any, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should reject empty sources array', async () => {
      const input = { sources: [], synthesisGoal: 'Test' };
      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should reject sources without content', async () => {
      const input = {
        sources: [{ content: '' }],
        synthesisGoal: 'Test',
      };
      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input validation failed');
    });

    it('should validate outputFormat', async () => {
      const input = {
        sources: [{ content: 'test' }],
        synthesisGoal: 'Test',
        outputFormat: 'invalid',
      };
      const isValid = await synthesizeTool.validateInput(input as any);

      expect(isValid).toBe(false);
    });

    it('should validate maxLength range', async () => {
      const inputTooLow = {
        sources: [{ content: 'test' }],
        synthesisGoal: 'Test',
        maxLength: 50,
      };
      expect(await synthesizeTool.validateInput(inputTooLow)).toBe(false);

      const inputTooHigh = {
        sources: [{ content: 'test' }],
        synthesisGoal: 'Test',
        maxLength: 15000,
      };
      expect(await synthesizeTool.validateInput(inputTooHigh)).toBe(false);

      const inputValid = {
        sources: [{ content: 'test' }],
        synthesisGoal: 'Test',
        maxLength: 500,
      };
      expect(await synthesizeTool.validateInput(inputValid)).toBe(true);
    });
  });

  describe('getInputSchema()', () => {
    it('should return valid JSON schema', () => {
      const schema = synthesizeTool.getInputSchema();

      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
      expect((schema as any).required).toContain('sources');
      expect((schema as any).required).toContain('synthesisGoal');
    });

    it('should define valid output formats', () => {
      const schema = synthesizeTool.getInputSchema() as any;

      expect(schema.properties.outputFormat.enum).toEqual([
        'summary',
        'report',
        'bullets',
        'structured',
      ]);
    });

    it('should define sources schema', () => {
      const schema = synthesizeTool.getInputSchema() as any;

      expect(schema.properties.sources.items).toBeDefined();
      expect(schema.properties.sources.items.properties).toHaveProperty('content');
      expect(schema.properties.sources.minItems).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      llmClient.complete = vi.fn().mockRejectedValue(new Error('LLM error'));

      const input = {
        sources: [{ content: 'test' }, { content: 'test2' }],
        synthesisGoal: 'Test',
      };
      const result = await synthesizeTool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('metadata', () => {
    it('should have required metadata properties', () => {
      expect(synthesizeTool.name).toBe('synthesizer');
      expect(synthesizeTool.description).toBeDefined();
      expect(synthesizeTool.version).toBe('1.0.0');
    });

    it('should include metadata in results', async () => {
      const input = {
        sources: [{ content: 'test' }, { content: 'test2' }],
        synthesisGoal: 'Test',
      };

      const result = await synthesizeTool.execute(input, context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty('sourceCount');
      expect(result.metadata).toHaveProperty('synthesisTime');
      expect(result.metadata).toHaveProperty('confidence');
    });
  });
});
