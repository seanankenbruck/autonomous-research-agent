/**
 * Main Entry Point
 * Autonomous Research Agent - Demo and CLI Interface
 */

import { config as dotenvConfig } from 'dotenv';
import { createAgentFromEnv } from './factory';
import { Goal } from './agent/types';

// Load environment variables
dotenvConfig();

/**
 * Example research scenarios
 */
const RESEARCH_SCENARIOS = {
  quantum: {
    topic: 'Quantum Computing Applications in 2025',
    goal: {
      description: 'Research the current state of quantum computing applications in various industries',
      successCriteria: [
        'Comprehensive overview of current applications',
        'List of at least 5 specific use cases',
        'Analysis of industry adoption trends',
        'Summary of key limitations',
      ],
      constraints: [
        'Focus on practical applications, not just theory',
        'Prioritize recent information (last 12 months)',
        'Include credible sources only',
      ],
      estimatedComplexity: 'moderate' as const,
    },
  },

  ai_agents: {
    topic: 'Autonomous AI Agents and Their Impact on Software Development',
    goal: {
      description: 'Investigate how autonomous AI agents are changing software development practices',
      successCriteria: [
        'Overview of popular AI agent tools',
        'Data on productivity improvements',
        'Framework for effective AI-human collaboration',
        'Analysis of potential risks',
      ],
      constraints: [
        'Focus on production-ready tools',
        'Include both benefits and drawbacks',
        'Cite specific studies or data when available',
      ],
      estimatedComplexity: 'moderate' as const,
    },
  },

  climate: {
    topic: 'Carbon Capture Technology Breakthroughs',
    goal: {
      description: 'Research recent advancements in carbon capture and storage technology',
      successCriteria: [
        'Overview of 3-5 leading technologies',
        'Comparison of cost per ton of CO2',
        'List of active commercial projects',
        'Assessment of impact potential',
      ],
      constraints: [
        'Focus on scientifically validated approaches',
        'Include both established and emerging technologies',
        'Provide recent data (2023-2025)',
      ],
      estimatedComplexity: 'moderate' as const,
    },
  },
};

/**
 * Run a research task
 */
async function runResearch(scenarioName: keyof typeof RESEARCH_SCENARIOS) {
  console.log('\n' + '='.repeat(80));
  console.log('🤖 Autonomous Research Agent');
  console.log('='.repeat(80) + '\n');

  const scenario = RESEARCH_SCENARIOS[scenarioName];
  if (!scenario) {
    console.error(`❌ Unknown scenario: ${scenarioName}`);
    console.log('Available scenarios:', Object.keys(RESEARCH_SCENARIOS).join(', '));
    process.exit(1);
  }

  console.log(`📚 Research Topic: ${scenario.topic}`);
  console.log(`🎯 Goal: ${scenario.goal.description}\n`);

  let agentInstance;

  try {
    // Create agent
    console.log('⚙️  Initializing agent...\n');
    agentInstance = await createAgentFromEnv();
    const { agent } = agentInstance;

    // Start research
    console.log('🚀 Starting autonomous research...\n');
    const startTime = Date.now();

    const result = await agent.research(scenario.topic, scenario.goal);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESEARCH RESULTS');
    console.log('='.repeat(80) + '\n');

    if (result.success && result.result) {
      console.log(`✅ Research completed successfully in ${duration}s`);
      console.log(`📈 Iterations: ${result.iterations}`);
      console.log(`🔄 Reflections: ${result.reflections}\n`);

      console.log('─'.repeat(80));
      console.log('📝 SYNTHESIS');
      console.log('─'.repeat(80));
      console.log(result.result.synthesis);
      console.log();

      console.log('─'.repeat(80));
      console.log('🔍 KEY FINDINGS');
      console.log('─'.repeat(80));
      result.result.keyFindings.forEach((finding, idx) => {
        console.log(`\n${idx + 1}. ${finding.source.title || 'Finding'}`);
        console.log(`   ${finding.content}`);
        console.log(`   📊 Confidence: ${(finding.confidence * 100).toFixed(1)}%`);
        console.log(`   🔗 Source: ${finding.source.url}`);
      });
      console.log();

      if (result.result.sources && result.result.sources.length > 0) {
        console.log('─'.repeat(80));
        console.log('📚 SOURCES');
        console.log('─'.repeat(80));
        result.result.sources.forEach((source, idx) => {
          console.log(`${idx + 1}. ${source.title || source.url}`);
          console.log(`   ${source.url}`);
        });
        console.log();
      }

    } else {
      console.log(`❌ Research failed: ${result.error}`);
      console.log(`📈 Iterations completed: ${result.iterations}`);
      console.log(`🔄 Reflections performed: ${result.reflections}\n`);
    }

  } catch (error) {
    console.error('\n❌ Error during research:');
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    if (agentInstance) {
      console.log('\n🧹 Cleaning up...');
      await agentInstance.cleanup();
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✨ Done!');
  console.log('='.repeat(80) + '\n');
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
🤖 Autonomous Research Agent - CLI

USAGE:
  npm start [scenario]
  npm run dev [scenario]

SCENARIOS:
  quantum    - Research quantum computing applications
  ai_agents  - Research AI agents in software development
  climate    - Research carbon capture technology

EXAMPLES:
  npm start quantum
  npm run dev ai_agents

ENVIRONMENT VARIABLES:
  Required:
    ANTHROPIC_API_KEY       - Anthropic API key for Claude

  Optional:
    TAVILY_API_KEY          - Tavily API key for web search
    VOYAGE_API_KEY          - Voyage API key for embeddings

    AGENT_MAX_ITERATIONS    - Max iterations (default: 50)
    AGENT_REFLECTION_INTERVAL - Reflect every N iterations (default: 5)

    CHROMA_HOST             - ChromaDB host (default: localhost)
    CHROMA_PORT             - ChromaDB port (default: 8000)
    SQLITE_DB_PATH          - SQLite database path

    LOG_LEVEL               - Logging level: debug, info, warn, error
    LOG_DIR                 - Log directory path

For more information, see README.md
  `);
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle help command
  if (args.length === 0 || args[0] === 'help') {
    displayHelp();
    process.exit(0);
  }

  // Get scenario
  const scenario = args[0] as keyof typeof RESEARCH_SCENARIOS;

  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
    console.error('Please set it in your .env file or environment\n');
    process.exit(1);
  }

  // Run research
  await runResearch(scenario);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { runResearch, RESEARCH_SCENARIOS };
