/**
 * ChromaDB Vector Store Implementation
 * Provides a type-safe wrapper around ChromaDB for storing and retrieving embeddings
 */

import { ChromaClient, Collection } from "chromadb";
import type {
  IVectorStore,
  SearchMatch,
  VectorDocument,
} from "../../agent/types";

export interface VectorStoreConfig {
  host: string;
  port: number;
  authToken?: string;
  expectedDimension?: number; // e.g., 1024 for Claude embeddings
}

export interface SearchOptions {
  limit?: number;
  where?: Record<string, any>;
  minScore?: number;
}

/**
 * Chroma query result structure
 */
interface ChromaQueryResult {
  ids: string[][];
  distances: number[][];
  documents: (string | null)[][];
  metadatas: (Record<string, any> | null)[][];
}

/**
 * Vector store errors
 */
export class VectorStoreError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = "VectorStoreError";
  }
}

/**
 * ChromaDB implementation of vector store
 */
export class ChromaVectorStore implements IVectorStore {
  private client: ChromaClient;
  private config: VectorStoreConfig;
  private collectionCache: Map<string, Collection>;

  constructor(config: VectorStoreConfig) {
    this.client = new ChromaClient({
      path: `http://${config.host}:${config.port}`,
      auth: config.authToken ? {
        provider: "token",
        credentials: config.authToken,
      } : undefined,
    });
    this.config = config;
    this.collectionCache = new Map<string, Collection>();
  }

  /**
   * Create a new collection
   */
  async createCollection(name: string): Promise<void> {
    try {
      // Create collection with embeddingFunction: undefined (we handle embeddings ourselves)
      const collection = await this.client.createCollection({
        name,
        embeddingFunction: undefined,
      });

      // Add to cache
      this.collectionCache.set(name, collection);
    } catch (error) {
      throw new VectorStoreError(
        `Failed to create collection '${name}'`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    try {
      // Delete collection
      await this.client.deleteCollection({ name });
      
      // Remove collection from cache
      this.collectionCache.delete(name);
    } catch (error) {
      throw new VectorStoreError(
        `Failed to delete collection '${name}'`,
        error instanceof Error ? error: undefined
      );
    }
  }

  /**
   * Get or create collection (lazy loading with cache)
   */
  private async getCollection(name: string): Promise<Collection> {
    try {
      // Check cache
      if (this.collectionCache.has(name)) {
        return this.collectionCache.get(name)!;
      }

      // If not cached, get/create from Chroma
      const collection = await this.client.getOrCreateCollection({
        name,
        embeddingFunction: undefined,
      });

      // Add to cache and return
      this.collectionCache.set(name, collection);
      return collection;
    } catch (error) {
      throw new VectorStoreError(
        `Failed to get or create collection '${name}'`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Store an embedding with metadata
   */
  async storeEmbedding(
    collection: string,
    id: string,
    embedding: number[],
    metadata: Record<string, any>,
    document: string
  ): Promise<void> {
    try {
      // Validate embedding
      this.validateEmbedding(embedding);

      // Get collection
      const collectionResult = await this.getCollection(collection);

      // Store in Chroma
      await collectionResult.add({
        ids: [id],
        embeddings: [embedding],
        documents: [document],
        metadatas: [metadata],
      });
    } catch (error) {
      throw new VectorStoreError(
        `Failed to store embedding '${id}' in collection '${collection}'`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search for similar embeddings
   */
  async search(
    collection: string,
    queryEmbedding: number[],
    options?: SearchOptions
  ): Promise<SearchMatch[]> {
    try {
      // Validate embedding
      this.validateEmbedding(queryEmbedding);

      // Get collection
      const collectionResult = await this.getCollection(collection);

      // Execute Query with options
      const queryResults = await collectionResult.query({
        queryEmbeddings: [queryEmbedding],
        nResults: options?.limit || 10,
        where: options?.where,
        include: ["metadatas", "documents", "distances"],
      });

      // Transform and filter results
      const matches = this.transformResults(queryResults as ChromaQueryResult);

      // Apply minScore filter if specified
      if (options?.minScore !== undefined) {
        return matches.filter((match) => match.score >= options.minScore!);
      }

      return matches;
    } catch (error) {
      throw new VectorStoreError(
        `Failed to search collection '${collection}'`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve embedding by ID
   */
  async get(
    collection: string,
    id: string
  ): Promise<VectorDocument | null> {
    try {
      // Get collection
      const collectionResult = await this.getCollection(collection);

      // Retrieve by ID
      const result = await collectionResult.get({
        ids: [id],
        include: ["embeddings", "documents", "metadatas"],
      });

      // Transform result or return null
      if (!result.ids || result.ids.length === 0) {
        return null;
      }

      return {
        id: result.ids[0],
        embedding: result.embeddings?.[0] ?? [],
        document: result.documents?.[0] ?? "",
        metadata: result.metadatas?.[0] ?? {},
      };
    } catch (error) {
      throw new VectorStoreError(
        `Failed to retrieve embedding '${id}' from collection '${collection}'`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete an embedding by ID
   */
  async delete(collection: string, id: string): Promise<void> {
    try {
      // Get collection
      const collectionResult = await this.getCollection(collection);

      // Delete by ID
      await collectionResult.delete({
        ids: [id],
      });
    } catch (error) {
      throw new VectorStoreError(
        `Failed to delete embedding '${id}' from collection '${collection}'`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Store multiple embeddings in batch (more efficient)
   */
  async storeBatch(
    collection: string,
    items: Array<{
      id: string;
      embedding: number[];
      metadata: Record<string, any>;
      document: string;
    }>
  ): Promise<void> {
    try {
      // Validate all embeddings
      for (const item of items) {
        this.validateEmbedding(item.embedding);
      }

      // Get collection
      const collectionResult = await this.getCollection(collection);

      // Store batch in Chroma
      await collectionResult.add({
        ids: items.map(item => item.id),
        embeddings: items.map(item => item.embedding),
        documents: items.map(item => item.document),
        metadatas: items.map(item => item.metadata),
      });
    } catch (error) {
      throw new VectorStoreError(
        `Failed to store batch embeddings in collection '${collection}'`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate embedding format and dimensions
   */
  private validateEmbedding(embedding: number[]): void {
    // Check is array
    if (!Array.isArray(embedding)) {
      throw new VectorStoreError("Embedding must be an array");
    }

    // Check not empty
    if (embedding.length === 0) {
      throw new VectorStoreError("Embedding cannot be empty");
    }

    // Check all numbers
    if (!embedding.every((val) => typeof val === "number" && !isNaN(val))) {
      throw new VectorStoreError("Embedding must contain only valid numbers");
    }

    // Check dimension (if configured)
    if (this.config.expectedDimension && embedding.length !== this.config.expectedDimension) {
      throw new VectorStoreError(
        `Embedding dimension mismatch: expected ${this.config.expectedDimension}, got ${embedding.length}`
      );
    }
  }

  /**
   * Transform Chroma results to our format
   * 
   * Note: ChromaDB uses L2 (Euclidean) distance by default, where smaller distance = more similar.
   * We convert to a similarity score using: score = 1 / (1 + distance)
   * This gives us a 0-1 scale where 1 is most similar.
   */
  private transformResults(chromaResults: ChromaQueryResult): SearchMatch[] {
    const results: SearchMatch[] = [];

    // ChromaDB returns results as parallel arrays
    const ids = chromaResults.ids[0] || [];
    const distances = chromaResults.distances[0] || [];
    const documents = chromaResults.documents[0] || [];
    const metadatas = chromaResults.metadatas[0] || [];

    // Transform from parallel arrays to objects
    for (let i = 0; i < ids.length; i++) {
      // Convert distance to similarity score (0-1, where 1 is most similar)
      const distance = distances[i] ?? Infinity;
      const score = 1 / (1 + distance);

      results.push({
        id: ids[i],
        score,
        document: documents[i] ?? "",
        metadata: metadatas[i] ?? {},
      });
    }

    return results;
  }

  /**
   * Close connections and clear cache
   */
  async close(): Promise<void> {
    this.collectionCache.clear();
  }
}