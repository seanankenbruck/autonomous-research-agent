/**
 * Reasoning Engine
 * Implements ReAct-style reasoning: Reason → Act → Observe
 */

import { LLMClient } from '../llm/client';
import { Logger } from '../utils/logger';
import {
  Goal,
  Progress,
  Action,
  Outcome,
  WorkingMemory,
  Reasoning,
  ReasoningContext,
  ReasoningOption,
  ProceduralMemory,
  EpisodicMemory,
  SemanticMemory,
} from './types';
import type { Tool } from '../tools/types';

/**
 * Memory context provided to reasoning engine
 */
export interface ReasoningMemoryContext {
  relevantEpisodes: EpisodicMemory[];
  relevantFacts: SemanticMemory[];
  recommendedStrategies: ProceduralMemory[];
}

/**
 * Result from the reasoning process
 */
export interface ReasoningResult {
  reasoning: Reasoning;
  selectedAction: Action;
  confidence: number;
}

/**
 * Result from observing an action outcome
 */
export interface ObservationResult {
  observations: string[];
  success: boolean;
  shouldContinue: boolean;
  shouldReplan: boolean;
  learnings: string[];
}

/**
 * ReasoningEngine - Implements ReAct-style reasoning
 *
 * The ReAct (Reasoning + Acting) pattern:
 * 1. Reason: Analyze current state and decide next action
 * 2. Act: Execute the selected action using a tool
 * 3. Observe: Analyze the outcome and extract learnings
 */
export class ReasoningEngine {
  constructor(
    private readonly llmClient: LLMClient,
    private readonly logger: Logger
  ) {}

  // ============================================================================
  // Reason: Analyze and Decide
  // ============================================================================

  /**
   * Reason about the current state and decide next action
   * This is the "Reason" step in ReAct
   */
  async reason(
    goal: Goal,
    progress: Progress,
    workingMemory: WorkingMemory,
    availableTools: Tool[],
    memoryContext: ReasoningMemoryContext,
    sessionId: string
  ): Promise<ReasoningResult> {
    this.logger.info('Starting reasoning process', { sessionId, goal: goal.description });

    // Build reasoning context
    const context = this.buildReasoningContext(
      goal,
      progress,
      workingMemory,
      availableTools,
      memoryContext
    );

    // Generate reasoning options using LLM
    const options = await this.generateReasoningOptions(context);

    // Select best option
    const selectedOption = this.selectBestOption(options);

    // Create reasoning record
    const reasoning: Reasoning = {
      id: this.generateId(),
      context,
      analysis: await this.generateAnalysis(context, options),
      options,
      selectedOption: selectedOption.id,
      confidence: selectedOption.confidence,
      timestamp: new Date(),
    };

    // Create action from selected option
    const action: Action = {
      id: this.generateId(),
      sessionId,
      type: this.inferActionType(selectedOption.action),
      tool: selectedOption.action,
      parameters: this.extractParameters(selectedOption.action, goal, selectedOption.rationale, workingMemory),
      reasoning: selectedOption.rationale,
      strategy: memoryContext.recommendedStrategies[0]?.strategyName,
      timestamp: new Date(),
    };

    this.logger.info('Reasoning complete', {
      selectedAction: action.tool,
      confidence: reasoning.confidence,
    });

    return {
      reasoning,
      selectedAction: action,
      confidence: reasoning.confidence,
    };
  }

  /**
   * Build reasoning context from current state
   */
  private buildReasoningContext(
    goal: Goal,
    progress: Progress,
    workingMemory: WorkingMemory,
    availableTools: Tool[],
    memoryContext: ReasoningMemoryContext
  ): ReasoningContext {
    return {
      currentGoal: goal,
      currentProgress: progress,
      recentActions: workingMemory.recentActions.map(a =>
        `${a.tool}: ${a.reasoning}`
      ),
      recentOutcomes: workingMemory.recentOutcomes.map(o =>
        `${o.success ? 'SUCCESS' : 'FAILURE'}: ${o.observations.join('; ')}`
      ),
      availableTools: availableTools.map(t => t.name),
      relevantMemories: [
        ...memoryContext.relevantEpisodes.map(e => e.summary),
        ...memoryContext.relevantFacts.map(f => f.content),
        ...memoryContext.recommendedStrategies.map(s =>
          `Strategy: ${s.strategyName} - ${s.description}`
        ),
      ],
      constraints: goal.constraints || [],
    };
  }

  /**
   * Generate reasoning options using LLM
   */
  private async generateReasoningOptions(
    context: ReasoningContext
  ): Promise<ReasoningOption[]> {
    const prompt = this.buildReasoningPrompt(context);

    try {
      const response = await this.llmClient.complete(
        [
          {
            role: 'user',
            content: prompt + '\n\nRespond with valid JSON only, no markdown formatting.',
          },
        ],
        {
          systemPrompt: this.getReasoningSystemPrompt(),
          maxTokens: 2000,
          temperature: 0.7,
        }
      );

      // Extract text from response
      const text = this.llmClient.extractText(response);

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const data = JSON.parse(jsonMatch[0]);

      if (!data.options || !Array.isArray(data.options)) {
        throw new Error('Invalid response format');
      }

      return data.options;
    } catch (error) {
      this.logger.error('Failed to generate reasoning options', { error });
      // Return fallback option
      return [this.getFallbackOption(context)];
    }
  }

  /**
   * Build reasoning prompt for LLM
   */
  private buildReasoningPrompt(context: ReasoningContext): string {
    return `You are an autonomous research agent. Analyze the current state and propose 2-4 possible next actions.

GOAL:
${context.currentGoal.description}

SUCCESS CRITERIA:
${context.currentGoal.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

CURRENT PROGRESS:
- Phase: ${context.currentProgress.currentPhase}
- Steps: ${context.currentProgress.stepsCompleted}/${context.currentProgress.stepsTotal}
- Sources gathered: ${context.currentProgress.sourcesGathered}
- Facts extracted: ${context.currentProgress.factsExtracted}
- Confidence: ${(context.currentProgress.confidence * 100).toFixed(0)}%

RECENT ACTIONS:
${context.recentActions.slice(-3).map((a, i) => `${i + 1}. ${a}`).join('\n') || 'None yet'}

RECENT OUTCOMES:
${context.recentOutcomes.slice(-3).map((o, i) => `${i + 1}. ${o}`).join('\n') || 'None yet'}

AVAILABLE TOOLS:
${context.availableTools.map((t, i) => `${i + 1}. ${t}`).join('\n')}

RELEVANT PAST EXPERIENCES:
${context.relevantMemories.slice(0, 5).map((m, i) => `${i + 1}. ${m}`).join('\n') || 'None'}

CONSTRAINTS:
${context.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n') || 'None'}

Propose 2-4 different actions I could take next. You MUST respond with ONLY valid JSON in this exact format:

{
  "options": [
    {
      "id": "option-1",
      "action": "web_search",
      "rationale": "Need to gather initial information about the topic",
      "expectedBenefit": "Will provide foundational knowledge and credible sources",
      "potentialRisks": ["May find outdated information", "Results may vary in quality"],
      "estimatedCost": 3,
      "confidence": 0.8
    },
    {
      "id": "option-2",
      "action": "content_analyzer",
      "rationale": "Analyze previously fetched content to extract facts",
      "expectedBenefit": "Extract structured information from existing sources",
      "potentialRisks": ["Content may not contain relevant facts"],
      "estimatedCost": 2,
      "confidence": 0.7
    }
  ]
}

IMPORTANT RULES:
- The "action" field MUST be one of: ${context.availableTools.join(', ')}
- The "potentialRisks" field MUST be an array of strings
- The "estimatedCost" field MUST be a number from 1-10
- The "confidence" field MUST be a decimal number from 0-1
- Do NOT include any markdown formatting or code blocks
- Do NOT include any text before or after the JSON object

Consider:
- What information gaps exist?
- What would move us closer to the goal?
- What has worked in similar situations?
- What risks should we avoid?
- Choose actions appropriate for the current phase (${context.currentProgress.currentPhase})`;
  }

  /**
   * Get system prompt for reasoning
   */
  private getReasoningSystemPrompt(): string {
    return `You are an expert at strategic planning and decision-making. Your role is to analyze situations and propose well-reasoned next actions. Be thorough, consider multiple perspectives, and weigh costs vs benefits.`;
  }

  /**
   * Select the best option from generated options
   */
  private selectBestOption(options: ReasoningOption[]): ReasoningOption {
    // Sort by a weighted score combining confidence and cost
    const scored = options.map(option => ({
      option,
      score: option.confidence * 0.7 - (option.estimatedCost / 10) * 0.3,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].option;
  }

  /**
   * Generate analysis summary
   */
  private async generateAnalysis(
    context: ReasoningContext,
    options: ReasoningOption[]
  ): Promise<string> {
    const prompt = `Summarize the reasoning process in 2-3 sentences:

GOAL: ${context.currentGoal.description}
PROGRESS: ${context.currentProgress.currentPhase} phase, ${context.currentProgress.stepsCompleted}/${context.currentProgress.stepsTotal} steps

OPTIONS CONSIDERED:
${options.map((o, i) => `${i + 1}. ${o.action}: ${o.rationale}`).join('\n')}

Provide a concise analysis of the situation and the decision-making process.`;

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 200 }
      );

      return this.llmClient.extractText(response) || 'Analysis unavailable';
    } catch (error) {
      this.logger.error('Failed to generate analysis', { error });
      return 'Analysis unavailable';
    }
  }

  /**
   * Get fallback option when LLM fails
   */
  private getFallbackOption(context: ReasoningContext): ReasoningOption {
    // Intelligent fallback based on phase and progress
    let action: string;
    let rationale: string;

    if (context.currentProgress.currentPhase === 'gathering' || context.currentProgress.sourcesGathered === 0) {
      // Always start with web search if we have no sources or in gathering phase
      action = 'web_search';
      rationale = 'Fallback to web search - need to gather initial sources';
    } else if (context.currentProgress.sourcesGathered > 0 && context.currentProgress.factsExtracted === 0) {
      // We have sources but no facts - analyze them
      action = 'content_analyzer';
      rationale = 'Fallback to content analyzer - have sources but need to extract facts';
    } else if (context.currentProgress.factsExtracted > 3) {
      // We have enough facts - synthesize
      action = 'synthesizer';
      rationale = 'Fallback to synthesizer - have enough facts to create summary';
    } else {
      // Default: gather more information
      action = 'web_search';
      rationale = 'Fallback to web search - need more information';
    }

    return {
      id: 'fallback-option',
      action,
      rationale,
      expectedBenefit: 'Continue making progress with safe default action',
      potentialRisks: ['May not be the optimal action for current situation'],
      estimatedCost: 5,
      confidence: 0.3,
    };
  }

  // ============================================================================
  // Observe: Analyze Outcomes
  // ============================================================================

  /**
   * Observe and analyze the outcome of an action
   * This is the "Observe" step in ReAct
   */
  async observe(
    action: Action,
    outcome: Outcome,
    goal: Goal,
    progress: Progress,
    workingMemory: WorkingMemory
  ): Promise<ObservationResult> {
    this.logger.info('Observing action outcome', {
      action: action.tool,
      success: outcome.success,
    });

    // Extract observations from outcome
    const observations = outcome.observations;

    // Analyze what was learned
    const learnings = await this.extractLearnings(action, outcome, goal);

    // Determine if we should continue, replan, etc.
    const shouldContinue = this.shouldContinue(outcome, progress, goal);
    const shouldReplan = this.shouldReplan(outcome, progress, workingMemory);

    this.logger.info('Observation complete', {
      shouldContinue,
      shouldReplan,
      learnings: learnings.length,
    });

    return {
      observations,
      success: outcome.success,
      shouldContinue,
      shouldReplan,
      learnings,
    };
  }

  /**
   * Extract learnings from action outcome
   */
  private async extractLearnings(
    action: Action,
    outcome: Outcome,
    _goal: Goal
  ): Promise<string[]> {
    const prompt = `Analyze this action and its outcome to extract key learnings:

GOAL: ${_goal.description}

ACTION: ${action.tool}
REASONING: ${action.reasoning}

OUTCOME: ${outcome.success ? 'SUCCESS' : 'FAILURE'}
${outcome.error ? `ERROR: ${outcome.error}` : ''}

OBSERVATIONS:
${outcome.observations.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Extract 1-3 key learnings from this experience. What worked? What didn't? What should be remembered for next time?

Respond with a JSON object with a "learnings" array of strings.`;

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 300 }
      );

      const text = this.llmClient.extractText(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.learnings && Array.isArray(data.learnings)) {
          return data.learnings;
        }
      }

      // Fallback: try to extract bullet points
      const lines = text.split('\n').filter(l => l.trim().match(/^[-•*\d.]/));
      if (lines.length > 0) {
        return lines.map(l => l.replace(/^[-•*\d.]\s*/, '').trim());
      }

      return [`${action.tool} ${outcome.success ? 'succeeded' : 'failed'}`];
    } catch (error) {
      this.logger.error('Failed to extract learnings', { error });
      return [`${action.tool} ${outcome.success ? 'succeeded' : 'failed'}`];
    }
  }

  /**
   * Determine if agent should continue
   */
  private shouldContinue(
    outcome: Outcome,
    progress: Progress,
    goal: Goal
  ): boolean {
    // Don't continue if goal is complete
    if (progress.currentPhase === 'completed') {
      return false;
    }

    // Continue if action succeeded or if we can recover from failure
    return outcome.success || progress.confidence > 0.3;
  }

  /**
   * Determine if agent should replan
   */
  private shouldReplan(
    outcome: Outcome,
    progress: Progress,
    workingMemory: WorkingMemory
  ): boolean {
    // Replan if last action failed
    if (!outcome.success) {
      return true;
    }

    // Replan if multiple recent failures
    const recentOutcomes = workingMemory.recentOutcomes.slice(-3);
    const failureCount = recentOutcomes.filter(o => !o.success).length;
    if (failureCount >= 2) {
      return true;
    }

    // Replan if confidence is low
    if (progress.confidence < 0.4 && progress.stepsCompleted > 3) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Infer action type from tool name/action
   */
  private inferActionType(toolName: string): Action['type'] {
    const actionLower = toolName.toLowerCase();

    if (actionLower.includes('search')) return 'search';
    if (actionLower.includes('fetch')) return 'fetch';
    if (actionLower.includes('analyze')) return 'analyze';
    if (actionLower.includes('extract')) return 'extract';
    if (actionLower.includes('verify')) return 'verify';
    if (actionLower.includes('synthesize')) return 'synthesize';
    if (actionLower.includes('reflect')) return 'reflect';
    if (actionLower.includes('replan')) return 'replan';

    return 'search'; // default
  }

  /**
   * Extract parameters from action string
   * Enriches parameters with data from working memory
   */
  private extractParameters(action: string, goal: Goal, rationale: string, workingMemory: WorkingMemory): Record<string, any> {
    // Generate sensible default parameters based on the tool and context
    switch (action) {
      case 'web_search':
        // Extract search query from goal description or rationale
        return {
          query: goal.description,
          maxResults: 10,
          searchDepth: 'basic'
        };

      case 'web_fetch':
        // For fetch, try to extract URL from rationale or use a default approach
        // This is a fallback - ideally the LLM should provide the URL
        return {
          url: '', // Empty URL will cause validation error, which is expected
          extractContent: true,
          includeMetadata: true
        };

      case 'content_analyzer':
        // Analyze tool needs content from previously fetched sources
        // Combine all content from recent successful outcomes
        const recentContent = workingMemory.recentOutcomes
          .filter(o => o.success && o.result?.content)
          .map(o => o.result.content)
          .join('\n\n---\n\n');

        // Fallback: use key findings if no content available
        const content = recentContent || workingMemory.keyFindings.join('\n\n');

        return {
          content: content || 'No content available to analyze',
          analysisType: 'extract',
          extractionTargets: {
            facts: true,
            entities: true,
            keyPhrases: true,
            concepts: true
          }
        };

      case 'synthesizer':
        // Gather sources from working memory
        const sources = workingMemory.recentOutcomes
          .filter(o => o.success && (o.result?.content || o.result?.results))
          .map(o => ({
            content: o.result.content || JSON.stringify(o.result.results),
            metadata: o.result.metadata || {}
          }));

        return {
          synthesisGoal: goal.description,
          sources: sources.length > 0 ? sources : [],
          outputFormat: 'summary'
        };

      default:
        return {};
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `reasoning_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Factory function to create ReasoningEngine instance
 */
export function createReasoningEngine(
  llmClient: LLMClient,
  logger: Logger
): ReasoningEngine {
  return new ReasoningEngine(llmClient, logger);
}
