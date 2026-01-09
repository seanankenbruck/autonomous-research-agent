# Autonomous Research Agent

A fully autonomous AI agent that conducts comprehensive research on any topic using the **ReAct (Reasoning + Acting) pattern**. The agent iteratively gathers information from the web, analyzes content, extracts facts, and synthesizes findings into a coherent research report—all without human intervention.

Unlike simple question-answering systems, this agent **plans, executes, observes, and adapts** its research strategy in real-time, leveraging persistent memory systems to improve over time.

---

## 🎯 What Does This Do?

This agent conducts **autonomous research** by:

1. **Understanding Your Goal**: You provide a research topic and success criteria (e.g., "Find 5+ applications of quantum computing with credible sources")

2. **Planning & Reasoning**: Using Claude Sonnet 4.5, the agent creates an action plan, selecting appropriate tools and strategies based on the current state of research

3. **Gathering Information**:
   - Searches the web for relevant sources (URLs, snippets, metadata)
   - Fetches full page content from promising sources
   - Extracts factual statements using LLM-based content analysis
   - Verifies information across multiple sources

4. **Adaptive Execution**:
   - Monitors progress toward success criteria
   - Adjusts strategy based on what's working (e.g., "not enough technical details, need to search for academic papers")
   - Handles failures gracefully (API errors, timeouts, low-quality content)

5. **Synthesis**: Creates a comprehensive research report with:
   - Executive summary of findings
   - Key facts with confidence scores and source attribution
   - Bibliography of credible sources

6. **Memory & Learning**:
   - Stores successful strategies for future research tasks
   - Remembers facts and sources across sessions
   - Learns from past experiences to improve efficiency

### Real-World Example

**Input**: "Research quantum computing applications in 2025"

**What the Agent Does**:
```
Iteration 1: web_search("quantum computing applications 2025")
  → Found 10 sources with URLs and snippets

Iteration 2: web_fetch("https://www.ibm.com/quantum/applications")
  → Retrieved 12,450 characters of content

Iteration 3: content_analyzer(fetched content)
  → Extracted 8 factual statements with confidence scores

Iteration 4: web_fetch("https://quantumai.google/research")
  → Retrieved additional technical details

Iteration 5: content_analyzer(new content)
  → Extracted 7 more facts about Google's quantum systems

Iteration 6: synthesizer(all 15 facts)
  → Created final research report with citations
```

**Output**: A structured report with synthesis, key findings, confidence scores, and source URLs.

---

## 🧠 Core Capabilities

### 1. **ReAct Pattern Implementation**
The agent uses the **Reason → Act → Observe** cycle:
- **Reason**: Analyzes current progress, decides next action based on goal and context
- **Act**: Executes a tool (search, fetch, analyze, synthesize)
- **Observe**: Evaluates outcome, updates working memory, reflects on progress

### 2. **Persistent Memory Systems**
- **Episodic Memory**: Stores past research experiences (what actions were taken, what worked)
- **Semantic Memory**: Extracts and stores factual knowledge with LLM-powered consolidation
- **Procedural Memory**: Learns effective research strategies (e.g., "always fetch content before analyzing")
- **Working Memory**: Short-term context for current research session

### 3. **Intelligent Tool Selection**
The agent has 4 specialized tools:
- **`web_search`**: Finds relevant sources using Tavily API (returns URLs + snippets)
- **`web_fetch`**: Retrieves full page content from URLs (returns complete text)
- **`content_analyzer`**: Extracts factual statements from content (requires 500+ chars)
- **`synthesizer`**: Creates final research report from extracted facts

The reasoning engine automatically selects the right tool based on:
- Current research phase (gathering → analyzing → synthesizing)
- Available information (sources vs. full content vs. facts)
- Progress toward goal (how many facts extracted, confidence levels)

### 4. **Self-Reflection & Adaptation**
Every N iterations, the agent reflects on:
- Is the current strategy working?
- Are we making progress toward success criteria?
- Should we try a different approach? (e.g., search for different keywords)
- Are we getting high-quality sources?

### 5. **Fallback Logic**
When the LLM reasoning fails, intelligent fallback logic ensures forward progress:
- Has facts → synthesize
- Has full content but no facts → analyze
- Has sources but no content → fetch
- Needs more sources → search

This ensures the agent never gets stuck in loops.

## Architecture

- **Vector Store**: Chroma for semantic search
- **Document Store**: SQLite for structured data
- **LLM**: Claude Sonnet 4 for reasoning and decision-making

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

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** (TypeScript execution environment)
- **Docker & Docker Compose** (for ChromaDB vector store)
- **Anthropic API Key** (for Claude Sonnet 4.5) - [Get one here](https://console.anthropic.com/)
- **Tavily API Key** (for web search) - [Get one here](https://tavily.com/) - *Optional but recommended*
- **Voyage AI API Key** (for embeddings) - [Get one here](https://www.voyageai.com/) - *Optional*

### Installation

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd autonomous-research-agent
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your API keys:
# ANTHROPIC_API_KEY=your_key_here
# TAVILY_API_KEY=your_key_here (optional)
# VOYAGE_API_KEY=your_key_here (optional)
```

3. **Start ChromaDB (vector store)**
```bash
make init    # Initializes Docker services
# or manually:
docker-compose up -d
```

4. **Verify setup**
```bash
npm test     # Run test suite (607 tests should pass)
```

### Running Your First Research Task

The agent comes with 3 pre-configured research scenarios:

```bash
# Research quantum computing applications
npm start quantum

# Research AI agents in software development
npm start ai_agents

# Research carbon capture technology
npm start climate
```

**Example Output**:
```
🤖 Autonomous Research Agent
================================================================================

📚 Research Topic: Quantum Computing Applications in 2025
🎯 Goal: Research the current state of quantum computing applications...

⚙️  Initializing agent...

🚀 Starting autonomous research...

🔍 Iteration 1/50 - Gathering Phase
→ Executing: web_search
✓ Found 10 sources

🔍 Iteration 2/50 - Gathering Phase
→ Executing: web_fetch
✓ Retrieved 12,450 chars in 2.3s

🔍 Iteration 3/50 - Analyzing Phase
→ Executing: content_analyzer
✓ Extracted 8 facts

[... more iterations ...]

================================================================================
📊 RESEARCH RESULTS
================================================================================

✅ Research completed successfully in 45.2s
📈 Iterations: 15
🔄 Reflections: 3

────────────────────────────────────────────────────────────────────────────────
📝 SYNTHESIS
────────────────────────────────────────────────────────────────────────────────
[Comprehensive summary of findings]

────────────────────────────────────────────────────────────────────────────────
🔍 KEY FINDINGS
────────────────────────────────────────────────────────────────────────────────

1. IBM Quantum Systems Feature 127 Qubits
   IBM has deployed quantum computers with 127 qubits accessible via cloud...
   📊 Confidence: 95.0%
   🔗 Source: https://www.ibm.com/quantum

[... more findings ...]
```

### Advanced Usage

**Custom Research Goals**:
```typescript
import { createAgentFromEnv } from './src/factory';
import { Goal } from './src/agent/types';

const { agent } = await createAgentFromEnv();

const customGoal: Goal = {
  description: 'Research breakthrough materials for battery technology',
  successCriteria: [
    'Identify 3+ promising materials',
    'Include efficiency metrics',
    'Find recent publications (2024-2025)',
  ],
  constraints: [
    'Focus on commercially viable materials',
    'Exclude purely theoretical research',
  ],
  estimatedComplexity: 'moderate',
};

const result = await agent.research(
  'Battery technology materials',
  customGoal
);

console.log(result.result?.synthesis);
console.log(`Found ${result.result?.keyFindings.length} facts`);
```

**Configuration Options**:
```bash
# Control iteration limits
AGENT_MAX_ITERATIONS=20 npm start quantum

# Adjust reflection frequency (reflect every N iterations)
AGENT_REFLECTION_INTERVAL=3 npm start quantum

# Change LLM model
LLM_MODEL=claude-opus-4-5 npm start quantum

# Set log level
LOG_LEVEL=debug npm start quantum
```

---

## 🔧 How It Works

### The Research Loop

The agent follows a structured loop until success criteria are met or max iterations reached:

```
┌─────────────────────────────────────────────────────────────┐
│  1. REASON: Analyze current state & select next action      │
│     - What information do we have?                          │
│     - What do we still need?                                │
│     - Which tool should we use next?                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  2. ACT: Execute selected tool                              │
│     - web_search: Find relevant URLs                        │
│     - web_fetch: Get full page content                      │
│     - content_analyzer: Extract facts                       │
│     - synthesizer: Create final report                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  3. OBSERVE: Evaluate outcome                               │
│     - Did the action succeed?                               │
│     - What new information did we get?                      │
│     - Update progress metrics                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  4. REFLECT: Periodically evaluate strategy (every 5 iter)  │
│     - Are we making progress?                               │
│     - Should we change approach?                            │
│     - Are sources credible enough?                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
         [Loop back to REASON]
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  5. COMPLETE: Success criteria met or max iterations        │
│     - Synthesize final report                               │
│     - Store findings in memory                              │
│     - Return structured results                             │
└─────────────────────────────────────────────────────────────┘
```

### Reasoning Engine

The reasoning engine ([src/agent/reasoning.ts](src/agent/reasoning.ts)) makes decisions based on:

**Context Inputs**:
- **Goal**: Research topic + success criteria + constraints
- **Progress**: Current phase, facts extracted, sources gathered, confidence level
- **Working Memory**: Recent actions, outcomes, key findings
- **Long-term Memory**: Past experiences, learned strategies, stored facts
- **Available Tools**: Which tools are enabled and ready to use

**Decision Process**:
1. **LLM-Based Reasoning** (Primary): Claude Sonnet 4.5 analyzes context and generates 2-3 action options with rationale
2. **Fallback Logic** (Secondary): If LLM fails, use rule-based decision tree:
   - `if (facts >= 3)` → synthesize
   - `else if (has_content && facts == 0)` → analyze
   - `else if (sources >= 5 && !has_content)` → fetch
   - `else` → search

**Output**: Selected action with parameters extracted from working memory

### Tool Workflow

The agent follows a recommended workflow but can adapt based on context:

```
web_search → web_fetch → content_analyzer → synthesizer
    ↓            ↓              ↓                ↓
  URLs +     Full page      Facts with       Final
  snippets    content       confidence      report
```

**Key Insight**: `content_analyzer` needs substantial content (500+ chars), so the agent must call `web_fetch` before analyzing. The reasoning engine enforces this workflow through prompt guidance and fallback logic.

### Memory Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  WORKING MEMORY (Short-term, Current Session)               │
│  - Recent actions (last 5)                                  │
│  - Recent outcomes (last 5)                                 │
│  - Key findings (extracted facts)                           │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Consolidation after session
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  LONG-TERM MEMORY (Persistent, Cross-Session)               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ EPISODIC: Past experiences                           │   │
│  │ - What actions were taken                            │   │
│  │ - What were the outcomes                             │   │
│  │ - Stored in SQLite: episodes table                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ SEMANTIC: Factual knowledge                          │   │
│  │ - Extracted facts across all research                │   │
│  │ - Indexed in ChromaDB vector store                   │   │
│  │ - Metadata in SQLite: facts table                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PROCEDURAL: Learned strategies                       │   │
│  │ - What works for different goals                     │   │
│  │ - Tool usage patterns                                │   │
│  │ - Stored in SQLite: strategies table                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Memory Retrieval**: Before each iteration, relevant memories are retrieved:
- **Semantic Search**: Find similar facts from past research (vector similarity)
- **Episodic Lookup**: Find similar past situations and outcomes
- **Strategy Matching**: Find successful strategies for similar goals

This allows the agent to **learn from experience** and improve over time.

---

## 📁 Project Structure

```
autonomous-research-agent/
├── src/
│   ├── agent/                      # 🤖 Core agent implementation
│   │   ├── core.ts                 # Main orchestration loop (ReAct cycle)
│   │   ├── reasoning.ts            # Decision-making & tool selection
│   │   ├── reflection.ts           # Self-evaluation & strategy adaptation
│   │   ├── planning.ts             # Future: Advanced planning strategies
│   │   └── types.ts                # Type definitions (Goal, Progress, etc.)
│   │
│   ├── llm/                        # 🧠 LLM client and utilities
│   │   ├── client.ts               # Claude API wrapper with error handling
│   │   ├── embeddings.ts           # Voyage AI embeddings for semantic search
│   │   ├── token-counter.ts        # Context window management
│   │   └── types.ts                # LLM-related types
│   │
│   ├── memory/                     # 💾 Memory system components
│   │   ├── managers/
│   │   │   ├── episodic-manager.ts    # Past experiences (episodes)
│   │   │   ├── semantic-manager.ts    # Factual knowledge (facts)
│   │   │   ├── procedural-manager.ts  # Learned strategies
│   │   │   └── session-manager.ts     # Session state
│   │   ├── stores/
│   │   │   ├── vector-store.ts        # ChromaDB integration
│   │   │   ├── document-store.ts      # SQLite integration
│   │   │   └── graph-store.ts         # Knowledge graph (future)
│   │   ├── memory-system.ts        # Unified memory interface
│   │   └── reflection-engine.ts    # Memory consolidation
│   │
│   ├── tools/                      # 🔧 Research tools
│   │   ├── search.ts               # web_search: Tavily API integration
│   │   ├── fetch.ts                # web_fetch: Content retrieval
│   │   ├── analyze.ts              # content_analyzer: Fact extraction
│   │   └── synthesize.ts           # synthesizer: Report generation
│   │
│   ├── utils/                      # 🛠️ Shared utilities
│   │   ├── config.ts               # Configuration management
│   │   └── logger.ts               # Structured logging
│   │
│   ├── factory.ts                  # Agent initialization & dependency injection
│   └── index.ts                    # CLI entry point
│
├── tests/                          # ✅ Test suites (607 tests)
|   ├── fixtures/                   # Mock data for tests
|   ├── helpers/                    # Utility functions for tests
|   ├── integration/                # CEnd-to-end workflow tests
│   ├── unit/                       # Unit tests for individual components
│
├── storage/                        # 📦 Persistent data (gitignored)
│   ├── chroma/                     # Vector embeddings
│   ├── sqlite/                     # Structured data (episodes, facts)
│   └── logs/                       # Application logs
│
├── docker/                         # 🐳 Docker configuration
│   └── docker-compose.yml          # ChromaDB service
│
├── .env.example                    # Environment template
├── Makefile                        # Development commands
├── package.json                    # Node dependencies
└── tsconfig.json                   # TypeScript configuration
```

---

## 🧪 Development

### Available Commands

```bash
# Development
make dev          # Start ChromaDB with admin UI (http://localhost:8000)
make init         # Initialize services (first-time setup)
make restart      # Restart all services

# Testing
make test         # Run full test suite (607 tests)
npm test          # Same as make test
npm run test:unit # Run only unit tests
npm run test:integration # Run integration tests

# Debugging
make logs         # View ChromaDB logs
make clean        # Clean up all services and data

# Code Quality
npm run type-check # Run TypeScript type checking
npm run lint      # Run ESLint (if configured)
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npx vitest tests/unit/agent/reasoning.test.ts

# Debug a specific test
LOG_LEVEL=debug npx vitest tests/integration/agent/web-fetch-analyzer-workflow.test.ts

# Watch mode (re-run on file changes)
npx vitest --watch
```

### Adding New Tools

1. **Create tool implementation** in `src/tools/`:
```typescript
// src/tools/my-new-tool.ts
export function createMyNewTool(config: ToolConfig, llmClient: LLMClient) {
  return {
    name: 'my_new_tool',
    category: 'custom' as const,
    execute: async (params: MyToolParams, context: ExecutionContext) => {
      // Tool logic here
      return { success: true, data: results };
    },
  };
}
```

2. **Register in tool registry** ([src/agent/core.ts](src/agent/core.ts)):
```typescript
this.toolRegistry.registerTool(createMyNewTool(config, llmClient));
```

3. **Update reasoning prompt** ([src/agent/reasoning.ts](src/agent/reasoning.ts)) to include the new tool in recommendations

4. **Write tests** in `tests/unit/tools/my-new-tool.test.ts`

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | - | Anthropic API key for Claude |
| `TAVILY_API_KEY` | ⚠️ Recommended | - | Tavily API key for web search |
| `VOYAGE_API_KEY` | ⚪ Optional | - | Voyage AI for embeddings |
| `AGENT_MAX_ITERATIONS` | ⚪ Optional | `50` | Max research iterations |
| `AGENT_REFLECTION_INTERVAL` | ⚪ Optional | `5` | Reflect every N iterations |
| `LLM_MODEL` | ⚪ Optional | `claude-sonnet-4-5-20250929` | Claude model to use |
| `LLM_MAX_TOKENS` | ⚪ Optional | `4000` | Max tokens per LLM call |
| `CHROMA_HOST` | ⚪ Optional | `localhost` | ChromaDB host |
| `CHROMA_PORT` | ⚪ Optional | `8000` | ChromaDB port |
| `SQLITE_DB_PATH` | ⚪ Optional | `./storage/sqlite/agent.db` | SQLite database path |
| `LOG_LEVEL` | ⚪ Optional | `info` | Logging level: debug, info, warn, error |
| `LOG_DIR` | ⚪ Optional | `./storage/logs` | Log file directory |

---

## 📊 Performance & Costs

### Typical Research Session

**Scenario**: "Research quantum computing applications" (moderate complexity)

| Metric | Value |
|--------|-------|
| Iterations | 10-20 |
| Duration | 30-60 seconds |
| LLM API Calls | ~20-30 |
| Input Tokens | ~40,000 |
| Output Tokens | ~10,000 |
| Search API Calls | 3-5 |
| **Estimated Cost** | **$0.20 - $0.50** |

**Cost Breakdown** (Claude Sonnet 4.5):
- Input: 40K tokens × $3/M = $0.12
- Output: 10K tokens × $15/M = $0.15
- Search (Tavily): 5 queries × $0.01 = $0.05
- **Total**: ~$0.32

### Optimization Tips

1. **Reduce iterations**: Set `AGENT_MAX_ITERATIONS=15` for faster research
2. **Use Haiku for reasoning**: Set `LLM_MODEL=claude-haiku-4` (20x cheaper, slightly less capable)
3. **Disable embeddings**: Skip Voyage AI if semantic memory not needed
4. **Batch similar research**: Agent reuses stored facts, reducing redundant searches

---

## 🐛 Troubleshooting

### Issue: "ANTHROPIC_API_KEY environment variable is required"
**Solution**: Copy `.env.example` to `.env` and add your API key:
```bash
cp .env.example .env
echo "ANTHROPIC_API_KEY=your_key_here" >> .env
```

### Issue: "Connection refused to ChromaDB"
**Solution**: Start ChromaDB service:
```bash
make init
# or
docker-compose up -d
```

### Issue: "No facts extracted" or "KEY FINDINGS empty"
**Possible causes**:
1. Agent only getting short snippets (< 500 chars) instead of full content
2. Check logs: `LOG_LEVEL=debug npm start quantum`
3. Verify `web_fetch` is being called (should see "Retrieved X chars")
4. Ensure `content_analyzer` receives content from `web_fetch`, not just search snippets

**Solution**: This was fixed in Phase 3 - ensure you're using the latest version with proper workflow enforcement.

### Issue: Tests failing with "ANTHROPIC_API_KEY required"
**Solution**: Some integration tests require API keys. Either:
1. Add keys to `.env` file
2. Skip integration tests: `npm run test:unit`

### Issue: "Rate limit exceeded"
**Solution**:
1. Reduce `AGENT_MAX_ITERATIONS` to avoid rapid API calls
2. Wait a few minutes and retry
3. Upgrade Anthropic API tier for higher limits

---

## 🗺️ Roadmap

### ✅ Phase 1-3: Core Functionality (Complete)
- [x] Agent architecture (ReAct pattern)
- [x] Memory systems (episodic, semantic, procedural)
- [x] Tool implementations (search, fetch, analyze, synthesize)
- [x] End-to-end integration
- [x] Bug fixes and workflow optimization

### 🚧 Phase 4: Production Readiness (In Progress)
See [PHASE4_PRODUCTION_CLI.md](PHASE4_PRODUCTION_CLI.md) for detailed plan:
- [ ] Enhanced error handling & retry logic
- [ ] Cost tracking & budget limits
- [ ] Rate limiting
- [ ] Configuration management
- [ ] CLI progress display
- [ ] Session management (pause/resume)
- [ ] Export formats (markdown, JSON, text)

### 🔮 Future Enhancements
- [ ] Multi-agent collaboration (multiple agents working together)
- [ ] Advanced planning (Tree-of-Thoughts, Chain-of-Thought)
- [ ] Source verification & fact-checking
- [ ] Academic paper integration (arXiv, PubMed)
- [ ] Citation management & bibliography generation
- [ ] Web UI for interactive research
- [ ] API for programmatic access

---

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Detailed system design (if exists)
- **[PHASE4_PRODUCTION_CLI.md](PHASE4_PRODUCTION_CLI.md)**: Roadmap for next development phase
- **[FIXES_COMPLETE.md](FIXES_COMPLETE.md)**: Recent bug fixes and improvements
- **[DEBUGGING_SUMMARY.md](DEBUGGING_SUMMARY.md)**: Debug process for recent issues

---

## 🤝 Contributing

Contributions welcome! Areas that need help:
- Additional research tools (academic databases, data analysis)
- Improved reasoning strategies
- Better error handling and recovery
- Performance optimizations
- Documentation improvements

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

Built with:
- **[Claude Sonnet 4.5](https://www.anthropic.com/claude)** - LLM for reasoning and analysis
- **[Tavily API](https://tavily.com/)** - Web search
- **[ChromaDB](https://www.trychroma.com/)** - Vector embeddings
- **[Voyage AI](https://www.voyageai.com/)** - Semantic embeddings

Inspired by:
- **ReAct Pattern**: [Yao et al. (2022)](https://arxiv.org/abs/2210.03629)
- **Reflexion**: [Shinn et al. (2023)](https://arxiv.org/abs/2303.11366)
- **Generative Agents**: [Park et al. (2023)](https://arxiv.org/abs/2304.03442)