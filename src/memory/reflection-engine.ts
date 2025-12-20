import { MemorySystem } from './memory-system';
import { LLMClient } from '../llm/client';
import { Logger } from '../utils/logger';
import type {
  Session,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  Reflection,
  ProgressAssessment,
  StrategyEvaluation,
} from '../agent/types';


/**
 * Configuration for reflection engine
 */
interface ReflectionConfig {
  // Thresholds
  minEpisodesForReflection: number; // Minimum episodes needed to reflect
  minActionsForReflection: number; // Minimum actions needed to reflect
  recentEpisodeCount: number; // Default: 10 - analyze last N episodes

  // Analysis settings
  analyzeTopicPatterns: boolean;
  analyzeStrategyEffectiveness: boolean;
  identifyKnowledgeGaps: boolean;
  
  // LLM settings
  maxReflectionTokens: number; // Max tokens for reflection generation
}

/**
 * Pattern analysis results
 */
interface TopicPattern {
  topic: string;
  frequency: number;
  successRate: number;
  averageDuration: number;
}

interface StrategyPattern {
  strategyName: string;
  successRate: number;
  timesUsed: number;
  contexts: string[];
}

/**
 * Reflection Engine
 * Analyzes patterns across memory types and generates insights
 * Triggers consolidation when appropriate
 */
export class ReflectionEngine {
  private readonly CONSOLIDATION_THRESHOLDS = {
    minEpisodes: 50,
    minFacts: 100,
    minDaysSinceLastConsolidation: 7,
  };
  private config: ReflectionConfig;
  
  constructor(
    private readonly memorySystem: MemorySystem,
    private readonly llmClient: LLMClient,
    private readonly logger: Logger,
    config?: Partial<ReflectionConfig>
  ) {
    // Merge provided config with defaults
    this.config = {
      minEpisodesForReflection: 3,
      minActionsForReflection: 5,
      recentEpisodeCount: 10,
      analyzeTopicPatterns: true,
      analyzeStrategyEffectiveness: true,
      identifyKnowledgeGaps: true,
      maxReflectionTokens: 2000,
      ...config,
    };
  }

  // ============================================================================
  // Main Reflection
  // ============================================================================

  /**
   * Perform comprehensive reflection on current session
   * This is the main entry point called by the agent
   */
  async reflect(): Promise<Reflection> {
    this.logger.info('Starting reflection');

    // Get current session (required)
    const session = this.memorySystem.getCurrentSession();
    if (!session) {
      throw new Error('No active session - cannot reflect without a session');
    }

    // Check if we have enough data to reflect
    if (!this.canReflect()) {
      throw new Error('Insufficient data for reflection - need more episodes/actions');
    }

    // Get recent episodes for analysis
    const allEpisodes = await this.memorySystem.getSessionEpisodes(session.id);
    const recentEpisodes = allEpisodes.slice(-this.config.recentEpisodeCount);

    // Analyze patterns (topics, strategies, knowledge gaps)
    const [topics, strategies, knowledgeGaps] = await Promise.all([
      this.config.analyzeTopicPatterns ? this.analyzeTopicPatterns() : Promise.resolve([]),
      this.config.analyzeStrategyEffectiveness ? this.analyzeStrategyEffectiveness() : Promise.resolve([]),
      this.config.identifyKnowledgeGaps ? this.identifyKnowledgeGaps() : Promise.resolve([]),
    ]);

    const patterns = { topics, strategies, knowledgeGaps };

    // Generate reflection using LLM
    const llmReflection = await this.generateReflection(session, recentEpisodes, patterns);

    // Assess progress and evaluate strategy
    const [progressAssessment, strategyEvaluation] = await Promise.all([
      this.assessProgress(session, recentEpisodes),
      this.evaluateStrategy(session, recentEpisodes),
    ]);

    // Extract action and outcome summaries
    const actionsSinceLastReflection = this.extractActionSummary(recentEpisodes);
    const outcomesSinceLastReflection = this.extractOutcomeSummary(recentEpisodes);

    // Create reflection object
    const reflection: Reflection = {
      id: `reflection-${Date.now()}`,
      sessionId: session.id,
      iterationNumber: session.state.iterationCount,
      timestamp: new Date(),
      actionsSinceLastReflection,
      outcomesSinceLastReflection,
      progressAssessment,
      strategyEvaluation,
      learnings: llmReflection.learnings,
      shouldReplan: llmReflection.shouldReplan,
      adjustments: llmReflection.adjustments,
      nextFocus: llmReflection.nextFocus,
    };

    // Store reflection in session state
    session.state.reflections.push(reflection);

    // Reset memory system reflection counter
    this.memorySystem.resetReflectionCounter();

    this.logger.info(`Reflection completed: ${reflection.learnings.length} learnings, shouldReplan: ${reflection.shouldReplan}`);

    return reflection;
  }

  /**
   * Check if reflection should be performed
   * Validates prerequisites are met
   */
  canReflect(): boolean {
    // Check if there's an active session
    const session = this.memorySystem.getCurrentSession();
    if (!session) {
      return false;
    }

    // Get session episodes (synchronous check - we'll get them async in reflect())
    // For now, just check if we have enough iteration count as a proxy
    const episodeCount = session.state.workingMemory.recentActions.length;
    const actionCount = session.state.workingMemory.recentActions.length;

    // Check against minimum thresholds
    return (
      episodeCount >= this.config.minEpisodesForReflection ||
      actionCount >= this.config.minActionsForReflection
    );
  }

  // ============================================================================
  // Pattern Analysis
  // ============================================================================

  /**
   * Analyze topic patterns from episodes
   * Identifies frequently discussed topics and their success rates
   */
  async analyzeTopicPatterns(): Promise<TopicPattern[]> {
    const session = this.memorySystem.getCurrentSession();
    if (!session) {
      return [];
    }

    // Get ALL episodes for session
    const allEpisodes = await this.memorySystem.getSessionEpisodes(session.id);

    // Take last N episodes
    const recentEpisodes = allEpisodes.slice(-this.config.recentEpisodeCount);

    // Group by topic, calculate stats
    const topicMap = new Map<string, {
      count: number;
      successCount: number;
      totalDuration: number;
    }>();

    for (const episode of recentEpisodes) {
      const existing = topicMap.get(episode.topic) || {
        count: 0,
        successCount: 0,
        totalDuration: 0,
      };

      existing.count++;
      if (episode.success) existing.successCount++;
      existing.totalDuration += episode.duration;

      topicMap.set(episode.topic, existing);
    }

    // Convert to pattern format
    const patterns: TopicPattern[] = Array.from(topicMap.entries()).map(([topic, stats]) => ({
      topic,
      frequency: stats.count,
      successRate: stats.count > 0 ? stats.successCount / stats.count : 0,
      averageDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
    }));

    // Sort by frequency
    patterns.sort((a, b) => b.frequency - a.frequency);

    return patterns;
  }

  /**
   * Analyze strategy effectiveness
   * Evaluates which strategies are working well
   */
  async analyzeStrategyEffectiveness(): Promise<StrategyPattern[]> {
    // Get all strategies from memory system
    const stats = await this.memorySystem.getStatistics();
    const allStrategies = stats.procedural.mostUsed;

    // Map to pattern format with success rates
    const patterns: StrategyPattern[] = allStrategies.map(strategy => ({
      strategyName: strategy.strategyName,
      successRate: strategy.successRate,
      timesUsed: strategy.timesUsed,
      contexts: strategy.applicableContexts,
    }));

    // Sort by success rate
    patterns.sort((a, b) => b.successRate - a.successRate);

    return patterns;
  }

  /**
   * Identify knowledge gaps
   * Finds areas where agent lacks information
   */
  async identifyKnowledgeGaps(): Promise<string[]> {
    const session = this.memorySystem.getCurrentSession();
    if (!session) {
      return [];
    }

    // Extract open questions from working memory
    const openQuestions = session.state.workingMemory.openQuestions;

    // Get recent episodes
    const allEpisodes = await this.memorySystem.getSessionEpisodes(session.id);
    const recentEpisodes = allEpisodes.slice(-this.config.recentEpisodeCount);

    if (recentEpisodes.length === 0) {
      return openQuestions;
    }

    // Use LLM to identify additional gaps from episode patterns
    const episodeSummaries = recentEpisodes
      .map(e => `- ${e.topic}: ${e.summary} (${e.success ? 'success' : 'failed'})`)
      .join('\n');

    const prompt = `Analyze these recent research episodes and identify knowledge gaps or unanswered questions:

${episodeSummaries}

Known open questions:
${openQuestions.map(q => `- ${q}`).join('\n')}

Identify 3-5 additional knowledge gaps or areas where more information is needed.
Return as a simple list, one gap per line, starting with a dash.`;

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 500 }
      );

      const text = this.llmClient.extractText(response);
      const llmGaps = text
        .split('\n')
        .filter(line => line.trim().match(/^[-•*]/))
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 0);

      // Deduplicate and return gaps
      const allGaps = [...openQuestions, ...llmGaps];
      return Array.from(new Set(allGaps));
    } catch (error) {
      this.logger.error('Failed to identify knowledge gaps with LLM', error);
      return openQuestions;
    }
  }

  // ============================================================================
  // Progress Assessment
  // ============================================================================

  /**
   * Assess progress toward session goal
   */
  async assessProgress(
    session: Session,
    episodes: EpisodicMemory[]
  ): Promise<ProgressAssessment> {
    const progress = session.state.progress;
    const goal = session.goal;

    // Calculate progress rate (steps per minute)
    const sessionDuration = Date.now() - session.createdAt.getTime();
    const sessionMinutes = sessionDuration / (1000 * 60);
    const progressRate = sessionMinutes > 0 ? progress.stepsCompleted / sessionMinutes : 0;

    // Identify blockers from failed episodes
    const failedEpisodes = episodes.filter(e => !e.success);
    const blockers = failedEpisodes.map(e => {
      const failedOutcomes = e.outcomes.filter(o => !o.success);
      return failedOutcomes.map(o => o.observations.join(', ')).join('; ');
    }).filter(b => b.length > 0);

    // List achievements from successful episodes
    const successfulEpisodes = episodes.filter(e => e.success);
    const achievements = successfulEpisodes.map(e => {
      if (e.findings.length > 0) {
        return `${e.topic}: ${e.findings.length} findings`;
      }
      return e.summary.substring(0, 100);
    });

    // Estimate iterations remaining based on progress
    const completionRatio = progress.stepsTotal > 0
      ? progress.stepsCompleted / progress.stepsTotal
      : 0;
    const estimatedCompletion = completionRatio > 0.1
      ? Math.ceil((1 - completionRatio) / completionRatio * session.state.iterationCount)
      : 10; // Default estimate if too early

    // Determine if on track
    const isOnTrack = progress.confidence > 0.6 && failedEpisodes.length < successfulEpisodes.length;

    return {
      isOnTrack,
      progressRate,
      estimatedCompletion,
      blockers,
      achievements,
    };
  }

  // ============================================================================
  // Strategy Evaluation
  // ============================================================================

  /**
   * Evaluate current strategy effectiveness
   */
  async evaluateStrategy(
    session: Session,
    episodes: EpisodicMemory[]
  ): Promise<StrategyEvaluation> {
    const currentStrategy = session.state.plan.strategy;

    // Calculate effectiveness from recent episodes
    const successfulEpisodes = episodes.filter(e => e.success);
    const effectiveness = episodes.length > 0
      ? successfulEpisodes.length / episodes.length
      : 0;

    // Identify strengths (what's working)
    const strengths = successfulEpisodes
      .map(e => e.findings.map(f => f.content))
      .flat()
      .slice(0, 3);

    // Identify weaknesses (what's not working)
    const failedEpisodes = episodes.filter(e => !e.success);
    const weaknesses = failedEpisodes
      .map(e => e.outcomes.filter(o => !o.success))
      .flat()
      .map(o => o.observations.join(', '))
      .slice(0, 3);

    // Use LLM to suggest alternative strategies
    const episodeSummary = episodes
      .map(e => `${e.success ? '✓' : '✗'} ${e.summary}`)
      .join('\n');

    const prompt = `Evaluate this research strategy and suggest alternatives:

Current Strategy: ${currentStrategy}
Effectiveness: ${(effectiveness * 100).toFixed(0)}%

Recent Episodes:
${episodeSummary}

Strengths:
${strengths.map(s => `- ${s}`).join('\n')}

Weaknesses:
${weaknesses.map(w => `- ${w}`).join('\n')}

Suggest 2-3 alternative strategies that might work better.
Format as a simple list, one strategy per line, starting with a dash.`;

    let alternativeStrategies: string[] = [];
    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 500 }
      );

      const text = this.llmClient.extractText(response);
      alternativeStrategies = text
        .split('\n')
        .filter(line => line.trim().match(/^[-•*]/))
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 3);
    } catch (error) {
      this.logger.error('Failed to get alternative strategies from LLM', error);
    }

    // Make recommendation (continue/adjust/change)
    let recommendation: 'continue' | 'adjust' | 'change';
    if (effectiveness >= 0.7) {
      recommendation = 'continue';
    } else if (effectiveness >= 0.4) {
      recommendation = 'adjust';
    } else {
      recommendation = 'change';
    }

    return {
      currentStrategy,
      effectiveness,
      strengths,
      weaknesses,
      alternativeStrategies,
      recommendation,
    };
  }

  // ============================================================================
  // LLM-Powered Reflection Generation
  // ============================================================================

  /**
   * Use LLM to generate comprehensive reflection
   * Combines all analysis into actionable insights
   */
  private async generateReflection(
    session: Session,
    episodes: EpisodicMemory[],
    patterns: {
      topics: TopicPattern[];
      strategies: StrategyPattern[];
      knowledgeGaps: string[];
    }
  ): Promise<{
    learnings: string[];
    shouldReplan: boolean;
    adjustments: string[];
    nextFocus: string;
  }> {
    // Build comprehensive context from patterns and episodes
    const episodeSummary = episodes
      .map(e => `${e.success ? '✓' : '✗'} ${e.topic}: ${e.summary}`)
      .join('\n');

    const topicSummary = patterns.topics
      .map(t => `${t.topic} (${t.frequency}x, ${(t.successRate * 100).toFixed(0)}% success)`)
      .join('\n');

    const strategySummary = patterns.strategies
      .map(s => `${s.strategyName} (${(s.successRate * 100).toFixed(0)}% success, ${s.timesUsed} uses)`)
      .join('\n');

    const gapsSummary = patterns.knowledgeGaps.join('\n');

    const prompt = `Perform a comprehensive reflection on this research session.

GOAL: ${session.goal.description}

SUCCESS CRITERIA:
${session.goal.successCriteria.map(c => `- ${c}`).join('\n')}

RECENT EPISODES:
${episodeSummary}

TOPIC PATTERNS:
${topicSummary}

STRATEGY EFFECTIVENESS:
${strategySummary}

KNOWLEDGE GAPS:
${gapsSummary}

CURRENT PROGRESS:
- Phase: ${session.state.progress.currentPhase}
- Steps: ${session.state.progress.stepsCompleted}/${session.state.progress.stepsTotal}
- Confidence: ${(session.state.progress.confidence * 100).toFixed(0)}%

Based on this analysis, provide:
1. Key learnings (3-5 insights from the episodes)
2. Whether replanning is needed (true/false based on progress and blockers)
3. Specific adjustments to improve performance (2-4 actionable items)
4. Next focus area (what should be prioritized next)

Return as JSON:
{
  "learnings": ["learning 1", "learning 2", ...],
  "shouldReplan": true/false,
  "adjustments": ["adjustment 1", "adjustment 2", ...],
  "nextFocus": "description of next focus area"
}`;

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: this.config.maxReflectionTokens }
      );

      const text = this.llmClient.extractText(response);

      // Try to parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          learnings: parsed.learnings || [],
          shouldReplan: parsed.shouldReplan || false,
          adjustments: parsed.adjustments || [],
          nextFocus: parsed.nextFocus || 'Continue current approach',
        };
      }

      // Fallback: parse text format
      this.logger.warn('LLM did not return JSON, parsing text format');
      return {
        learnings: ['Reflection generated but could not parse structured insights'],
        shouldReplan: false,
        adjustments: [],
        nextFocus: 'Continue current approach',
      };
    } catch (error) {
      this.logger.error('Failed to generate reflection with LLM', error);
      return {
        learnings: ['Failed to generate reflection'],
        shouldReplan: false,
        adjustments: [],
        nextFocus: 'Continue current approach',
      };
    }
  }

  // ============================================================================
  // Consolidation Triggering
  // ============================================================================

  /**
   * Determine if memory consolidation should be triggered
   * Based on patterns and memory usage
   */
  async shouldConsolidate(): Promise<boolean> {
    const stats = await this.memorySystem.getStatistics();

    // Check if episodes >= 50
    const episodesExceeded = stats.episodic.totalEpisodes >= this.CONSOLIDATION_THRESHOLDS.minEpisodes;

    // Check if facts >= 100
    const factsExceeded = stats.semantic.totalFacts >= this.CONSOLIDATION_THRESHOLDS.minFacts;

    // Return true if ANY threshold exceeded
    return episodesExceeded || factsExceeded;
  }

  /**
   * Trigger memory consolidation if needed
   */
  async triggerConsolidationIfNeeded(): Promise<{
    consolidated: boolean;
    episodesConsolidated: number;
    factsConsolidated: number;
  }> {
    const shouldConsolidate = await this.shouldConsolidate();

    if (!shouldConsolidate) {
      return {
        consolidated: false,
        episodesConsolidated: 0,
        factsConsolidated: 0,
      };
    }

    this.logger.info('Triggering memory consolidation');
    const result = await this.memorySystem.consolidateMemories();

    return {
      consolidated: true,
      episodesConsolidated: result.episodesConsolidated,
      factsConsolidated: result.factsConsolidated,
    };
  }

  // ============================================================================
  // Reflection History
  // ============================================================================

  /**
   * Get reflection history for current session
   */
  async getReflectionHistory(): Promise<Reflection[]> {
    const session = this.memorySystem.getCurrentSession();
    if (!session) {
      return [];
    }

    // Extract reflections from session state and sort by timestamp (newest first)
    return [...session.state.reflections].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Compare current reflection with previous
   * Tracks improvement over time
   */
  async compareWithPrevious(
    current: Reflection
  ): Promise<{
    progressImproved: boolean;
    newLearnings: string[];
    persistentBlockers: string[];
  }> {
    const history = await this.getReflectionHistory();

    // Find the previous reflection (skip the current one)
    const previous = history.find(r => r.id !== current.id);

    if (!previous) {
      // No previous reflection to compare
      return {
        progressImproved: true,
        newLearnings: current.learnings,
        persistentBlockers: [],
      };
    }

    // Compare progress metrics
    const currentProgress = current.progressAssessment.isOnTrack;
    const previousProgress = previous.progressAssessment.isOnTrack;
    const progressImproved = currentProgress && !previousProgress;

    // Identify new learnings not in previous
    const previousLearningsSet = new Set(previous.learnings);
    const newLearnings = current.learnings.filter(
      learning => !previousLearningsSet.has(learning)
    );

    // Identify blockers that persist
    const previousBlockersSet = new Set(previous.progressAssessment.blockers);
    const persistentBlockers = current.progressAssessment.blockers.filter(
      blocker => previousBlockersSet.has(blocker)
    );

    return {
      progressImproved,
      newLearnings,
      persistentBlockers,
    };
  }

  // Strategy extraction - manual trigger only
  async extractStrategyFromRecentEpisodes(
    episodeCount?: number
  ): Promise<ProceduralMemory | null> {
    const session = this.memorySystem.getCurrentSession();
    if (!session) {
      return null;
    }

    // Get recent successful episodes
    const allEpisodes = await this.memorySystem.getSessionEpisodes(session.id);
    const count = episodeCount ?? this.config.recentEpisodeCount;
    const recentEpisodes = allEpisodes.slice(-count);
    const successfulEpisodes = recentEpisodes.filter(e => e.success);

    if (successfulEpisodes.length === 0) {
      this.logger.warn('No successful episodes to extract strategy from');
      return null;
    }

    // Use memory system's public accessor to extract strategy
    return this.memorySystem.extractStrategyFromEpisodes(
      successfulEpisodes,
      session.topic
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Format reflection for display
   */
  formatReflection(reflection: Reflection): string {
    const lines: string[] = [];

    // Format header with iteration number and timestamp
    lines.push(`# Reflection - Iteration ${reflection.iterationNumber}`);
    lines.push(`Timestamp: ${reflection.timestamp.toISOString()}`);
    lines.push('');

    // Format progress assessment section
    lines.push('## Progress Assessment');
    lines.push(`Status: ${reflection.progressAssessment.isOnTrack ? '✓ On Track' : '✗ Off Track'}`);
    lines.push(`Progress Rate: ${reflection.progressAssessment.progressRate.toFixed(2)} steps/min`);
    lines.push(`Estimated Completion: ${reflection.progressAssessment.estimatedCompletion} iterations`);

    if (reflection.progressAssessment.achievements.length > 0) {
      lines.push('\nAchievements:');
      reflection.progressAssessment.achievements.forEach(a => lines.push(`- ${a}`));
    }

    if (reflection.progressAssessment.blockers.length > 0) {
      lines.push('\nBlockers:');
      reflection.progressAssessment.blockers.forEach(b => lines.push(`- ${b}`));
    }
    lines.push('');

    // Format strategy evaluation section
    lines.push('## Strategy Evaluation');
    lines.push(`Current Strategy: ${reflection.strategyEvaluation.currentStrategy}`);
    lines.push(`Effectiveness: ${(reflection.strategyEvaluation.effectiveness * 100).toFixed(0)}%`);
    lines.push(`Recommendation: ${reflection.strategyEvaluation.recommendation.toUpperCase()}`);

    if (reflection.strategyEvaluation.strengths.length > 0) {
      lines.push('\nStrengths:');
      reflection.strategyEvaluation.strengths.forEach(s => lines.push(`- ${s}`));
    }

    if (reflection.strategyEvaluation.weaknesses.length > 0) {
      lines.push('\nWeaknesses:');
      reflection.strategyEvaluation.weaknesses.forEach(w => lines.push(`- ${w}`));
    }
    lines.push('');

    // Format learnings as bullet points
    lines.push('## Key Learnings');
    reflection.learnings.forEach(l => lines.push(`- ${l}`));
    lines.push('');

    // Format adjustments and next focus
    if (reflection.adjustments.length > 0) {
      lines.push('## Suggested Adjustments');
      reflection.adjustments.forEach(a => lines.push(`- ${a}`));
      lines.push('');
    }

    lines.push('## Next Focus');
    lines.push(reflection.nextFocus);

    if (reflection.shouldReplan) {
      lines.push('');
      lines.push('⚠️  **REPLANNING RECOMMENDED**');
    }

    return lines.join('\n');
  }

  /**
   * Extract action summary from episodes
   */
  private extractActionSummary(episodes: EpisodicMemory[]): string[] {
    // Collect all actions from episodes
    const allActions = episodes.flatMap(e => e.actions);

    // Group by action type
    const actionCounts = new Map<string, number>();
    for (const action of allActions) {
      actionCounts.set(action.type, (actionCounts.get(action.type) || 0) + 1);
    }

    // Create summary strings
    const summaries = Array.from(actionCounts.entries())
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .sort((a, b) => {
        const countA = parseInt(a.split(' ')[0]);
        const countB = parseInt(b.split(' ')[0]);
        return countB - countA;
      });

    return summaries;
  }

  /**
   * Extract outcome summary from episodes
   */
  private extractOutcomeSummary(episodes: EpisodicMemory[]): string[] {
    // Collect all outcomes from episodes
    const allOutcomes = episodes.flatMap(e => e.outcomes);

    // Count successes vs failures
    const successCount = allOutcomes.filter(o => o.success).length;
    const failureCount = allOutcomes.length - successCount;

    const summaries: string[] = [
      `${successCount} successful, ${failureCount} failed (${allOutcomes.length} total)`,
    ];

    // Extract key observations from failed outcomes
    const failedOutcomes = allOutcomes.filter(o => !o.success);
    const observations = failedOutcomes
      .flatMap(o => o.observations)
      .slice(0, 5); // Top 5 observations

    summaries.push(...observations);

    return summaries;
  }

  /**
   * Get configuration
   */
  getConfig(): ReflectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ReflectionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Reflection engine configuration updated', updates);
  }
}

/**
 * Factory function to create reflection engine
 */
export function createReflectionEngine(
  memorySystem: MemorySystem,
  llmClient: LLMClient,
  logger: Logger,
  config?: Partial<ReflectionConfig>
): ReflectionEngine {
  logger.info('Creating reflection engine');
  return new ReflectionEngine(memorySystem, llmClient, logger, config);
}