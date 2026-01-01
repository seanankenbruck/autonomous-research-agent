/**
 * Agent Fixtures Index
 * Centralized exports for all agent-related test fixtures
 */

// Action fixtures
export {
  createMockAction,
  searchAction,
  fetchAction,
  analyzeAction,
  synthesizeAction,
  failedAction,
  reflectAction,
  replanAction,
  mockActionArray,
  actionsByType,
  generateActionSequence,
  createActionsWithToolPattern,
  createMixedSuccessActions,
} from './mock-actions';

// Outcome fixtures
export {
  createMockOutcome,
  successfulOutcome,
  failedOutcome,
  searchOutcome,
  fetchOutcome,
  analyzeOutcome,
  synthesizeOutcome,
  partialSuccessOutcome,
  mockOutcomeArray,
  outcomesByStatus,
  generateOutcomeSequence,
  createOutcomesWithDurations,
  createConsecutiveFailures,
  createTypedOutcomes,
} from './mock-outcomes';

// Goal fixtures
export {
  createMockGoal,
  simpleGoal,
  moderateGoal,
  complexGoal,
  constrainedGoal,
  technicalGoal,
  exploratoryGoal,
  quickGoal,
  comparativeGoal,
  historicalGoal,
  goalsByComplexity,
  mockGoalArray,
  generateGoalsWithCriteria,
  generateGoalsWithConstraints,
  createGoalWithComplexity,
} from './mock-goals';

// Plan fixtures
export {
  createMockPlan,
  createMockStep,
  basicPlan,
  complexPlan,
  adaptivePlan,
  quickPlan,
  iterativePlan,
  failedPlan,
  plansByStrategy,
  mockPlanArray,
  generatePlanWithSteps,
  generatePlanWithMixedStatuses,
  createParallelPlan,
} from './mock-plans';

// State fixtures
export {
  createMockState,
  initialState,
  inProgressState,
  completedState,
  lowConfidenceState,
  highIterationState,
  reflectiveState,
  statesByPhase,
  mockStateArray,
  generateStateAtProgress,
  generateStateWithMemorySize,
  createStateInPhase,
} from './mock-states';
