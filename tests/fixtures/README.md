# Test Fixtures

This directory contains reusable test fixtures for the memory system and related components.

## Directory Structure

```
fixtures/
├── memory/
│   ├── mock-sessions.ts          # Session fixtures and factory
│   ├── mock-episodes.ts          # Episodic memory fixtures and factory
│   ├── mock-facts.ts             # Semantic memory fixtures and factory
│   ├── mock-strategies.ts        # Procedural memory fixtures and factory
│   ├── mock-conversations.ts     # Test conversation data
│   └── index.ts                  # Centralized exports
├── fixtures.test.ts              # Fixture validation tests
└── README.md                     # This file
```

## Usage

### Importing Fixtures

All fixtures can be imported from the central index:

```typescript
import {
  mockSessions,
  mockEpisodes,
  mockFacts,
  mockStrategies,
  mockConversations,
} from '../fixtures/memory';
```

Or import specific items:

```typescript
import {
  activeSession,
  createMockSession,
} from '../fixtures/memory/mock-sessions';
```

### Session Fixtures

**Pre-built sessions:**
- `activeSession` - Currently in progress
- `completedSession` - Successfully finished
- `failedSession` - Encountered errors
- `pausedSession` - Temporarily suspended
- `sessionWithReflections` - Has reflection data
- `parentSession` / `childSession` - Parent-child hierarchy

**Factory function:**
```typescript
const customSession = createMockSession({
  topic: 'My Custom Topic',
  status: 'active',
  userId: 'test-user',
});
```

**Collections:**
- `mockSessionArray` - Array of diverse sessions
- `sessionsByStatus` - Grouped by status

### Episode Fixtures

**Pre-built episodes:**
- `successfulResearch` - Multi-action successful research
- `failedSearch` - Failed search with no results
- `partialSuccess` - Some actions succeeded, some failed
- `multiActionEpisode` - Comprehensive workflow (search → fetch → analyze → verify → synthesize)
- `episodeWithFeedback` - Includes user feedback

**Factory function:**
```typescript
const customEpisode = createMockEpisode({
  topic: 'Custom Research',
  success: true,
  actions: [...],
  outcomes: [...],
});
```

**Collections:**
- `mockEpisodeArray` - Array of diverse episodes

### Fact Fixtures

**Pre-built facts:**
- `highConfidenceFacts` - High confidence (≥0.9) verified facts
- `lowConfidenceFacts` - Low confidence (<0.5) speculative facts
- `categorizedFacts` - Map organized by category
- `relatedFacts` - Facts with bidirectional relationships
- `frequentlyAccessedFact` - High access count
- `rarelyAccessedFact` - Low access count
- `recentlyModifiedFact` - Recently updated

**Factory function:**
```typescript
const customFact = createMockFact({
  content: 'My custom fact',
  category: 'custom-category',
  confidence: 0.95,
});
```

**Utilities:**
```typescript
// Get all facts from categorized map
const allFacts = getAllCategorizedFacts();
```

### Strategy Fixtures

**Pre-built strategies:**
- `highSuccessStrategy` - High success rate (>0.9)
- `lowSuccessStrategy` - Low success rate (<0.5)
- `frequentlyUsedStrategy` - High usage count (>100)
- `recentlyRefinedStrategy` - Recently refined
- `technicalStrategy` - Specialized for technical content
- `experimentalStrategy` - New strategy with few uses
- `highlyRefinedStrategy` - Multiple refinements (>3)

**Factory function:**
```typescript
const customStrategy = createMockStrategy({
  strategyName: 'my_custom_strategy',
  successRate: 0.85,
  timesUsed: 50,
});
```

**Collections:**
- `strategiesBySuccessRate` - Grouped by success rate (high/medium/low)
- `strategiesByUsage` - Grouped by usage frequency

### Conversation Fixtures

**Pre-built conversations:**
- `technicalDiscussion` - Programming Q&A session
- `researchSession` - Research about a topic
- `debuggingSession` - Bug investigation
- `brainstormingSession` - Idea generation
- `partialSuccessConversation` - Some failures encountered

**Utilities:**
```typescript
// Extract actions from conversation
const actions = extractConversationActions(technicalDiscussion);

// Extract outcomes from conversation
const outcomes = extractConversationOutcomes(technicalDiscussion);
```

## Test Utilities

Common utilities are available in `tests/helpers/`:

```typescript
import {
  createInMemoryDocumentStore,
  createMockVectorStore,
  createMockEmbeddingClient,
  createMockLLMClient,
  createMockLogger,
} from '../helpers';
```

See [tests/helpers/README.md](../helpers/README.md) for complete documentation.

## Example Usage

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { SessionManager } from '../../../src/memory/managers/session-manager';
import { createInMemoryDocumentStore, createMockLogger } from '../../helpers';
import { createMockSession } from '../../fixtures/memory';

describe('SessionManager', () => {
  it('should retrieve session by ID', async () => {
    const store = createInMemoryDocumentStore();
    const logger = createMockLogger();
    const manager = new SessionManager(store, logger);

    const session = createMockSession({ topic: 'Test' });
    // ... test logic
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { MemorySystem } from '../../../src/memory/system';
import { createInMemoryDocumentStore, createMockLogger } from '../../helpers';
import { mockEpisodeArray, mockFactArray } from '../../fixtures/memory';

describe('MemorySystem Integration', () => {
  it('should handle bulk episode storage', async () => {
    const store = createInMemoryDocumentStore();
    const logger = createMockLogger();
    const system = new MemorySystem(store, logger);

    // Use pre-built episodes for testing
    for (const episode of mockEpisodeArray) {
      await store.storeEpisode(episode);
    }

    // ... test logic
  });
});
```

## Fixture Design Principles

1. **Deterministic** - Fixtures use fixed dates and IDs for reproducible tests
2. **Realistic** - Data reflects actual usage patterns
3. **Diverse** - Cover success, failure, and edge cases
4. **Composable** - Factory functions allow customization
5. **Documented** - Clear naming and structure
6. **Validated** - All fixtures are tested in `fixtures.test.ts`

## Adding New Fixtures

When adding new fixtures:

1. Create the fixture in the appropriate `mock-*.ts` file
2. Export it from the file
3. Add export to `index.ts`
4. Add validation test to `fixtures.test.ts`
5. Document usage in this README

## Best Practices

1. **Use factory functions** for custom test data
2. **Use pre-built fixtures** for common scenarios
3. **Use collections** (`*Array`, `*ByStatus`) for bulk testing
4. **Keep tests deterministic** - fixtures use fixed dates
5. **Clean up resources** - use `TestResourceManager` for cleanup
