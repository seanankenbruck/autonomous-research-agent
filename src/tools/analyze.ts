/**
 * Analyze Tool
 * Content analysis and information extraction
 */

import { BaseTool } from './base-tool';
import {
  AnalyzeInput,
  AnalyzeOutput,
  AnalyzeConfig,
  ExtractedEntity,
  ExtractedFact,
  ToolResult,
  ToolContext,
} from './types';
import { LLMClient } from '../llm/client';

/**
 * AnalyzeTool - Extract information and insights from content
 *
 * Key features:
 * - Fact extraction with confidence scores
 * - Named entity recognition (NER)
 * - Key phrase extraction
 * - Concept identification
 * - Summarization
 * - Sentiment analysis
 * - Content classification
 *
 * Uses LLM for:
 * - Fact extraction
 * - Summarization
 * - Concept extraction
 *
 * Can use NLP libraries for:
 * - Entity extraction (spaCy, compromise)
 * - Keyword extraction (natural, retext)
 * - Sentiment analysis (sentiment, natural)
 */
export class AnalyzeTool extends BaseTool<AnalyzeInput, AnalyzeOutput, AnalyzeConfig> {
  readonly name = 'content_analyzer';
  readonly description = 'Analyze content and extract facts, entities, and insights';
  readonly version = '1.0.0';

  constructor(
    config: AnalyzeConfig,
    private readonly llmClient: LLMClient
  ) {
    super({
      enabled: true,
      timeout: 60000, // Longer timeout for LLM calls
      llmModel: 'claude-sonnet-4-5-20250929',
      maxTokens: 4000,
      temperature: 0.3, // Lower temperature for more focused extraction
      defaultAnalysisType: 'all',
      ...config,
    });
  }

  /**
   * Execute content analysis
   */
  protected async executeImpl(
    input: AnalyzeInput,
    context: ToolContext
  ): Promise<ToolResult<AnalyzeOutput>> {
    const startTime = Date.now();

    try {
      const analysisType = input.analysisType || this.config.defaultAnalysisType;
      const output: AnalyzeOutput = {};

      context.logger.debug(`[${this.name}] Starting analysis`, {
        analysisType,
        contentLength: input.content.length,
      });

      // Execute different analysis types based on input
      if (analysisType === 'all' || analysisType === 'extract') {
        // Run all extraction tasks in parallel for efficiency
        const [facts, entities, keyPhrases, concepts] = await Promise.all([
          this.extractFacts(input.content, input.extractionTargets),
          this.extractEntities(input.content, input.extractionTargets),
          this.extractKeyPhrases(input.content, input.extractionTargets),
          this.extractConcepts(input.content, input.extractionTargets),
        ]);

        output.facts = facts;
        output.entities = entities;
        output.keyPhrases = keyPhrases;
        output.concepts = concepts;
      }

      if (analysisType === 'all' || analysisType === 'summarize') {
        output.summary = await this.summarize(input.content);
      }

      if (analysisType === 'all' || analysisType === 'sentiment') {
        output.sentiment = await this.analyzeSentiment(input.content);
      }

      if (analysisType === 'all' || analysisType === 'classify') {
        output.classification = await this.classify(input.content);
      }

      context.logger.info(`[${this.name}] Analysis completed`, {
        analysisType,
        factCount: output.facts?.length || 0,
        entityCount: output.entities?.length || 0,
        keyPhraseCount: output.keyPhrases?.length || 0,
        conceptCount: output.concepts?.length || 0,
      });

      return this.createSuccessResult(output, {
        analysisType,
        contentLength: input.content.length,
        analysisTime: Date.now() - startTime,
      });
    } catch (error) {
      context.logger.error(`[${this.name}] Analysis failed`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Validate analyze input
   */
  async validateInput(input: AnalyzeInput): Promise<boolean> {
    // Check required fields
    if (!this.hasRequiredFields(input, ['content'])) {
      return false;
    }

    // Validate content is not empty
    if (input.content.trim().length === 0) {
      return false;
    }

    // Validate content is not too long (prevent excessive token usage)
    if (input.content.length > 100000) {
      return false;
    }

    // Validate analysis type if provided
    if (input.analysisType !== undefined) {
      const validTypes = ['extract', 'summarize', 'classify', 'sentiment', 'all'];
      if (!validTypes.includes(input.analysisType)) {
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
        content: {
          type: 'string',
          description: 'The content to analyze',
        },
        analysisType: {
          type: 'string',
          enum: ['extract', 'summarize', 'classify', 'sentiment', 'all'],
          description: 'Type of analysis to perform',
          default: 'all',
        },
        extractionTargets: {
          type: 'object',
          description: 'Specific extraction targets',
          properties: {
            facts: {
              type: 'boolean',
              description: 'Extract factual statements',
              default: true,
            },
            entities: {
              type: 'boolean',
              description: 'Extract named entities (people, organizations, locations)',
              default: true,
            },
            keyPhrases: {
              type: 'boolean',
              description: 'Extract key phrases and terms',
              default: true,
            },
            concepts: {
              type: 'boolean',
              description: 'Extract main concepts and topics',
              default: true,
            },
          },
        },
      },
      required: ['content'],
    };
  }

  // ============================================================================
  // Private Analysis Methods
  // ============================================================================

  /**
   * Extract facts from content using LLM
   */
  private async extractFacts(
    content: string,
    targets?: { facts?: boolean }
  ): Promise<ExtractedFact[]> {
    if (targets?.facts === false) return [];

    const truncatedContent = this.truncateText(content, 8000);

    console.log('[DEBUG] extractFacts called with content length:', content.length);
    console.log('[DEBUG] Content preview (first 200 chars):', content.substring(0, 200));

    const response = await this.llmClient.complete([
      {
        role: 'user',
        content: `Extract factual statements from the following content. You MUST respond with ONLY valid JSON - no markdown, no code blocks, no explanations.

CRITICAL REQUIREMENTS:
- Each fact MUST be an object with THREE fields: "statement", "confidence", "sources"
- "statement" must be a complete factual sentence (string)
- "confidence" must be a decimal number between 0 and 1
- "sources" must be an array of strings (can be empty if no sources mentioned)
- DO NOT return an array of strings - each item MUST be an object

CORRECT FORMAT EXAMPLES:
[
  {
    "statement": "Quantum computers use qubits that can exist in superposition states",
    "confidence": 0.95,
    "sources": ["Nature Physics", "IBM Research"]
  },
  {
    "statement": "Google achieved quantum supremacy in 2019",
    "confidence": 0.9,
    "sources": []
  }
]

INCORRECT FORMATS (DO NOT USE):
["fact one", "fact two"]  ❌ WRONG - these are strings, not objects
[{"text": "fact"}]  ❌ WRONG - missing required fields

Content to analyze:
${truncatedContent}

Return your response as a JSON array of fact objects. If no facts found, return: []`,
      },
    ], {
      model: this.config.llmModel,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const text = this.llmClient.extractText(response).trim();

    // Log the raw response for debugging
    console.log('[DEBUG] Raw LLM response for fact extraction:', text.substring(0, 500));

    try {
      // Try to parse as JSON
      const facts = JSON.parse(text);
      if (!Array.isArray(facts)) {
        console.log('[DEBUG] LLM response is not an array:', typeof facts);
        return [];
      }

      const parsedFacts = facts.map(f => ({
        statement: f.statement || '',
        confidence: typeof f.confidence === 'number' ? f.confidence : 0.5,
        sources: Array.isArray(f.sources) ? f.sources : [],
      }));

      console.log('[DEBUG] Successfully parsed', parsedFacts.length, 'facts');
      return parsedFacts;
    } catch (error) {
      // Fallback: parse text-based response
      console.log('[DEBUG] JSON parse failed, using text parser. Error:', error instanceof Error ? error.message : String(error));
      return this.parseFactsFromText(text);
    }
  }

  /**
   * Extract named entities from content
   */
  private async extractEntities(
    content: string,
    targets?: { entities?: boolean }
  ): Promise<ExtractedEntity[]> {
    if (targets?.entities === false) return [];

    const truncatedContent = this.truncateText(content, 8000);

    const response = await this.llmClient.complete([
      {
        role: 'user',
        content: `Extract named entities from the content. Include:
- People names
- Organizations
- Locations
- Dates
- Numbers

Content:
${truncatedContent}

Return ONLY a valid JSON array in this exact format:
[{"text": "entity name", "type": "person", "confidence": 0.9}]

Valid types: "person", "organization", "location", "date", "number", "other"
If no entities found, return: []`,
      },
    ], {
      model: this.config.llmModel,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const text = this.llmClient.extractText(response).trim();

    try {
      const entities = JSON.parse(text);
      if (!Array.isArray(entities)) return [];

      return entities.map(e => ({
        text: e.text || '',
        type: e.type || 'other',
        confidence: typeof e.confidence === 'number' ? e.confidence : 0.7,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Extract key phrases from content
   */
  private async extractKeyPhrases(
    content: string,
    targets?: { keyPhrases?: boolean }
  ): Promise<string[]> {
    if (targets?.keyPhrases === false) return [];

    const truncatedContent = this.truncateText(content, 8000);

    const response = await this.llmClient.complete([
      {
        role: 'user',
        content: `Extract the 5-10 most important key phrases and terms from this content.
Return ONLY a valid JSON array of strings: ["phrase1", "phrase2", ...]

Content:
${truncatedContent}

If no key phrases found, return: []`,
      },
    ], {
      model: this.config.llmModel,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const text = this.llmClient.extractText(response).trim();

    try {
      const keyPhrases = JSON.parse(text);
      if (!Array.isArray(keyPhrases)) return [];
      return keyPhrases.filter(p => typeof p === 'string');
    } catch {
      return [];
    }
  }

  /**
   * Extract main concepts from content
   */
  private async extractConcepts(
    content: string,
    targets?: { concepts?: boolean }
  ): Promise<string[]> {
    if (targets?.concepts === false) return [];

    const truncatedContent = this.truncateText(content, 8000);

    const response = await this.llmClient.complete([
      {
        role: 'user',
        content: `Identify the 3-7 main concepts and topics discussed in this content.
Return ONLY a valid JSON array of concept strings: ["concept1", "concept2", ...]

Content:
${truncatedContent}

If no concepts found, return: []`,
      },
    ], {
      model: this.config.llmModel,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const text = this.llmClient.extractText(response).trim();

    try {
      const concepts = JSON.parse(text);
      if (!Array.isArray(concepts)) return [];
      return concepts.filter(c => typeof c === 'string');
    } catch {
      return [];
    }
  }

  /**
   * Summarize content
   */
  private async summarize(content: string): Promise<string> {
    const truncatedContent = this.truncateText(content, 10000);

    const response = await this.llmClient.complete([
      {
        role: 'user',
        content: `Provide a concise summary of the following content in 2-3 sentences:

${truncatedContent}`,
      },
    ], {
      model: this.config.llmModel,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return this.llmClient.extractText(response).trim();
  }

  /**
   * Analyze sentiment
   */
  private async analyzeSentiment(content: string): Promise<{
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  }> {
    const truncatedContent = this.truncateText(content, 8000);

    const response = await this.llmClient.complete([
      {
        role: 'user',
        content: `Analyze the sentiment of this content. Return ONLY valid JSON: {"score": 0.5, "label": "neutral"}
Score: -1 (very negative) to 1 (very positive)
Label: must be exactly "positive", "negative", or "neutral"

Content:
${truncatedContent}`,
      },
    ], {
      model: this.config.llmModel,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const text = this.llmClient.extractText(response).trim();

    try {
      const sentiment = JSON.parse(text);
      const score = typeof sentiment.score === 'number' ? sentiment.score : 0;
      const validLabels = ['positive', 'negative', 'neutral'];
      const label = validLabels.includes(sentiment.label) ? sentiment.label : 'neutral';

      return { score, label };
    } catch {
      return { score: 0, label: 'neutral' };
    }
  }

  /**
   * Classify content into categories
   */
  private async classify(content: string): Promise<Array<{
    category: string;
    confidence: number;
  }>> {
    const truncatedContent = this.truncateText(content, 8000);

    const response = await this.llmClient.complete([
      {
        role: 'user',
        content: `Classify this content into 1-3 relevant categories. Return ONLY valid JSON array:
[{"category": "technology", "confidence": 0.9}]

Possible categories: technology, science, business, politics, health, education, entertainment, sports, finance, culture, environment, law, etc.

Content:
${truncatedContent}

If uncertain, return: []`,
      },
    ], {
      model: this.config.llmModel,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const text = this.llmClient.extractText(response).trim();

    try {
      const classifications = JSON.parse(text);
      if (!Array.isArray(classifications)) return [];

      return classifications.map(c => ({
        category: c.category || '',
        confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Parse facts from text response (fallback for non-JSON responses)
   */
  private parseFactsFromText(text: string): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse patterns like "- Statement (confidence: 0.9)" or "• Statement"
      const match = line.match(/[-•]\s*(.+?)(?:\s*\(confidence:\s*([0-9.]+)\))?$/);
      if (match) {
        facts.push({
          statement: match[1].trim(),
          confidence: match[2] ? parseFloat(match[2]) : 0.7,
          sources: [],
        });
      }
    }

    return facts;
  }
}

/**
 * Factory function to create AnalyzeTool instance
 */
export function createAnalyzeTool(
  config: AnalyzeConfig,
  llmClient: LLMClient
): AnalyzeTool {
  return new AnalyzeTool(config, llmClient);
}
