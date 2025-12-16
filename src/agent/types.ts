/**
 * Core types for the Autonomous Research Agent
 */

// ============================================================================
// Agent Identity & Profile
// ============================================================================

export interface AgentProfile {
  id: string;
  name: string;
  expertise: string[];
  preferences: ResearchPreferences;
  createdAt: Date;
  updatedAt: Date;
  stats: AgentStatistics;
}

export interface ResearchPreferences {
  sourceTypes: string[]; // e.g., ["academic", "news", "blogs"]
  depth: "shallow" | "moderate" | "deep";
  verificationLevel: "low" | "medium" | "high";
  maxSourcesPerTopic: number;
  preferredDomains?: string[];
  excludedDomains?: string[];
}

export interface AgentStatistics {
  totalSessions: number;
  totalActions: number;
  successfulResearches: number;
  averageSessionDuration: number; // in seconds
  topTopics: Array<{ topic: string; count: number }>;
  toolUsageStats: Record<string, number>;
}

// ============================================================================
// Session Management
// ============================================================================

export interface Session {
  id: string;
  userId?: string;
  topic: string;
  goal: Goal;
  state: AgentState;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  parentSessionId?: string; // For resumed sessions
}

export type SessionStatus = 
  | "active" 
  | "paused" 
  | "completed" 
  | "failed" 
  | "cancelled";

export interface Goal {
  description: string;
  successCriteria: string[];
  constraints?: string[];
  estimatedComplexity: "simple" | "moderate" | "complex";
}

// ============================================================================
// Agent State
// ============================================================================

export interface AgentState {
  sessionId: string;
  currentGoal: Goal;
  plan: ResearchPlan;
  progress: Progress;
  workingMemory: WorkingMemory;
  reflections: Reflection[];
  iterationCount: number;
  lastActionTimestamp: Date;
}

export interface ResearchPlan {
  id: string;
  strategy: string;
  steps: PlannedStep[];
  estimatedDuration: number; // in seconds
  createdAt: Date;
  revisedAt?: Date;
  revisionReason?: string;
}

export interface PlannedStep {
  id: string;
  description: string;
  action: string; // Tool to use
  dependencies: string[]; // IDs of steps that must complete first
  status: "pending" | "in_progress" | "completed" | "skipped" | "failed";
  expectedOutcome: string;
}

export interface Progress {
  stepsCompleted: number;
  stepsTotal: number;
  sourcesGathered: number;
  factsExtracted: number;
  currentPhase: ResearchPhase;
  confidence: number; // 0-1
}

export type ResearchPhase = 
  | "planning"
  | "gathering"
  | "analyzing"
  | "synthesizing"
  | "verifying"
  | "completed";

export interface WorkingMemory {
  recentActions: Action[];
  recentOutcomes: Outcome[];
  keyFindings: Finding[];
  openQuestions: string[];
  hypotheses: Hypothesis[];
}

// ============================================================================
// Actions & Outcomes
// ============================================================================

export interface Action {
  id: string;
  sessionId: string;
  type: ActionType;
  tool: string;
  parameters: Record<string, any>;
  reasoning: string;
  strategy?: string; // Which strategy is this part of
  timestamp: Date;
}

export type ActionType = 
  | "search"
  | "fetch"
  | "analyze"
  | "extract"
  | "verify"
  | "synthesize"
  | "reflect"
  | "replan";

export interface Outcome {
  actionId: string;
  success: boolean;
  result?: any;
  error?: string;
  observations: string[];
  duration: number; // milliseconds
  metadata: Record<string, any>;
  timestamp: Date;
}

// ============================================================================
// Research Findings
// ============================================================================

export interface Finding {
  id: string;
  content: string;
  source: Source;
  confidence: number; // 0-1
  relevance: number; // 0-1
  timestamp: Date;
  verificationStatus: "unverified" | "verified" | "disputed";
  relatedFindings: string[]; // IDs of related findings
}

export interface Source {
  url: string;
  title: string;
  type: "webpage" | "pdf" | "academic" | "news" | "social" | "other";
  author?: string;
  publishDate?: Date;
  credibilityScore?: number;
}

export interface Hypothesis {
  id: string;
  statement: string;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  status: "active" | "confirmed" | "refuted" | "needs_more_data";
}

// ============================================================================
// Reflection
// ============================================================================

export interface Reflection {
  id: string;
  sessionId: string;
  iterationNumber: number;
  timestamp: Date;
  
  // What happened
  actionsSinceLastReflection: string[];
  outcomesSinceLastReflection: string[];
  
  // Analysis
  progressAssessment: ProgressAssessment;
  strategyEvaluation: StrategyEvaluation;
  learnings: string[];
  
  // Decisions
  shouldReplan: boolean;
  adjustments: string[];
  nextFocus: string;
}

export interface ProgressAssessment {
  isOnTrack: boolean;
  progressRate: number; // steps per minute
  estimatedCompletion: number; // iterations remaining
  blockers: string[];
  achievements: string[];
}

export interface StrategyEvaluation {
  currentStrategy: string;
  effectiveness: number; // 0-1
  strengths: string[];
  weaknesses: string[];
  alternativeStrategies: string[];
  recommendation: "continue" | "adjust" | "change";
}

// ============================================================================
// Reasoning
// ============================================================================

export interface Reasoning {
  id: string;
  context: ReasoningContext;
  analysis: string;
  options: ReasoningOption[];
  selectedOption: string;
  confidence: number;
  timestamp: Date;
}

export interface ReasoningContext {
  currentGoal: Goal;
  currentProgress: Progress;
  recentActions: string[];
  recentOutcomes: string[];
  availableTools: string[];
  relevantMemories: string[];
  constraints: string[];
}

export interface ReasoningOption {
  id: string;
  action: string;
  rationale: string;
  expectedBenefit: string;
  potentialRisks: string[];
  estimatedCost: number; // API calls, time, etc.
  confidence: number;
}

// ============================================================================
// Memory Types
// ============================================================================

export interface EpisodicMemory {
  id: string;
  sessionId: string;
  timestamp: Date;
  
  // What happened
  topic: string;
  actions: Action[];
  outcomes: Outcome[];
  findings: Finding[];
  
  // Metadata
  duration: number;
  success: boolean;
  feedback?: UserFeedback;
  
  // For retrieval
  summary: string;
  tags: string[];
  embedding?: number[];
}

export interface SemanticMemory {
  id: string;
  content: string;
  category: string;
  subcategory?: string;
  
  // Metadata
  source: string; // Where was this learned
  confidence: number;
  relevance: number;
  
  // Usage tracking
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  lastModified: Date;
  
  // For retrieval
  tags: string[];
  relatedFacts: string[]; // IDs
  embedding?: number[];
}

export interface ProceduralMemory {
  id: string;
  strategyName: string;
  description: string;
  
  // When to use this strategy
  applicableContexts: string[];
  requiredTools: string[];
  
  // Performance tracking
  successRate: number;
  averageDuration: number;
  timesUsed: number;
  
  // Evolution
  refinements: Refinement[];
  createdAt: Date;
  lastUsed: Date;
  lastRefined: Date;
}

export interface Refinement {
  id: string;
  timestamp: Date;
  reason: string;
  change: string;
  expectedImprovement: string;
  actualImprovement?: number;
}

// ============================================================================
// User Feedback
// ============================================================================

export interface UserFeedback {
  sessionId: string;
  timestamp: Date;
  rating: number; // 1-5
  helpful: boolean;
  comments?: string;
  specificFeedback: {
    sources?: "too_many" | "too_few" | "good";
    depth?: "too_shallow" | "too_deep" | "good";
    accuracy?: "inaccurate" | "mostly_accurate" | "very_accurate";
    relevance?: "off_topic" | "somewhat_relevant" | "highly_relevant";
  };
  preferences?: Partial<ResearchPreferences>;
}

// ============================================================================
// Result Types
// ============================================================================

export interface ResearchResult {
  sessionId: string;
  topic: string;
  goal: Goal;
  
  // Core output
  synthesis: string;
  keyFindings: Finding[];
  sources: Source[];
  
  // Metadata
  confidence: number;
  completeness: number; // 0-1
  duration: number; // seconds
  
  // Process information
  totalActions: number;
  totalReflections: number;
  strategiesUsed: string[];
  
  // For learning
  successfulApproaches: string[];
  challenges: string[];
  suggestions: string[];
}

// ============================================================================
// Tool Interfaces
// ============================================================================

export interface SearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
    score: number;
  }>;
  totalResults: number;
  timestamp: Date;
}

export interface FetchedContent {
  url: string;
  title: string;
  content: string;
  contentType: string;
  wordCount: number;
  author?: string;
  publishDate?: Date;
  extractedAt: Date;
}

export interface AnalysisResult {
  content: string;
  entities: Entity[];
  keyPoints: string[];
  sentiment?: "positive" | "neutral" | "negative";
  topics: string[];
  credibilityIndicators: string[];
}

export interface Entity {
  name: string;
  type: "person" | "organization" | "location" | "concept" | "other";
  mentions: number;
  context: string[];
}

export interface VerificationResult {
  claim: string;
  verified: boolean;
  confidence: number;
  supportingSources: Source[];
  contradictingSources: Source[];
  consensus: "strong" | "moderate" | "weak" | "none";
}

export interface Synthesis {
  summary: string;
  keyThemes: string[];
  mainPoints: string[];
  evidence: Array<{
    claim: string;
    support: string[];
  }>;
  gaps: string[];
  recommendations: string[];
}

// ============================================================================
// Configuration
// ============================================================================

export interface AgentConfig {
  maxIterations: number;
  reflectionInterval: number;
  maxMemoryItems: number;
  anthropicApiKey: string;
  anthropicModel: string;
  tavilyApiKey?: string;
  chromaHost: string;
  chromaPort: number;
  chromaAuthToken?: string;
  sqliteDbPath: string;
  logLevel: string;
  logDir: string;
}

// ============================================================================
// Memory Store Interfaces (for dependency injection)
// ============================================================================

export interface IDocumentStore {
  // Session operations
  createSession(session: Omit<Session, "id" | "createdAt" | "updatedAt">): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<void>;
  listSessions(filters?: SessionFilters): Promise<Session[]>;
  
  // Episode operations
  storeEpisode(episode: EpisodicMemory): Promise<void>;
  getEpisode(episodeId: string): Promise<EpisodicMemory | null>;
  listEpisodes(sessionId: string): Promise<EpisodicMemory[]>;
  
  // Semantic memory operations
  storeFact(fact: SemanticMemory): Promise<void>;
  getFact(factId: string): Promise<SemanticMemory | null>;
  updateFact(factId: string, updates: Partial<SemanticMemory>): Promise<void>;
  listFacts(filters?: FactFilters): Promise<SemanticMemory[]>;
  
  // Procedural memory operations
  storeStrategy(strategy: ProceduralMemory): Promise<void>;
  getStrategy(strategyId: string): Promise<ProceduralMemory | null>;
  updateStrategy(strategyId: string, updates: Partial<ProceduralMemory>): Promise<void>;
  listStrategies(): Promise<ProceduralMemory[]>;
  
  // Feedback operations
  storeFeedback(feedback: UserFeedback): Promise<void>;
  getFeedback(sessionId: string): Promise<UserFeedback | null>;
  
  // Cleanup
  close(): Promise<void>;
}

export interface IVectorStore {
  // Collection management
  createCollection(name: string): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  
  // Store embeddings
  storeEmbedding(
    collection: string,
    id: string,
    embedding: number[],
    metadata: Record<string, any>,
    document: string
  ): Promise<void>;
  
  // Search
  search(
    collection: string,
    queryEmbedding: number[],
    options?: {
      limit?: number;
      where?: Record<string, any>;
      minScore?: number;
    }
  ): Promise<SearchMatch[]>;
  
  // Retrieve by ID
  get(collection: string, id: string): Promise<VectorDocument | null>;
  
  // Delete
  delete(collection: string, id: string): Promise<void>;
  
  // Cleanup
  close(): Promise<void>;
}

export interface SearchMatch {
  id: string;
  score: number;
  document: string;
  metadata: Record<string, any>;
}

export interface VectorDocument {
  id: string;
  embedding: number[];
  document: string;
  metadata: Record<string, any>;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface SessionFilters {
  userId?: string;
  status?: SessionStatus;
  topic?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
}

export interface FactFilters {
  category?: string;
  minConfidence?: number;
  minRelevance?: number;
  tags?: string[];
  limit?: number;
}