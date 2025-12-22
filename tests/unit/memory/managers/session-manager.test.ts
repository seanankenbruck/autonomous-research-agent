/**
 * SessionManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../../../../src/memory/managers/session-manager';
import type { SQLiteDocumentStore } from '../../../../src/memory/stores/document-store';
import type { Logger } from '../../../../src/utils/logger';
import type {
  Session,
  SessionStatus,
  Goal,
  AgentState,
  SessionFilters,
} from '../../../../src/agent/types';

describe('SessionManager', () => {
  let manager: SessionManager;
  let mockDocStore: SQLiteDocumentStore;
  let mockLogger: Logger;

  // Sample test data
  const sampleGoal: Goal = {
    description: 'Research autonomous agents',
    successCriteria: ['Find 10 sources', 'Extract key concepts'],
    constraints: ['Use only recent sources'],
    estimatedComplexity: 'moderate',
  };

  const createMockSession = (
    overrides: Partial<Session> = {}
  ): Session => {
    return {
      id: 'session-1',
      userId: 'user-1',
      topic: 'Autonomous Agents',
      goal: sampleGoal,
      state: createMockState('session-1'),
      status: 'active',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
      ...overrides,
    };
  };

  const createMockState = (sessionId: string): AgentState => {
    return {
      sessionId,
      currentGoal: sampleGoal,
      plan: {
        id: 'plan-1',
        strategy: 'initial',
        steps: [],
        estimatedDuration: 0,
        createdAt: new Date('2024-01-15T10:00:00Z'),
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
      lastActionTimestamp: new Date('2024-01-15T10:00:00Z'),
    };
  };

  beforeEach(() => {
    // Create mocks
    mockDocStore = {
      createSession: vi.fn(),
      getSession: vi.fn(),
      updateSession: vi.fn(),
      listSessions: vi.fn(),
    } as unknown as SQLiteDocumentStore;

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as unknown as Logger;

    manager = new SessionManager(mockDocStore, mockLogger);
  });

  describe('createSession()', () => {
    it('should create a new session with initial state', async () => {
      const mockSession = createMockSession();
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      const result = await manager.createSession('Test Topic', sampleGoal);

      expect(mockDocStore.createSession).toHaveBeenCalledWith({
        userId: undefined,
        topic: 'Test Topic',
        goal: sampleGoal,
        state: expect.objectContaining({
          currentGoal: sampleGoal,
          plan: expect.objectContaining({
            strategy: 'initial',
            steps: [],
          }),
          progress: expect.objectContaining({
            stepsCompleted: 0,
            stepsTotal: 0,
            currentPhase: 'planning',
            confidence: 0,
          }),
          workingMemory: expect.objectContaining({
            recentActions: [],
            recentOutcomes: [],
            keyFindings: [],
            openQuestions: [],
            hypotheses: [],
          }),
          reflections: [],
          iterationCount: 0,
        }),
        status: 'active',
        parentSessionId: undefined,
      });
      expect(result).toEqual(mockSession);
    });

    it('should set created session as current session', async () => {
      const mockSession = createMockSession();
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      await manager.createSession('Test Topic', sampleGoal);

      const currentSession = manager.getCurrentSession();
      expect(currentSession).toEqual(mockSession);
    });

    it('should create session with userId when provided', async () => {
      const mockSession = createMockSession({ userId: 'custom-user' });
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      await manager.createSession('Test Topic', sampleGoal, {
        userId: 'custom-user',
      });

      expect(mockDocStore.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'custom-user',
        })
      );
    });

    it('should create session with parent session ID when provided', async () => {
      const mockSession = createMockSession({ parentSessionId: 'parent-1' });
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      await manager.createSession('Test Topic', sampleGoal, {
        parentSessionId: 'parent-1',
      });

      expect(mockDocStore.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          parentSessionId: 'parent-1',
        })
      );
    });

    it('should initialize state with correct structure', async () => {
      const mockSession = createMockSession();
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      await manager.createSession('Test Topic', sampleGoal);

      const createdState = vi.mocked(mockDocStore.createSession).mock
        .calls[0][0].state;
      expect(createdState).toMatchObject({
        currentGoal: sampleGoal,
        plan: expect.objectContaining({
          id: expect.any(String),
          strategy: 'initial',
          steps: [],
          estimatedDuration: 0,
          createdAt: expect.any(Date),
        }),
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
        lastActionTimestamp: expect.any(Date),
      });
    });
  });

  describe('getCurrentSession() / requireCurrentSession()', () => {
    it('getCurrentSession should return null when no session is active', () => {
      const result = manager.getCurrentSession();
      expect(result).toBeNull();
    });

    it('getCurrentSession should return current session when one exists', async () => {
      const mockSession = createMockSession();
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      await manager.createSession('Test Topic', sampleGoal);
      const result = manager.getCurrentSession();

      expect(result).toEqual(mockSession);
    });

    it('requireCurrentSession should throw when no session is active', async () => {
      await expect(manager.requireCurrentSession()).rejects.toThrow(
        'No active session'
      );
    });

    it('requireCurrentSession should return refreshed session from database', async () => {
      const mockSession = createMockSession();
      const updatedSession = createMockSession({
        state: {
          ...mockSession.state,
          iterationCount: 5,
        },
      });

      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);
      vi.mocked(mockDocStore.getSession).mockResolvedValue(updatedSession);

      await manager.createSession('Test Topic', sampleGoal);
      const result = await manager.requireCurrentSession();

      expect(mockDocStore.getSession).toHaveBeenCalledWith('session-1');
      expect(result).toEqual(updatedSession);
      expect(result.state.iterationCount).toBe(5);
    });

    it('requireCurrentSession should throw if session not found in database', async () => {
      const mockSession = createMockSession();
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);
      vi.mocked(mockDocStore.getSession).mockResolvedValue(null);

      await manager.createSession('Test Topic', sampleGoal);

      await expect(manager.requireCurrentSession()).rejects.toThrow(
        'Current session not found in database'
      );
    });
  });

  describe('setCurrentSession()', () => {
    it('should set session as current by ID', async () => {
      const mockSession = createMockSession({ id: 'session-2' });
      vi.mocked(mockDocStore.getSession).mockResolvedValue(mockSession);

      const result = await manager.setCurrentSession('session-2');

      expect(mockDocStore.getSession).toHaveBeenCalledWith('session-2');
      expect(result).toEqual(mockSession);
      expect(manager.getCurrentSession()).toEqual(mockSession);
    });

    it('should throw error when session not found', async () => {
      vi.mocked(mockDocStore.getSession).mockResolvedValue(null);

      await expect(manager.setCurrentSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent'
      );
    });
  });

  describe('updateSessionState() / updateSessionStatus()', () => {
    it('updateSessionState should update state in document store', async () => {
      const mockSession = createMockSession();
      const updatedState: AgentState = {
        ...mockSession.state,
        iterationCount: 10,
      };

      await manager.updateSessionState('session-1', updatedState);

      expect(mockDocStore.updateSession).toHaveBeenCalledWith('session-1', {
        state: updatedState,
      });
    });

    it('updateSessionState should update in-memory current session', async () => {
      const mockSession = createMockSession();
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      await manager.createSession('Test Topic', sampleGoal);

      const updatedState: AgentState = {
        ...mockSession.state,
        iterationCount: 15,
      };

      await manager.updateSessionState('session-1', updatedState);

      const currentSession = manager.getCurrentSession();
      expect(currentSession?.state.iterationCount).toBe(15);
    });

    it('updateSessionState should not update in-memory if different session', async () => {
      const mockSession = createMockSession({ id: 'session-1' });
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      await manager.createSession('Test Topic', sampleGoal);

      const updatedState: AgentState = {
        ...mockSession.state,
        iterationCount: 20,
      };

      await manager.updateSessionState('session-2', updatedState);

      const currentSession = manager.getCurrentSession();
      expect(currentSession?.state.iterationCount).toBe(0); // Unchanged
    });

    it('updateSessionStatus should update status in document store', async () => {
      await manager.updateSessionStatus('session-1', 'paused');

      expect(mockDocStore.updateSession).toHaveBeenCalledWith('session-1', {
        status: 'paused',
      });
    });

    it('updateSessionStatus should set completedAt for terminal statuses', async () => {
      const statuses: SessionStatus[] = ['completed', 'failed', 'cancelled'];

      for (const status of statuses) {
        vi.clearAllMocks();
        await manager.updateSessionStatus('session-1', status);

        expect(mockDocStore.updateSession).toHaveBeenCalledWith('session-1', {
          status,
          completedAt: expect.any(Date),
        });
      }
    });

    it('updateSessionStatus should not set completedAt for non-terminal statuses', async () => {
      const statuses: SessionStatus[] = ['active', 'paused'];

      for (const status of statuses) {
        vi.clearAllMocks();
        await manager.updateSessionStatus('session-1', status);

        expect(mockDocStore.updateSession).toHaveBeenCalledWith('session-1', {
          status,
        });
      }
    });

    it('updateSessionStatus should update in-memory current session', async () => {
      const mockSession = createMockSession();
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

      await manager.createSession('Test Topic', sampleGoal);
      await manager.updateSessionStatus('session-1', 'paused');

      const currentSession = manager.getCurrentSession();
      expect(currentSession?.status).toBe('paused');
    });
  });

  describe('Session lifecycle transitions', () => {
    let mockSession: Session;

    beforeEach(async () => {
      mockSession = createMockSession();
      vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);
      await manager.createSession('Test Topic', sampleGoal);
    });

    describe('completeCurrentSession()', () => {
      it('should complete current session and update status', async () => {
        await manager.completeCurrentSession();

        expect(mockDocStore.updateSession).toHaveBeenCalledWith('session-1', {
          status: 'completed',
          completedAt: expect.any(Date),
        });
      });

      it('should clear current session reference', async () => {
        await manager.completeCurrentSession();

        expect(manager.getCurrentSession()).toBeNull();
      });

      it('should throw error when no active session', async () => {
        await manager.completeCurrentSession();

        await expect(manager.completeCurrentSession()).rejects.toThrow(
          'No active session to complete'
        );
      });
    });

    describe('failCurrentSession()', () => {
      it('should fail current session with status update', async () => {
        await manager.failCurrentSession('Error occurred');

        expect(mockDocStore.updateSession).toHaveBeenCalledWith('session-1', {
          status: 'failed',
          completedAt: expect.any(Date),
        });
      });

      it('should clear current session reference', async () => {
        await manager.failCurrentSession();

        expect(manager.getCurrentSession()).toBeNull();
      });

      it('should log error with reason', async () => {
        await manager.failCurrentSession('Test error reason');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Session failed: session-1',
          { reason: 'Test error reason' }
        );
      });

      it('should throw error when no active session', async () => {
        await manager.failCurrentSession();

        await expect(manager.failCurrentSession()).rejects.toThrow(
          'No active session to fail'
        );
      });
    });

    describe('pauseCurrentSession()', () => {
      it('should pause current session and update status', async () => {
        await manager.pauseCurrentSession();

        expect(mockDocStore.updateSession).toHaveBeenCalledWith('session-1', {
          status: 'paused',
        });
      });

      it('should keep reference to paused session', async () => {
        await manager.pauseCurrentSession();

        const currentSession = manager.getCurrentSession();
        expect(currentSession).not.toBeNull();
        expect(currentSession?.status).toBe('paused');
      });

      it('should throw error when no active session', async () => {
        await manager.completeCurrentSession();

        await expect(manager.pauseCurrentSession()).rejects.toThrow(
          'No active session to pause'
        );
      });
    });

    describe('resumeSession()', () => {
      it('should resume paused session', async () => {
        const pausedSession = createMockSession({
          id: 'session-2',
          status: 'paused',
        });
        vi.mocked(mockDocStore.getSession).mockResolvedValue(pausedSession);

        const result = await manager.resumeSession('session-2');

        expect(mockDocStore.updateSession).toHaveBeenCalledWith('session-2', {
          status: 'active',
        });
        expect(result).toEqual(pausedSession);
        expect(manager.getCurrentSession()).toEqual(pausedSession);
      });

      it('should throw error if session not found', async () => {
        vi.mocked(mockDocStore.getSession).mockResolvedValue(null);

        await expect(manager.resumeSession('nonexistent')).rejects.toThrow(
          'Session not found: nonexistent'
        );
      });

      it('should throw error if session is not paused', async () => {
        const activeSession = createMockSession({
          id: 'session-2',
          status: 'active',
        });
        vi.mocked(mockDocStore.getSession).mockResolvedValue(activeSession);

        await expect(manager.resumeSession('session-2')).rejects.toThrow(
          'Session is not paused: session-2'
        );
      });
    });
  });

  describe('createChildSession()', () => {
    it('should create child session with parent reference', async () => {
      const parentSession = createMockSession({ id: 'parent-1' });
      const childSession = createMockSession({
        id: 'child-1',
        parentSessionId: 'parent-1',
      });

      vi.mocked(mockDocStore.getSession).mockResolvedValue(parentSession);
      vi.mocked(mockDocStore.createSession).mockResolvedValue(childSession);

      const result = await manager.createChildSession(
        'parent-1',
        'Child Topic',
        sampleGoal
      );

      expect(mockDocStore.getSession).toHaveBeenCalledWith('parent-1');
      expect(mockDocStore.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'Child Topic',
          parentSessionId: 'parent-1',
        })
      );
      expect(result).toEqual(childSession);
    });

    it('should inherit userId from parent when not provided', async () => {
      const parentSession = createMockSession({
        id: 'parent-1',
        userId: 'parent-user',
      });
      const childSession = createMockSession({
        id: 'child-1',
        userId: 'parent-user',
        parentSessionId: 'parent-1',
      });

      vi.mocked(mockDocStore.getSession).mockResolvedValue(parentSession);
      vi.mocked(mockDocStore.createSession).mockResolvedValue(childSession);

      await manager.createChildSession('parent-1', 'Child Topic', sampleGoal);

      expect(mockDocStore.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'parent-user',
        })
      );
    });

    it('should use provided userId over parent userId', async () => {
      const parentSession = createMockSession({
        id: 'parent-1',
        userId: 'parent-user',
      });
      const childSession = createMockSession({
        id: 'child-1',
        userId: 'custom-user',
        parentSessionId: 'parent-1',
      });

      vi.mocked(mockDocStore.getSession).mockResolvedValue(parentSession);
      vi.mocked(mockDocStore.createSession).mockResolvedValue(childSession);

      await manager.createChildSession(
        'parent-1',
        'Child Topic',
        sampleGoal,
        'custom-user'
      );

      expect(mockDocStore.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'custom-user',
        })
      );
    });

    it('should throw error if parent session not found', async () => {
      vi.mocked(mockDocStore.getSession).mockResolvedValue(null);

      await expect(
        manager.createChildSession('nonexistent', 'Child Topic', sampleGoal)
      ).rejects.toThrow('Parent session not found: nonexistent');
    });
  });

  describe('Querying sessions', () => {
    const sessions = [
      createMockSession({ id: 'session-1', topic: 'AI', status: 'active' }),
      createMockSession({
        id: 'session-2',
        topic: 'ML',
        status: 'completed',
        completedAt: new Date('2024-01-15T12:00:00Z'),
      }),
      createMockSession({ id: 'session-3', topic: 'AI', status: 'active' }),
    ];

    describe('listSessions()', () => {
      it('should list all sessions without filters', async () => {
        vi.mocked(mockDocStore.listSessions).mockResolvedValue(sessions);

        const result = await manager.listSessions();

        expect(mockDocStore.listSessions).toHaveBeenCalledWith(undefined);
        expect(result).toEqual(sessions);
      });

      it('should list sessions with filters', async () => {
        const filters: SessionFilters = {
          status: 'active',
          topic: 'AI',
        };
        const filteredSessions = sessions.filter(
          (s) => s.status === 'active' && s.topic === 'AI'
        );
        vi.mocked(mockDocStore.listSessions).mockResolvedValue(
          filteredSessions
        );

        const result = await manager.listSessions(filters);

        expect(mockDocStore.listSessions).toHaveBeenCalledWith(filters);
        expect(result).toEqual(filteredSessions);
      });
    });

    describe('getRecentSessions()', () => {
      it('should get recent sessions with default limit', async () => {
        vi.mocked(mockDocStore.listSessions).mockResolvedValue(sessions);

        const result = await manager.getRecentSessions();

        expect(mockDocStore.listSessions).toHaveBeenCalledWith({ limit: 10 });
        expect(result).toEqual(sessions);
      });

      it('should get recent sessions with custom limit', async () => {
        vi.mocked(mockDocStore.listSessions).mockResolvedValue([sessions[0]]);

        const result = await manager.getRecentSessions(1);

        expect(mockDocStore.listSessions).toHaveBeenCalledWith({ limit: 1 });
        expect(result).toHaveLength(1);
      });
    });

    describe('getActiveSessions()', () => {
      it('should get only active sessions', async () => {
        const activeSessions = sessions.filter((s) => s.status === 'active');
        vi.mocked(mockDocStore.listSessions).mockResolvedValue(
          activeSessions
        );

        const result = await manager.getActiveSessions();

        expect(mockDocStore.listSessions).toHaveBeenCalledWith({
          status: 'active',
        });
        expect(result).toEqual(activeSessions);
      });
    });
  });

  describe('getSessionSummary()', () => {
    it('should generate summary for completed session', async () => {
      const completedSession = createMockSession({
        id: 'session-1',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:30:00Z'),
        status: 'completed',
      });
      vi.mocked(mockDocStore.getSession).mockResolvedValue(completedSession);

      const result = await manager.getSessionSummary('session-1');

      expect(result).toEqual({
        id: 'session-1',
        topic: 'Autonomous Agents',
        status: 'completed',
        duration: 30 * 60 * 1000, // 30 minutes in ms
        createdAt: completedSession.createdAt,
        completedAt: completedSession.completedAt,
      });
    });

    it('should calculate duration for active session', async () => {
      const activeSession = createMockSession({
        createdAt: new Date(Date.now() - 60000), // 1 minute ago
        status: 'active',
      });
      vi.mocked(mockDocStore.getSession).mockResolvedValue(activeSession);

      const result = await manager.getSessionSummary('session-1');

      expect(result.duration).toBeGreaterThan(59000); // At least 59 seconds
      expect(result.duration).toBeLessThan(120000); // Less than 2 minutes
      expect(result.completedAt).toBeUndefined();
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockDocStore.getSession).mockResolvedValue(null);

      await expect(manager.getSessionSummary('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent'
      );
    });
  });

  describe('getStatistics()', () => {
    it('should return zero statistics for empty session list', async () => {
      vi.mocked(mockDocStore.listSessions).mockResolvedValue([]);

      const result = await manager.getStatistics();

      expect(result).toEqual({
        totalSessions: 0,
        completedSessions: 0,
        activeSessions: 0,
        failedSessions: 0,
        averageDuration: 0,
        completionRate: 0,
        topTopics: [],
      });
    });

    it('should calculate statistics correctly', async () => {
      const sessions = [
        createMockSession({
          id: '1',
          topic: 'AI',
          status: 'completed',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          completedAt: new Date('2024-01-15T10:30:00Z'),
        }),
        createMockSession({
          id: '2',
          topic: 'ML',
          status: 'completed',
          createdAt: new Date('2024-01-15T11:00:00Z'),
          completedAt: new Date('2024-01-15T11:20:00Z'),
        }),
        createMockSession({
          id: '3',
          topic: 'AI',
          status: 'active',
        }),
        createMockSession({
          id: '4',
          topic: 'DL',
          status: 'failed',
          createdAt: new Date('2024-01-15T12:00:00Z'),
          completedAt: new Date('2024-01-15T12:10:00Z'),
        }),
      ];
      vi.mocked(mockDocStore.listSessions).mockResolvedValue(sessions);

      const result = await manager.getStatistics();

      expect(result.totalSessions).toBe(4);
      expect(result.completedSessions).toBe(2);
      expect(result.activeSessions).toBe(1);
      expect(result.failedSessions).toBe(1);
      expect(result.averageDuration).toBe(25 * 60 * 1000); // (30+20)/2 minutes
      expect(result.completionRate).toBe(2 / 3); // 2 completed / (2 completed + 1 failed)
      expect(result.topTopics).toEqual([
        { topic: 'AI', count: 2 },
        { topic: 'ML', count: 1 },
        { topic: 'DL', count: 1 },
      ]);
    });

    it('should handle completion rate when no finished sessions', async () => {
      const sessions = [
        createMockSession({ id: '1', status: 'active' }),
        createMockSession({ id: '2', status: 'paused' }),
      ];
      vi.mocked(mockDocStore.listSessions).mockResolvedValue(sessions);

      const result = await manager.getStatistics();

      expect(result.completionRate).toBe(0);
    });

    it('should sort topics by count descending', async () => {
      const sessions = [
        createMockSession({ id: '1', topic: 'AI', status: 'completed' }),
        createMockSession({ id: '2', topic: 'ML', status: 'completed' }),
        createMockSession({ id: '3', topic: 'AI', status: 'completed' }),
        createMockSession({ id: '4', topic: 'DL', status: 'completed' }),
        createMockSession({ id: '5', topic: 'AI', status: 'completed' }),
        createMockSession({ id: '6', topic: 'ML', status: 'completed' }),
      ];
      vi.mocked(mockDocStore.listSessions).mockResolvedValue(sessions);

      const result = await manager.getStatistics();

      expect(result.topTopics[0]).toEqual({ topic: 'AI', count: 3 });
      expect(result.topTopics[1]).toEqual({ topic: 'ML', count: 2 });
      expect(result.topTopics[2]).toEqual({ topic: 'DL', count: 1 });
    });

    it('should apply filters when calculating statistics', async () => {
      const allSessions = [
        createMockSession({ id: '1', topic: 'AI', status: 'completed' }),
        createMockSession({ id: '2', topic: 'ML', status: 'completed' }),
      ];
      const filteredSessions = [allSessions[0]];
      vi.mocked(mockDocStore.listSessions).mockResolvedValue(
        filteredSessions
      );

      const result = await manager.getStatistics({ topic: 'AI' });

      expect(result.totalSessions).toBe(1);
      expect(result.topTopics).toEqual([{ topic: 'AI', count: 1 }]);
    });
  });

  describe('validateSession()', () => {
    it('should validate correct session structure', () => {
      const session = createMockSession();

      const result = manager.validateSession(session);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidSession = {
        ...createMockSession(),
        id: '',
        topic: '',
      };

      const result = manager.validateSession(invalidSession);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing session ID');
      expect(result.errors).toContain('Missing topic');
    });

    it('should validate state structure', () => {
      const invalidSession = createMockSession();
      invalidSession.state = {
        ...invalidSession.state,
        currentGoal: null as any,
        plan: null as any,
      };

      const result = manager.validateSession(invalidSession);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing current goal in state');
      expect(result.errors).toContain('Missing plan in state');
    });

    it('should require completedAt for terminal statuses', () => {
      const completedSession = createMockSession({
        status: 'completed',
        completedAt: undefined,
      });

      const result = manager.validateSession(completedSession);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Completed/failed/cancelled session missing completion timestamp'
      );
    });

    it('should accept completedAt for terminal statuses', () => {
      const completedSession = createMockSession({
        status: 'completed',
        completedAt: new Date(),
      });

      const result = manager.validateSession(completedSession);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('formatSession()', () => {
    it('should format active session correctly', () => {
      const session = createMockSession({
        createdAt: new Date('2024-01-15T10:00:00Z'),
      });

      const result = manager.formatSession(session);

      expect(result).toContain('Session: Autonomous Agents');
      expect(result).toContain('ID: session-1');
      expect(result).toContain('Status: active');
      expect(result).toContain('User: user-1');
      expect(result).toContain('Phase: planning');
      expect(result).toContain('Steps: 0/0');
      expect(result).toContain('Sources: 0');
      expect(result).toContain('Facts: 0');
      expect(result).toContain('Confidence: 0%');
    });

    it('should include completion time for completed sessions', () => {
      const session = createMockSession({
        status: 'completed',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:30:00Z'),
      });

      const result = manager.formatSession(session);

      expect(result).toContain('Completed: 2024-01-15T10:30:00.000Z');
      expect(result).toContain('Duration: 30.0 minutes');
    });

    it('should include parent session ID when present', () => {
      const session = createMockSession({
        parentSessionId: 'parent-123',
      });

      const result = manager.formatSession(session);

      expect(result).toContain('Parent Session: parent-123');
    });

    it('should show progress information', () => {
      const session = createMockSession();
      session.state.progress = {
        stepsCompleted: 5,
        stepsTotal: 10,
        sourcesGathered: 15,
        factsExtracted: 20,
        currentPhase: 'analyzing',
        confidence: 0.75,
      };

      const result = manager.formatSession(session);

      expect(result).toContain('Phase: analyzing');
      expect(result).toContain('Steps: 5/10');
      expect(result).toContain('Sources: 15');
      expect(result).toContain('Facts: 20');
      expect(result).toContain('Confidence: 75%');
    });
  });

  describe('exportSession()', () => {
    it('should export complete session data', async () => {
      const session = createMockSession({
        createdAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:30:00Z'),
        status: 'completed',
      });
      session.state.iterationCount = 25;
      session.state.workingMemory.recentActions = [
        {} as any,
        {} as any,
        {} as any,
      ];
      session.state.workingMemory.recentOutcomes = [{} as any, {} as any];
      session.state.workingMemory.keyFindings = [{} as any];

      vi.mocked(mockDocStore.getSession).mockResolvedValue(session);

      const result = await manager.exportSession('session-1');

      expect(result).toEqual({
        session,
        summary: {
          id: 'session-1',
          topic: 'Autonomous Agents',
          status: 'completed',
          duration: 30 * 60 * 1000,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
        },
        statistics: {
          duration: 30 * 60 * 1000,
          iterationCount: 25,
          actionsCount: 3,
          outcomesCount: 2,
          findingsCount: 1,
        },
      });
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockDocStore.getSession).mockResolvedValue(null);

      await expect(manager.exportSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent'
      );
    });
  });

  describe('Helper methods', () => {
    describe('hasActiveSession()', () => {
      it('should return false when no session exists', () => {
        expect(manager.hasActiveSession()).toBe(false);
      });

      it('should return true when active session exists', async () => {
        const mockSession = createMockSession({ status: 'active' });
        vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

        await manager.createSession('Test Topic', sampleGoal);

        expect(manager.hasActiveSession()).toBe(true);
      });

      it('should return false when session exists but is not active', async () => {
        const mockSession = createMockSession({ status: 'paused' });
        vi.mocked(mockDocStore.createSession).mockResolvedValue(mockSession);

        await manager.createSession('Test Topic', sampleGoal);
        await manager.pauseCurrentSession();

        expect(manager.hasActiveSession()).toBe(false);
      });
    });

    describe('getSessionDuration()', () => {
      it('should calculate duration for completed session', () => {
        const session = createMockSession({
          createdAt: new Date('2024-01-15T10:00:00Z'),
          completedAt: new Date('2024-01-15T10:30:00Z'),
        });

        const duration = manager.getSessionDuration(session);

        expect(duration).toBe(30 * 60 * 1000); // 30 minutes
      });

      it('should calculate duration for active session', () => {
        const session = createMockSession({
          createdAt: new Date(Date.now() - 60000), // 1 minute ago
        });

        const duration = manager.getSessionDuration(session);

        expect(duration).toBeGreaterThan(59000);
        expect(duration).toBeLessThan(120000);
      });
    });
  });
});
