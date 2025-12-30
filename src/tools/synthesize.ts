/**
 * Synthesize Tool
 * Synthesize information from multiple sources
 */

import { BaseTool } from './base-tool';
import {
  SynthesizeInput,
  SynthesizeOutput,
  SynthesizeConfig,
  SynthesisSection,
  ToolResult,
  ToolContext,
} from './types';
import { LLMClient } from '../llm/client';

/**
 * SynthesizeTool - Combine information from multiple sources
 *
 * Key features:
 * - Synthesize information from multiple sources
 * - Cross-reference findings
 * - Track citations
 * - Handle contradictory information
 * - Generate different output formats
 * - Confidence scoring
 *
 * Output formats:
 * - summary: Concise synthesis
 * - report: Structured report with sections
 * - bullets: Bullet-point findings
 * - structured: Structured data with sources
 */
export class SynthesizeTool extends BaseTool<
  SynthesizeInput,
  SynthesizeOutput,
  SynthesizeConfig
> {
  readonly name = 'synthesizer';
  readonly description = 'Synthesize information from multiple sources into coherent output';
  readonly version = '1.0.0';

  constructor(
    config: SynthesizeConfig,
    private readonly llmClient: LLMClient
  ) {
    super({
      enabled: true,
      timeout: 90000, // Longer timeout for synthesis
      llmModel: 'claude-sonnet-4-5-20250929',
      maxTokens: 8000,
      temperature: 0.4,
      citationStyle: 'inline',
      ...config,
    });
  }

  /**
   * Execute synthesis
   */
  protected async executeImpl(
    input: SynthesizeInput,
    context: ToolContext
  ): Promise<ToolResult<SynthesizeOutput>> {
    const startTime = Date.now();

    try {
      // Step 1 - Validate we have enough sources
      if (input.sources.length < 2) {
        context.logger.warn(`[${this.name}] Synthesis works best with 2+ sources (got ${input.sources.length})`);
      }

      context.logger.debug(`[${this.name}] Starting synthesis`, {
        sourceCount: input.sources.length,
        goal: input.synthesisGoal,
        outputFormat: input.outputFormat || 'summary',
      });

      // Step 2 - Prepare sources for LLM
      const formattedSources = this.formatSourcesForLLM(input.sources);

      // Step 3 - Build synthesis prompt based on output format
      const prompt = this.buildSynthesisPrompt(
        formattedSources,
        input.synthesisGoal,
        input.outputFormat || 'summary',
        input.maxLength
      );

      // Step 4 - Call LLM for synthesis with retry logic
      const response = await this.withRetry(
        () => this.llmClient.complete([
          {
            role: 'user',
            content: prompt,
          },
        ], {
          model: this.config.llmModel,
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
        this.config.maxRetries || 2
      );

      const synthesisText = this.llmClient.extractText(response).trim();

      // Step 5 - Parse structured output if needed
      let sections: SynthesisSection[] | undefined;
      let keyFindings: string[] | undefined;

      if (input.outputFormat === 'structured' || input.outputFormat === 'report') {
        const structured = this.parseStructuredSynthesis(synthesisText);
        sections = structured.sections;
        keyFindings = structured.keyFindings;
      }

      // Step 6 - Extract and format citations
      const citations = this.extractCitations(input.sources);

      // Step 7 - Calculate confidence score
      const confidence = this.calculateConfidence(input.sources);

      // Step 8 - Create output
      const output: SynthesizeOutput = {
        synthesis: synthesisText,
        sections,
        keyFindings,
        sources: citations,
        confidence,
      };

      context.logger.info(`[${this.name}] Synthesis completed`, {
        sourceCount: input.sources.length,
        outputFormat: input.outputFormat || 'summary',
        synthesisLength: synthesisText.length,
        confidence,
      });

      return this.createSuccessResult(output, {
        sourceCount: input.sources.length,
        synthesisTime: Date.now() - startTime,
        confidence,
      });
    } catch (error) {
      context.logger.error(`[${this.name}] Synthesis failed`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Validate synthesize input
   */
  async validateInput(input: SynthesizeInput): Promise<boolean> {
    // Check required fields
    if (!this.hasRequiredFields(input, ['sources', 'synthesisGoal'])) {
      return false;
    }

    // Validate we have at least one source
    if (!Array.isArray(input.sources) || input.sources.length === 0) {
      return false;
    }

    // Validate each source has content
    for (const source of input.sources) {
      if (!source.content || source.content.trim().length === 0) {
        return false;
      }
    }

    // Validate synthesis goal is not empty
    if (input.synthesisGoal.trim().length === 0) {
      return false;
    }

    // Validate output format if provided
    if (input.outputFormat !== undefined) {
      const validFormats = ['summary', 'report', 'bullets', 'structured'];
      if (!validFormats.includes(input.outputFormat)) {
        return false;
      }
    }

    // Validate maxLength if provided
    if (input.maxLength !== undefined) {
      if (input.maxLength < 100 || input.maxLength > 10000) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get input schema for LLM tool use
   */
  getInputSchema(): object {
    return {
      type: 'object',
      properties: {
        sources: {
          type: 'array',
          description: 'Array of sources to synthesize',
          items: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content from the source',
              },
              url: {
                type: 'string',
                description: 'Source URL (optional)',
              },
              title: {
                type: 'string',
                description: 'Source title (optional)',
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata (optional)',
              },
            },
            required: ['content'],
          },
          minItems: 1,
        },
        synthesisGoal: {
          type: 'string',
          description: 'What you want to achieve with the synthesis',
        },
        outputFormat: {
          type: 'string',
          enum: ['summary', 'report', 'bullets', 'structured'],
          description: 'Desired output format',
          default: 'summary',
        },
        maxLength: {
          type: 'number',
          description: 'Maximum length of synthesis in words',
          minimum: 100,
          maximum: 10000,
        },
      },
      required: ['sources', 'synthesisGoal'],
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Format sources for LLM prompt
   */
  private formatSourcesForLLM(sources: Array<any>): string {
    return sources
      .map((source, index) => {
        const citation = `[${index + 1}]`;
        const title = source.title ? `Title: ${source.title}\n` : '';
        const url = source.url ? `URL: ${source.url}\n` : '';
        const truncatedContent = this.truncateText(source.content, 3000);

        return `Source ${citation}:
${title}${url}Content:
${truncatedContent}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Build synthesis prompt
   */
  private buildSynthesisPrompt(
    formattedSources: string,
    goal: string,
    format: string,
    maxLength?: number
  ): string {
    const lengthGuidance = maxLength
      ? `Keep the synthesis to approximately ${maxLength} words.`
      : '';

    const formatInstructions: Record<string, string> = {
      summary: 'Provide a concise summary that synthesizes the key information from all sources.',
      report: 'Create a structured report with sections (use ## for headings), detailed analysis, and citations. Include a "Key Findings" section.',
      bullets: 'Present the synthesis as clear, organized bullet points with citations. Group related information together.',
      structured: 'Return valid JSON with this structure: {"sections": [{"heading": "...", "content": "...", "sources": ["1", "2"]}], "keyFindings": ["finding1", "finding2"]}',
    };

    return `You are synthesizing information from multiple sources to create a comprehensive analysis.

Goal: ${goal}

Sources:
${formattedSources}

Task: ${formatInstructions[format] || formatInstructions.summary}
${lengthGuidance}

Guidelines:
1. Integrate information from ALL sources
2. Cross-reference and compare findings across sources
3. Note any contradictions or disagreements between sources
4. Include citations using [1], [2], etc. notation
5. Highlight key insights and patterns
6. Maintain objectivity and balance
7. Synthesize rather than summarize - find connections and themes

Synthesis:`;
  }

  /**
   * Parse structured synthesis output
   */
  private parseStructuredSynthesis(text: string): {
    sections: SynthesisSection[];
    keyFindings: string[];
  } {
    // Try to parse as JSON first (for structured format)
    try {
      const parsed = JSON.parse(text);
      return {
        sections: parsed.sections || [],
        keyFindings: parsed.keyFindings || [],
      };
    } catch {
      // Parse markdown-style sections
      const sections: SynthesisSection[] = [];
      const keyFindings: string[] = [];

      // Split by headings (## Heading)
      const headingRegex = /^##\s+(.+)$/gm;
      const parts = text.split(headingRegex);

      for (let i = 1; i < parts.length; i += 2) {
        const heading = parts[i].trim();
        const content = parts[i + 1]?.trim() || '';
        const sources = this.extractSourceReferences(content);

        sections.push({ heading, content, sources });

        // Extract key findings from "Key Findings" section
        if (heading.toLowerCase().includes('key') && heading.toLowerCase().includes('finding')) {
          const bullets = content.match(/^[-*•]\s+(.+)$/gm) || [];
          keyFindings.push(...bullets.map(b => b.replace(/^[-*•]\s+/, '').trim()));
        }
      }

      return { sections, keyFindings };
    }
  }

  /**
   * Extract source references from text
   */
  private extractSourceReferences(text: string): string[] {
    const references: string[] = [];
    const citationRegex = /\[(\d+)\]/g;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      references.push(match[1]);
    }

    return [...new Set(references)]; // Remove duplicates
  }

  /**
   * Extract and format citations
   */
  private extractCitations(sources: Array<any>): Array<{
    url?: string;
    title?: string;
    citationNumber: number;
  }> {
    return sources.map((source, index) => ({
      url: source.url,
      title: source.title,
      citationNumber: index + 1,
    }));
  }

  /**
   * Calculate confidence score for synthesis
   */
  private calculateConfidence(sources: Array<any>): number {
    // Factors that increase confidence:
    // 1. More sources
    // 2. Higher quality sources (if metadata available)
    // 3. Content length (indicates more detail)

    let confidence = 0.5; // Base confidence

    // More sources increase confidence (up to 0.3 bonus)
    const sourceBonus = Math.min(sources.length * 0.1, 0.3);
    confidence += sourceBonus;

    // Check source quality if metadata available
    const hasQualitySources = sources.some(
      s => s.metadata?.credibilityScore && s.metadata.credibilityScore > 0.8
    );
    if (hasQualitySources) {
      confidence += 0.1;
    }

    // Check for substantial content
    const avgContentLength = sources.reduce((sum, s) => sum + s.content.length, 0) / sources.length;
    if (avgContentLength > 1000) {
      confidence += 0.1;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Detect and handle contradictions between sources
   * (Optional method for future enhancement)
   */
  private async detectContradictions(sources: Array<any>): Promise<string[]> {
    const formattedSources = this.formatSourcesForLLM(sources);

    const response = await this.llmClient.complete([
      {
        role: 'user',
        content: `Analyze these sources and identify any contradictions or disagreements:

${formattedSources}

Return ONLY a valid JSON array of contradictions: ["contradiction 1", "contradiction 2"]
If no contradictions, return empty array: []`,
      },
    ], {
      model: this.config.llmModel,
      maxTokens: 2000,
      temperature: this.config.temperature,
    });

    const text = this.llmClient.extractText(response).trim();

    try {
      const contradictions = JSON.parse(text);
      return Array.isArray(contradictions) ? contradictions : [];
    } catch {
      return [];
    }
  }
}

/**
 * Factory function to create SynthesizeTool instance
 */
export function createSynthesizeTool(
  config: SynthesizeConfig,
  llmClient: LLMClient
): SynthesizeTool {
  return new SynthesizeTool(config, llmClient);
}
