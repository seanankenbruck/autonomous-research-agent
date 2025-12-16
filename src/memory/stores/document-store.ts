/**
 * SQLite Document Store Implementation
 * Handles structured storage for sessions, episodes, facts, and strategies
 */

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type {
  IDocumentStore,
  Session,
  SessionFilters,
  EpisodicMemory,
  SemanticMemory,
  FactFilters,
  ProceduralMemory,
  UserFeedback,
  Action,
  Outcome,
  Finding,
} from "../types";

export class SQLiteDocumentStore implements IDocumentStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // Better concurrency
    this.db.pragma("foreign_keys = ON"); // Enforce foreign keys
    this.initializeSchema();
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        topic TEXT NOT NULL,
        goal TEXT NOT NULL, -- JSON
        state TEXT NOT NULL, -- JSON
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        parent_session_id TEXT,
        FOREIGN KEY (parent_session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_topic ON sessions(topic);
    `);

    // Episodes table (episodic memory)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        topic TEXT NOT NULL,
        actions TEXT NOT NULL, -- JSON array
        outcomes TEXT NOT NULL, -- JSON array
        findings TEXT NOT NULL, -- JSON array
        duration INTEGER NOT NULL,
        success INTEGER NOT NULL, -- boolean as int
        feedback TEXT, -- JSON
        summary TEXT NOT NULL,
        tags TEXT NOT NULL, -- JSON array
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_episodes_session_id ON episodes(session_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp);
      CREATE INDEX IF NOT EXISTS idx_episodes_topic ON episodes(topic);
    `);

    // Semantic facts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_facts (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        source TEXT NOT NULL,
        confidence REAL NOT NULL,
        relevance REAL NOT NULL,
        created_at INTEGER NOT NULL,
        last_accessed INTEGER NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_modified INTEGER NOT NULL,
        tags TEXT NOT NULL, -- JSON array
        related_facts TEXT NOT NULL -- JSON array
      );

      CREATE INDEX IF NOT EXISTS idx_facts_category ON semantic_facts(category);
      CREATE INDEX IF NOT EXISTS idx_facts_confidence ON semantic_facts(confidence);
      CREATE INDEX IF NOT EXISTS idx_facts_relevance ON semantic_facts(relevance);
      CREATE INDEX IF NOT EXISTS idx_facts_last_accessed ON semantic_facts(last_accessed);
    `);

    // Strategies table (procedural memory)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        strategy_name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        applicable_contexts TEXT NOT NULL, -- JSON array
        required_tools TEXT NOT NULL, -- JSON array
        success_rate REAL NOT NULL,
        average_duration REAL NOT NULL,
        times_used INTEGER NOT NULL DEFAULT 0,
        refinements TEXT NOT NULL, -- JSON array
        created_at INTEGER NOT NULL,
        last_used INTEGER,
        last_refined INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_strategies_name ON strategies(strategy_name);
      CREATE INDEX IF NOT EXISTS idx_strategies_success_rate ON strategies(success_rate);
      CREATE INDEX IF NOT EXISTS idx_strategies_last_used ON strategies(last_used);
    `);

    // User feedback table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_feedback (
        session_id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        helpful INTEGER NOT NULL, -- boolean as int
        comments TEXT,
        specific_feedback TEXT NOT NULL, -- JSON
        preferences TEXT, -- JSON
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_feedback_rating ON user_feedback(rating);
      CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON user_feedback(timestamp);
    `);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  async createSession(
    session: Omit<Session, "id" | "createdAt" | "updatedAt">
  ): Promise<Session> {
    const id = uuidv4();
    const now = Date.now();

    const newSession: Session = {
      id,
      ...session,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, user_id, topic, goal, state, status,
        created_at, updated_at, completed_at, parent_session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newSession.id,
      newSession.userId || null,
      newSession.topic,
      JSON.stringify(newSession.goal),
      JSON.stringify(newSession.state),
      newSession.status,
      newSession.createdAt.getTime(),
      newSession.updatedAt.getTime(),
      newSession.completedAt?.getTime() || null,
      newSession.parentSessionId || null
    );

    return newSession;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);

    const row = stmt.get(sessionId) as any;
    if (!row) return null;

    return this.rowToSession(row);
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.state !== undefined) {
      fields.push("state = ?");
      values.push(JSON.stringify(updates.state));
    }
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      fields.push("completed_at = ?");
      values.push(updates.completedAt?.getTime() || null);
    }

    // Always update updated_at
    fields.push("updated_at = ?");
    values.push(Date.now());

    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE sessions SET ${fields.join(", ")} WHERE id = ?
    `);

    stmt.run(...values);
  }

  async listSessions(filters?: SessionFilters): Promise<Session[]> {
    let query = "SELECT * FROM sessions WHERE 1=1";
    const params: any[] = [];

    if (filters?.userId) {
      query += " AND user_id = ?";
      params.push(filters.userId);
    }

    if (filters?.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    if (filters?.topic) {
      query += " AND topic LIKE ?";
      params.push(`%${filters.topic}%`);
    }

    if (filters?.createdAfter) {
      query += " AND created_at >= ?";
      params.push(filters.createdAfter.getTime());
    }

    if (filters?.createdBefore) {
      query += " AND created_at <= ?";
      params.push(filters.createdBefore.getTime());
    }

    query += " ORDER BY created_at DESC";

    if (filters?.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => this.rowToSession(row));
  }

  // ============================================================================
  // Episode Operations
  // ============================================================================

  async storeEpisode(episode: EpisodicMemory): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO episodes (
        id, session_id, timestamp, topic, actions, outcomes, findings,
        duration, success, feedback, summary, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      episode.id,
      episode.sessionId,
      episode.timestamp.getTime(),
      episode.topic,
      JSON.stringify(episode.actions),
      JSON.stringify(episode.outcomes),
      JSON.stringify(episode.findings),
      episode.duration,
      episode.success ? 1 : 0,
      episode.feedback ? JSON.stringify(episode.feedback) : null,
      episode.summary,
      JSON.stringify(episode.tags)
    );
  }

  async getEpisode(episodeId: string): Promise<EpisodicMemory | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM episodes WHERE id = ?
    `);

    const row = stmt.get(episodeId) as any;
    if (!row) return null;

    return this.rowToEpisode(row);
  }

  async listEpisodes(sessionId: string): Promise<EpisodicMemory[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM episodes WHERE session_id = ? ORDER BY timestamp DESC
    `);

    const rows = stmt.all(sessionId) as any[];
    return rows.map((row) => this.rowToEpisode(row));
  }

  // ============================================================================
  // Semantic Memory Operations
  // ============================================================================

  async storeFact(fact: SemanticMemory): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO semantic_facts (
        id, content, category, subcategory, source, confidence, relevance,
        created_at, last_accessed, access_count, last_modified, tags, related_facts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fact.id,
      fact.content,
      fact.category,
      fact.subcategory || null,
      fact.source,
      fact.confidence,
      fact.relevance,
      fact.createdAt.getTime(),
      fact.lastAccessed.getTime(),
      fact.accessCount,
      fact.lastModified.getTime(),
      JSON.stringify(fact.tags),
      JSON.stringify(fact.relatedFacts)
    );
  }

  async getFact(factId: string): Promise<SemanticMemory | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM semantic_facts WHERE id = ?
    `);

    const row = stmt.get(factId) as any;
    if (!row) return null;

    // Update access tracking
    this.db.prepare(`
      UPDATE semantic_facts
      SET last_accessed = ?, access_count = access_count + 1
      WHERE id = ?
    `).run(Date.now(), factId);

    // Fetch the updated row to get the incremented access_count
    const updatedRow = stmt.get(factId) as any;
    return this.rowToFact(updatedRow);
  }

  async updateFact(
    factId: string,
    updates: Partial<SemanticMemory>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push("content = ?");
      values.push(updates.content);
    }
    if (updates.confidence !== undefined) {
      fields.push("confidence = ?");
      values.push(updates.confidence);
    }
    if (updates.relevance !== undefined) {
      fields.push("relevance = ?");
      values.push(updates.relevance);
    }
    if (updates.tags !== undefined) {
      fields.push("tags = ?");
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.relatedFacts !== undefined) {
      fields.push("related_facts = ?");
      values.push(JSON.stringify(updates.relatedFacts));
    }

    // Always update last_modified
    fields.push("last_modified = ?");
    values.push(Date.now());

    values.push(factId);

    const stmt = this.db.prepare(`
      UPDATE semantic_facts SET ${fields.join(", ")} WHERE id = ?
    `);

    stmt.run(...values);
  }

  async listFacts(filters?: FactFilters): Promise<SemanticMemory[]> {
    let query = "SELECT * FROM semantic_facts WHERE 1=1";
    const params: any[] = [];

    if (filters?.category) {
      query += " AND category = ?";
      params.push(filters.category);
    }

    if (filters?.minConfidence !== undefined) {
      query += " AND confidence >= ?";
      params.push(filters.minConfidence);
    }

    if (filters?.minRelevance !== undefined) {
      query += " AND relevance >= ?";
      params.push(filters.minRelevance);
    }

    // Note: Tag filtering would require JSON operations or FTS
    // For simplicity, we'll do it in memory for now

    query += " ORDER BY relevance DESC, confidence DESC";

    if (filters?.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    let facts = rows.map((row) => this.rowToFact(row));

    // Filter by tags in memory if needed
    if (filters?.tags && filters.tags.length > 0) {
      facts = facts.filter((fact) =>
        filters.tags!.some((tag) => fact.tags.includes(tag))
      );
    }

    return facts;
  }

  // ============================================================================
  // Procedural Memory Operations
  // ============================================================================

  async storeStrategy(strategy: ProceduralMemory): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO strategies (
        id, strategy_name, description, applicable_contexts, required_tools,
        success_rate, average_duration, times_used, refinements,
        created_at, last_used, last_refined
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      strategy.id,
      strategy.strategyName,
      strategy.description,
      JSON.stringify(strategy.applicableContexts),
      JSON.stringify(strategy.requiredTools),
      strategy.successRate,
      strategy.averageDuration,
      strategy.timesUsed,
      JSON.stringify(strategy.refinements),
      strategy.createdAt.getTime(),
      strategy.lastUsed?.getTime() || null,
      strategy.lastRefined.getTime()
    );
  }

  async getStrategy(strategyId: string): Promise<ProceduralMemory | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM strategies WHERE id = ?
    `);

    const row = stmt.get(strategyId) as any;
    if (!row) return null;

    return this.rowToStrategy(row);
  }

  async updateStrategy(
    strategyId: string,
    updates: Partial<ProceduralMemory>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.successRate !== undefined) {
      fields.push("success_rate = ?");
      values.push(updates.successRate);
    }
    if (updates.averageDuration !== undefined) {
      fields.push("average_duration = ?");
      values.push(updates.averageDuration);
    }
    if (updates.timesUsed !== undefined) {
      fields.push("times_used = ?");
      values.push(updates.timesUsed);
    }
    if (updates.refinements !== undefined) {
      fields.push("refinements = ?");
      values.push(JSON.stringify(updates.refinements));
    }
    if (updates.lastUsed !== undefined) {
      fields.push("last_used = ?");
      values.push(updates.lastUsed.getTime());
    }
    if (updates.lastRefined !== undefined) {
      fields.push("last_refined = ?");
      values.push(updates.lastRefined.getTime());
    }

    values.push(strategyId);

    const stmt = this.db.prepare(`
      UPDATE strategies SET ${fields.join(", ")} WHERE id = ?
    `);

    stmt.run(...values);
  }

  async listStrategies(): Promise<ProceduralMemory[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM strategies ORDER BY success_rate DESC, times_used DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map((row) => this.rowToStrategy(row));
  }

  // ============================================================================
  // Feedback Operations
  // ============================================================================

  async storeFeedback(feedback: UserFeedback): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO user_feedback (
        session_id, timestamp, rating, helpful, comments,
        specific_feedback, preferences
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      feedback.sessionId,
      feedback.timestamp.getTime(),
      feedback.rating,
      feedback.helpful ? 1 : 0,
      feedback.comments || null,
      JSON.stringify(feedback.specificFeedback),
      feedback.preferences ? JSON.stringify(feedback.preferences) : null
    );
  }

  async getFeedback(sessionId: string): Promise<UserFeedback | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM user_feedback WHERE session_id = ?
    `);

    const row = stmt.get(sessionId) as any;
    if (!row) return null;

    return this.rowToFeedback(row);
  }

  // ============================================================================
  // Helper Methods - Row Conversions
  // ============================================================================

  private rowToSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      topic: row.topic,
      goal: JSON.parse(row.goal),
      state: JSON.parse(row.state),
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      parentSessionId: row.parent_session_id,
    };
  }

  private rowToEpisode(row: any): EpisodicMemory {
    return {
      id: row.id,
      sessionId: row.session_id,
      timestamp: new Date(row.timestamp),
      topic: row.topic,
      actions: JSON.parse(row.actions),
      outcomes: JSON.parse(row.outcomes),
      findings: JSON.parse(row.findings),
      duration: row.duration,
      success: row.success === 1,
      feedback: row.feedback ? JSON.parse(row.feedback) : undefined,
      summary: row.summary,
      tags: JSON.parse(row.tags),
    };
  }

  private rowToFact(row: any): SemanticMemory {
    return {
      id: row.id,
      content: row.content,
      category: row.category,
      subcategory: row.subcategory,
      source: row.source,
      confidence: row.confidence,
      relevance: row.relevance,
      createdAt: new Date(row.created_at),
      lastAccessed: new Date(row.last_accessed),
      accessCount: row.access_count,
      lastModified: new Date(row.last_modified),
      tags: JSON.parse(row.tags),
      relatedFacts: JSON.parse(row.related_facts),
    };
  }

  private rowToStrategy(row: any): ProceduralMemory {
    return {
      id: row.id,
      strategyName: row.strategy_name,
      description: row.description,
      applicableContexts: JSON.parse(row.applicable_contexts),
      requiredTools: JSON.parse(row.required_tools),
      successRate: row.success_rate,
      averageDuration: row.average_duration,
      timesUsed: row.times_used,
      refinements: JSON.parse(row.refinements),
      createdAt: new Date(row.created_at),
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      lastRefined: new Date(row.last_refined),
    };
  }

  private rowToFeedback(row: any): UserFeedback {
    return {
      sessionId: row.session_id,
      timestamp: new Date(row.timestamp),
      rating: row.rating,
      helpful: row.helpful === 1,
      comments: row.comments,
      specificFeedback: JSON.parse(row.specific_feedback),
      preferences: row.preferences ? JSON.parse(row.preferences) : undefined,
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async close(): Promise<void> {
    this.db.close();
  }
}