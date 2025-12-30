/**
 * Tool Registry
 * Manage and discover available tools
 */

import {
  Tool,
  ToolResult,
  ToolContext,
  ToolRegistryEntry,
  ToolExecutionLog,
} from './types';
import { Logger } from '../utils/logger';

/**
 * ToolRegistry - Central registry for managing tools
 *
 * Features:
 * - Register and discover tools
 * - Execute tools with logging
 * - Track usage statistics
 * - Enable/disable tools
 * - Get tool schemas for LLM integration
 * - Execution history
 */
export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();
  private executionHistory: ToolExecutionLog[] = [];
  private maxHistorySize: number = 1000;

  constructor(private readonly logger: Logger) {}

  // ============================================================================
  // Tool Registration
  // ============================================================================

  /**
   * Register a tool in the registry
   */
  register(
    tool: Tool,
    options?: {
      category?: string;
      tags?: string[];
      enabled?: boolean;
    }
  ): void {
    // Check if tool already exists
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} is already registered. Overwriting.`);
    }

    // Create registry entry
    const entry: ToolRegistryEntry = {
      tool,
      metadata: {
        category: options?.category || 'general',
        tags: options?.tags || [],
        enabled: options?.enabled !== false,
        usageCount: 0,
      },
    };

    this.tools.set(tool.name, entry);
    this.logger.info(`Registered tool: ${tool.name}`, {
      version: tool.version,
      category: entry.metadata.category,
    });
  }

  /**
   * Unregister a tool
   */
  unregister(toolName: string): boolean {
    const deleted = this.tools.delete(toolName);
    if (deleted) {
      this.logger.info(`Unregistered tool: ${toolName}`);
    } else {
      this.logger.warn(`Tool not found: ${toolName}`);
    }
    return deleted;
  }

  // ============================================================================
  // Tool Discovery
  // ============================================================================

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | null {
    const entry = this.tools.get(name);
    return entry?.tool || null;
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values()).map(entry => entry.tool);
  }

  /**
   * Get enabled tools only
   */
  getEnabledTools(): Tool[] {
    return Array.from(this.tools.values())
      .filter(entry => entry.metadata.enabled)
      .map(entry => entry.tool);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.values())
      .filter(entry => entry.metadata.category === category)
      .map(entry => entry.tool);
  }

  /**
   * Get tools by tag
   */
  getToolsByTag(tag: string): Tool[] {
    return Array.from(this.tools.values())
      .filter(entry => entry.metadata.tags.includes(tag))
      .map(entry => entry.tool);
  }

  // ============================================================================
  // Tool Execution
  // ============================================================================

  /**
   * Execute a tool by name
   */
  async executeTool<TInput, TOutput>(
    toolName: string,
    input: TInput,
    context: ToolContext
  ): Promise<ToolResult<TOutput>> {
    const startTime = new Date();

    // Get tool
    const entry = this.tools.get(toolName);
    if (!entry) {
      this.logger.error(`Tool not found: ${toolName}`);
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    // Check if tool is enabled
    if (!entry.metadata.enabled) {
      this.logger.warn(`Tool is disabled: ${toolName}`);
      return {
        success: false,
        error: `Tool is disabled: ${toolName}`,
      };
    }

    // Execute tool
    try {
      const result = await entry.tool.execute(input, context);

      // Update metadata
      entry.metadata.usageCount++;
      entry.metadata.lastUsed = new Date();

      // Log execution
      const endTime = new Date();
      this.logExecution(toolName, input, result, startTime, endTime);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tool execution failed: ${toolName}`, { error: errorMessage });

      const endTime = new Date();
      const errorResult = {
        success: false,
        error: errorMessage,
      };
      this.logExecution(toolName, input, errorResult, startTime, endTime);

      return errorResult;
    }
  }

  // ============================================================================
  // Tool Management
  // ============================================================================

  /**
   * Enable a tool
   */
  enableTool(toolName: string): boolean {
    const entry = this.tools.get(toolName);
    if (entry) {
      entry.metadata.enabled = true;
      this.logger.info(`Enabled tool: ${toolName}`);
      return true;
    }
    return false;
  }

  /**
   * Disable a tool
   */
  disableTool(toolName: string): boolean {
    const entry = this.tools.get(toolName);
    if (entry) {
      entry.metadata.enabled = false;
      this.logger.info(`Disabled tool: ${toolName}`);
      return true;
    }
    return false;
  }

  // ============================================================================
  // LLM Integration
  // ============================================================================

  /**
   * Get tool schemas for LLM tool use
   * Returns schemas for all enabled tools in Anthropic tool use format
   */
  getToolSchemas(): Array<{
    name: string;
    description: string;
    input_schema: object;
  }> {
    return this.getEnabledTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.getInputSchema(),
    }));
  }

  /**
   * Get tool schemas for specific tools
   */
  getToolSchemasByName(toolNames: string[]): Array<{
    name: string;
    description: string;
    input_schema: object;
  }> {
    return toolNames
      .map(name => this.getTool(name))
      .filter(tool => tool !== null)
      .map(tool => ({
        name: tool!.name,
        description: tool!.description,
        input_schema: tool!.getInputSchema(),
      }));
  }

  // ============================================================================
  // Statistics and History
  // ============================================================================

  /**
   * Get usage statistics for a tool
   */
  getToolStatistics(toolName: string): {
    usageCount: number;
    lastUsed?: Date;
    successRate: number;
    averageDuration: number;
  } | null {
    const entry = this.tools.get(toolName);
    if (!entry) return null;

    // Calculate success rate from execution history
    const toolExecutions = this.executionHistory.filter(log => log.toolName === toolName);
    const successCount = toolExecutions.filter(log => log.success).length;
    const successRate = toolExecutions.length > 0 ? successCount / toolExecutions.length : 0;

    // Calculate average duration
    const avgDuration = toolExecutions.length > 0
      ? toolExecutions.reduce((sum, log) => sum + log.duration, 0) / toolExecutions.length
      : 0;

    return {
      usageCount: entry.metadata.usageCount,
      lastUsed: entry.metadata.lastUsed,
      successRate,
      averageDuration: avgDuration,
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(options?: {
    toolName?: string;
    limit?: number;
    successOnly?: boolean;
  }): ToolExecutionLog[] {
    let history = [...this.executionHistory];

    // Filter by tool name
    if (options?.toolName) {
      history = history.filter(log => log.toolName === options.toolName);
    }

    // Filter by success
    if (options?.successOnly) {
      history = history.filter(log => log.success);
    }

    // Limit results
    if (options?.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    this.logger.info('Cleared execution history');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Log tool execution
   */
  private logExecution(
    toolName: string,
    input: any,
    output: ToolResult<any>,
    startTime: Date,
    endTime: Date
  ): void {
    const log: ToolExecutionLog = {
      toolName,
      input,
      output,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      success: output.success,
      error: output.error,
    };

    this.executionHistory.push(log);

    // Trim history if too large
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }
}

/**
 * Factory function to create ToolRegistry instance
 */
export function createToolRegistry(logger: Logger): ToolRegistry {
  return new ToolRegistry(logger);
}
