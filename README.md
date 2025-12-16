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