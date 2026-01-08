import { v4 as uuidv4 } from 'uuid';
import { SQLiteDocumentStore } from '../stores/document-store';
import { ChromaVectorStore } from '../stores/vector-store';
import { EmbeddingClient } from '../../llm/embeddings';
import { LLMClient } from '../../llm/client';
import { TokenCounter } from '../../llm/token-counter';
import { Logger } from '../../utils/logger';
import type {
  SemanticMemory,
  EpisodicMemory,
} from '../../agent/types';
import type { Message } from '../../llm/types';

interface SemanticSearchOptions {
  maxResults?: number;
  category?: string;
  minConfidence?: number;
  minRelevance?: number;
  similarityThreshold?: number;
}

interface FactExtractionResult {
  facts: SemanticMemory[];
  totalExtracted: number;
}

interface MergeCandidate {
  fact1: SemanticMemory;
  fact2: SemanticMemory;
  similarity: number;
}

export class SemanticManager {
  private readonly VECTOR_COLLECTION = 'fact_vectors';

  constructor(
    private readonly documentStore: SQLiteDocumentStore,
    private readonly vectorStore: ChromaVectorStore,
    private readonly embeddingClient: EmbeddingClient,
    private readonly llmClient: LLMClient,
    private readonly logger: Logger
  ) {}

  /**
   * Extract facts from an episodic memory
   * Uses LLM to identify key facts, concepts, and knowledge
   */
  async extractFactsFromEpisode(
    episode: EpisodicMemory
  ): Promise<FactExtractionResult> {
    this.logger.debug(`Extracting facts from episode: ${episode.id}`);

    const prompt = `Analyze this research episode and extract key facts, knowledge, and insights.

Episode Summary: ${episode.summary}

Topic: ${episode.topic}
Success: ${episode.success}

Extract distinct, atomic facts. Each fact should be:
1. Self-contained and independently meaningful
2. Factual and verifiable
3. Specific and actionable

Format your response as a JSON array of objects with this structure:
{
  "content": "The fact statement",
  "category": "concept|method|finding|tool|limitation",
  "subcategory": "optional specific subcategory",
  "confidence": 0.0-1.0,
  "tags": ["tag1", "tag2"]
}

Example:
[
  {
    "content": "Claude API supports function calling through the tools parameter",
    "category": "method",
    "subcategory": "api-feature",
    "confidence": 0.95,
    "tags": ["claude", "api", "tools"]
  }
]

Return only the JSON array, no additional text.`;

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 2000 }
      );

      const text = this.llmClient.extractText(response);

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('No facts extracted from episode');
        return { facts: [], totalExtracted: 0 };
      }

      const extractedFacts = JSON.parse(jsonMatch[0]);
      const now = new Date();

      // Convert to SemanticMemory objects and store
      const facts: SemanticMemory[] = [];
      for (const extracted of extractedFacts) {
        const fact: SemanticMemory = {
          id: uuidv4(),
          content: extracted.content,
          category: extracted.category,
          subcategory: extracted.subcategory,
          source: `episode:${episode.id}`,
          confidence: extracted.confidence,
          relevance: 1.0, // Initial relevance
          createdAt: now,
          lastAccessed: now,
          accessCount: 0,
          lastModified: now,
          tags: extracted.tags || [],
          relatedFacts: [],
        };

        await this.storeFact(fact);
        facts.push(fact);
      }

      this.logger.info(`Extracted ${facts.length} facts from episode ${episode.id}`);

      return {
        facts,
        totalExtracted: facts.length,
      };
    } catch (error) {
      this.logger.error('Failed to extract facts from episode', error);
      return { facts: [], totalExtracted: 0 };
    }
  }

  /**
   * Store a fact with embedding for semantic search
   */
  async storeFact(fact: SemanticMemory): Promise<void> {
    this.logger.debug(`Storing fact: ${fact.id}`);

    // Store in document store
    await this.documentStore.storeFact(fact);

    // Generate and store embedding
    try {
      const embedding = await this.embeddingClient.embed(
        fact.content,
        'document'
      );

      await this.vectorStore.storeEmbedding(
        this.VECTOR_COLLECTION,
        fact.id,
        embedding,
        {
          category: fact.category,
          subcategory: fact.subcategory || '',
          confidence: fact.confidence,
          relevance: fact.relevance,
          // Store tags as comma-separated string (ChromaDB requires primitives)
          tags: fact.tags.join(','),
        },
        fact.content
      );

      this.logger.debug(`Fact stored with embedding: ${fact.id}`);
    } catch (error) {
      this.logger.error('Failed to generate embedding for fact', error);
      // Fact still stored, just without vector search capability
    }
  }

  /**
   * Store multiple facts efficiently using batch operations
   * More efficient than calling storeFact multiple times
   */
  async storeFacts(facts: SemanticMemory[]): Promise<void> {
    this.logger.debug(`Storing ${facts.length} facts in batch`);

    if (facts.length === 0) {
      return;
    }

    // Store all facts in document store
    for (const fact of facts) {
      await this.documentStore.storeFact(fact);
    }

    // Generate embeddings and prepare batch
    const embeddingBatch: Array<{
      id: string;
      embedding: number[];
      metadata: Record<string, any>;
      document: string;
    }> = [];

    for (const fact of facts) {
      try {
        const embedding = await this.embeddingClient.embed(
          fact.content,
          'document'
        );

        embeddingBatch.push({
          id: fact.id,
          embedding,
          metadata: {
            category: fact.category,
            subcategory: fact.subcategory || '',
            confidence: fact.confidence,
            relevance: fact.relevance,
            tags: fact.tags,
          },
          document: fact.content,
        });
      } catch (error) {
        this.logger.warn(`Failed to generate embedding for fact ${fact.id}`, error);
        // Continue with other facts
      }
    }

    // Store all embeddings in a single batch operation
    if (embeddingBatch.length > 0) {
      try {
        await this.vectorStore.storeBatch(
          this.VECTOR_COLLECTION,
          embeddingBatch
        );
        this.logger.debug(
          `Stored ${embeddingBatch.length} fact embeddings in batch`
        );
      } catch (error) {
        this.logger.error('Failed to store fact embeddings in batch', error);
        // Facts are still stored in document store
      }
    }
  }

  /**
   * Retrieve a specific fact by ID
   */
  async getFact(id: string): Promise<SemanticMemory | null> {
    return this.documentStore.getFact(id);
  }

  /**
   * Retrieve all facts
   * @returns List of facts
   */
  async getAllFacts(): Promise<SemanticMemory[]> {
    return this.documentStore.listFacts({});
  }

  /**
   * Search for relevant facts using semantic search
   * Note: ChromaDB has limited metadata filtering capabilities, so we filter
   * numeric comparisons (minConfidence, minRelevance) in memory after retrieval
   */
  async searchFacts(
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<SemanticMemory[]> {
    this.logger.debug('Searching facts', { query, options });

    const {
      maxResults = 10,
      similarityThreshold = 0.7,
      category,
      minConfidence,
      minRelevance,
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.embeddingClient.embed(query, 'query');

    // Build metadata filter (only exact matches supported by ChromaDB)
    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    // Search vector store with more results to allow for filtering
    const searchLimit = (minConfidence !== undefined || minRelevance !== undefined)
      ? maxResults * 2
      : maxResults;

    const results = await this.vectorStore.search(
      this.VECTOR_COLLECTION,
      queryEmbedding,
      {
        limit: searchLimit,
        where: Object.keys(where).length > 0 ? where : undefined,
        minScore: similarityThreshold,
      }
    );

    // Get full facts from document store and apply numeric filters
    const facts: SemanticMemory[] = [];
    for (const result of results) {
      const fact = await this.getFact(result.id);
      if (!fact) continue;

      // Apply numeric filters in memory
      if (minConfidence !== undefined && fact.confidence < minConfidence) continue;
      if (minRelevance !== undefined && fact.relevance < minRelevance) continue;

      facts.push(fact);
      
      // Stop once we have enough results
      if (facts.length >= maxResults) break;
    }

    return facts;
  }

  /**
   * Build knowledge context for agent from relevant facts
   * Respects token budget and scores by relevance + recency + confidence
   */
  async buildKnowledgeContext(
    query: string,
    maxTokens: number,
    options: SemanticSearchOptions = {}
  ): Promise<{
    facts: SemanticMemory[];
    totalTokens: number;
    truncated: boolean;
  }> {
    this.logger.debug('Building knowledge context', { query, maxTokens });

    // Search for relevant facts
    const relevantFacts = await this.searchFacts(query, {
      ...options,
      maxResults: 50, // Get more candidates for selection
    });

    if (relevantFacts.length === 0) {
      return { facts: [], totalTokens: 0, truncated: false };
    }

    // Score facts by confidence + recency + access patterns
    const now = Date.now();
    const scoredFacts = relevantFacts.map(fact => {
      // Recency score: exponential decay (half-life of 30 days)
      const ageMs = now - fact.createdAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-ageDays / 30);

      // Access pattern score: frequently accessed facts are more useful
      const accessScore = Math.min(fact.accessCount / 10, 1.0);

      // Combined score (50% confidence, 30% recency, 20% access)
      const combinedScore =
        0.5 * fact.confidence +
        0.3 * recencyScore +
        0.2 * accessScore;

      return { fact, score: combinedScore };
    });

    // Sort by combined score
    scoredFacts.sort((a, b) => b.score - a.score);

    // Select facts within token budget
    const selectedFacts: SemanticMemory[] = [];
    let tokenCount = 0;
    let truncated = false;

    for (const { fact } of scoredFacts) {
      const factTokens = TokenCounter.estimate(fact.content);

      if (tokenCount + factTokens > maxTokens) {
        truncated = true;
        break;
      }

      selectedFacts.push(fact);
      tokenCount += factTokens;
    }

    this.logger.debug(
      `Selected ${selectedFacts.length} facts (${tokenCount} tokens, truncated: ${truncated})`
    );

    return {
      facts: selectedFacts,
      totalTokens: tokenCount,
      truncated,
    };
  }

  /**
   * Find similar facts that might be duplicates or candidates for merging
   * Uses cosine similarity from embedding client for accurate comparison
   */
  async findSimilarFacts(
    fact: SemanticMemory,
    similarityThreshold: number = 0.85
  ): Promise<MergeCandidate[]> {
    this.logger.debug(`Finding similar facts to: ${fact.id}`);

    // Search using the fact's content
    const similarFacts = await this.searchFacts(fact.content, {
      maxResults: 20, // Get more candidates for similarity comparison
      similarityThreshold: 0.7, // Lower threshold for initial search
      category: fact.category, // Same category only
    });

    // Generate embedding for the source fact once
    const factEmbedding = await this.embeddingClient.embed(fact.content, 'document');

    // Calculate precise similarity scores using cosine similarity
    const candidates: MergeCandidate[] = [];
    for (const similar of similarFacts) {
      if (similar.id === fact.id) continue;

      // Get embedding for comparison
      const similarEmbedding = await this.embeddingClient.embed(similar.content, 'document');
      
      // Calculate cosine similarity
      const similarity = this.embeddingClient.cosineSimilarity(factEmbedding, similarEmbedding);

      if (similarity >= similarityThreshold) {
        candidates.push({
          fact1: fact,
          fact2: similar,
          similarity,
        });
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Merge two similar facts into a single, consolidated fact
   * Uses LLM to intelligently combine the facts
   */
  async mergeFacts(
    fact1: SemanticMemory,
    fact2: SemanticMemory
  ): Promise<SemanticMemory> {
    this.logger.info(`Merging facts: ${fact1.id} and ${fact2.id}`);

    const prompt = `Merge these two similar facts into a single, comprehensive fact that preserves all important information.

Fact 1 (confidence: ${fact1.confidence}):
${fact1.content}

Fact 2 (confidence: ${fact2.confidence}):
${fact2.content}

Create a merged fact that:
1. Combines unique information from both facts
2. Resolves any contradictions (favor higher confidence)
3. Is clear and concise
4. Maintains factual accuracy

Respond with ONLY the merged fact content, no additional explanation.`;

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 500 }
      );

      const mergedContent = this.llmClient.extractText(response).trim();

      // Create merged fact with combined metadata
      const now = new Date();
      const mergedFact: SemanticMemory = {
        id: uuidv4(),
        content: mergedContent,
        category: fact1.category,
        subcategory: fact1.subcategory || fact2.subcategory,
        source: `merged:${fact1.id},${fact2.id}`,
        confidence: Math.max(fact1.confidence, fact2.confidence),
        relevance: Math.max(fact1.relevance, fact2.relevance),
        createdAt: now,
        lastAccessed: now,
        accessCount: fact1.accessCount + fact2.accessCount,
        lastModified: now,
        tags: Array.from(new Set([...fact1.tags, ...fact2.tags])),
        relatedFacts: Array.from(
          new Set([
            ...fact1.relatedFacts,
            ...fact2.relatedFacts,
            fact1.id,
            fact2.id,
          ])
        ),
      };

      // Store merged fact
      await this.storeFact(mergedFact);

      // Delete original facts (optional - could keep for audit trail)
      // await this.deleteFact(fact1.id);
      // await this.deleteFact(fact2.id);

      this.logger.info(`Created merged fact: ${mergedFact.id}`);
      return mergedFact;
    } catch (error) {
      this.logger.error('Failed to merge facts', error);
      throw error;
    }
  }

  /**
   * Consolidate similar facts in a category
   * Identifies and merges facts with high similarity
   */
  async consolidateFacts(
    category?: string,
    similarityThreshold: number = 0.9
  ): Promise<{
    mergedCount: number;
    newFacts: SemanticMemory[];
  }> {
    this.logger.info('Starting fact consolidation', { category, similarityThreshold });

    const facts = await this.documentStore.listFacts({ category });
    const mergedFacts: SemanticMemory[] = [];
    const processedIds = new Set<string>();
    let mergedCount = 0;

    for (const fact of facts) {
      if (processedIds.has(fact.id)) continue;

      // Find similar facts
      const candidates = await this.findSimilarFacts(fact, similarityThreshold);

      if (candidates.length > 0) {
        // Merge with the most similar fact
        const mostSimilar = candidates[0];
        if (!processedIds.has(mostSimilar.fact2.id)) {
          const merged = await this.mergeFacts(fact, mostSimilar.fact2);
          mergedFacts.push(merged);
          processedIds.add(fact.id);
          processedIds.add(mostSimilar.fact2.id);
          mergedCount += 2;
        }
      }
    }

    this.logger.info(`Consolidated ${mergedCount} facts into ${mergedFacts.length} merged facts`);

    return {
      mergedCount,
      newFacts: mergedFacts,
    };
  }

  /**
   * Update fact relevance based on usage and time
   * Called periodically to decay relevance of unused facts
   */
  async updateFactRelevance(fact: SemanticMemory): Promise<void> {
    const now = Date.now();
    const daysSinceAccess =
      (now - fact.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);

    // Decay relevance if not accessed recently (half-life of 60 days)
    const decayFactor = Math.exp(-daysSinceAccess / 60);
    const newRelevance = fact.relevance * decayFactor;

    // Boost relevance if frequently accessed
    const accessBoost = Math.min(fact.accessCount * 0.01, 0.2);
    const adjustedRelevance = Math.min(newRelevance + accessBoost, 1.0);

    if (adjustedRelevance !== fact.relevance) {
      await this.documentStore.updateFact(fact.id, {
        relevance: adjustedRelevance,
      });

      this.logger.debug(
        `Updated relevance for ${fact.id}: ${fact.relevance.toFixed(3)} -> ${adjustedRelevance.toFixed(3)}`
      );
    }
  }

  /**
   * Format facts as context for agent prompts
   */
  formatFactsAsContext(facts: SemanticMemory[]): string {
    if (facts.length === 0) return '';

    const sections: Record<string, SemanticMemory[]> = {};

    // Group by category
    for (const fact of facts) {
      if (!sections[fact.category]) {
        sections[fact.category] = [];
      }
      sections[fact.category].push(fact);
    }

    // Format as text
    const lines: string[] = ['## Relevant Knowledge\n'];

    for (const [category, categoryFacts] of Object.entries(sections)) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`);
      for (const fact of categoryFacts) {
        const confidence = (fact.confidence * 100).toFixed(0);
        lines.push(`- ${fact.content} (confidence: ${confidence}%)`);
        if (fact.tags.length > 0) {
          lines.push(`  Tags: ${fact.tags.join(', ')}`);
        }
      }
      lines.push(''); // Empty line between categories
    }

    return lines.join('\n');
  }

  /**
   * Extract facts from a conversation/message history
   */
  async extractFactsFromMessages(
    messages: Message[],
    topic: string
  ): Promise<FactExtractionResult> {
    this.logger.debug('Extracting facts from message history');

    // Convert messages to text
    const conversation = messages
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const content = typeof msg.content === 'string'
          ? msg.content
          : msg.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n');
        return `${role}: ${content}`;
      })
      .join('\n\n');

    const prompt = `Analyze this conversation and extract key facts, knowledge, and insights about ${topic}.

${conversation}

Extract distinct, atomic facts. Each fact should be:
1. Self-contained and independently meaningful
2. Factual and verifiable
3. Specific and actionable

Format your response as a JSON array of objects with this structure:
{
  "content": "The fact statement",
  "category": "concept|method|finding|tool|limitation",
  "subcategory": "optional specific subcategory",
  "confidence": 0.0-1.0,
  "tags": ["tag1", "tag2"]
}

Return only the JSON array, no additional text.`;

    try {
      const response = await this.llmClient.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 2000 }
      );

      const text = this.llmClient.extractText(response);

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('No facts extracted from messages');
        return { facts: [], totalExtracted: 0 };
      }

      const extractedFacts = JSON.parse(jsonMatch[0]);
      const now = new Date();

      // Convert to SemanticMemory objects and store
      const facts: SemanticMemory[] = [];
      for (const extracted of extractedFacts) {
        const fact: SemanticMemory = {
          id: uuidv4(),
          content: extracted.content,
          category: extracted.category,
          subcategory: extracted.subcategory,
          source: `conversation:${topic}`,
          confidence: extracted.confidence,
          relevance: 1.0,
          createdAt: now,
          lastAccessed: now,
          accessCount: 0,
          lastModified: now,
          tags: extracted.tags || [],
          relatedFacts: [],
        };

        await this.storeFact(fact);
        facts.push(fact);
      }

      this.logger.info(`Extracted ${facts.length} facts from conversation`);

      return {
        facts,
        totalExtracted: facts.length,
      };
    } catch (error) {
      this.logger.error('Failed to extract facts from messages', error);
      return { facts: [], totalExtracted: 0 };
    }
  }

  /**
   * Get statistics about stored facts
   */
  async getStats(category?: string): Promise<{
    totalFacts: number;
    averageConfidence: number;
    averageRelevance: number;
    topCategories: Array<{ category: string; count: number }>;
    topTags: Array<{ tag: string; count: number }>;
  }> {
    const facts = await this.documentStore.listFacts({ category });

    if (facts.length === 0) {
      return {
        totalFacts: 0,
        averageConfidence: 0,
        averageRelevance: 0,
        topCategories: [],
        topTags: [],
      };
    }

    // Calculate averages
    const totalConfidence = facts.reduce((sum, f) => sum + f.confidence, 0);
    const totalRelevance = facts.reduce((sum, f) => sum + f.relevance, 0);

    // Count categories
    const categoryCounts = new Map<string, number>();
    for (const fact of facts) {
      categoryCounts.set(fact.category, (categoryCounts.get(fact.category) || 0) + 1);
    }

    // Count tags
    const tagCounts = new Map<string, number>();
    for (const fact of facts) {
      for (const tag of fact.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Sort and take top 5
    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalFacts: facts.length,
      averageConfidence: totalConfidence / facts.length,
      averageRelevance: totalRelevance / facts.length,
      topCategories,
      topTags,
    };
  }

  /**
   * Delete a fact and its embedding from both document and vector stores
   */
  async deleteFact(id: string): Promise<void> {
    this.logger.debug(`Deleting fact: ${id}`);

    try {
      // Delete from document store first
      await this.documentStore.deleteFact(id);
      this.logger.debug(`Deleted fact from document store: ${id}`);

      // Delete from vector store
      await this.vectorStore.delete(this.VECTOR_COLLECTION, id);
      this.logger.debug(`Deleted fact embedding from vector store: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete fact: ${id}`, error);
      throw error;
    }
  }
}