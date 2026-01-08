/**
 * Agent Factory
 * Creates fully configured agent instances with all dependencies
 */

import { AutonomousAgent, createAutonomousAgent, type AgentConfig as CoreAgentConfig } from './agent';
import { createReasoningEngine } from './agent/reasoning';
import { createAgentReflection } from './agent/reflection';
import { createMemorySystem } from './memory/memory-system';
import { createReflectionEngine } from './memory/reflection-engine';
import { SQLiteDocumentStore } from './memory/stores/document-store';
import { ChromaVectorStore } from './memory/stores/vector-store';
import { ToolRegistry } from './tools/registry';
import { SearchTool } from './tools/search';
import { FetchTool } from './tools/fetch';
import { AnalyzeTool } from './tools/analyze';
import { SynthesizeTool } from './tools/synthesize';
import { LLMClient } from './llm/client';
import { EmbeddingClient } from './llm/embeddings';
import { Logger, LogLevel } from './utils/logger';

/**
 * Configuration for creating an agent instance
 */
export interface AgentFactoryConfig {
  // API Keys
  anthropicApiKey: string;
  tavilyApiKey?: string;
  voyageApiKey?: string;

  // Agent behavior
  maxIterations?: number;
  reflectionInterval?: number;
  maxContextTokens?: number;
  enableAutoReflection?: boolean;

  // Storage
  sqliteDbPath?: string;
  chromaHost?: string;
  chromaPort?: number;
  chromaAuthToken?: string;

  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logDir?: string;

  // LLM
  anthropicModel?: string;
  embeddingModel?: string;
}

/**
 * Agent instance with all dependencies
 */
export interface AgentInstance {
  agent: AutonomousAgent;
  cleanup: () => Promise<void>;
}

/**
 * Create a fully configured agent instance
 *
 * This is the main entry point for creating an agent. It:
 * 1. Initializes all required services (LLM, embeddings, storage)
 * 2. Creates memory system with all managers
 * 3. Sets up tool registry with all tools
 * 4. Wires everything together into the agent
 *
 * @param config Configuration options
 * @returns Agent instance with cleanup function
 */
export async function createAgent(config: AgentFactoryConfig): Promise<AgentInstance> {
  // ============================================================================
  // 1. Create foundational services
  // ============================================================================

  // Logger
  const logLevelMap: Record<string, LogLevel> = {
    'debug': LogLevel.DEBUG,
    'info': LogLevel.INFO,
    'warn': LogLevel.WARN,
    'error': LogLevel.ERROR,
  };

  const logger = new Logger({
    level: logLevelMap[config.logLevel || 'info'],
    enableConsole: true,
    enableFile: true,
    logDir: config.logDir || './storage/logs',
    context: 'AgentFactory',
  });

  logger.info('Creating autonomous research agent...');

  // LLM Client
  const llmClient = new LLMClient({
    apiKey: config.anthropicApiKey,
    defaultModel: config.anthropicModel || 'claude-sonnet-4-20250514',
  });

  // Embedding Client
  const embeddingClient = new EmbeddingClient({
    apiKey: config.voyageApiKey || config.anthropicApiKey,
    model: config.embeddingModel || 'voyage-3',
  });

  // ============================================================================
  // 2. Create Memory System
  // ============================================================================

  logger.info('Initializing memory system...');

  // Create document store
  const documentStore = new SQLiteDocumentStore(
    config.sqliteDbPath || './storage/sqlite/agent.db'
  );

  // Create vector store
  const vectorStore = new ChromaVectorStore({
    host: config.chromaHost || 'localhost',
    port: config.chromaPort || 8000,
    authToken: config.chromaAuthToken,
  });

  // Create memory system
  const memorySystem = await createMemorySystem(
    documentStore,
    vectorStore,
    embeddingClient,
    llmClient,
    logger
  );

  // Create reflection engine
  const reflectionEngine = createReflectionEngine(
    memorySystem,
    llmClient,
    logger
  );

  // ============================================================================
  // 3. Create Tool Registry
  // ============================================================================

  logger.info('Setting up tool registry...');

  const toolRegistry = new ToolRegistry(logger);

  // Create and register Search Tool
  if (config.tavilyApiKey) {
    const searchTool = new SearchTool({
      apiKey: config.tavilyApiKey,
      enabled: true,
      timeout: 30000,
      defaultMaxResults: 10,
      defaultSearchDepth: 'basic',
    });
    toolRegistry.register(searchTool, { category: 'search', enabled: true });
    logger.info('✓ Search tool registered');
  } else {
    logger.warn('⚠️  Search tool not registered - TAVILY_API_KEY not provided');
  }

  // Create and register Fetch Tool
  const fetchTool = new FetchTool({
    enabled: true,
    timeout: 30000,
    maxCacheSize: 100,
    cacheTTL: 3600000, // 1 hour
    userAgent: 'AutonomousResearchAgent/1.0',
  });
  toolRegistry.register(fetchTool, { category: 'retrieval', enabled: true });
  logger.info('✓ Fetch tool registered');

  // Create and register Analyze Tool
  const analyzeTool = new AnalyzeTool({
    enabled: true,
    timeout: 60000,
  }, llmClient);
  toolRegistry.register(analyzeTool, { category: 'analysis', enabled: true });
  logger.info('✓ Analyze tool registered');

  // Create and register Synthesize Tool
  const synthesizeTool = new SynthesizeTool({
    enabled: true,
    timeout: 90000,
    maxSources: 10,
    defaultFormat: 'markdown',
  }, llmClient);
  toolRegistry.register(synthesizeTool, { category: 'synthesis', enabled: true });
  logger.info('✓ Synthesize tool registered');

  logger.info(`Tool registry initialized with ${toolRegistry.getEnabledTools().length} tools`);

  // ============================================================================
  // 4. Create Agent Components
  // ============================================================================

  logger.info('Creating agent components...');

  // Agent configuration
  const agentConfig: CoreAgentConfig = {
    maxIterations: config.maxIterations || 50,
    reflectionInterval: config.reflectionInterval || 5,
    maxContextTokens: config.maxContextTokens || 8000,
    enableAutoReflection: config.enableAutoReflection ?? true,
  };

  // Create reasoning engine
  const reasoningEngine = createReasoningEngine(llmClient, logger);

  // Create agent reflection
  const agentReflection = createAgentReflection(
    reflectionEngine,
    logger
  );

  // Create the agent
  const agent = createAutonomousAgent(
    reasoningEngine,
    agentReflection,
    memorySystem,
    toolRegistry,
    llmClient,
    logger,
    agentConfig
  );

  logger.info('✓ Agent created successfully');

  // ============================================================================
  // 5. Create cleanup function
  // ============================================================================

  const cleanup = async () => {
    logger.info('Cleaning up agent resources...');

    // Close any active sessions
    const currentSession = memorySystem.getCurrentSession();
    if (currentSession && currentSession.status !== 'completed') {
      await memorySystem.completeSession();
    }

    // Close database connections
    // (DocumentStore and VectorStore will handle their own cleanup)

    logger.info('✓ Cleanup complete');
  };

  // ============================================================================
  // Return agent instance
  // ============================================================================

  return {
    agent,
    cleanup,
  };
}

/**
 * Create agent with configuration from environment variables
 */
export async function createAgentFromEnv(): Promise<AgentInstance> {
  const config: AgentFactoryConfig = {
    // Required
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,

    // Optional
    tavilyApiKey: process.env.TAVILY_API_KEY,
    voyageApiKey: process.env.VOYAGE_API_KEY,

    // Agent config
    maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || '50'),
    reflectionInterval: parseInt(process.env.AGENT_REFLECTION_INTERVAL || '5'),
    maxContextTokens: parseInt(process.env.AGENT_MAX_CONTEXT_TOKENS || '8000'),
    enableAutoReflection: process.env.AGENT_ENABLE_AUTO_REFLECTION !== 'false',

    // Storage
    sqliteDbPath: process.env.SQLITE_DB_PATH || './storage/sqlite/agent.db',
    chromaHost: process.env.CHROMA_HOST || 'localhost',
    chromaPort: parseInt(process.env.CHROMA_PORT || '8000'),
    chromaAuthToken: process.env.CHROMA_AUTH_TOKEN,

    // Logging
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    logDir: process.env.LOG_DIR || './storage/logs',

    // LLM
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    embeddingModel: process.env.EMBEDDING_MODEL || 'voyage-3',
  };

  // Validate required config
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  return createAgent(config);
}
