/**
 * Agent Core
 * Main autonomous agent loop orchestrating research execution
 */

import { ReasoningEngine, ReasoningMemoryContext } from './reasoning';
import { AgentReflection } from './reflection';
import { MemorySystem } from '../memory/memory-system';
import { ToolRegistry } from '../tools/registry';
import { LLMClient } from '../llm/client';
import { Logger } from '../utils/logger';
import {
  Goal,
  AgentState,
  ResearchPlan,
  PlannedStep,
  Progress,
  WorkingMemory,
  Action,
  Outcome,
  Finding,
  ResearchResult,
  SessionStatus,
  ResearchPhase,
} from './types';

/**
 * Configuration for the agent
 */
export interface AgentConfig {
  maxIterations: number;
  reflectionInterval: number;
  maxContextTokens: number;
  enableAutoReflection: boolean;
}

/**
 * Result from agent execution
 */
export interface AgentExecutionResult {
  success: boolean;
  result?: ResearchResult;
  error?: string;
  iterations: number;
  reflections: number;
}

/**
 * AutonomousAgent - Main agent orchestrator
 *
 * Implements the autonomous research loop:
 * 1. Plan: Decompose goal into steps
 * 2. Execute Loop:
 *    - Reason: Decide next action based on context and memories
 *    - Act: Execute action using tools
 *    - Observe: Analyze outcome and extract learnings
 *    - Reflect: Periodically reflect on progress and adjust strategy
 * 3. Synthesize: Generate final research output
 */
export class AutonomousAgent {
  private currentState: AgentState | null = null;

  constructor(
    private readonly reasoningEngine: ReasoningEngine,
    private readonly agentReflection: AgentReflection,
    private readonly memorySystem: MemorySystem,
    private readonly toolRegistry: ToolRegistry,
    private readonly llmClient: LLMClient,
    private readonly logger: Logger,
    private readonly config: AgentConfig
  ) {}

  // ============================================================================
  // Main Execution Loop
  // ============================================================================

  /**
   * Execute autonomous research on a topic
   */
  async research(topic: string, goal: Goal): Promise<AgentExecutionResult> {
    this.logger.info('Starting autonomous research', { topic, goal: goal.description });

    try {
      // Create session
      const session = await this.memorySystem.startSession(topic, goal);
      const sessionId = session.id;

      // Initialize state
      this.currentState = await this.initializeState(sessionId, goal);

      // Create research plan
      const plan = await this.createPlan(goal, sessionId);
      this.currentState.plan = plan;

      this.logger.info('Research plan created', {
        steps: plan.steps.length,
        strategy: plan.strategy,
      });

      // Main execution loop
      let iteration = 0;
      let shouldContinue = true;

      while (shouldContinue && iteration < this.config.maxIterations) {
        iteration++;
        this.currentState.iterationCount = iteration;
        this.currentState.lastActionTimestamp = new Date();

        this.logger.info(`Iteration ${iteration}/${this.config.maxIterations}`, {
          phase: this.currentState.progress.currentPhase,
          confidence: this.currentState.progress.confidence,
        });

        // Check if reflection is needed
        if (this.config.enableAutoReflection) {
          const reflectionCheck = this.agentReflection.shouldReflect(
            this.currentState,
            this.currentState.workingMemory.recentActions,
            this.currentState.workingMemory.recentOutcomes
          );

          if (reflectionCheck.shouldReflect) {
            await this.performReflection(sessionId);
          }
        }

        // Get memory context for reasoning
        const memoryContext = await this.retrieveMemoryContext(topic, goal);

        // Reason: Decide next action
        const reasoningResult = await this.reasoningEngine.reason(
          goal,
          this.currentState.progress,
          this.currentState.workingMemory,
          this.toolRegistry.getEnabledTools(),
          memoryContext,
          sessionId
        );

        const action = reasoningResult.selectedAction;
        this.currentState.workingMemory.recentActions.push(action);

        // Act: Execute action
        const outcome = await this.executeAction(action);
        this.currentState.workingMemory.recentOutcomes.push(outcome);

        // Observe: Analyze outcome
        const observation = await this.reasoningEngine.observe(
          action,
          outcome,
          goal,
          this.currentState.progress,
          this.currentState.workingMemory
        );

        // Store experience in memory
        await this.storeExperience(sessionId, action, outcome, observation.learnings);

        // Update progress
        this.updateProgress(outcome, observation);

        // Update plan status
        this.updatePlanProgress(action, outcome);

        // Check if should replan
        if (observation.shouldReplan) {
          this.logger.info('Replanning due to observation');
          const newPlan = await this.createPlan(goal, sessionId);
          this.currentState.plan = newPlan;
        }

        // Check if should continue
        shouldContinue = observation.shouldContinue;

        // Check if goal is complete
        if (this.isGoalComplete(this.currentState.progress, goal)) {
          this.logger.info('Goal completed', {
            iterations: iteration,
            confidence: this.currentState.progress.confidence,
          });
          shouldContinue = false;
        }

        // Limit working memory size
        this.trimWorkingMemory();
      }

      // Final reflection
      if (this.config.enableAutoReflection) {
        await this.performReflection(sessionId);
      }

      // Generate final result
      const result = await this.synthesizeResult(sessionId, topic, goal);

      // Complete session
      await this.memorySystem.completeSession();

      this.logger.info('Research complete', {
        iterations: iteration,
        success: true,
        confidence: result.confidence,
      });

      return {
        success: true,
        result,
        iterations: iteration,
        reflections: this.agentReflection.getStatistics().reflectionCount,
      };
    } catch (error) {
      this.logger.error('Research failed', { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        iterations: this.currentState?.iterationCount || 0,
        reflections: this.agentReflection.getStatistics().reflectionCount,
      };
    }
  }

  // ============================================================================
  // Planning System
  // ============================================================================

  /**
   * Create a research plan by decomposing the goal into steps
   */
  private async createPlan(goal: Goal, sessionId: string): Promise<ResearchPlan> {
    this.logger.info('Creating research plan', { goal: goal.description });

    // Get recommended strategies from memory
    const availableTools = this.toolRegistry.getEnabledTools().map(t => t.name);
    const strategies = await this.memorySystem.getStrategyRecommendations(
      goal.description,
      availableTools,
      3
    );

    const strategy = strategies[0]?.strategy.strategyName || 'general-research';

    // Generate plan using LLM
    const prompt = this.buildPlanningPrompt(goal, strategies);

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        {
          systemPrompt: 'You are an expert research planner. Create detailed, actionable research plans.',
          maxTokens: 2000,
          temperature: 0.7,
        }
      );

      const text = this.llmClient.extractText(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        const steps: PlannedStep[] = data.steps.map((step: any, index: number) => ({
          id: `step-${index + 1}`,
          description: step.description,
          action: step.action || 'search',
          dependencies: step.dependencies || [],
          status: 'pending' as const,
          expectedOutcome: step.expectedOutcome || '',
        }));

        return {
          id: `plan-${sessionId}`,
          strategy,
          steps,
          estimatedDuration: data.estimatedDuration || steps.length * 60,
          createdAt: new Date(),
        };
      }
    } catch (error) {
      this.logger.error('Failed to generate plan, using fallback', { error });
    }

    // Fallback plan
    return this.createFallbackPlan(goal, strategy, sessionId);
  }

  /**
   * Build planning prompt for LLM
   */
  private buildPlanningPrompt(
    goal: Goal,
    strategies: Array<{ strategy: any; relevanceScore: number; reasoning: string }>
  ): string {
    return `Create a detailed research plan for the following goal:

GOAL: ${goal.description}

SUCCESS CRITERIA:
${goal.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

CONSTRAINTS:
${goal.constraints?.map((c, i) => `${i + 1}. ${c}`).join('\n') || 'None'}

ESTIMATED COMPLEXITY: ${goal.estimatedComplexity}

${strategies.length > 0 ? `RECOMMENDED STRATEGIES (based on past experience):
${strategies.map((s, i) => `${i + 1}. ${s.strategy.strategyName} (relevance: ${s.relevanceScore.toFixed(2)})\n   ${s.reasoning}`).join('\n')}` : ''}

Create a step-by-step research plan. Each step should:
- Have a clear description
- Specify which action/tool to use (search, fetch, analyze, synthesize)
- List any dependencies on previous steps
- Describe the expected outcome

Available tools: search, fetch, analyze, synthesize

Respond with JSON in this format (no markdown):
{
  "steps": [
    {
      "description": "Step description",
      "action": "tool name",
      "dependencies": [],
      "expectedOutcome": "What this step should produce"
    }
  ],
  "estimatedDuration": 300
}

Aim for 5-8 steps that logically progress from information gathering → analysis → synthesis.`;
  }

  /**
   * Create fallback plan when LLM fails
   */
  private createFallbackPlan(goal: Goal, strategy: string, sessionId: string): ResearchPlan {
    const steps: PlannedStep[] = [
      {
        id: 'step-1',
        description: 'Search for initial information on topic',
        action: 'search',
        dependencies: [],
        status: 'pending',
        expectedOutcome: 'Relevant sources and initial information',
      },
      {
        id: 'step-2',
        description: 'Fetch and extract content from promising sources',
        action: 'fetch',
        dependencies: ['step-1'],
        status: 'pending',
        expectedOutcome: 'Detailed content from sources',
      },
      {
        id: 'step-3',
        description: 'Analyze content to extract key facts',
        action: 'analyze',
        dependencies: ['step-2'],
        status: 'pending',
        expectedOutcome: 'Structured facts and insights',
      },
      {
        id: 'step-4',
        description: 'Search for additional information to fill gaps',
        action: 'search',
        dependencies: ['step-3'],
        status: 'pending',
        expectedOutcome: 'Additional sources addressing gaps',
      },
      {
        id: 'step-5',
        description: 'Synthesize findings into cohesive result',
        action: 'synthesize',
        dependencies: ['step-3', 'step-4'],
        status: 'pending',
        expectedOutcome: 'Final synthesized research output',
      },
    ];

    return {
      id: `plan-${sessionId}`,
      strategy,
      steps,
      estimatedDuration: 300,
      createdAt: new Date(),
    };
  }

  // ============================================================================
  // Action Execution
  // ============================================================================

  /**
   * Execute an action using the appropriate tool
   */
  private async executeAction(action: Action): Promise<Outcome> {
    const startTime = Date.now();

    this.logger.info('Executing action', {
      tool: action.tool,
      type: action.type,
      reasoning: action.reasoning,
    });

    try {
      // Execute tool
      const result = await this.toolRegistry.executeTool(
        action.tool,
        action.parameters,
        {
          logger: this.logger,
          sessionId: action.sessionId,
        }
      );

      const duration = Date.now() - startTime;

      // Extract observations from result
      const observations: string[] = [];
      if (result.success) {
        observations.push(`Successfully executed ${action.tool}`);

        // Add specific observations based on tool type
        if (result.data && typeof result.data === 'object') {
          const data = result.data as any;
          if (action.type === 'search' && 'results' in data) {
            observations.push(`Found ${data.results?.length || 0} results`);
          } else if (action.type === 'fetch' && 'content' in data) {
            observations.push(`Fetched content (${data.content?.contentLength || 0} chars)`);
          } else if (action.type === 'analyze' && 'facts' in data) {
            observations.push(`Extracted ${data.facts?.length || 0} facts`);
          } else if (action.type === 'synthesize') {
            observations.push('Generated synthesis');
          }
        }
      } else {
        observations.push(`Failed to execute ${action.tool}: ${result.error}`);
      }

      return {
        actionId: action.id,
        success: result.success,
        result: result.data,
        error: result.error,
        observations,
        duration,
        metadata: result.metadata || {},
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('Action execution failed', { action: action.tool, error: errorMessage });

      return {
        actionId: action.id,
        success: false,
        error: errorMessage,
        observations: [`Error executing ${action.tool}: ${errorMessage}`],
        duration,
        metadata: {},
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // Memory Integration
  // ============================================================================

  /**
   * Retrieve relevant memory context for reasoning
   */
  private async retrieveMemoryContext(
    topic: string,
    goal: Goal
  ): Promise<ReasoningMemoryContext> {
    const query = `${topic} ${goal.description}`;

    // Get context from memory system
    const context = await this.memorySystem.buildContext(query, {
      maxTokens: this.config.maxContextTokens,
    });

    // Get recommended strategies
    const availableTools = this.toolRegistry.getEnabledTools().map(t => t.name);
    const strategies = await this.memorySystem.getStrategyRecommendations(
      query,
      availableTools,
      3
    );

    return {
      relevantEpisodes: context.episodes,
      relevantFacts: context.facts,
      recommendedStrategies: strategies.map((s: { strategy: any }) => s.strategy),
    };
  }

  /**
   * Store experience in memory system
   */
  private async storeExperience(
    sessionId: string,
    action: Action,
    outcome: Outcome,
    learnings: string[]
  ): Promise<void> {
    // Store episode with action and outcome
    const summary = `${action.tool}: ${outcome.success ? 'succeeded' : 'failed'}. ${learnings.join('. ')}`;

    await this.memorySystem.storeExperience(
      sessionId,
      [action],
      [outcome],
      this.currentState?.workingMemory.keyFindings || [],
      summary
    );
  }

  // ============================================================================
  // Reflection Integration
  // ============================================================================

  /**
   * Perform reflection and apply insights
   */
  private async performReflection(sessionId: string): Promise<void> {
    if (!this.currentState) return;

    this.logger.info('Performing reflection');

    const reflection = await this.agentReflection.reflect(
      sessionId,
      this.currentState,
      this.currentState.workingMemory.recentActions,
      this.currentState.workingMemory.recentOutcomes
    );

    // Add reflection to state
    this.currentState.reflections.push(reflection);

    // Apply reflection insights
    const application = this.agentReflection.applyReflection(reflection, this.currentState);

    this.logger.info('Reflection applied', {
      adjustments: application.adjustmentsMade.length,
      shouldReplan: application.shouldReplan,
    });

    // If reflection suggests replanning, mark for replanning
    if (application.shouldReplan) {
      // Will be handled in next iteration
      this.logger.info('Reflection recommends replanning');
    }
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Initialize agent state for a new session
   */
  private async initializeState(sessionId: string, goal: Goal): Promise<AgentState> {
    return {
      sessionId,
      currentGoal: goal,
      plan: {
        id: 'temp',
        strategy: 'initializing',
        steps: [],
        estimatedDuration: 0,
        createdAt: new Date(),
      },
      progress: {
        stepsCompleted: 0,
        stepsTotal: 0,
        sourcesGathered: 0,
        factsExtracted: 0,
        currentPhase: 'planning',
        confidence: 0.5,
      },
      workingMemory: {
        recentActions: [],
        recentOutcomes: [],
        keyFindings: [],
        openQuestions: [],
        hypotheses: [],
      },
      reflections: [],
      iterationCount: 0,
      lastActionTimestamp: new Date(),
    };
  }

  /**
   * Update progress based on action outcome
   */
  private updateProgress(outcome: Outcome, observation: any): void {
    if (!this.currentState) return;

    const progress = this.currentState.progress;

    // Update phase based on progress
    if (progress.stepsCompleted === 0) {
      progress.currentPhase = 'gathering';
    } else if (progress.sourcesGathered >= 5 && progress.factsExtracted < 10) {
      progress.currentPhase = 'analyzing';
    } else if (progress.factsExtracted >= 10) {
      progress.currentPhase = 'synthesizing';
    }

    // Update counters based on outcome
    if (outcome.success && outcome.result) {
      const data = outcome.result as any;
      if (data.results && Array.isArray(data.results)) {
        progress.sourcesGathered += data.results.length;
      }
      if (data.facts && Array.isArray(data.facts)) {
        progress.factsExtracted += data.facts.length;
      }
    }

    // Update confidence
    if (outcome.success) {
      progress.confidence = Math.min(1.0, progress.confidence + 0.1);
    } else {
      progress.confidence = Math.max(0.0, progress.confidence - 0.05);
    }
  }

  /**
   * Update plan progress
   */
  private updatePlanProgress(action: Action, outcome: Outcome): void {
    if (!this.currentState) return;

    const plan = this.currentState.plan;

    // Find matching step and update status
    const step = plan.steps.find(s =>
      s.action === action.tool || s.action === action.type
    );

    if (step && step.status === 'pending') {
      step.status = outcome.success ? 'completed' : 'failed';

      if (outcome.success) {
        this.currentState.progress.stepsCompleted++;
      }
    }

    // Update total steps
    this.currentState.progress.stepsTotal = plan.steps.length;
  }

  /**
   * Check if goal is complete
   */
  private isGoalComplete(progress: Progress, goal: Goal): boolean {
    // Simple heuristic - can be enhanced
    return (
      progress.currentPhase === 'synthesizing' &&
      progress.confidence >= 0.7 &&
      progress.factsExtracted >= 10 &&
      progress.sourcesGathered >= 5
    );
  }

  /**
   * Trim working memory to prevent unbounded growth
   */
  private trimWorkingMemory(): void {
    if (!this.currentState) return;

    const maxItems = 20;
    const wm = this.currentState.workingMemory;

    if (wm.recentActions.length > maxItems) {
      wm.recentActions = wm.recentActions.slice(-maxItems);
    }
    if (wm.recentOutcomes.length > maxItems) {
      wm.recentOutcomes = wm.recentOutcomes.slice(-maxItems);
    }
    if (wm.keyFindings.length > maxItems) {
      wm.keyFindings = wm.keyFindings.slice(-maxItems);
    }
  }

  // ============================================================================
  // Result Synthesis
  // ============================================================================

  /**
   * Synthesize final research result
   */
  private async synthesizeResult(
    sessionId: string,
    topic: string,
    goal: Goal
  ): Promise<ResearchResult> {
    this.logger.info('Synthesizing final result');

    if (!this.currentState) {
      throw new Error('No current state');
    }

    // Use synthesize tool to create final output
    const synthesizeTool = this.toolRegistry.getTool('synthesize');

    if (synthesizeTool) {
      const result = await this.toolRegistry.executeTool(
        'synthesize',
        {
          sources: this.currentState.workingMemory.keyFindings.map(f => ({
            content: f.content,
            title: f.source?.title,
            url: f.source?.url,
          })),
          synthesisGoal: goal.description,
        },
        {
          logger: this.logger,
          sessionId,
        }
      );

      if (result.success && result.data) {
        const data = result.data as any;
        return {
          sessionId,
          topic,
          goal,
          synthesis: data.synthesis || 'Synthesis unavailable',
          keyFindings: this.currentState.workingMemory.keyFindings,
          sources: this.currentState.workingMemory.keyFindings.map(f => f.source),
          confidence: this.currentState.progress.confidence,
          completeness: this.currentState.progress.stepsCompleted / this.currentState.progress.stepsTotal,
          duration: (Date.now() - this.currentState.lastActionTimestamp.getTime()) / 1000,
          totalActions: this.currentState.workingMemory.recentActions.length,
          totalReflections: this.currentState.reflections.length,
          strategiesUsed: [this.currentState.plan.strategy],
          successfulApproaches: this.currentState.reflections.flatMap(r => r.learnings),
          challenges: this.currentState.reflections.flatMap(r => r.progressAssessment.blockers),
          suggestions: this.currentState.reflections.flatMap(r => r.strategyEvaluation.alternativeStrategies),
        };
      }
    }

    // Fallback synthesis
    return this.createFallbackResult(sessionId, topic, goal);
  }

  /**
   * Create fallback result when synthesis tool fails
   */
  private createFallbackResult(
    sessionId: string,
    topic: string,
    goal: Goal
  ): ResearchResult {
    if (!this.currentState) {
      throw new Error('No current state');
    }

    const findings = this.currentState.workingMemory.keyFindings;
    const synthesis = findings.length > 0
      ? `Research on ${topic}: ${findings.map(f => f.content).join(' ')}`
      : `Research completed on ${topic} with limited findings.`;

    return {
      sessionId,
      topic,
      goal,
      synthesis,
      keyFindings: findings,
      sources: findings.map(f => f.source),
      confidence: this.currentState.progress.confidence,
      completeness: this.currentState.progress.stepsCompleted / Math.max(1, this.currentState.progress.stepsTotal),
      duration: (Date.now() - this.currentState.lastActionTimestamp.getTime()) / 1000,
      totalActions: this.currentState.workingMemory.recentActions.length,
      totalReflections: this.currentState.reflections.length,
      strategiesUsed: [this.currentState.plan.strategy],
      successfulApproaches: [],
      challenges: [],
      suggestions: [],
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get current agent state (for monitoring)
   */
  getState(): AgentState | null {
    return this.currentState;
  }

  /**
   * Pause current research
   */
  async pause(): Promise<void> {
    if (this.currentState) {
      // TODO: Implement pause functionality
      this.logger.info('Research paused', { sessionId: this.currentState.sessionId });
    }
  }

  /**
   * Resume paused research
   */
  async resume(sessionId: string): Promise<void> {
    // TODO: Implement resume functionality
    this.logger.info('Research resumed', { sessionId });

    // Restore state from session
    // This would need to be implemented based on how state is persisted
  }
}

/**
 * Factory function to create AutonomousAgent instance
 */
export function createAutonomousAgent(
  reasoningEngine: ReasoningEngine,
  agentReflection: AgentReflection,
  memorySystem: MemorySystem,
  toolRegistry: ToolRegistry,
  llmClient: LLMClient,
  logger: Logger,
  config: AgentConfig
): AutonomousAgent {
  return new AutonomousAgent(
    reasoningEngine,
    agentReflection,
    memorySystem,
    toolRegistry,
    llmClient,
    logger,
    config
  );
}
