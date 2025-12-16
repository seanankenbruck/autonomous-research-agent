/**
 * Configuration Management
 * Loads and validates environment variables
 */

import { config as dotenvConfig } from "dotenv";
import type { AgentConfig } from "./types";

// Load .env file
dotenvConfig();

/**
 * Get configuration from environment variables
 */
export function getConfig(): AgentConfig {
  // Required variables
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required in .env file");
  }

  // Build configuration object
  const config: AgentConfig = {
    // LLM Configuration
    anthropicApiKey,
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",

    // Agent Configuration
    maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || "50"),
    reflectionInterval: parseInt(process.env.AGENT_REFLECTION_INTERVAL || "5"),
    maxMemoryItems: parseInt(process.env.AGENT_MAX_MEMORY_ITEMS || "1000"),

    // Chroma Configuration
    chromaHost: process.env.CHROMA_HOST || "localhost",
    chromaPort: parseInt(process.env.CHROMA_PORT || "8000"),
    chromaAuthToken: process.env.CHROMA_AUTH_TOKEN,

    // Storage Configuration
    sqliteDbPath: process.env.SQLITE_DB_PATH || "./storage/sqlite/agent.db",

    // Logging Configuration
    logLevel: process.env.LOG_LEVEL || "info",
    logDir: process.env.LOG_DIR || "./storage/logs",

    // Optional API Keys
    tavilyApiKey: process.env.TAVILY_API_KEY,
  };

  return config;
}

/**
 * Validate that all required external services are configured
 */
export function validateConfig(config: AgentConfig): void {
  const errors: string[] = [];

  // Check Anthropic API key
  if (!config.anthropicApiKey) {
    errors.push("ANTHROPIC_API_KEY is required");
  }

  // Warn about optional services
  if (!config.tavilyApiKey) {
    console.warn("⚠️  TAVILY_API_KEY not set - web search will be limited");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join("\n")}`);
  }
}

/**
 * Get configuration and validate
 */
export function getValidatedConfig(): AgentConfig {
  const config = getConfig();
  validateConfig(config);
  return config;
}