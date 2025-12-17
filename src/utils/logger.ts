import * as fs from 'fs';
import * as path from 'path';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  data?: unknown;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  context?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  logDir?: string;
  logFileName?: string;
  prettyPrint?: boolean;
}

/**
 * Logger class for structured logging with multiple outputs
 */
export class Logger {
  private level: LogLevel;
  private context?: string;
  private enableConsole: boolean;
  private enableFile: boolean;
  private logDir?: string;
  private logFileName?: string;
  private prettyPrint: boolean;
  private logStream?: fs.WriteStream;

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? LogLevel.INFO;
    this.context = config.context;
    this.enableConsole = config.enableConsole ?? true;
    this.enableFile = config.enableFile ?? false;
    this.logDir = config.logDir;
    this.logFileName = config.logFileName ?? 'app.log';
    this.prettyPrint = config.prettyPrint ?? true;

    // Initialize file logging if enabled
    if (this.enableFile && this.logDir) {
      this.initializeFileLogging();
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    const childContext = this.context 
      ? `${this.context}:${context}`
      : context;
    
    return new Logger({
      level: this.level,
      context: childContext,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      logDir: this.logDir,
      logFileName: this.logFileName,
      prettyPrint: this.prettyPrint,
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, data?: unknown): void {
    const errorData = error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        }
      : undefined;

    this.log(LogLevel.ERROR, message, data, errorData);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    error?: { message: string; stack?: string; code?: string }
  ): void {
    // Check if this log level should be output
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: this.context,
      data,
      error,
    };

    // Output to console
    if (this.enableConsole) {
      this.logToConsole(entry);
    }

    // Output to file
    if (this.enableFile && this.logStream) {
      this.logToFile(entry);
    }
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: LogEntry): void {
    const { timestamp, level, message, context, data, error } = entry;

    // Color codes for different log levels
    const colors = {
      DEBUG: '\x1b[36m',    // Cyan
      INFO: '\x1b[32m',     // Green
      WARN: '\x1b[33m',     // Yellow
      ERROR: '\x1b[31m',    // Red
    };
    const reset = '\x1b[0m';

    const color = colors[level as keyof typeof colors] || reset;
    const contextStr = context ? `[${context}] ` : '';
    const timeStr = new Date(timestamp).toLocaleTimeString();

    // Base message
    console.log(
      `${color}${level}${reset} ${timeStr} ${contextStr}${message}`
    );

    // Additional data
    if (data && this.prettyPrint) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    } else if (data) {
      console.log('  Data:', data);
    }

    // Error details
    if (error) {
      console.log(`  Error: ${error.message}`);
      if (error.code) {
        console.log(`  Code: ${error.code}`);
      }
      if (error.stack && level === 'ERROR') {
        console.log(`  Stack:\n${error.stack}`);
      }
    }
  }

  /**
   * Log to file as JSON lines
   */
  private logToFile(entry: LogEntry): void {
    if (!this.logStream) {
      return;
    }

    try {
      const line = JSON.stringify(entry) + '\n';
      this.logStream.write(line);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  /**
   * Initialize file logging
   */
  private initializeFileLogging(): void {
    if (!this.logDir) {
      return;
    }

    try {
      // Create log directory if it doesn't exist
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Create write stream
      const logPath = path.join(this.logDir, this.logFileName!);
      this.logStream = fs.createWriteStream(logPath, { flags: 'a' });

      // Handle stream errors
      this.logStream.on('error', (err) => {
        console.error('Log stream error:', err);
      });
    } catch (err) {
      console.error('Failed to initialize file logging:', err);
      this.enableFile = false;
    }
  }

  /**
   * Close log stream (cleanup)
   */
  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = undefined;
    }
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

/**
 * Create a logger instance with default settings
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}

/**
 * Default logger instance for convenience
 */
export const defaultLogger = createLogger({
  level: process.env.LOG_LEVEL 
    ? LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel]
    : LogLevel.INFO,
  enableConsole: true,
  enableFile: process.env.ENABLE_FILE_LOGGING === 'true',
  logDir: process.env.LOG_DIR || './storage/logs',
});