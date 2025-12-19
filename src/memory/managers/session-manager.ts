import { v4 as uuidv4 } from 'uuid';
import { SQLiteDocumentStore } from '../stores/document-store';
import { Logger } from '../../utils/logger';
import type {
  Session,
  SessionStatus,
  SessionFilters,
  Goal,
  AgentState,
} from '../../agent/types';

interface SessionSummary {
  id: string;
  topic: string;
  status: SessionStatus;
  duration: number; // milliseconds
  createdAt: Date;
  completedAt?: Date;
}

interface SessionStatistics {
  totalSessions: number;
  completedSessions: number;
  activeSessions: number;
  failedSessions: number;
  averageDuration: number;
  completionRate: number;
  topTopics: Array<{ topic: string; count: number }>;
}

export class SessionManager {
  private currentSession: Session | null = null;

  constructor(
    private readonly documentStore: SQLiteDocumentStore,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new session
   * Automatically becomes the current session
   */
  async createSession(
    topic: string,
    goal: Goal,
    options: {
      userId?: string;
      parentSessionId?: string;
    } = {}
  ): Promise<Session> {
    this.logger.info('Creating new session', { topic });

    const session = await this.documentStore.createSession({
      userId: options.userId,
      topic,
      goal,
      state: this.createInitialState(goal),
      status: 'active',
      parentSessionId: options.parentSessionId,
    });

    this.currentSession = session;
    this.logger.info(`Session created: ${session.id}`);

    return session;
  }

  /**
   * Create initial agent state for a new session
   */
  private createInitialState(goal: Goal): AgentState {
    return {
      sessionId: '', // Will be set when session is created
      currentGoal: goal,
      plan: {
        id: uuidv4(),
        strategy: 'initial',
        steps: [],
        estimatedDuration: 0,
        createdAt: new Date(),
      },
      progress: {
        stepsCompleted: 0,
        stepsTotal: 0,
        sourcesGathered: 0,
        factsExtracted: 0,
        currentPhase: 'planning',
        confidence: 0,
      },
      workingMemory: {
        recentActions: [],
        recentOutcomes: [],
        keyFindings: [],
        openQuestions: [],
        hypotheses: [],
      },
      reflections: [],
      iterationCount: 0,
      lastActionTimestamp: new Date(),
    };
  }

  /**
   * Get the current active session
   * Returns null if no session is active
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Get the current active session or throw error
   */
  async requireCurrentSession(): Promise<Session> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    // Refresh from database to get latest state
    const session = await this.getSession(this.currentSession.id);
    if (!session) {
      throw new Error('Current session not found in database');
    }
    this.currentSession = session;
    return session;
  }

  /**
   * Set a session as the current active session
   */
  async setCurrentSession(sessionId: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    this.currentSession = session;
    this.logger.info(`Current session set to: ${sessionId}`);
    return session;
  }

  /**
   * Get a specific session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return this.documentStore.getSession(sessionId);
  }

  /**
   * Update session state
   */
  async updateSessionState(
    sessionId: string,
    state: AgentState
  ): Promise<void> {
    this.logger.debug(`Updating session state: ${sessionId}`);

    await this.documentStore.updateSession(sessionId, { state });

    // Update in-memory if this is current session
    if (this.currentSession?.id === sessionId) {
      this.currentSession.state = state;
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus
  ): Promise<void> {
    this.logger.info(`Updating session status: ${sessionId} -> ${status}`);

    const updates: Partial<Session> = { status };

    // Set completion time if completing or failing
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = new Date();
    }

    await this.documentStore.updateSession(sessionId, updates);

    // Update in-memory if this is current session
    if (this.currentSession?.id === sessionId) {
      this.currentSession.status = status;
      if (updates.completedAt) {
        this.currentSession.completedAt = updates.completedAt;
      }
    }
  }

  /**
   * Complete the current session
   */
  async completeCurrentSession(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to complete');
    }

    await this.updateSessionStatus(this.currentSession.id, 'completed');
    this.logger.info(`Session completed: ${this.currentSession.id}`);
    this.currentSession = null;
  }

  /**
   * Fail the current session with optional reason
   */
  async failCurrentSession(reason?: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to fail');
    }

    await this.updateSessionStatus(this.currentSession.id, 'failed');
    this.logger.error(`Session failed: ${this.currentSession.id}`, { reason });
    this.currentSession = null;
  }

  /**
   * Pause the current session
   */
  async pauseCurrentSession(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to pause');
    }

    await this.updateSessionStatus(this.currentSession.id, 'paused');
    this.logger.info(`Session paused: ${this.currentSession.id}`);
    // Keep reference to paused session
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'paused') {
      throw new Error(`Session is not paused: ${sessionId}`);
    }

    await this.updateSessionStatus(sessionId, 'active');
    this.currentSession = session;
    this.logger.info(`Session resumed: ${sessionId}`);

    return session;
  }

  /**
   * Create a child session that continues from a parent session
   */
  async createChildSession(
    parentSessionId: string,
    topic: string,
    goal: Goal,
    userId?: string
  ): Promise<Session> {
    const parent = await this.getSession(parentSessionId);
    if (!parent) {
      throw new Error(`Parent session not found: ${parentSessionId}`);
    }

    this.logger.info(`Creating child session from parent: ${parentSessionId}`);

    return this.createSession(topic, goal, {
      userId: userId || parent.userId,
      parentSessionId,
    });
  }

  /**
   * List sessions with optional filters
   */
  async listSessions(filters?: SessionFilters): Promise<Session[]> {
    return this.documentStore.listSessions(filters);
  }

  /**
   * Get recent sessions
   */
  async getRecentSessions(limit: number = 10): Promise<Session[]> {
    return this.documentStore.listSessions({ limit });
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<Session[]> {
    return this.documentStore.listSessions({ status: 'active' });
  }

  /**
   * Get sessions by topic
   */
  async getSessionsByTopic(topic: string, limit?: number): Promise<Session[]> {
    return this.documentStore.listSessions({ topic, limit });
  }

  /**
   * Get session summary
   */
  async getSessionSummary(sessionId: string): Promise<SessionSummary> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const duration = session.completedAt
      ? session.completedAt.getTime() - session.createdAt.getTime()
      : Date.now() - session.createdAt.getTime();

    return {
      id: session.id,
      topic: session.topic,
      status: session.status,
      duration,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    };
  }

  /**
   * Get comprehensive statistics across all sessions
   */
  async getStatistics(filters?: SessionFilters): Promise<SessionStatistics> {
    this.logger.debug('Calculating session statistics');

    const sessions = await this.listSessions(filters);

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        activeSessions: 0,
        failedSessions: 0,
        averageDuration: 0,
        completionRate: 0,
        topTopics: [],
      };
    }

    // Count by status
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const activeSessions = sessions.filter(s => s.status === 'active').length;
    const failedSessions = sessions.filter(s => s.status === 'failed').length;

    // Calculate average duration for completed sessions
    const completedWithDuration = sessions.filter(
      s => s.status === 'completed' && s.completedAt
    );
    const totalDuration = completedWithDuration.reduce(
      (sum, s) => sum + (s.completedAt!.getTime() - s.createdAt.getTime()),
      0
    );
    const averageDuration = completedWithDuration.length > 0
      ? totalDuration / completedWithDuration.length
      : 0;

    // Calculate completion rate (completed / (completed + failed))
    const finishedSessions = completedSessions + failedSessions;
    const completionRate = finishedSessions > 0
      ? completedSessions / finishedSessions
      : 0;

    // Count topics
    const topicCounts = new Map<string, number>();
    for (const session of sessions) {
      topicCounts.set(session.topic, (topicCounts.get(session.topic) || 0) + 1);
    }

    const topTopics = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSessions: sessions.length,
      completedSessions,
      activeSessions,
      failedSessions,
      averageDuration,
      completionRate,
      topTopics,
    };
  }

  /**
   * Check if there's an active session
   */
  hasActiveSession(): boolean {
    return this.currentSession !== null && this.currentSession.status === 'active';
  }

  /**
   * Get session duration (current time - created time)
   */
  getSessionDuration(session: Session): number {
    const endTime = session.completedAt || new Date();
    return endTime.getTime() - session.createdAt.getTime();
  }

  /**
   * Format session for display
   */
  formatSession(session: Session): string {
    const duration = this.getSessionDuration(session);
    const durationMinutes = (duration / 1000 / 60).toFixed(1);
    
    const lines = [
      `Session: ${session.topic}`,
      `ID: ${session.id}`,
      `Status: ${session.status}`,
      `Duration: ${durationMinutes} minutes`,
      `Created: ${session.createdAt.toISOString()}`,
    ];

    if (session.completedAt) {
      lines.push(`Completed: ${session.completedAt.toISOString()}`);
    }

    if (session.userId) {
      lines.push(`User: ${session.userId}`);
    }

    if (session.parentSessionId) {
      lines.push(`Parent Session: ${session.parentSessionId}`);
    }

    // Progress information
    const progress = session.state.progress;
    lines.push(`\nProgress:`);
    lines.push(`  Phase: ${progress.currentPhase}`);
    lines.push(`  Steps: ${progress.stepsCompleted}/${progress.stepsTotal}`);
    lines.push(`  Sources: ${progress.sourcesGathered}`);
    lines.push(`  Facts: ${progress.factsExtracted}`);
    lines.push(`  Confidence: ${(progress.confidence * 100).toFixed(0)}%`);

    return lines.join('\n');
  }

  /**
   * Clean up old completed sessions
   * Useful for maintaining database size
   */
  async cleanupOldSessions(olderThanDays: number): Promise<number> {
    this.logger.info(`Cleaning up sessions older than ${olderThanDays} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const sessions = await this.listSessions({
      createdBefore: cutoffDate,
    });

    // Only clean up completed, failed, or cancelled sessions
    const sessionsToCleanup = sessions.filter(
      s => s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled'
    );

    // Note: Actual deletion would need to be implemented in SQLiteDocumentStore
    // For now, we just count what would be deleted
    this.logger.info(`Would clean up ${sessionsToCleanup.length} old sessions`);

    // TODO: Implement deleteSession in SQLiteDocumentStore
    // for (const session of sessionsToCleanup) {
    //   await this.documentStore.deleteSession(session.id);
    // }

    return sessionsToCleanup.length;
  }

  /**
   * Export session data for analysis or backup
   */
  async exportSession(sessionId: string): Promise<{
    session: Session;
    summary: SessionSummary;
    statistics: {
      duration: number;
      iterationCount: number;
      actionsCount: number;
      outcomesCount: number;
      findingsCount: number;
    };
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const summary = await this.getSessionSummary(sessionId);
    const state = session.state;

    return {
      session,
      summary,
      statistics: {
        duration: summary.duration,
        iterationCount: state.iterationCount,
        actionsCount: state.workingMemory.recentActions.length,
        outcomesCount: state.workingMemory.recentOutcomes.length,
        findingsCount: state.workingMemory.keyFindings.length,
      },
    };
  }

  /**
   * Validate session state integrity
   */
  validateSession(session: Session): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!session.id) errors.push('Missing session ID');
    if (!session.topic) errors.push('Missing topic');
    if (!session.goal) errors.push('Missing goal');
    if (!session.state) errors.push('Missing state');
    if (!session.status) errors.push('Missing status');
    if (!session.createdAt) errors.push('Missing created timestamp');

    // Validate state
    if (session.state) {
      if (!session.state.currentGoal) errors.push('Missing current goal in state');
      if (!session.state.plan) errors.push('Missing plan in state');
      if (!session.state.progress) errors.push('Missing progress in state');
      if (!session.state.workingMemory) errors.push('Missing working memory in state');
    }

    // Validate completed session has completion time
    if (
      (session.status === 'completed' || 
       session.status === 'failed' || 
       session.status === 'cancelled') &&
      !session.completedAt
    ) {
      errors.push('Completed/failed/cancelled session missing completion timestamp');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}