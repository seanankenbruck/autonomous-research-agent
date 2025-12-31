/**
 * Agent Module Exports
 * Autonomous Research Agent core components
 */

// Core agent
export {
  AutonomousAgent,
  createAutonomousAgent,
  type AgentConfig,
  type AgentExecutionResult,
} from './core';

// Reasoning engine
export {
  ReasoningEngine,
  createReasoningEngine,
  type ReasoningMemoryContext,
  type ReasoningResult,
  type ObservationResult,
} from './reasoning';

// Reflection integration
export {
  AgentReflection,
  createAgentReflection,
  type ReflectionTriggerResult,
  type ReflectionApplicationResult,
} from './reflection';

// Types
export * from './types';
