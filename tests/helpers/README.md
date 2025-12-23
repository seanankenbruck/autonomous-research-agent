# Test Utilities

Reusable testing utilities for the autonomous research agent test suite.

## Available Utilities

### Store Creation

#### `createInMemoryDocumentStore()`
Creates an in-memory SQLite document store for fast, isolated tests.

```typescript
const store = createInMemoryDocumentStore();
// Use for testing without file I/O
```

#### `createMockVectorStore()`
Creates a mock vector store with vitest spies.

```typescript
const vectorStore = createMockVectorStore();
// All methods are mocked and can be inspected
```

### Mock Clients

#### `createMockEmbeddingClient(options?)`
Creates a mock embedding client that returns deterministic or random embeddings.

```typescript
// Deterministic embeddings (default)
const embeddingClient = createMockEmbeddingClient({
  dimension: 384,
  deterministic: true,
});

// Random embeddings
const randomClient = createMockEmbeddingClient({
  deterministic: false,
});
```

#### `createMockLLMClient(options?)`
Creates a mock LLM client with configurable responses.

```typescript
const llmClient = createMockLLMClient({
  defaultResponse: 'Default response',
  responses: new Map([
    ['specific prompt', 'specific response'],
  ]),
});
```

#### `createMockLogger()`
Creates a mock logger with spies on all methods.

```typescript
const logger = createMockLogger();
// Inspect calls: expect(logger.info).toHaveBeenCalled()
```

### Embedding Utilities

#### `cosineSimilarity(a, b)`
Calculate cosine similarity between two embeddings.

```typescript
const similarity = cosineSimilarity(embedding1, embedding2);
// Returns value between -1 and 1
```

#### `expectSimilarEmbeddings(embedding1, embedding2, minSimilarity?)`
Assert that two embeddings are similar.

```typescript
expectSimilarEmbeddings(embedding1, embedding2, 0.8);
// Throws if similarity < 0.8
```

#### `createSimilarEmbeddings(baseText, count, dimension?)`
Create a base embedding and similar variants for testing similarity search.

```typescript
const { base, similar } = createSimilarEmbeddings('test text', 5);
// Returns base embedding and 5 similar variants
```

### Async Utilities

#### `waitForAsync(ms?)`
Wait for async operations to complete.

```typescript
await waitForAsync(100); // Wait 100ms
```

#### `flushPromises()`
Flush all pending promises.

```typescript
await flushPromises();
```

#### `expectAsyncError(fn, expectedMessage?)`
Assert that an async function throws an error.

```typescript
await expectAsyncError(
  async () => { throw new Error('Test error'); },
  'Test error'
);
```

### Mock Data Utilities

#### `createMockSearchResults(options)`
Create mock search results for vector store testing.

```typescript
const results = createMockSearchResults({
  count: 5,
  baseScore: 0.9,
  documents: ['doc1', 'doc2'],
});
```

#### `createDateRange(startDate, count, intervalMs?)`
Create a range of dates for testing time-series data.

```typescript
const dates = createDateRange(
  new Date('2024-01-01'),
  10,
  60000 // 1 minute intervals
);
```

### Assertion Utilities

#### `assertContainsAll(actual, expected, compareFn?)`
Assert that an array contains all expected items in any order.

```typescript
assertContainsAll([1, 2, 3], [2, 3]); // Passes
assertContainsAll([1, 2], [1, 2, 3]); // Fails
```

### Time Utilities

#### `MockTimer`
Mock timer for testing time-dependent behavior.

```typescript
const timer = new MockTimer(new Date('2024-01-01'));

timer.setTimeout(() => {
  console.log('Fired!');
}, 1000);

timer.advance(1000); // Executes the timeout
```

### Resource Management

#### `TestResourceManager`
Manage test resources and ensure cleanup.

```typescript
const resources = new TestResourceManager();

resources.register(async () => {
  await store.close();
});

// In afterEach:
await resources.cleanup();
```

### Batch Processing

#### `batchProcess(items, processor, batchSize?)`
Process items in batches for testing bulk operations.

```typescript
const results = await batchProcess(
  items,
  async (item) => await processItem(item),
  10 // Batch size
);
```

### Call Tracking

#### `createCallTracker()`
Create a spy that tracks calls with arguments.

```typescript
const tracker = createCallTracker();

tracker.track('arg1', 'arg2');
tracker.track('arg3', 'arg4');

expect(tracker.getCallCount()).toBe(2);
expect(tracker.wasCalledWith('arg1', 'arg2')).toBe(true);
```

## Usage Examples

### Testing with In-Memory Store

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryDocumentStore } from '../helpers';
import { mockSessions } from '../fixtures/memory';

describe('Session Storage', () => {
  let store: ReturnType<typeof createInMemoryDocumentStore>;

  beforeEach(() => {
    store = createInMemoryDocumentStore();
  });

  afterEach(async () => {
    await store.close();
  });

  it('should store and retrieve session', async () => {
    await store.createSession(mockSessions.activeSession);
    const retrieved = await store.getSession(mockSessions.activeSession.id);
    expect(retrieved).toEqual(mockSessions.activeSession);
  });
});
```

### Testing with Mock Clients

```typescript
import { describe, it, expect } from 'vitest';
import {
  createMockEmbeddingClient,
  createMockLLMClient,
  expectSimilarEmbeddings,
} from '../helpers';

describe('Embedding Generation', () => {
  it('should generate consistent embeddings', async () => {
    const client = createMockEmbeddingClient({ deterministic: true });

    const embedding1 = await client.embed('test text');
    const embedding2 = await client.embed('test text');

    expectSimilarEmbeddings(embedding1, embedding2, 0.99);
  });
});
```

### Testing Async Workflows

```typescript
import { describe, it, expect } from 'vitest';
import { waitForAsync, flushPromises } from '../helpers';

describe('Async Workflow', () => {
  it('should complete async operations', async () => {
    let completed = false;

    setTimeout(() => {
      completed = true;
    }, 50);

    await waitForAsync(60);
    expect(completed).toBe(true);
  });
});
```

### Resource Cleanup

```typescript
import { describe, it, afterEach } from 'vitest';
import { TestResourceManager, createInMemoryDocumentStore } from '../helpers';

describe('Resource Management', () => {
  const resources = new TestResourceManager();

  afterEach(async () => {
    await resources.cleanup();
  });

  it('should clean up resources', async () => {
    const store = createInMemoryDocumentStore();
    resources.register(() => store.close());

    // Resources will be cleaned up after test
  });
});
```

## Best Practices

1. **Use in-memory stores** for unit tests (faster, isolated)
2. **Use mock clients** to avoid external dependencies
3. **Use deterministic embeddings** for reproducible tests
4. **Clean up resources** with `TestResourceManager`
5. **Flush promises** when testing async workflows
6. **Track calls** with `createCallTracker` for detailed assertions
