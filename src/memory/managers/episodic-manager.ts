import { v4 as uuidv4 } from 'uuid';
import { SQLiteDocumentStore } from '../stores/document-store';
import { ChromaVectorStore } from '../stores/vector-store';
import { EmbeddingClient } from '../../llm/embeddings';
import { LLMClient } from '../../llm/client';
import { TokenCounter } from '../../llm/token-counter';
import { Logger } from '../../utils/logger';
import type {
  EpisodicMemory,
  Action,
  Outcome,
  Finding,
  UserFeedback,
} from '../../agent/types';

interface EpisodicSearchOptions {
  maxResults?: number;
  maxTokens?: number;
  sessionId?: string;
  startTime?: Date;
  endTime?: Date;
  similarityThreshold?: number;
  topic?: string;
}

interface ContextBuildResult {
  episodes: EpisodicMemory[];
  totalTokens: number;
  truncated: boolean;
}

export class EpisodicManager {
  private readonly VECTOR_COLLECTION = 'episode_vectors';
  
  constructor(
    private readonly documentStore: SQLiteDocumentStore,
    private readonly vectorStore: ChromaVectorStore,
    private readonly embeddingClient: EmbeddingClient,
    private readonly llmClient: LLMClient,
    private readonly logger: Logger
  ) {}

  /**
   * Store a new episode
   * Automatically generates embedding for semantic search
   */
  async storeEpisode(
    episode: Omit<EpisodicMemory, 'id'>
  ): Promise<EpisodicMemory> {
    this.logger.debug(`Storing episode for session: ${episode.sessionId}`);
    
    const id = uuidv4();
    const fullEpisode: EpisodicMemory = {
      ...episode,
      id,
    };
    
    // Store in document store
    await this.documentStore.storeEpisode(fullEpisode);
    
    // Generate embedding from summary for semantic search
    try {
      const embedding = await this.embeddingClient.embed(
        fullEpisode.summary,
        'document'
      );
      
      await this.vectorStore.storeEmbedding(
        this.VECTOR_COLLECTION,
        id,
        embedding,
        {
          sessionId: episode.sessionId,
          topic: episode.topic,
          timestamp: episode.timestamp.toISOString(),
          success: episode.success,
        },
        fullEpisode.summary // document field
      );
      
      this.logger.debug(`Episode stored with embedding: ${id}`);
    } catch (error) {
      this.logger.error('Failed to generate embedding for episode', error);
      // Episode still stored, just without vector search capability
    }
    
    return fullEpisode;
  }

  /**
   * Retrieve a specific episode by ID
   */
  async getEpisode(id: string): Promise<EpisodicMemory | null> {
    return this.documentStore.getEpisode(id);
  }

  /**
   * Get all episodes for a session
   */
  async getSessionEpisodes(sessionId: string): Promise<EpisodicMemory[]> {
    return this.documentStore.listEpisodes(sessionId);
  }

  /**
   * Search for similar episodes using semantic search
   */
  async searchSimilar(
    query: string,
    options: EpisodicSearchOptions = {}
  ): Promise<EpisodicMemory[]> {
    this.logger.debug('Searching similar episodes', { query, options });
    
    const {
      maxResults = 10,
      similarityThreshold = 0.7,
      sessionId,
      topic,
    } = options;
    
    // Generate query embedding
    const queryEmbedding = await this.embeddingClient.embed(query, 'query');
    
    // Build metadata filter
    const where: Record<string, unknown> = {};
    if (sessionId) where.sessionId = sessionId;
    if (topic) where.topic = topic;

    // Search vector store (already filtered by minScore)
    const results = await this.vectorStore.search(
      this.VECTOR_COLLECTION,
      queryEmbedding,
      {
        limit: maxResults,
        where: Object.keys(where).length > 0 ? where : undefined,
        minScore: similarityThreshold,
      }
    );

    // Get full episodes from document store
    const episodes: EpisodicMemory[] = [];
    for (const result of results) {
      const episode = await this.getEpisode(result.id);
      if (episode) {
        episodes.push(episode);
      }
    }

    return episodes;
  }

  /**
   * Build context from episodes for agent, respecting token budget
   * Uses relevance + recency scoring
   */
  async buildContext(
    query: string,
    maxTokens: number,
    options: Omit<EpisodicSearchOptions, 'maxTokens'> = {}
  ): Promise<ContextBuildResult> {
    this.logger.debug('Building episode context', { query, maxTokens });
    
    // Search for relevant episodes
    const relevantEpisodes = await this.searchSimilar(query, {
      ...options,
      maxResults: 50, // Get more candidates for selection
    });
    
    // Score episodes by relevance + recency
    const now = Date.now();
    const scoredEpisodes = relevantEpisodes.map(episode => {
      // Recency score: exponential decay (half-life of 7 days)
      const ageMs = now - episode.timestamp.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-ageDays / 7);
      
      // Combined score (70% relevance from vector search, 30% recency)
      // Note: We don't have access to original vector score here,
      // so we'll weight by order (first results are more relevant)
      const relevanceScore = 1 - (relevantEpisodes.indexOf(episode) / relevantEpisodes.length);
      const combinedScore = 0.7 * relevanceScore + 0.3 * recencyScore;
      
      return { episode, score: combinedScore };
    });
    
    // Sort by combined score
    scoredEpisodes.sort((a, b) => b.score - a.score);
    
    // Select episodes within token budget
    const selectedEpisodes: EpisodicMemory[] = [];
    let tokenCount = 0;
    let truncated = false;
    
    for (const { episode } of scoredEpisodes) {
      const episodeTokens = TokenCounter.estimate(episode.summary);

      if (tokenCount + episodeTokens > maxTokens) {
        truncated = true;
        break;
      }

      selectedEpisodes.push(episode);
      tokenCount += episodeTokens;
    }
    
    // Sort selected episodes chronologically for natural reading
    selectedEpisodes.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    this.logger.debug(
      `Selected ${selectedEpisodes.length} episodes (${tokenCount} tokens, truncated: ${truncated})`
    );
    
    return {
      episodes: selectedEpisodes,
      totalTokens: tokenCount,
      truncated,
    };
  }

  /**
   * Consolidate old episodes into summaries
   * Groups related episodes and creates consolidated summaries
   */
  async consolidateOldEpisodes(
    olderThanDays: number,
    sessionId?: string
  ): Promise<{
    consolidatedCount: number;
    newEpisodes: EpisodicMemory[];
  }> {
    this.logger.info(`Consolidating episodes older than ${olderThanDays} days`);
    
    // This is a placeholder - actual implementation would:
    // 1. Query old episodes from document store
    // 2. Group by session and topic
    // 3. Use LLM to generate consolidated summaries
    // 4. Create new consolidated episodes
    // 5. Delete original episodes
    
    // For now, return empty result
    return {
      consolidatedCount: 0,
      newEpisodes: [],
    };
  }

  /**
   * Extract insights from a set of episodes
   * Used by reflection engine
   */
  async extractInsights(episodes: EpisodicMemory[]): Promise<string[]> {
    if (episodes.length === 0) return [];
    
    const summaries = episodes.map(e => e.summary).join('\n\n');
    
    const prompt = `Analyze these research episodes and extract key insights:

${summaries}

Provide 3-5 key insights about:
1. Common patterns or themes
2. Successful approaches
3. Areas for improvement
4. Knowledge gaps identified

Format as a bullet list.`;
    
    const response = await this.llmClient.complete(
      [{ role: 'user', content: prompt }],
      { maxTokens: 500 }
    );

    // Parse bullet points from response
    const text = this.llmClient.extractText(response);
    const insights = text
      .split('\n')
      .filter(line => line.trim().match(/^[-•*]/))
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0);
    
    return insights;
  }

  /**
 * Helper to create an episode from individual components
 * Useful when building episodes programmatically
 */
async createEpisode(
  sessionId: string,
  topic: string,
  actions: Action[],
  outcomes: Outcome[],
  findings: Finding[],
  summary: string,
  options: {
    tags?: string[];
    feedback?: UserFeedback;
  } = {}
): Promise<EpisodicMemory> {
  const timestamps = actions.map(a => a.timestamp.getTime());
  const duration = timestamps.length > 1 
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : 0;
  
  const success = outcomes.every(o => o.success);
  
  return this.storeEpisode({
    sessionId,
    timestamp: new Date(),
    topic,
    actions,
    outcomes,
    findings,
    duration,
    success,
    feedback: options.feedback,
    summary,
    tags: options.tags || [],
  });
}
}