import { EpisodicManager } from './managers/episodic-manager';
import { SemanticManager } from './managers/semantic-manager';
import { ProceduralManager } from './managers/procedural-manager';
import { SessionManager } from './managers/session-manager';
import { SQLiteDocumentStore } from './stores/document-store';
import { ChromaVectorStore } from './stores/vector-store';
import { EmbeddingClient } from '../llm/embeddings';
import { LLMClient } from '../llm/client';
import { Logger } from '../utils/logger';
import type {
  Session,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  Action,
  Outcome,
  Finding,
  Goal,
} from '../agent/types';

/**
 * Configuration for the memory system
 */
interface MemorySystemConfig {
  // Consolidation settings
  consolidationThresholdDays: number; // Auto-consolidate episodes older than this
  autoConsolidate: boolean; // Enable automatic consolidation
  
  // Reflection settings
  reflectionInterval: number; // Reflect after N actions
  autoReflect: boolean; // Enable automatic reflection
  
  // Context settings
  maxContextTokens: number; // Maximum tokens for context building
  
  // Relevance decay
  factRelevanceDecayDays: number; // Half-life for fact relevance decay
}

/**
 * Context bundle for agent with memories from all types
 */
interface MemoryContext {
  episodes: EpisodicMemory[];
  facts: SemanticMemory[];
  strategies: ProceduralMemory[];
  totalTokens: number;
  truncated: {
    episodes: boolean;
    facts: boolean;
    strategies: boolean;
  };
}

/**
 * Result from storing an experience
 */
interface StoreExperienceResult {
  episode: EpisodicMemory;
  extractedFacts: SemanticMemory[];
  shouldReflect: boolean; // Whether it's time to reflect
}

/**
 * Main Memory System
 * Coordinates all memory managers and provides unified interface
 */
export class MemorySystem {
  private config: MemorySystemConfig;
  private actionCount: number = 0; // Track for reflection triggering
  
  constructor(
    private readonly episodicManager: EpisodicManager,
    private readonly semanticManager: SemanticManager,
    private readonly proceduralManager: ProceduralManager,
    private readonly sessionManager: SessionManager,
    private readonly logger: Logger,
    config?: Partial<MemorySystemConfig>
  ) {
    // Merge provided config with defaults
    this.config = {
      consolidationThresholdDays: 7,
      autoConsolidate: true,
      reflectionInterval: 5, // Reflect every 5 actions
      autoReflect: true,
      maxContextTokens: 4000,
      factRelevanceDecayDays: 60,
      ...config,
    };
  }

  // ============================================================================
  // Session Management (delegates to SessionManager)
  // ============================================================================

  /**
   * Start a new session
   */
  async startSession(
    topic: string,
    goal: Goal,
    userId?: string
  ): Promise<Session> {
    this.logger.info('Starting new session', { topic });
    const session = await this.sessionManager.createSession(topic, goal, { userId });
    this.logger.info(`Session started: ${session.id}`);
    return session;
  }

  /**
   * Get current active session
   */
  getCurrentSession(): Session | null {
    return this.sessionManager.getCurrentSession();
  }

  /**
   * Complete current session
   */
  async completeSession(): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) {
      this.logger.warn('No active session to complete');
      return;
    }

    this.logger.info(`Completing session: ${session.id}`);

    // Optionally consolidate memories if auto-consolidation is enabled
    if (this.config.autoConsolidate) {
      await this.consolidateMemories();
    }

    await this.sessionManager.completeCurrentSession();
    this.logger.info('Session completed');
  }

  // ============================================================================
  // Experience Storage (Episodic + Semantic Extraction)
  // ============================================================================

  /**
   * Store an experience (episode) and optionally extract facts
   * This is the main entry point for storing agent experiences
   */
  async storeExperience(
    topic: string,
    actions: Action[],
    outcomes: Outcome[],
    findings: Finding[],
    summary: string,
    options?: {
      extractFacts?: boolean; // Default true
      tags?: string[];
    }
  ): Promise<StoreExperienceResult> {
    const extractFacts = options?.extractFacts ?? true;

    // Get current session (required)
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session - call startSession() first');
    }

    // Store episode via episodic manager
    const episode = await this.episodicManager.createEpisode(
      session.id,
      topic,
      actions,
      outcomes,
      findings,
      summary,
      { tags: options?.tags }
    );

    // Optionally extract facts from episode
    let extractedFacts: SemanticMemory[] = [];
    if (extractFacts) {
      const result = await this.semanticManager.extractFactsFromEpisode(episode);
      extractedFacts = result.facts;
    }

    // Increment action count
    this.actionCount += actions.length;

    // Check if reflection should be triggered
    const shouldReflect = this.shouldReflect();

    this.logger.info(
      `Stored experience: ${extractedFacts.length} facts extracted, shouldReflect: ${shouldReflect}`
    );

    return {
      episode,
      extractedFacts,
      shouldReflect,
    };
  }

  /**
   * Store a strategy
   */
  async storeStrategy(
    strategyName: string,
    description: string,
    applicableContexts: string[],
    requiredTools: string[],
    options?: {
      successRate?: number;
      averageDuration?: number;
    }
  ): Promise<ProceduralMemory> {
    return this.proceduralManager.storeStrategy({
      strategyName,
      description,
      applicableContexts,
      requiredTools,
      successRate: options?.successRate ?? 0.5,
      averageDuration: options?.averageDuration ?? 0,
      timesUsed: 0,
      refinements: [],
      lastUsed: new Date(),
    });
  }

  /**
   * Record usage of a strategy
   */
  async recordStrategyUse(
    strategyId: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    await this.proceduralManager.recordStrategyUse(strategyId, success, duration);
  }

  // ============================================================================
  // Context Building (retrieve relevant memories)
  // ============================================================================

  /**
   * Build comprehensive memory context for agent
   * Retrieves relevant memories from all types within token budget
   */
  async buildContext(
    query: string,
    options?: {
      maxTokens?: number;
      includeEpisodes?: boolean;
      includeFacts?: boolean;
      includeStrategies?: boolean;
      episodeTokens?: number; // Specific allocation
      factTokens?: number;
      strategyTokens?: number;
    }
  ): Promise<MemoryContext> {
    const maxTokens = options?.maxTokens ?? this.config.maxContextTokens;
    const includeEpisodes = options?.includeEpisodes ?? true;
    const includeFacts = options?.includeFacts ?? true;
    const includeStrategies = options?.includeStrategies ?? true;

    // Allocate token budget across memory types
    // Default: 40% episodes, 40% facts, 20% strategies
    const episodeTokens = options?.episodeTokens ?? Math.floor(maxTokens * 0.4);
    const factTokens = options?.factTokens ?? Math.floor(maxTokens * 0.4);
    const strategyTokens = options?.strategyTokens ?? Math.floor(maxTokens * 0.2);

    this.logger.debug('Building memory context', {
      maxTokens,
      episodeTokens,
      factTokens,
      strategyTokens
    });

    // Retrieve from each manager in parallel
    const [episodeResult, factResult, strategyResult] = await Promise.all([
      includeEpisodes
        ? this.episodicManager.buildContext(query, episodeTokens)
        : Promise.resolve({ episodes: [], totalTokens: 0, truncated: false }),
      includeFacts
        ? this.semanticManager.buildKnowledgeContext(query, factTokens)
        : Promise.resolve({ facts: [], totalTokens: 0, truncated: false }),
      includeStrategies
        ? this.proceduralManager.searchStrategies(query, { maxResults: 5 })
        : Promise.resolve([]),
    ]);

    // Combine results
    const context: MemoryContext = {
      episodes: episodeResult.episodes,
      facts: factResult.facts,
      strategies: strategyResult,
      totalTokens: episodeResult.totalTokens + factResult.totalTokens,
      truncated: {
        episodes: episodeResult.truncated,
        facts: factResult.truncated,
        strategies: false, // Strategy search doesn't use token-based truncation
      },
    };

    this.logger.info(
      `Built context: ${context.episodes.length} episodes, ${context.facts.length} facts, ` +
      `${context.strategies.length} strategies (${context.totalTokens} tokens)`
    );

    return context;
  }

  /**
   * Format memory context as text for LLM prompt
   */
  formatContextForPrompt(context: MemoryContext): string {
    const sections: string[] = [];

    // Format episodes section
    if (context.episodes.length > 0) {
      sections.push('## Past Episodes\n');
      for (const episode of context.episodes) {
        const timestamp = episode.timestamp.toISOString();
        const status = episode.success ? '✓' : '✗';
        sections.push(`### ${status} ${episode.topic} (${timestamp})`);
        sections.push(episode.summary);
        if (episode.tags.length > 0) {
          sections.push(`Tags: ${episode.tags.join(', ')}`);
        }
        sections.push(''); // Empty line
      }
    }

    // Format facts section (use semantic manager formatter)
    if (context.facts.length > 0) {
      sections.push(this.semanticManager.formatFactsAsContext(context.facts));
    }

    // Format strategies section (use procedural manager formatter)
    if (context.strategies.length > 0) {
      sections.push(this.proceduralManager.formatStrategiesAsContext(context.strategies));
    }

    // Add truncation warnings
    const warnings: string[] = [];
    if (context.truncated.episodes) warnings.push('episodes');
    if (context.truncated.facts) warnings.push('facts');
    if (warnings.length > 0) {
      sections.push(`\n*Note: ${warnings.join(' and ')} truncated due to token limit*`);
    }

    return sections.join('\n');
  }

  // ============================================================================
  // Search & Retrieval
  // ============================================================================

  /**
   * Search across all memory types
   */
  async searchMemories(
    query: string,
    options?: {
      maxResults?: number;
      similarityThreshold?: number;
      types?: Array<'episodic' | 'semantic' | 'procedural'>;
    }
  ): Promise<{
    episodes: EpisodicMemory[];
    facts: SemanticMemory[];
    strategies: ProceduralMemory[];
  }> {
    const maxResults = options?.maxResults ?? 10;
    const similarityThreshold = options?.similarityThreshold ?? 0.7;
    const types = options?.types ?? ['episodic', 'semantic', 'procedural'];

    this.logger.debug('Searching all memory types', { query, types });

    // Search each enabled memory type in parallel
    const [episodes, facts, strategies] = await Promise.all([
      types.includes('episodic')
        ? this.episodicManager.searchSimilar(query, { maxResults, similarityThreshold })
        : Promise.resolve([]),
      types.includes('semantic')
        ? this.semanticManager.searchFacts(query, { maxResults, similarityThreshold })
        : Promise.resolve([]),
      types.includes('procedural')
        ? this.proceduralManager.searchStrategies(query, { maxResults, similarityThreshold })
        : Promise.resolve([]),
    ]);

    return { episodes, facts, strategies };
  }

  /**
   * Get recommendations for a context
   * Returns relevant strategies with reasoning
   */
  async getStrategyRecommendations(
    context: string,
    availableTools: string[],
    maxRecommendations?: number
  ): Promise<Array<{
    strategy: ProceduralMemory;
    relevanceScore: number;
    reasoning: string;
  }>> {
    return this.proceduralManager.recommendStrategies(
      context,
      availableTools,
      maxRecommendations
    );
  }

  // ============================================================================
  // Consolidation & Maintenance
  // ============================================================================

  /**
   * Consolidate old memories
   * Summarizes old episodes, merges similar facts
   */
  async consolidateMemories(): Promise<{
    episodesConsolidated: number;
    factsConsolidated: number;
  }> {
    if (!this.config.autoConsolidate) {
      this.logger.debug('Auto-consolidation disabled, skipping');
      return { episodesConsolidated: 0, factsConsolidated: 0 };
    }

    this.logger.info('Starting memory consolidation');

    // Consolidate episodes older than threshold
    const episodeResult = await this.episodicManager.consolidateOldEpisodes(
      this.config.consolidationThresholdDays
    );

    // Consolidate similar facts
    const factResult = await this.semanticManager.consolidateFacts();

    this.logger.info(
      `Consolidation complete: ${episodeResult.consolidatedCount} episodes, ` +
      `${factResult.mergedCount} facts merged`
    );

    return {
      episodesConsolidated: episodeResult.consolidatedCount,
      factsConsolidated: factResult.mergedCount,
    };
  }

  /**
   * Update fact relevance scores
   * Apply decay to unused facts
   */
  async updateFactRelevance(): Promise<number> {
    this.logger.debug('Updating fact relevance scores');

    // Get all facts from document store
    const facts = await this.semanticManager.getAllFacts();

    // Update relevance for each fact
    let updatedCount = 0;
    for (const fact of facts) {
      await this.semanticManager.updateFactRelevance(fact);
      updatedCount++;
    }

    this.logger.info(`Updated relevance for ${updatedCount} facts`);
    return updatedCount;
  }

  /**
   * Periodic maintenance
   * Consolidation + relevance updates
   */
  async performMaintenance(): Promise<{
    episodesConsolidated: number;
    factsConsolidated: number;
    factsUpdated: number;
  }> {
    this.logger.info('Starting periodic maintenance');

    // Run consolidation and relevance updates in parallel
    const [consolidationResult, factsUpdated] = await Promise.all([
      this.consolidateMemories(),
      this.updateFactRelevance(),
    ]);

    this.logger.info(
      `Maintenance complete: ${consolidationResult.episodesConsolidated} episodes consolidated, ` +
      `${consolidationResult.factsConsolidated} facts merged, ${factsUpdated} facts updated`
    );

    return {
      episodesConsolidated: consolidationResult.episodesConsolidated,
      factsConsolidated: consolidationResult.factsConsolidated,
      factsUpdated,
    };
  }

  // ============================================================================
  // Statistics & Analysis
  // ============================================================================

  /**
   * Get comprehensive memory statistics
   */
  async getStatistics(): Promise<{
    session: {
      current: Session | null;
      totalSessions: number;
      completionRate: number;
    };
    episodic: {
      totalEpisodes: number;
      successRate: number;
      averageDuration: number;
    };
    semantic: {
      totalFacts: number;
      averageConfidence: number;
      topCategories: Array<{ category: string; count: number }>;
    };
    procedural: {
      totalStrategies: number;
      averageSuccessRate: number;
      mostUsed: ProceduralMemory[];
    };
  }> {
    this.logger.debug('Gathering memory statistics');

    // Gather stats from all managers in parallel
    const [sessionStats, semanticStats, proceduralAnalysis] = await Promise.all([
      this.sessionManager.getStatistics(),
      this.semanticManager.getStats(),
      this.proceduralManager.analyzeStrategies(),
    ]);

    // Get episodic stats from document store
    const currentSession = this.getCurrentSession();
    const allEpisodes = currentSession
      ? await this.episodicManager.getSessionEpisodes(currentSession.id)
      : [];

    const successfulEpisodes = allEpisodes.filter(e => e.success);
    const totalDuration = allEpisodes.reduce((sum, e) => sum + e.duration, 0);

    return {
      session: {
        current: currentSession,
        totalSessions: sessionStats.totalSessions,
        completionRate: sessionStats.completionRate,
      },
      episodic: {
        totalEpisodes: allEpisodes.length,
        successRate: allEpisodes.length > 0
          ? successfulEpisodes.length / allEpisodes.length
          : 0,
        averageDuration: allEpisodes.length > 0
          ? totalDuration / allEpisodes.length
          : 0,
      },
      semantic: {
        totalFacts: semanticStats.totalFacts,
        averageConfidence: semanticStats.averageConfidence,
        topCategories: semanticStats.topCategories,
      },
      procedural: {
        totalStrategies: proceduralAnalysis.totalStrategies,
        averageSuccessRate: proceduralAnalysis.averageSuccessRate,
        mostUsed: proceduralAnalysis.mostUsed,
      },
    };
  }

  // ============================================================================
  // Reflection Support
  // ============================================================================

  /**
   * Check if it's time to reflect based on action count
   */
  shouldReflect(): boolean {
    if (!this.config.autoReflect) {
      return false;
    }
    return this.actionCount >= this.config.reflectionInterval;
  }

  /**
   * Reset reflection counter
   * Called after reflection is performed
   */
  resetReflectionCounter(): void {
    this.actionCount = 0;
    this.logger.debug('Reflection counter reset');
  }

  /**
   * Extract insights from recent episodes
   * Used by reflection engine
   */
  async extractInsights(episodeCount?: number): Promise<string[]> {
    const session = this.getCurrentSession();
    if (!session) {
      this.logger.warn('No active session for insight extraction');
      return [];
    }

    // Get recent episodes for session
    const allEpisodes = await this.episodicManager.getSessionEpisodes(session.id);

    // Take the most recent episodes
    const recentEpisodes = episodeCount
      ? allEpisodes.slice(-episodeCount)
      : allEpisodes;

    if (recentEpisodes.length === 0) {
      return [];
    }

    // Use episodic manager to extract insights
    return this.episodicManager.extractInsights(recentEpisodes);
  }

  /**
   * Get all episodes for a session
   * Public accessor for reflection engine
   */
  async getSessionEpisodes(sessionId: string): Promise<EpisodicMemory[]> {
    return this.episodicManager.getSessionEpisodes(sessionId);
  }

  /**
   * Extract strategy from recent episodes
   * Public accessor for reflection engine
   */
  async extractStrategyFromEpisodes(
    episodes: EpisodicMemory[],
    topic: string
  ): Promise<ProceduralMemory | null> {
    return this.proceduralManager.extractStrategyFromEpisodes(episodes, topic);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get configuration
   */
  getConfig(): MemorySystemConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MemorySystemConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Memory system configuration updated', updates);
  }

  /**
   * Health check - verify all components are working
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: {
      episodic: boolean;
      semantic: boolean;
      procedural: boolean;
      session: boolean;
    };
    errors: string[];
  }> {
    this.logger.debug('Running health check');

    const errors: string[] = [];
    const components = {
      episodic: true,
      semantic: true,
      procedural: true,
      session: true,
    };

    // Test episodic manager
    try {
      await this.episodicManager.searchSimilar('test', { maxResults: 1 });
    } catch (error) {
      components.episodic = false;
      errors.push(`Episodic manager error: ${error}`);
    }

    // Test semantic manager
    try {
      await this.semanticManager.searchFacts('test', { maxResults: 1 });
    } catch (error) {
      components.semantic = false;
      errors.push(`Semantic manager error: ${error}`);
    }

    // Test procedural manager
    try {
      await this.proceduralManager.searchStrategies('test', { maxResults: 1 });
    } catch (error) {
      components.procedural = false;
      errors.push(`Procedural manager error: ${error}`);
    }

    // Test session manager
    try {
      await this.sessionManager.getRecentSessions(1);
    } catch (error) {
      components.session = false;
      errors.push(`Session manager error: ${error}`);
    }

    const healthy = Object.values(components).every(c => c);

    this.logger.info(`Health check complete: ${healthy ? 'healthy' : 'unhealthy'}`, {
      components,
      errorCount: errors.length,
    });

    return {
      healthy,
      components,
      errors,
    };
  }
}

/**
 * Factory function to create fully initialized memory system
 */
export async function createMemorySystem(
  documentStore: SQLiteDocumentStore,
  vectorStore: ChromaVectorStore,
  embeddingClient: EmbeddingClient,
  llmClient: LLMClient,
  logger: Logger,
  config?: Partial<MemorySystemConfig>
): Promise<MemorySystem> {
  logger.info('Creating memory system');

  // Create all managers
  const episodicManager = new EpisodicManager(
    documentStore,
    vectorStore,
    embeddingClient,
    llmClient,
    logger
  );

  const semanticManager = new SemanticManager(
    documentStore,
    vectorStore,
    embeddingClient,
    llmClient,
    logger
  );

  const proceduralManager = new ProceduralManager(
    documentStore,
    vectorStore,
    embeddingClient,
    llmClient,
    logger
  );

  const sessionManager = new SessionManager(documentStore, logger);

  // Create memory system
  const memorySystem = new MemorySystem(
    episodicManager,
    semanticManager,
    proceduralManager,
    sessionManager,
    logger,
    config
  );

  // Vector collections will be created lazily on first use by the ChromaVectorStore
  logger.info('Memory system created successfully');
  return memorySystem;
}