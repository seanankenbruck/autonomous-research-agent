/**
 * Mock Conversation Fixtures
 * Provides realistic conversation data for testing
 */

import type { Action, Outcome } from '../../../src/agent/types';

/**
 * Conversation turn representing a user-agent interaction
 */
export interface ConversationTurn {
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  actions?: Action[];
  outcomes?: Outcome[];
}

/**
 * Complete conversation with metadata
 */
export interface TestConversation {
  id: string;
  topic: string;
  turns: ConversationTurn[];
  startTime: Date;
  endTime: Date;
  outcome: 'success' | 'partial' | 'failed';
}

/**
 * Technical discussion conversation
 */
export const technicalDiscussion: TestConversation = {
  id: 'conv-technical-1',
  topic: 'Deep Learning Optimization',
  startTime: new Date('2024-01-15T10:00:00Z'),
  endTime: new Date('2024-01-15T10:15:00Z'),
  outcome: 'success',
  turns: [
    {
      type: 'user',
      content: 'What are the best optimization techniques for training deep neural networks?',
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      type: 'agent',
      content: 'Let me research the latest optimization techniques for deep learning.',
      timestamp: new Date('2024-01-15T10:00:01Z'),
      actions: [
        {
          id: 'action-tech-1',
          sessionId: 'session-1',
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'deep learning optimization techniques 2024' },
          reasoning: 'Search for current best practices in DL optimization',
          timestamp: new Date('2024-01-15T10:00:02Z'),
        },
      ],
      outcomes: [
        {
          actionId: 'action-tech-1',
          success: true,
          result: { resultsFound: 15 },
          observations: ['Found recent papers on Adam, RMSprop, and AdamW'],
          duration: 1500,
          metadata: {},
          timestamp: new Date('2024-01-15T10:00:03.5Z'),
        },
      ],
    },
    {
      type: 'agent',
      content:
        'Based on recent research, here are the top optimization techniques:\n\n1. **Adam (Adaptive Moment Estimation)**: Combines advantages of AdaGrad and RMSprop\n2. **AdamW**: Adam with decoupled weight decay regularization\n3. **Learning Rate Scheduling**: Cosine annealing or step decay\n4. **Gradient Clipping**: Prevents exploding gradients\n5. **Batch Normalization**: Stabilizes training\n\nAdamW is particularly popular for transformer models.',
      timestamp: new Date('2024-01-15T10:00:10Z'),
    },
    {
      type: 'user',
      content: 'Can you explain why AdamW is better than regular Adam?',
      timestamp: new Date('2024-01-15T10:00:30Z'),
    },
    {
      type: 'agent',
      content:
        'AdamW decouples weight decay from the gradient-based update. In regular Adam, weight decay is implemented as L2 regularization which interacts with the adaptive learning rates. AdamW applies weight decay directly to the parameters, making it more effective for regularization while maintaining the benefits of adaptive learning rates.',
      timestamp: new Date('2024-01-15T10:00:35Z'),
    },
  ],
};

/**
 * Research session conversation
 */
export const researchSession: TestConversation = {
  id: 'conv-research-1',
  topic: 'Autonomous Agent Architectures',
  startTime: new Date('2024-01-15T11:00:00Z'),
  endTime: new Date('2024-01-15T11:30:00Z'),
  outcome: 'success',
  turns: [
    {
      type: 'user',
      content: 'I need to research different architectures for autonomous agents.',
      timestamp: new Date('2024-01-15T11:00:00Z'),
    },
    {
      type: 'agent',
      content: 'I\'ll conduct comprehensive research on autonomous agent architectures.',
      timestamp: new Date('2024-01-15T11:00:01Z'),
      actions: [
        {
          id: 'action-research-1',
          sessionId: 'session-2',
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'autonomous agent architectures' },
          reasoning: 'Find overview of agent architectures',
          timestamp: new Date('2024-01-15T11:00:02Z'),
        },
      ],
      outcomes: [
        {
          actionId: 'action-research-1',
          success: true,
          result: { resultsFound: 20 },
          observations: ['Found papers on ReAct, Reflexion, and tool-using agents'],
          duration: 2000,
          metadata: {},
          timestamp: new Date('2024-01-15T11:00:04Z'),
        },
      ],
    },
    {
      type: 'agent',
      content:
        'I found several prominent agent architectures:\n\n**1. ReAct (Reasoning + Acting)**\n- Interleaves reasoning and action steps\n- Uses chain-of-thought prompting\n\n**2. Reflexion**\n- Adds self-reflection capability\n- Learns from past mistakes\n\n**3. AutoGPT-style**\n- Goal decomposition and planning\n- Autonomous task execution\n\nWould you like me to dive deeper into any of these?',
      timestamp: new Date('2024-01-15T11:00:15Z'),
    },
    {
      type: 'user',
      content: 'Yes, tell me more about the Reflexion architecture.',
      timestamp: new Date('2024-01-15T11:00:30Z'),
    },
    {
      type: 'agent',
      content: 'Let me gather more detailed information on Reflexion.',
      timestamp: new Date('2024-01-15T11:00:31Z'),
      actions: [
        {
          id: 'action-research-2',
          sessionId: 'session-2',
          type: 'fetch',
          tool: 'web_fetch',
          parameters: { url: 'https://example.com/reflexion-paper' },
          reasoning: 'Get detailed information on Reflexion architecture',
          timestamp: new Date('2024-01-15T11:00:32Z'),
        },
      ],
      outcomes: [
        {
          actionId: 'action-research-2',
          success: true,
          result: { wordCount: 6000 },
          observations: ['Detailed paper with implementation examples'],
          duration: 3000,
          metadata: {},
          timestamp: new Date('2024-01-15T11:00:35Z'),
        },
      ],
    },
    {
      type: 'agent',
      content:
        '**Reflexion Architecture:**\n\nReflexion enhances agents with episodic memory and self-reflection:\n\n1. **Actor**: Generates actions based on current state\n2. **Evaluator**: Assesses action quality and outcomes\n3. **Self-Reflection**: Analyzes failures to generate insights\n4. **Memory**: Stores reflections for future reference\n\nKey benefit: Agents learn from mistakes without parameter updates, using natural language feedback stored in memory.',
      timestamp: new Date('2024-01-15T11:00:45Z'),
    },
  ],
};

/**
 * Debugging session conversation
 */
export const debuggingSession: TestConversation = {
  id: 'conv-debug-1',
  topic: 'Investigating API Error',
  startTime: new Date('2024-01-15T14:00:00Z'),
  endTime: new Date('2024-01-15T14:20:00Z'),
  outcome: 'success',
  turns: [
    {
      type: 'user',
      content: 'My API is returning 500 errors intermittently. Can you help investigate?',
      timestamp: new Date('2024-01-15T14:00:00Z'),
    },
    {
      type: 'agent',
      content: 'I\'ll help investigate the API errors. Let me search for common causes of intermittent 500 errors.',
      timestamp: new Date('2024-01-15T14:00:01Z'),
      actions: [
        {
          id: 'action-debug-1',
          sessionId: 'session-3',
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'intermittent 500 errors API debugging' },
          reasoning: 'Find common causes and solutions',
          timestamp: new Date('2024-01-15T14:00:02Z'),
        },
      ],
      outcomes: [
        {
          actionId: 'action-debug-1',
          success: true,
          result: { resultsFound: 12 },
          observations: ['Common causes: race conditions, resource limits, database connections'],
          duration: 1800,
          metadata: {},
          timestamp: new Date('2024-01-15T14:00:03.8Z'),
        },
      ],
    },
    {
      type: 'agent',
      content:
        'Intermittent 500 errors often stem from:\n\n1. **Resource exhaustion**: Memory leaks, connection pool limits\n2. **Race conditions**: Concurrent access issues\n3. **External dependencies**: Timeout or failure in downstream services\n4. **Database issues**: Connection limits, slow queries\n\nWhat does your error logging show?',
      timestamp: new Date('2024-01-15T14:00:10Z'),
    },
    {
      type: 'user',
      content: 'The logs show "Too many database connections" errors.',
      timestamp: new Date('2024-01-15T14:00:30Z'),
    },
    {
      type: 'agent',
      content:
        'That\'s the issue! Your database connection pool is being exhausted. Solutions:\n\n1. **Increase pool size** (short-term)\n2. **Fix connection leaks**: Ensure connections are properly closed\n3. **Implement connection timeout**: Prevent hanging connections\n4. **Add connection monitoring**: Track active connections\n\nI recommend checking your code for unclosed database connections first.',
      timestamp: new Date('2024-01-15T14:00:35Z'),
    },
  ],
};

/**
 * Brainstorming session conversation
 */
export const brainstormingSession: TestConversation = {
  id: 'conv-brainstorm-1',
  topic: 'AI Product Ideas',
  startTime: new Date('2024-01-15T15:00:00Z'),
  endTime: new Date('2024-01-15T15:25:00Z'),
  outcome: 'success',
  turns: [
    {
      type: 'user',
      content: 'Let\'s brainstorm AI product ideas for small businesses.',
      timestamp: new Date('2024-01-15T15:00:00Z'),
    },
    {
      type: 'agent',
      content: 'Great! Let me research current trends in AI for small business.',
      timestamp: new Date('2024-01-15T15:00:01Z'),
      actions: [
        {
          id: 'action-brainstorm-1',
          sessionId: 'session-4',
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'AI tools small business 2024' },
          reasoning: 'Identify market gaps and opportunities',
          timestamp: new Date('2024-01-15T15:00:02Z'),
        },
      ],
      outcomes: [
        {
          actionId: 'action-brainstorm-1',
          success: true,
          result: { resultsFound: 18 },
          observations: ['Growing interest in automation, customer service, and analytics'],
          duration: 2000,
          metadata: {},
          timestamp: new Date('2024-01-15T15:00:04Z'),
        },
      ],
    },
    {
      type: 'agent',
      content:
        'Based on current trends, here are AI product ideas for small businesses:\n\n1. **Smart Customer Service Bot**: Handles common queries, escalates complex issues\n2. **Automated Bookkeeping Assistant**: Categorizes expenses, flags anomalies\n3. **Social Media Content Generator**: Creates posts based on business context\n4. **Inventory Prediction System**: Forecasts demand and optimizes stock\n5. **Email Response Automation**: Drafts responses to common emails\n\nWhich area interests you most?',
      timestamp: new Date('2024-01-15T15:00:15Z'),
    },
    {
      type: 'user',
      content: 'The bookkeeping assistant sounds promising. What features should it have?',
      timestamp: new Date('2024-01-15T15:00:30Z'),
    },
    {
      type: 'agent',
      content:
        '**AI Bookkeeping Assistant - Key Features:**\n\n**Core Capabilities:**\n- Receipt scanning and data extraction\n- Automatic expense categorization\n- Bank transaction reconciliation\n- Anomaly detection (unusual expenses)\n\n**Smart Features:**\n- Tax deduction suggestions\n- Cash flow predictions\n- Budget vs. actual analysis\n- Natural language queries ("How much did I spend on marketing last month?")\n\n**Integration:**\n- Connect to bank accounts\n- Sync with invoicing tools\n- Export to accounting software\n\nThis could save small businesses 10-15 hours per month!',
      timestamp: new Date('2024-01-15T15:00:40Z'),
    },
  ],
};

/**
 * Partial success conversation (some actions failed)
 */
export const partialSuccessConversation: TestConversation = {
  id: 'conv-partial-1',
  topic: 'Research Rare Topic',
  startTime: new Date('2024-01-15T16:00:00Z'),
  endTime: new Date('2024-01-15T16:10:00Z'),
  outcome: 'partial',
  turns: [
    {
      type: 'user',
      content: 'Find information about quantum entanglement in biological systems.',
      timestamp: new Date('2024-01-15T16:00:00Z'),
    },
    {
      type: 'agent',
      content: 'I\'ll search for information on quantum biology.',
      timestamp: new Date('2024-01-15T16:00:01Z'),
      actions: [
        {
          id: 'action-partial-1',
          sessionId: 'session-5',
          type: 'search',
          tool: 'web_search',
          parameters: { query: 'quantum entanglement biological systems' },
          reasoning: 'Search for scientific literature',
          timestamp: new Date('2024-01-15T16:00:02Z'),
        },
      ],
      outcomes: [
        {
          actionId: 'action-partial-1',
          success: true,
          result: { resultsFound: 5 },
          observations: ['Limited results, highly specialized topic'],
          duration: 1500,
          metadata: {},
          timestamp: new Date('2024-01-15T16:00:03.5Z'),
        },
      ],
    },
    {
      type: 'agent',
      content:
        'I found limited information on this topic. This is a highly specialized area of quantum biology with ongoing research. The few sources suggest potential quantum effects in photosynthesis and bird navigation, but the evidence is still debated.\n\nWould you like me to search for related topics or specific researchers in this field?',
      timestamp: new Date('2024-01-15T16:00:10Z'),
    },
  ],
};

/**
 * Collection of all mock conversations
 */
export const mockConversations = {
  technicalDiscussion,
  researchSession,
  debuggingSession,
  brainstormingSession,
  partialSuccess: partialSuccessConversation,
};

/**
 * Array of all conversations for bulk testing
 */
export const mockConversationArray: TestConversation[] = [
  technicalDiscussion,
  researchSession,
  debuggingSession,
  brainstormingSession,
  partialSuccessConversation,
];

/**
 * Extract all actions from a conversation
 */
export function extractConversationActions(conversation: TestConversation): Action[] {
  const actions: Action[] = [];
  for (const turn of conversation.turns) {
    if (turn.actions) {
      actions.push(...turn.actions);
    }
  }
  return actions;
}

/**
 * Extract all outcomes from a conversation
 */
export function extractConversationOutcomes(
  conversation: TestConversation
): Outcome[] {
  const outcomes: Outcome[] = [];
  for (const turn of conversation.turns) {
    if (turn.outcomes) {
      outcomes.push(...turn.outcomes);
    }
  }
  return outcomes;
}
