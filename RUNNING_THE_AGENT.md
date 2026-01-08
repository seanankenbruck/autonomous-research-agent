# Running the Autonomous Research Agent

This guide will help you set up and run the autonomous research agent for the first time.

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** 18+ installed
- **npm** or **yarn** package manager
- **ChromaDB** running (for vector storage)
- **API Keys**:
  - Anthropic API key (required)
  - Tavily API key (optional, but recommended)
  - Voyage API key (optional)

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up ChromaDB

ChromaDB is required for vector storage and semantic search.

**Option A: Using Docker (Recommended)**

```bash
# Start ChromaDB in a container
docker run -d -p 8000:8000 chromadb/chroma:latest
```

**Option B: Using pip**

```bash
# Install ChromaDB
pip install chromadb

# Run ChromaDB server
chroma run --path ./storage/chroma --host localhost --port 8000
```

### 4. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```bash
# Required
ANTHROPIC_API_KEY=your_actual_anthropic_api_key_here

# Recommended
TAVILY_API_KEY=your_actual_tavily_api_key_here

# Optional
VOYAGE_API_KEY=your_actual_voyage_api_key_here
```

**Getting API Keys:**

- **Anthropic**: https://console.anthropic.com/
- **Tavily**: https://tavily.com/ (free tier available)
- **Voyage**: https://www.voyageai.com/ (optional, for better embeddings)

### 5. Create Storage Directories

```bash
mkdir -p storage/sqlite storage/logs storage/chroma
```

### 6. Run Your First Research Task

```bash
npm start quantum
```

This will run the quantum computing research scenario.

**Note:** `npm start` uses `ts-node` to run TypeScript directly without building. For production deployment, you can build first with `npm run build` and then use `npm run start:prod`.

---

## 📚 Available Research Scenarios

The agent comes with three pre-configured research scenarios:

### 1. Quantum Computing (`quantum`)

Researches current quantum computing applications in various industries.

```bash
npm start quantum
```

**What it does:**
- Finds recent breakthroughs (2024-2025)
- Identifies key companies and research institutions
- Analyzes practical use cases vs theoretical potential
- Identifies limitations and challenges

### 2. AI Agents (`ai_agents`)

Investigates how autonomous AI agents are changing software development.

```bash
npm start ai_agents
```

**What it does:**
- Surveys current AI coding assistants and agents
- Analyzes impact on developer productivity
- Identifies best practices for AI-human collaboration
- Examines limitations and ethical considerations

### 3. Climate Tech (`climate`)

Researches recent advancements in carbon capture technology.

```bash
npm start climate
```

**What it does:**
- Explores latest carbon capture methods
- Compares efficiency and cost-effectiveness
- Identifies real-world deployments
- Assesses scalability challenges

---

## 🛠️ Development Mode

For faster iteration during development, use dev mode with auto-reload:

```bash
npm run dev quantum
```

This uses `ts-node-dev` to run TypeScript directly without building.

---

## ⚙️ Configuration Options

### Agent Behavior

```bash
# Maximum iterations before stopping
AGENT_MAX_ITERATIONS=50

# How often to trigger self-reflection
AGENT_REFLECTION_INTERVAL=5

# Maximum context tokens from memory
AGENT_MAX_CONTEXT_TOKENS=8000

# Enable automatic reflection
AGENT_ENABLE_AUTO_REFLECTION=true
```

### LLM Settings

```bash
# Model selection
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Alternative models:
# - claude-opus-4-20250514 (more capable, slower, more expensive)
# - claude-3-7-sonnet-20250219 (previous generation)
```

### Logging

```bash
# Log verbosity: debug, info, warn, error
LOG_LEVEL=info

# Where to write logs
LOG_DIR=./storage/logs
```

Check logs for detailed execution traces:

```bash
tail -f storage/logs/combined.log
```

---

## 🔍 Understanding the Output

When you run a research task, you'll see:

### 1. Initialization Phase

```
⚙️  Initializing agent...
✓ Search tool registered
✓ Fetch tool registered
✓ Analyze tool registered
✓ Synthesize tool registered
```

### 2. Execution Phase

The agent will autonomously:
- Plan the research strategy
- Execute searches and analyses
- Retrieve relevant content
- Reflect on progress
- Adapt its approach

### 3. Results

```
📊 RESEARCH RESULTS
✅ Research completed successfully in 45.2s
📈 Iterations: 12
🔄 Reflections: 2

📝 SUMMARY
[Comprehensive summary of findings]

🔍 KEY FINDINGS
1. [Finding 1 with confidence score and sources]
2. [Finding 2...]
...

📚 SOURCES
1. [Source 1 with URL]
2. [Source 2...]
...

💡 RECOMMENDATIONS
1. [Actionable recommendation 1]
2. [Actionable recommendation 2]
...
```

---

## 🧪 Running Tests

### Unit Tests

```bash
npm test
```

### With Coverage

```bash
npm run coverage
```

### Watch Mode (for development)

```bash
npm run test:watch
```

### Run Specific Tests

```bash
# Run only agent tests
npx vitest run tests/unit/agent

# Run integration tests
npx vitest run tests/integration
```

---

## 🐛 Troubleshooting

### ChromaDB Connection Issues

**Error:** `Failed to connect to ChromaDB`

**Solution:**
1. Ensure ChromaDB is running: `docker ps` or check if the process is running
2. Verify the port: `CHROMA_PORT=8000` in `.env`
3. Try restarting ChromaDB

```bash
# Docker
docker restart <chroma-container-id>

# Or restart the chroma process
```

### API Rate Limits

**Error:** `429 Too Many Requests`

**Solution:**
- Add delays between requests by reducing `AGENT_MAX_ITERATIONS`
- Use a higher tier API plan
- Check your API usage at the provider's console

### Out of Memory

**Error:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start quantum
```

### Missing API Keys

**Error:** `ANTHROPIC_API_KEY environment variable is required`

**Solution:**
1. Ensure `.env` file exists in project root
2. Check that the key is set: `cat .env | grep ANTHROPIC_API_KEY`
3. Verify the key is valid at https://console.anthropic.com/

### Database Lock Issues

**Error:** `database is locked`

**Solution:**
```bash
# Stop any running agents
pkill -f "autonomous-research-agent"

# Remove the lock file
rm storage/sqlite/agent.db-wal
```

---

## 📊 Monitoring and Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm start quantum
```

### View Real-time Logs

```bash
# In another terminal
tail -f storage/logs/combined.log
```

### Inspect Database

```bash
# Install sqlite3 if needed
brew install sqlite3  # macOS
# or
apt-get install sqlite3  # Ubuntu

# Open database
sqlite3 storage/sqlite/agent.db

# View sessions
SELECT * FROM sessions;

# View episodes
SELECT * FROM episodes LIMIT 10;

# View facts
SELECT * FROM facts LIMIT 10;
```

### Monitor Memory Usage

```bash
# View ChromaDB collections
curl http://localhost:8000/api/v1/collections
```

---

## 🎯 Creating Custom Research Scenarios

Edit `src/index.ts` to add your own scenarios:

```typescript
const RESEARCH_SCENARIOS = {
  // Add your custom scenario
  myResearch: {
    topic: 'Your Research Topic',
    goal: {
      description: 'What you want to research',
      requirements: [
        'Requirement 1',
        'Requirement 2',
      ],
      successCriteria: [
        'Success criterion 1',
        'Success criterion 2',
      ],
      constraints: [
        'Constraint 1',
        'Constraint 2',
      ],
    } as Goal,
  },
  // ... other scenarios
};
```

Then run:

```bash
npm start myResearch
```

---

## 🔄 Programmatic Usage

You can also use the agent programmatically in your own code:

```typescript
import { createAgent } from './src/factory';
import { Goal } from './src/agent/types';

async function main() {
  // Create agent
  const { agent, cleanup } = await createAgent({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    logLevel: 'info',
  });

  // Define goal
  const goal: Goal = {
    description: 'Research topic X',
    requirements: ['...'],
    successCriteria: ['...'],
    constraints: ['...'],
  };

  try {
    // Run research
    const result = await agent.research('Topic X', goal);
    console.log(result);
  } finally {
    // Always cleanup
    await cleanup();
  }
}

main();
```

---

## 📈 Performance Tips

### Optimize Iteration Count

- Start with lower iterations for testing: `AGENT_MAX_ITERATIONS=10`
- Increase for production: `AGENT_MAX_ITERATIONS=50`

### Reduce Reflection Frequency

- Less frequent reflection = faster execution
- `AGENT_REFLECTION_INTERVAL=10` (instead of 5)
- Trade-off: Less adaptive behavior

### Use Faster Models

```bash
# For development/testing
ANTHROPIC_MODEL=claude-3-7-sonnet-20250219
```

### Limit Context Tokens

```bash
# Reduce memory context size for faster processing
AGENT_MAX_CONTEXT_TOKENS=4000
```

---

## 🛡️ Best Practices

### API Key Security

- **Never** commit `.env` file to git
- Use separate API keys for dev/prod
- Rotate keys regularly
- Monitor API usage

### Resource Management

- Always call `cleanup()` when done
- Close ChromaDB connections properly
- Monitor disk space for SQLite database

### Research Quality

- Provide specific, well-defined goals
- Include clear success criteria
- Set reasonable constraints
- Review and validate results

---

## 📞 Getting Help

- **Documentation**: Check other `.md` files in this repo
- **Logs**: `storage/logs/combined.log` for detailed traces
- **Tests**: Look at test files for usage examples
- **Issues**: Check known issues in project documentation

---

## ✨ Next Steps

1. **Try all three scenarios** to understand agent capabilities
2. **Create your own scenario** for a topic you're interested in
3. **Experiment with configuration** to optimize performance
4. **Review the logs** to understand agent reasoning
5. **Explore the code** in `src/agent/` to learn how it works

Happy researching! 🚀
