/**
 * Mock Semantic Memory (Facts) Fixtures
 * Provides realistic fact data for testing
 */

import { v4 as uuidv4 } from 'uuid';
import type { SemanticMemory } from '../../../src/agent/types';

/**
 * Create a mock semantic memory (fact) with optional overrides
 */
export function createMockFact(
  overrides?: Partial<SemanticMemory>
): SemanticMemory {
  const id = overrides?.id || uuidv4();
  const createdAt = overrides?.createdAt || new Date('2024-01-15T10:00:00Z');

  return {
    id,
    content:
      overrides?.content ||
      'Machine learning models require large amounts of training data',
    category: overrides?.category || 'machine-learning',
    subcategory: overrides?.subcategory || 'training',
    source: overrides?.source || 'episode-success-1',
    confidence: overrides?.confidence !== undefined ? overrides.confidence : 0.85,
    relevance: overrides?.relevance !== undefined ? overrides.relevance : 0.8,
    createdAt,
    lastAccessed: overrides?.lastAccessed || createdAt,
    accessCount: overrides?.accessCount !== undefined ? overrides.accessCount : 1,
    lastModified: overrides?.lastModified || createdAt,
    tags: overrides?.tags || ['ml', 'training', 'data'],
    relatedFacts: overrides?.relatedFacts || [],
    embedding: overrides?.embedding,
  };
}

/**
 * High confidence facts
 */
export const highConfidenceFacts: SemanticMemory[] = [
  createMockFact({
    id: 'fact-high-1',
    content: 'Deep neural networks use backpropagation for training',
    category: 'deep-learning',
    subcategory: 'training',
    confidence: 0.98,
    relevance: 0.95,
    tags: ['deep-learning', 'backpropagation', 'training'],
    source: 'episode-success-1',
    accessCount: 15,
  }),
  createMockFact({
    id: 'fact-high-2',
    content: 'Transformer architecture revolutionized natural language processing',
    category: 'nlp',
    subcategory: 'architecture',
    confidence: 0.95,
    relevance: 0.9,
    tags: ['nlp', 'transformers', 'architecture'],
    source: 'episode-success-1',
    accessCount: 12,
  }),
  createMockFact({
    id: 'fact-high-3',
    content: 'Reinforcement learning agents learn through trial and error',
    category: 'reinforcement-learning',
    subcategory: 'fundamentals',
    confidence: 0.96,
    relevance: 0.92,
    tags: ['rl', 'learning', 'agents'],
    source: 'episode-multi-1',
    accessCount: 8,
  }),
];

/**
 * Low confidence facts (unverified or speculative)
 */
export const lowConfidenceFacts: SemanticMemory[] = [
  createMockFact({
    id: 'fact-low-1',
    content: 'AGI may be achieved within the next decade',
    category: 'ai-future',
    subcategory: 'predictions',
    confidence: 0.3,
    relevance: 0.6,
    tags: ['agi', 'predictions', 'speculative'],
    source: 'episode-partial-1',
    accessCount: 2,
  }),
  createMockFact({
    id: 'fact-low-2',
    content: 'Quantum computing will replace classical ML within 5 years',
    category: 'quantum-computing',
    subcategory: 'predictions',
    confidence: 0.25,
    relevance: 0.5,
    tags: ['quantum', 'ml', 'speculative'],
    source: 'episode-partial-1',
    accessCount: 1,
  }),
  createMockFact({
    id: 'fact-low-3',
    content: 'Neural networks mimic the human brain exactly',
    category: 'neuroscience',
    subcategory: 'comparison',
    confidence: 0.4,
    relevance: 0.55,
    tags: ['neuroscience', 'neural-networks', 'misconception'],
    source: 'episode-partial-1',
    accessCount: 3,
  }),
];

/**
 * Facts categorized by topic
 */
export const categorizedFacts: Map<string, SemanticMemory[]> = new Map([
  [
    'machine-learning',
    [
      createMockFact({
        id: 'fact-ml-1',
        content: 'Supervised learning requires labeled training data',
        category: 'machine-learning',
        subcategory: 'supervised-learning',
        confidence: 0.95,
        relevance: 0.9,
        tags: ['supervised', 'training', 'data'],
      }),
      createMockFact({
        id: 'fact-ml-2',
        content: 'Overfitting occurs when model memorizes training data',
        category: 'machine-learning',
        subcategory: 'problems',
        confidence: 0.92,
        relevance: 0.88,
        tags: ['overfitting', 'training', 'validation'],
      }),
      createMockFact({
        id: 'fact-ml-3',
        content: 'Cross-validation helps assess model generalization',
        category: 'machine-learning',
        subcategory: 'evaluation',
        confidence: 0.9,
        relevance: 0.85,
        tags: ['validation', 'evaluation', 'cross-validation'],
      }),
    ],
  ],
  [
    'deep-learning',
    [
      createMockFact({
        id: 'fact-dl-1',
        content: 'Convolutional layers are effective for image processing',
        category: 'deep-learning',
        subcategory: 'architectures',
        confidence: 0.94,
        relevance: 0.9,
        tags: ['cnn', 'images', 'architecture'],
      }),
      createMockFact({
        id: 'fact-dl-2',
        content: 'Dropout prevents overfitting in neural networks',
        category: 'deep-learning',
        subcategory: 'regularization',
        confidence: 0.93,
        relevance: 0.87,
        tags: ['dropout', 'regularization', 'overfitting'],
      }),
      createMockFact({
        id: 'fact-dl-3',
        content: 'Batch normalization stabilizes training',
        category: 'deep-learning',
        subcategory: 'optimization',
        confidence: 0.91,
        relevance: 0.86,
        tags: ['batch-norm', 'optimization', 'training'],
      }),
    ],
  ],
  [
    'nlp',
    [
      createMockFact({
        id: 'fact-nlp-1',
        content: 'Word embeddings capture semantic relationships',
        category: 'nlp',
        subcategory: 'representations',
        confidence: 0.92,
        relevance: 0.88,
        tags: ['embeddings', 'semantics', 'word2vec'],
      }),
      createMockFact({
        id: 'fact-nlp-2',
        content: 'Attention mechanisms improve sequence-to-sequence models',
        category: 'nlp',
        subcategory: 'mechanisms',
        confidence: 0.94,
        relevance: 0.91,
        tags: ['attention', 'seq2seq', 'transformers'],
      }),
      createMockFact({
        id: 'fact-nlp-3',
        content: 'Pre-trained language models enable transfer learning',
        category: 'nlp',
        subcategory: 'transfer-learning',
        confidence: 0.95,
        relevance: 0.92,
        tags: ['pretrained', 'transfer-learning', 'bert'],
      }),
    ],
  ],
  [
    'autonomous-agents',
    [
      createMockFact({
        id: 'fact-agent-1',
        content: 'Agents use planning to achieve long-term goals',
        category: 'autonomous-agents',
        subcategory: 'planning',
        confidence: 0.93,
        relevance: 0.95,
        tags: ['planning', 'goals', 'reasoning'],
      }),
      createMockFact({
        id: 'fact-agent-2',
        content: 'Reflection enables agents to learn from experience',
        category: 'autonomous-agents',
        subcategory: 'learning',
        confidence: 0.89,
        relevance: 0.9,
        tags: ['reflection', 'learning', 'meta-cognition'],
      }),
      createMockFact({
        id: 'fact-agent-3',
        content: 'Multi-agent systems require coordination mechanisms',
        category: 'autonomous-agents',
        subcategory: 'multi-agent',
        confidence: 0.87,
        relevance: 0.85,
        tags: ['multi-agent', 'coordination', 'communication'],
      }),
    ],
  ],
]);

/**
 * Facts with related facts (forming a knowledge graph)
 */
export const relatedFacts: SemanticMemory[] = [
  createMockFact({
    id: 'fact-related-1',
    content: 'Neural networks consist of interconnected layers of neurons',
    category: 'deep-learning',
    subcategory: 'architecture',
    confidence: 0.95,
    relevance: 0.9,
    tags: ['neural-networks', 'architecture'],
    relatedFacts: ['fact-related-2', 'fact-related-3'],
  }),
  createMockFact({
    id: 'fact-related-2',
    content: 'Each neuron applies an activation function to its input',
    category: 'deep-learning',
    subcategory: 'components',
    confidence: 0.94,
    relevance: 0.88,
    tags: ['neurons', 'activation-functions'],
    relatedFacts: ['fact-related-1', 'fact-related-3'],
  }),
  createMockFact({
    id: 'fact-related-3',
    content: 'Common activation functions include ReLU, sigmoid, and tanh',
    category: 'deep-learning',
    subcategory: 'activation-functions',
    confidence: 0.96,
    relevance: 0.87,
    tags: ['activation-functions', 'relu', 'sigmoid'],
    relatedFacts: ['fact-related-1', 'fact-related-2'],
  }),
];

/**
 * Facts with different access patterns
 */
export const frequentlyAccessedFact = createMockFact({
  id: 'fact-frequent-1',
  content: 'Gradient descent is the foundation of neural network training',
  category: 'deep-learning',
  subcategory: 'optimization',
  confidence: 0.97,
  relevance: 0.95,
  accessCount: 50,
  lastAccessed: new Date('2024-01-15T15:00:00Z'),
  tags: ['gradient-descent', 'optimization', 'fundamental'],
});

export const rarelyAccessedFact = createMockFact({
  id: 'fact-rare-1',
  content: 'Hopfield networks are a type of recurrent neural network',
  category: 'deep-learning',
  subcategory: 'recurrent-networks',
  confidence: 0.88,
  relevance: 0.6,
  accessCount: 1,
  lastAccessed: new Date('2024-01-10T10:00:00Z'),
  tags: ['hopfield', 'rnn', 'historical'],
});

/**
 * Recently modified fact
 */
export const recentlyModifiedFact = createMockFact({
  id: 'fact-modified-1',
  content: 'Large language models demonstrate emergent capabilities at scale',
  category: 'nlp',
  subcategory: 'large-models',
  confidence: 0.85,
  relevance: 0.9,
  createdAt: new Date('2024-01-10T10:00:00Z'),
  lastModified: new Date('2024-01-15T14:00:00Z'),
  tags: ['llm', 'emergence', 'scaling'],
});

/**
 * Collection of all mock facts
 */
export const mockFacts = {
  highConfidence: highConfidenceFacts,
  lowConfidence: lowConfidenceFacts,
  categorizedFacts,
  relatedFacts,
  frequentlyAccessed: frequentlyAccessedFact,
  rarelyAccessed: rarelyAccessedFact,
  recentlyModified: recentlyModifiedFact,
};

/**
 * Array of all facts for bulk testing
 */
export const mockFactArray: SemanticMemory[] = [
  ...highConfidenceFacts,
  ...lowConfidenceFacts,
  ...relatedFacts,
  frequentlyAccessedFact,
  rarelyAccessedFact,
  recentlyModifiedFact,
];

/**
 * Get all facts from categorized map
 */
export function getAllCategorizedFacts(): SemanticMemory[] {
  const allFacts: SemanticMemory[] = [];
  for (const facts of categorizedFacts.values()) {
    allFacts.push(...facts);
  }
  return allFacts;
}
