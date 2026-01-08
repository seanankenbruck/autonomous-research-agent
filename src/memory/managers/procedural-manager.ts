import { v4 as uuidv4 } from 'uuid';
import { SQLiteDocumentStore } from '../stores/document-store';
import { ChromaVectorStore } from '../stores/vector-store';
import { EmbeddingClient } from '../../llm/embeddings';
import { LLMClient } from '../../llm/client';
import { Logger } from '../../utils/logger';
import type {
  ProceduralMemory,
  Refinement,
  EpisodicMemory,
  StrategyAnalysis,
  StrategyRecommendation
} from '../../agent/types';

interface StrategySearchOptions {
  maxResults?: number;
  minSuccessRate?: number;
  requiredTools?: string[];
  similarityThreshold?: number;
}

export class ProceduralManager {
  private readonly VECTOR_COLLECTION = 'strategy_vectors';

  constructor(
    private readonly documentStore: SQLiteDocumentStore,
    private readonly vectorStore: ChromaVectorStore,
    private readonly embeddingClient: EmbeddingClient,
    private readonly llmClient: LLMClient,
    private readonly logger: Logger
  ) {}

  /**
   * Store a new strategy with embedding for context-based retrieval
   */
  async storeStrategy(
    strategy: Omit<ProceduralMemory, 'id' | 'createdAt' | 'lastRefined'>
  ): Promise<ProceduralMemory> {
    this.logger.debug(`Storing strategy: ${strategy.strategyName}`);

    const now = new Date();
    const fullStrategy: ProceduralMemory = {
      id: uuidv4(),
      ...strategy,
      createdAt: now,
      lastRefined: now,
    };

    // Store in document store
    await this.documentStore.storeStrategy(fullStrategy);

    // Generate embedding from description + applicable contexts
    const embeddingText = `${fullStrategy.description}. Applicable contexts: ${fullStrategy.applicableContexts.join(', ')}`;

    try {
      const embedding = await this.embeddingClient.embed(
        embeddingText,
        'document'
      );

      await this.vectorStore.storeEmbedding(
        this.VECTOR_COLLECTION,
        fullStrategy.id,
        embedding,
        {
          strategyName: fullStrategy.strategyName,
          successRate: fullStrategy.successRate,
          timesUsed: fullStrategy.timesUsed,
          // Store requiredTools as comma-separated string (ChromaDB requires primitives)
          requiredTools: fullStrategy.requiredTools.join(','),
        },
        embeddingText
      );

      this.logger.debug(`Strategy stored with embedding: ${fullStrategy.id}`);
    } catch (error) {
      this.logger.error('Failed to generate embedding for strategy', error);
      // Strategy still stored, just without vector search capability
    }

    return fullStrategy;
  }

  /**
   * Retrieve a specific strategy by ID
   */
  async getStrategy(id: string): Promise<ProceduralMemory | null> {
    return this.documentStore.getStrategy(id);
  }

  /**
   * Get strategy by name
   */
  async getStrategyByName(name: string): Promise<ProceduralMemory | null> {
    const strategies = await this.documentStore.listStrategies();
    return strategies.find(s => s.strategyName === name) || null;
  }

  /**
   * Search for strategies relevant to a given context
   * Uses semantic search to find strategies that apply to similar situations
   */
  async searchStrategies(
    context: string,
    options: StrategySearchOptions = {}
  ): Promise<ProceduralMemory[]> {
    this.logger.debug('Searching strategies', { context, options });

    const {
      maxResults = 10,
      similarityThreshold = 0.7,
      minSuccessRate,
      requiredTools,
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.embeddingClient.embed(context, 'query');

    // Search vector store
    const results = await this.vectorStore.search(
      this.VECTOR_COLLECTION,
      queryEmbedding,
      {
        limit: maxResults * 2, // Get more for filtering
        minScore: similarityThreshold,
      }
    );

    // Get full strategies and apply filters
    const strategies: ProceduralMemory[] = [];
    for (const result of results) {
      const strategy = await this.getStrategy(result.id);
      if (!strategy) continue;

      // Apply filters
      if (minSuccessRate !== undefined && strategy.successRate < minSuccessRate) continue;
      
      if (requiredTools && requiredTools.length > 0) {
        // Check if strategy has all required tools
        const hasAllTools = requiredTools.every(tool =>
          strategy.requiredTools.includes(tool)
        );
        if (!hasAllTools) continue;
      }

      strategies.push(strategy);

      if (strategies.length >= maxResults) break;
    }

    return strategies;
  }

  /**
   * Get strategy recommendations for a specific context
   * Returns top strategies with reasoning for why they're recommended
   */
  async recommendStrategies(
    context: string,
    availableTools: string[],
    maxRecommendations: number = 3
  ): Promise<StrategyRecommendation[]> {
    this.logger.debug('Generating strategy recommendations', { context });

    // Search for relevant strategies
    const candidates = await this.searchStrategies(context, {
      maxResults: 10,
      similarityThreshold: 0.6,
    });

    // Score strategies based on multiple factors
    const scoredStrategies = candidates.map(strategy => {
      // Success rate score (0-1)
      const successScore = strategy.successRate;

      // Experience score: higher for more frequently used strategies
      const experienceScore = Math.min(strategy.timesUsed / 20, 1.0);

      // Tool availability score: penalize if missing required tools
      const missingTools = strategy.requiredTools.filter(
        tool => !availableTools.includes(tool)
      );
      const toolScore = missingTools.length === 0
        ? 1.0
        : Math.max(0, 1 - (missingTools.length * 0.2));

      // Recency score: favor recently used strategies
      const now = Date.now();
      const daysSinceUse = strategy.lastUsed
        ? (now - strategy.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
        : 365; // Default to 1 year if never used
      const recencyScore = Math.exp(-daysSinceUse / 30); // 30-day half-life

      // Combined score (weights: 40% success, 25% experience, 20% tools, 15% recency)
      const relevanceScore =
        0.40 * successScore +
        0.25 * experienceScore +
        0.20 * toolScore +
        0.15 * recencyScore;

      return { strategy, relevanceScore };
    });

    // Sort by score
    scoredStrategies.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Generate recommendations with reasoning
    const recommendations: StrategyRecommendation[] = [];
    for (const { strategy, relevanceScore } of scoredStrategies.slice(0, maxRecommendations)) {
      const reasoning = this.generateRecommendationReasoning(
        strategy,
        relevanceScore,
        availableTools
      );

      recommendations.push({
        strategy,
        relevanceScore,
        reasoning,
      });
    }

    return recommendations;
  }

  /**
   * Generate human-readable reasoning for a strategy recommendation
   */
  private generateRecommendationReasoning(
    strategy: ProceduralMemory,
    score: number,
    availableTools: string[]
  ): string {
    const reasons: string[] = [];

    // Success rate
    if (strategy.successRate >= 0.8) {
      reasons.push(`high success rate (${(strategy.successRate * 100).toFixed(0)}%)`);
    } else if (strategy.successRate >= 0.6) {
      reasons.push(`moderate success rate (${(strategy.successRate * 100).toFixed(0)}%)`);
    }

    // Experience
    if (strategy.timesUsed >= 10) {
      reasons.push(`well-tested (${strategy.timesUsed} uses)`);
    } else if (strategy.timesUsed >= 5) {
      reasons.push(`proven effective (${strategy.timesUsed} uses)`);
    }

    // Tool availability
    const missingTools = strategy.requiredTools.filter(
      tool => !availableTools.includes(tool)
    );
    if (missingTools.length === 0) {
      reasons.push('all required tools available');
    } else {
      reasons.push(`missing ${missingTools.length} tool(s): ${missingTools.join(', ')}`);
    }

    // Recency
    if (strategy.lastUsed) {
      const daysSinceUse = (Date.now() - strategy.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUse <= 7) {
        reasons.push('recently used');
      }
    }

    return reasons.join(', ');
  }

  /**
   * Record usage of a strategy and update statistics
   */
  async recordStrategyUse(
    strategyId: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    this.logger.debug(`Recording strategy use: ${strategyId}`, { success, duration });

    const strategy = await this.getStrategy(strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    // Calculate new success rate (running average)
    const totalUses = strategy.timesUsed + 1;
    const previousSuccesses = strategy.successRate * strategy.timesUsed;
    const newSuccesses = previousSuccesses + (success ? 1 : 0);
    const newSuccessRate = newSuccesses / totalUses;

    // Calculate new average duration (running average)
    const previousTotalDuration = strategy.averageDuration * strategy.timesUsed;
    const newTotalDuration = previousTotalDuration + duration;
    const newAverageDuration = newTotalDuration / totalUses;

    // Update strategy
    await this.documentStore.updateStrategy(strategyId, {
      successRate: newSuccessRate,
      averageDuration: newAverageDuration,
      timesUsed: totalUses,
      lastUsed: new Date(),
    });

    this.logger.info(
      `Strategy ${strategy.strategyName} updated: ` +
      `success rate ${strategy.successRate.toFixed(2)} -> ${newSuccessRate.toFixed(2)}, ` +
      `times used ${strategy.timesUsed} -> ${totalUses}`
    );
  }

  /**
   * Add a refinement to a strategy based on learning
   */
  async refineStrategy(
    strategyId: string,
    refinement: Omit<Refinement, 'id' | 'timestamp'>
  ): Promise<void> {
    this.logger.debug(`Refining strategy: ${strategyId}`);

    const strategy = await this.getStrategy(strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const fullRefinement: Refinement = {
      id: uuidv4(),
      timestamp: new Date(),
      ...refinement,
    };

    const updatedRefinements = [...strategy.refinements, fullRefinement];

    await this.documentStore.updateStrategy(strategyId, {
      refinements: updatedRefinements,
      lastRefined: new Date(),
    });

    this.logger.info(`Strategy ${strategy.strategyName} refined: ${refinement.change}`);
  }

  /**
   * Extract strategies from successful episodes
   * Uses LLM to identify patterns and formalize them as reusable strategies
   */
  async extractStrategyFromEpisodes(
    episodes: EpisodicMemory[],
    topic: string
  ): Promise<ProceduralMemory | null> {
    this.logger.debug(`Extracting strategy from ${episodes.length} episodes`);

    // Filter for successful episodes
    const successfulEpisodes = episodes.filter(e => e.success);
    if (successfulEpisodes.length === 0) {
      this.logger.warn('No successful episodes to extract strategy from');
      return null;
    }

    // Build episode summaries
    const episodeSummaries = successfulEpisodes
      .map((e, i) => `Episode ${i + 1}: ${e.summary}`)
      .join('\n\n');

    const prompt = `Analyze these successful research episodes and extract a reusable strategy.

Topic: ${topic}

Episodes:
${episodeSummaries}

Identify the common approach or pattern that led to success. Create a strategy description that includes:
1. A clear name for the strategy
2. A detailed description of the approach
3. When this strategy should be applied (applicable contexts)
4. What tools or capabilities are required
5. Key steps or principles

Format your response as JSON:
{
  "strategyName": "short, descriptive name",
  "description": "detailed description of the approach",
  "applicableContexts": ["context1", "context2"],
  "requiredTools": ["tool1", "tool2"]
}

Return only the JSON, no additional text.`;

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 1000 }
      );

      const text = this.llmClient.extractText(response);

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Failed to extract strategy JSON from LLM response');
        return null;
      }

      const extracted = JSON.parse(jsonMatch[0]);

      // Create strategy
      const strategy = await this.storeStrategy({
        strategyName: extracted.strategyName,
        description: extracted.description,
        applicableContexts: extracted.applicableContexts,
        requiredTools: extracted.requiredTools,
        successRate: 1.0, // Start with perfect score based on successful episodes
        averageDuration: successfulEpisodes.reduce((sum, e) => sum + e.duration, 0) / successfulEpisodes.length,
        timesUsed: successfulEpisodes.length,
        refinements: [],
        lastUsed: new Date(),
      });

      this.logger.info(`Extracted new strategy: ${strategy.strategyName}`);
      return strategy;
    } catch (error) {
      this.logger.error('Failed to extract strategy from episodes', error);
      return null;
    }
  }

  /**
   * Compare two strategies and suggest when to use each
   */
  async compareStrategies(
    strategy1Id: string,
    strategy2Id: string
  ): Promise<{
    comparison: string;
    recommendation: string;
  }> {
    const strategy1 = await this.getStrategy(strategy1Id);
    const strategy2 = await this.getStrategy(strategy2Id);

    if (!strategy1 || !strategy2) {
      throw new Error('One or both strategies not found');
    }

    const prompt = `Compare these two research strategies and provide guidance on when to use each.

Strategy 1: ${strategy1.strategyName}
Description: ${strategy1.description}
Success Rate: ${(strategy1.successRate * 100).toFixed(0)}%
Times Used: ${strategy1.timesUsed}
Average Duration: ${strategy1.averageDuration.toFixed(0)}ms

Strategy 2: ${strategy2.strategyName}
Description: ${strategy2.description}
Success Rate: ${(strategy2.successRate * 100).toFixed(0)}%
Times Used: ${strategy2.timesUsed}
Average Duration: ${strategy2.averageDuration.toFixed(0)}ms

Provide:
1. A comparison of their strengths and weaknesses
2. Specific recommendations for when to use each strategy
3. Situations where one is clearly better than the other

Be concise and practical.`;

    const response = await this.llmClient.complete(
      [{ role: 'user', content: prompt }],
      { maxTokens: 800 }
    );

    const text = this.llmClient.extractText(response);

    return {
      comparison: text,
      recommendation: text, // Could parse into separate sections if needed
    };
  }

  /**
   * Get comprehensive analysis of all strategies
   */
  async analyzeStrategies(): Promise<StrategyAnalysis> {
    this.logger.debug('Analyzing all strategies');

    const strategies = await this.documentStore.listStrategies();

    if (strategies.length === 0) {
      return {
        totalStrategies: 0,
        averageSuccessRate: 0,
        mostSuccessful: [],
        leastSuccessful: [],
        mostUsed: [],
        recentlyRefined: [],
      };
    }

    // Calculate average success rate
    const totalSuccessRate = strategies.reduce((sum, s) => sum + s.successRate, 0);
    const averageSuccessRate = totalSuccessRate / strategies.length;

    // Sort by different criteria
    const bySuccessRate = [...strategies].sort((a, b) => b.successRate - a.successRate);
    const byUsage = [...strategies].sort((a, b) => b.timesUsed - a.timesUsed);
    const byRefinement = [...strategies].sort(
      (a, b) => b.lastRefined.getTime() - a.lastRefined.getTime()
    );

    return {
      totalStrategies: strategies.length,
      averageSuccessRate,
      mostSuccessful: bySuccessRate.slice(0, 5),
      leastSuccessful: bySuccessRate.slice(-5).reverse(),
      mostUsed: byUsage.slice(0, 5),
      recentlyRefined: byRefinement.slice(0, 5),
    };
  }

  /**
   * Get statistics for a specific strategy
   */
  async getStrategyStats(strategyId: string): Promise<{
    strategy: ProceduralMemory;
    performance: {
      successRate: number;
      totalUses: number;
      averageDuration: number;
      lastUsed: Date | null;
    };
    refinements: {
      total: number;
      recent: Refinement[];
    };
    comparison: {
      betterThanAverage: boolean;
      rankBySuccessRate: number;
      rankByUsage: number;
    };
  }> {
    const strategy = await this.getStrategy(strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const allStrategies = await this.documentStore.listStrategies();
    const analysis = await this.analyzeStrategies();

    // Calculate rankings
    const bySuccessRate = [...allStrategies].sort((a, b) => b.successRate - a.successRate);
    const byUsage = [...allStrategies].sort((a, b) => b.timesUsed - a.timesUsed);

    const rankBySuccessRate = bySuccessRate.findIndex(s => s.id === strategyId) + 1;
    const rankByUsage = byUsage.findIndex(s => s.id === strategyId) + 1;

    return {
      strategy,
      performance: {
        successRate: strategy.successRate,
        totalUses: strategy.timesUsed,
        averageDuration: strategy.averageDuration,
        lastUsed: strategy.lastUsed,
      },
      refinements: {
        total: strategy.refinements.length,
        recent: strategy.refinements.slice(-5).reverse(),
      },
      comparison: {
        betterThanAverage: strategy.successRate > analysis.averageSuccessRate,
        rankBySuccessRate,
        rankByUsage,
      },
    };
  }

  /**
   * Format strategies as context for agent decision-making
   */
  formatStrategiesAsContext(strategies: ProceduralMemory[]): string {
    if (strategies.length === 0) return '';

    const lines: string[] = ['## Available Strategies\n'];

    for (const strategy of strategies) {
      const successRate = (strategy.successRate * 100).toFixed(0);
      const avgDuration = (strategy.averageDuration / 1000).toFixed(1);

      lines.push(`### ${strategy.strategyName}`);
      lines.push(`${strategy.description}`);
      lines.push(`- Success Rate: ${successRate}% (used ${strategy.timesUsed} times)`);
      lines.push(`- Average Duration: ${avgDuration}s`);
      lines.push(`- Required Tools: ${strategy.requiredTools.join(', ')}`);
      lines.push(`- Applicable Contexts: ${strategy.applicableContexts.join(', ')}`);
      
      if (strategy.refinements.length > 0) {
        const latestRefinement = strategy.refinements[strategy.refinements.length - 1];
        lines.push(`- Latest Refinement: ${latestRefinement.change}`);
      }
      
      lines.push(''); // Empty line between strategies
    }

    return lines.join('\n');
  }
}