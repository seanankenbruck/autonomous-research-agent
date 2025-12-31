/**
 * Reflection Integration
 * Connects agent execution with the reflection engine for meta-cognitive analysis
 */

import { ReflectionEngine } from '../memory/reflection-engine';
import { Logger } from '../utils/logger';
import {
  Reflection,
  Action,
  Outcome,
  AgentState,
  Goal,
  Progress,
  WorkingMemory,
} from './types';

/**
 * Result from triggering reflection
 */
export interface ReflectionTriggerResult {
  shouldReflect: boolean;
  reason: string;
}

/**
 * Result from applying reflection insights
 */
export interface ReflectionApplicationResult {
  adjustmentsMade: string[];
  shouldReplan: boolean;
  newFocus: string;
  strategyRecommendation: 'continue' | 'adjust' | 'change';
}

/**
 * AgentReflection - Integrates reflection into agent execution
 *
 * Responsibilities:
 * - Determine when agent should reflect
 * - Trigger reflection via reflection engine
 * - Apply reflection insights to agent behavior
 * - Track reflection history
 */
export class AgentReflection {
  private reflectionCount: number = 0;
  private lastReflectionIteration: number = 0;

  constructor(
    private readonly reflectionEngine: ReflectionEngine,
    private readonly logger: Logger,
    private readonly reflectionInterval: number = 5 // Reflect every N iterations
  ) {}

  // ============================================================================
  // Reflection Triggering
  // ============================================================================

  /**
   * Check if agent should reflect based on current state
   */
  shouldReflect(
    state: AgentState,
    recentActions: Action[],
    recentOutcomes: Outcome[]
  ): ReflectionTriggerResult {
    const iterationsSinceLastReflection = state.iterationCount - this.lastReflectionIteration;

    // Trigger 1: Regular interval
    if (iterationsSinceLastReflection >= this.reflectionInterval) {
      return {
        shouldReflect: true,
        reason: `Regular reflection interval (every ${this.reflectionInterval} iterations)`,
      };
    }

    // Trigger 2: Multiple consecutive failures
    const recentFailures = recentOutcomes.slice(-3).filter(o => !o.success);
    if (recentFailures.length >= 2) {
      return {
        shouldReflect: true,
        reason: 'Multiple recent failures detected',
      };
    }

    // Trigger 3: Low confidence
    if (state.progress.confidence < 0.4 && state.iterationCount > 3) {
      return {
        shouldReflect: true,
        reason: 'Low confidence in current approach',
      };
    }

    // Trigger 4: Approaching iteration limit without completion
    const maxIterations = 50; // Could be configurable
    if (state.iterationCount > maxIterations * 0.8 && state.progress.currentPhase !== 'completed') {
      return {
        shouldReflect: true,
        reason: 'Approaching iteration limit',
      };
    }

    // Trigger 5: Explicit reflection action
    const hasReflectAction = recentActions.some(a => a.type === 'reflect');
    if (hasReflectAction) {
      return {
        shouldReflect: true,
        reason: 'Explicit reflection action requested',
      };
    }

    return {
      shouldReflect: false,
      reason: 'No reflection trigger met',
    };
  }

  /**
   * Perform reflection using the reflection engine
   */
  async reflect(
    sessionId: string,
    state: AgentState,
    recentActions: Action[],
    recentOutcomes: Outcome[]
  ): Promise<Reflection> {
    this.logger.info('Starting reflection', {
      sessionId,
      iterationCount: state.iterationCount,
      reflectionCount: this.reflectionCount,
    });

    // Build action/outcome summaries
    const actionsSinceLastReflection = recentActions
      .slice(this.lastReflectionIteration)
      .map(a => `${a.tool}: ${a.reasoning}`);

    const outcomesSinceLastReflection = recentOutcomes
      .slice(this.lastReflectionIteration)
      .map(o => `${o.success ? 'SUCCESS' : 'FAILURE'}: ${o.observations.join('; ')}`);

    // Analyze progress
    const progressAssessment = this.assessProgress(state, recentOutcomes);

    // Evaluate strategy
    const strategyEvaluation = this.evaluateStrategy(state, recentActions, recentOutcomes);

    // Extract learnings
    const learnings = this.extractLearnings(recentActions, recentOutcomes);

    // Determine adjustments
    const { shouldReplan, adjustments, nextFocus } = this.determineAdjustments(
      progressAssessment,
      strategyEvaluation
    );

    // Create reflection record
    const reflection: Reflection = {
      id: this.generateId(),
      sessionId,
      iterationNumber: state.iterationCount,
      timestamp: new Date(),
      actionsSinceLastReflection,
      outcomesSinceLastReflection,
      progressAssessment,
      strategyEvaluation,
      learnings,
      shouldReplan,
      adjustments,
      nextFocus,
    };

    // Update tracking
    this.reflectionCount++;
    this.lastReflectionIteration = state.iterationCount;

    this.logger.info('Reflection complete', {
      shouldReplan,
      adjustments: adjustments.length,
      recommendation: strategyEvaluation.recommendation,
    });

    return reflection;
  }

  // ============================================================================
  // Reflection Analysis
  // ============================================================================

  /**
   * Assess progress towards goal
   */
  private assessProgress(
    state: AgentState,
    recentOutcomes: Outcome[]
  ): Reflection['progressAssessment'] {
    const goal = state.currentGoal;
    const progress = state.progress;

    // Calculate progress rate
    const progressRate = state.iterationCount > 0
      ? progress.stepsCompleted / state.iterationCount
      : 0;

    // Estimate completion
    const stepsRemaining = progress.stepsTotal - progress.stepsCompleted;
    const estimatedCompletion = progressRate > 0
      ? Math.ceil(stepsRemaining / progressRate)
      : 999;

    // Check if on track
    const expectedProgress = state.iterationCount * 0.15; // Expect ~15% progress per iteration
    const isOnTrack = progress.stepsCompleted >= expectedProgress && progress.confidence > 0.5;

    // Identify blockers
    const blockers: string[] = [];
    const recentFailures = recentOutcomes.slice(-5).filter(o => !o.success);
    if (recentFailures.length >= 3) {
      blockers.push('Frequent action failures');
    }
    if (progress.confidence < 0.4) {
      blockers.push('Low confidence in current approach');
    }
    if (state.workingMemory.openQuestions.length > 5) {
      blockers.push('Too many unanswered questions');
    }
    if (progress.sourcesGathered < 3 && state.iterationCount > 5) {
      blockers.push('Insufficient sources gathered');
    }

    // Identify achievements
    const achievements: string[] = [];
    if (progress.sourcesGathered >= 5) {
      achievements.push(`Gathered ${progress.sourcesGathered} sources`);
    }
    if (progress.factsExtracted >= 10) {
      achievements.push(`Extracted ${progress.factsExtracted} facts`);
    }
    if (progress.confidence >= 0.7) {
      achievements.push('High confidence in findings');
    }
    if (state.workingMemory.keyFindings.length >= 5) {
      achievements.push(`Identified ${state.workingMemory.keyFindings.length} key findings`);
    }

    return {
      isOnTrack,
      progressRate,
      estimatedCompletion,
      blockers,
      achievements,
    };
  }

  /**
   * Evaluate current strategy effectiveness
   */
  private evaluateStrategy(
    state: AgentState,
    recentActions: Action[],
    recentOutcomes: Outcome[]
  ): Reflection['strategyEvaluation'] {
    const currentStrategy = state.plan.strategy || 'undefined';

    // Calculate success rate
    const actionOutcomePairs = recentActions
      .slice(-10)
      .map((action, i) => ({
        action,
        outcome: recentOutcomes[i],
      }))
      .filter(pair => pair.outcome);

    const successCount = actionOutcomePairs.filter(p => p.outcome.success).length;
    const effectiveness = actionOutcomePairs.length > 0
      ? successCount / actionOutcomePairs.length
      : 0.5;

    // Identify strengths
    const strengths: string[] = [];
    const successfulActions = actionOutcomePairs.filter(p => p.outcome.success);
    if (successfulActions.length > 0) {
      const toolCounts: Record<string, number> = {};
      successfulActions.forEach(p => {
        toolCounts[p.action.tool] = (toolCounts[p.action.tool] || 0) + 1;
      });
      const topTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0];
      if (topTool) {
        strengths.push(`Effective use of ${topTool[0]} tool`);
      }
    }
    if (state.progress.confidence > 0.6) {
      strengths.push('Building confidence steadily');
    }

    // Identify weaknesses
    const weaknesses: string[] = [];
    const failedActions = actionOutcomePairs.filter(p => !p.outcome.success);
    if (failedActions.length > 3) {
      weaknesses.push('High failure rate');
    }
    if (state.progress.currentPhase === state.plan.steps[0]?.status && state.iterationCount > 10) {
      weaknesses.push('Stuck in same phase too long');
    }
    if (state.workingMemory.recentActions.length > 5) {
      const actionTypes = state.workingMemory.recentActions.map(a => a.type);
      const uniqueTypes = new Set(actionTypes);
      if (uniqueTypes.size === 1) {
        weaknesses.push('Repeating same action type');
      }
    }

    // Suggest alternatives
    const alternativeStrategies: string[] = [];
    if (effectiveness < 0.5) {
      alternativeStrategies.push('Try a different search strategy');
      alternativeStrategies.push('Focus on quality over quantity');
    }
    if (state.progress.sourcesGathered > 10 && state.progress.factsExtracted < 5) {
      alternativeStrategies.push('Prioritize analysis over gathering');
    }

    // Make recommendation
    let recommendation: 'continue' | 'adjust' | 'change';
    if (effectiveness >= 0.7 && state.progress.confidence > 0.6) {
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

  /**
   * Extract learnings from recent experiences
   */
  private extractLearnings(
    recentActions: Action[],
    recentOutcomes: Outcome[]
  ): string[] {
    const learnings: string[] = [];

    // Learning from successes
    const successes = recentActions
      .map((a, i) => ({ action: a, outcome: recentOutcomes[i] }))
      .filter(p => p.outcome?.success);

    if (successes.length > 0) {
      const successfulTools = successes.map(s => s.action.tool);
      const mostCommon = this.getMostCommon(successfulTools);
      if (mostCommon) {
        learnings.push(`${mostCommon} tool has been most effective`);
      }
    }

    // Learning from failures
    const failures = recentActions
      .map((a, i) => ({ action: a, outcome: recentOutcomes[i] }))
      .filter(p => p.outcome && !p.outcome.success);

    if (failures.length > 0) {
      const failedTools = failures.map(f => f.action.tool);
      const mostCommon = this.getMostCommon(failedTools);
      if (mostCommon) {
        learnings.push(`${mostCommon} tool needs improvement or different approach`);
      }
    }

    // Learning from patterns
    if (recentActions.length > 5) {
      const recentPhases = recentActions.slice(-5).map(a => a.type);
      const uniquePhases = new Set(recentPhases);
      if (uniquePhases.size === 1) {
        learnings.push('Need more diversity in action types');
      }
    }

    return learnings;
  }

  /**
   * Determine adjustments based on assessments
   */
  private determineAdjustments(
    progressAssessment: Reflection['progressAssessment'],
    strategyEvaluation: Reflection['strategyEvaluation']
  ): { shouldReplan: boolean; adjustments: string[]; nextFocus: string } {
    const adjustments: string[] = [];
    let shouldReplan = false;
    let nextFocus = '';

    // Based on progress assessment
    if (!progressAssessment.isOnTrack) {
      shouldReplan = true;
      adjustments.push('Replan due to being off track');
    }

    if (progressAssessment.blockers.length > 0) {
      adjustments.push(`Address blockers: ${progressAssessment.blockers.join(', ')}`);
    }

    // Based on strategy evaluation
    if (strategyEvaluation.recommendation === 'change') {
      shouldReplan = true;
      adjustments.push('Change strategy due to poor effectiveness');
    } else if (strategyEvaluation.recommendation === 'adjust') {
      adjustments.push('Adjust current strategy');
    }

    // Determine next focus
    if (progressAssessment.blockers.includes('Insufficient sources gathered')) {
      nextFocus = 'Focus on gathering more diverse sources';
    } else if (progressAssessment.blockers.includes('Too many unanswered questions')) {
      nextFocus = 'Focus on answering open questions';
    } else if (strategyEvaluation.weaknesses.includes('Stuck in same phase too long')) {
      nextFocus = 'Move to next phase of research';
    } else {
      nextFocus = 'Continue current approach with minor improvements';
    }

    return { shouldReplan, adjustments, nextFocus };
  }

  // ============================================================================
  // Application of Reflection Insights
  // ============================================================================

  /**
   * Apply reflection insights to agent behavior
   */
  applyReflection(
    reflection: Reflection,
    state: AgentState
  ): ReflectionApplicationResult {
    this.logger.info('Applying reflection insights', {
      shouldReplan: reflection.shouldReplan,
      adjustments: reflection.adjustments.length,
    });

    const adjustmentsMade: string[] = [];

    // Apply learnings to working memory
    reflection.learnings.forEach(learning => {
      // This would be used by the agent core to inform decisions
      adjustmentsMade.push(`Learned: ${learning}`);
    });

    // Adjust confidence based on assessment
    if (!reflection.progressAssessment.isOnTrack) {
      adjustmentsMade.push('Reduced confidence due to being off track');
    }

    // Track adjustments
    if (reflection.adjustments.length > 0) {
      adjustmentsMade.push(...reflection.adjustments);
    }

    return {
      adjustmentsMade,
      shouldReplan: reflection.shouldReplan,
      newFocus: reflection.nextFocus,
      strategyRecommendation: reflection.strategyEvaluation.recommendation,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get most common element in array
   */
  private getMostCommon<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;

    const counts = new Map<T, number>();
    arr.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });

    let maxCount = 0;
    let mostCommon: T | null = null;

    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `reflection_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Reset reflection tracking (for new session)
   */
  reset(): void {
    this.reflectionCount = 0;
    this.lastReflectionIteration = 0;
  }

  /**
   * Get reflection statistics
   */
  getStatistics(): {
    reflectionCount: number;
    lastReflectionIteration: number;
    reflectionInterval: number;
  } {
    return {
      reflectionCount: this.reflectionCount,
      lastReflectionIteration: this.lastReflectionIteration,
      reflectionInterval: this.reflectionInterval,
    };
  }
}

/**
 * Factory function to create AgentReflection instance
 */
export function createAgentReflection(
  reflectionEngine: ReflectionEngine,
  logger: Logger,
  reflectionInterval?: number
): AgentReflection {
  return new AgentReflection(reflectionEngine, logger, reflectionInterval);
}
