/**
 * Tool System Types
 * Defines interfaces and types for the agent's tool system
 */

import { Logger } from '../utils/logger';

/**
 * Tool execution result
 * Generic result type that all tools return
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    duration?: number;
    tokensUsed?: number;
    cost?: number;
    source?: string;
    [key: string]: any;
  };
}

/**
 * Tool execution context
 * Provides tools with access to shared resources
 */
export interface ToolContext {
  logger: Logger;
  sessionId?: string;
  userId?: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Tool configuration
 * Base configuration that all tools can extend
 */
export interface ToolConfig {
  enabled?: boolean;
  timeout?: number;
  maxRetries?: number;
  [key: string]: any;
}

/**
 * Base tool interface
 * All tools must implement this interface
 */
export interface Tool<TInput = any, TOutput = any, TConfig extends ToolConfig = ToolConfig> {
  /**
   * Unique identifier for the tool
   */
  readonly name: string;

  /**
   * Human-readable description of what the tool does
   */
  readonly description: string;

  /**
   * Tool version for tracking changes
   */
  readonly version: string;

  /**
   * Configuration for the tool
   */
  config: TConfig;

  /**
   * Execute the tool with given input
   */
  execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>;

  /**
   * Validate input before execution
   */
  validateInput(input: TInput): Promise<boolean>;

  /**
   * Get JSON schema for tool input (for LLM tool use)
   */
  getInputSchema(): object;
}

// ============================================================================
// Search Tool Types
// ============================================================================

export interface SearchInput {
  query: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: Date;
  score?: number;
  domain?: string;
}

export interface SearchOutput {
  results: SearchResult[];
  totalResults: number;
  query: string;
  searchTime: number;
}

export interface SearchConfig extends ToolConfig {
  apiKey?: string;
  defaultMaxResults?: number;
  defaultSearchDepth?: 'basic' | 'advanced';
}

// ============================================================================
// Fetch Tool Types
// ============================================================================

export interface FetchInput {
  url: string;
  extractContent?: boolean;
  includeMetadata?: boolean;
  timeout?: number;
}

export interface FetchedContent {
  url: string;
  title?: string;
  content: string;
  contentType?: string;
  contentLength?: number;
  publishedDate?: Date;
  author?: string;
  metadata?: {
    description?: string;
    keywords?: string[];
    language?: string;
    [key: string]: any;
  };
}

export interface FetchOutput {
  content: FetchedContent;
  fetchTime: number;
  cached?: boolean;
}

export interface FetchConfig extends ToolConfig {
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
  validateSSL?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

// ============================================================================
// Analyze Tool Types
// ============================================================================

export interface AnalyzeInput {
  content: string;
  analysisType?: 'extract' | 'summarize' | 'classify' | 'sentiment' | 'all';
  extractionTargets?: {
    facts?: boolean;
    entities?: boolean;
    keyPhrases?: boolean;
    concepts?: boolean;
  };
}

export interface ExtractedEntity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'number' | 'other';
  confidence: number;
}

export interface ExtractedFact {
  statement: string;
  confidence: number;
  sources?: string[];
}

export interface AnalyzeOutput {
  summary?: string;
  facts?: ExtractedFact[];
  entities?: ExtractedEntity[];
  keyPhrases?: string[];
  concepts?: string[];
  sentiment?: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  classification?: {
    category: string;
    confidence: number;
  }[];
}

export interface AnalyzeConfig extends ToolConfig {
  llmModel?: string;
  maxTokens?: number;
  temperature?: number;
  defaultAnalysisType?: string;
}

// ============================================================================
// Synthesize Tool Types
// ============================================================================

export interface SynthesizeInput {
  sources: Array<{
    content: string;
    url?: string;
    title?: string;
    metadata?: any;
  }>;
  synthesisGoal: string;
  outputFormat?: 'summary' | 'report' | 'bullets' | 'structured';
  maxLength?: number;
}

export interface SynthesisSection {
  heading: string;
  content: string;
  sources: string[];
}

export interface SynthesizeOutput {
  synthesis: string;
  sections?: SynthesisSection[];
  keyFindings?: string[];
  sources: Array<{
    url?: string;
    title?: string;
    citationNumber: number;
  }>;
  confidence: number;
}

export interface SynthesizeConfig extends ToolConfig {
  llmModel?: string;
  maxTokens?: number;
  temperature?: number;
  citationStyle?: 'inline' | 'footnote' | 'endnote';
}

// ============================================================================
// Tool Registry Types
// ============================================================================

export interface ToolRegistryEntry {
  tool: Tool;
  metadata: {
    category: string;
    tags: string[];
    enabled: boolean;
    usageCount: number;
    lastUsed?: Date;
  };
}

export interface ToolExecutionLog {
  toolName: string;
  input: any;
  output: ToolResult;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  error?: string;
}
