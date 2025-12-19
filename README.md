# Autonomous Research Agent

An autonomous AI agent with persistent memory, adaptive learning, and multi-session capabilities for conducting research tasks.

## Features

- 🧠 **Persistent Memory**: Episodic, semantic, and procedural memory systems
- 🔄 **Multi-Session**: Resume research across sessions
- 🤔 **Adaptive Learning**: Improves strategies based on outcomes and feedback
- 💭 **Self-Reflection**: Evaluates progress and adjusts approach
- 🔍 **Research Tools**: Web search, content analysis, synthesis

## Architecture

- **Vector Store**: Chroma for semantic search
- **Document Store**: SQLite for structured data
- **LLM**: Claude Sonnet 4 for reasoning and decision-making

## Project Structure

```
autonomous-research-agent/
├── src/
│   ├── agent/                      # Core agent implementation
│   │   ├── core.ts                 # Main autonomous agent class
│   │   ├── reasoning.ts            # Reasoning and decision-making logic
│   │   ├── reflection.ts           # Self-reflection capabilities
│   │   └── types.ts                # Core type definitions
│   │
│   ├── llm/                        # LLM client and utilities
│   │   ├── client.ts               # Claude API client wrapper
│   │   ├── embeddings.ts           # Voyage AI embedding client
│   │   ├── token-counter.ts        # Token estimation utilities
│   │   └── types.ts                # LLM-related type definitions
│   │
│   ├── memory/                     # Memory system components
│   │   ├── managers/               # Memory managers
│   │   │   ├── episodic-manager.ts    # Episodic memory (experiences)
│   │   │   ├── semantic-manager.ts    # Semantic memory (facts/knowledge)
│   │   │   ├── procedural-manager.ts  # Procedural memory (strategies)
│   │   │   └── session-manager.ts     # Session state management
│   │   ├── stores/                 # Storage backends
│   │   │   ├── vector-store.ts        # ChromaDB vector store
│   │   │   ├── document-store.ts      # SQLite document store
│   │   │   └── graph-store.ts         # Knowledge graph store
│   │   ├── memory-system.ts        # Unified memory interface
│   │   └── reflection-engine.ts    # Memory consolidation & reflection
│   │
│   ├── tools/                      # Agent tools
│   │   ├── search.ts               # Web search capabilities
│   │   ├── fetch.ts                # Content fetching
│   │   ├── analyze.ts              # Content analysis
│   │   └── synthesize.ts           # Information synthesis
│   │
│   └── utils/                      # Shared utilities
│       ├── config.ts               # Configuration management
│       └── logger.ts               # Logging utilities
│
├── tests/                          # Test suites
│   └── unit/
│       ├── llm/
│       │   └── client.test.ts      # LLM client tests
│       └── memory/
│           ├── memory-system.test.ts
│           └── stores/
│               ├── vector-store.test.ts
│               └── document-store.test.ts
│
├── storage/                        # Persistent data (gitignored)
│   ├── chroma/                     # Vector embeddings
│   ├── sqlite/                     # Structured data
│   └── logs/                       # Application logs
│
├── docker/                         # Docker configuration
│   └── docker-compose.yml          # ChromaDB service
│
├── .env.example                    # Environment template
├── Makefile                        # Development commands
├── package.json                    # Node dependencies
└── tsconfig.json                   # TypeScript configuration
```

### Key Components

#### Agent Layer
- **core.ts**: Main orchestrator for research sessions
- **reasoning.ts**: Planning and decision-making
- **reflection.ts**: Self-evaluation and adaptation

#### Memory System
- **Episodic**: Stores past experiences and research sessions
- **Semantic**: Extracts and stores facts/knowledge with LLM-powered consolidation
- **Procedural**: Learns and improves research strategies
- **Session**: Manages multi-turn research conversations

#### LLM Integration
- **Client**: Type-safe wrapper around Anthropic Claude API
- **Embeddings**: Voyage AI integration for semantic search
- **Token Counter**: Context window management and estimation

#### Storage
- **Vector Store**: ChromaDB for semantic similarity search
- **Document Store**: SQLite for structured episodic/semantic data
- **Graph Store**: Knowledge relationships and connections

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Anthropic API key
- (Optional) Tavily API key for web search

### Setup

1. **Clone and install**
```bash
   git clone <repository-url>
   cd autonomous-research-agent
   make install
```

2. **Configure environment**
```bash
   cp .env.example .env
   # Edit .env with your API keys
```

3. **Initialize infrastructure**
```bash
   make init
```

4. **Start development environment**
```bash
   make dev
```

## Usage
```typescript
import { AutonomousResearchAgent } from './src/agent/core';

const agent = new AutonomousResearchAgent();

// Start new research session
const session = await agent.startSession(
  "What are the latest developments in quantum computing?"
);

const result = await agent.execute(session);
console.log(result.synthesis);

// Resume later
const resumed = await agent.startSession(
  "Continue quantum computing research",
  session.id
);
```

## Development

- `make dev` - Start with admin UI
- `make logs` - View service logs
- `make test` - Run tests
- `make clean` - Clean up everything

## Storage

Data is persisted in `./storage/`:
- `chroma/` - Vector embeddings
- `sqlite/` - Structured data
- `logs/` - Application logs

## License

MIT