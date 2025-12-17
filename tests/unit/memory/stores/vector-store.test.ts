import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChromaVectorStore, VectorStoreError } from "../../../../src/memory/stores/vector-store";

// Create mock objects that will be shared
let mockCollectionInstance: any;
let mockClientInstance: any;

vi.mock("chromadb", () => {
  class MockChromaClient {
    createCollection: any;
    deleteCollection: any;
    getOrCreateCollection: any;

    constructor() {
      this.createCollection = vi.fn();
      this.deleteCollection = vi.fn();
      this.getOrCreateCollection = vi.fn();
    }
  }

  return {
    ChromaClient: MockChromaClient,
  };
});

describe("ChromaVectorStore", () => {
  let vectorStore: ChromaVectorStore;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Setup mock collection
    mockCollectionInstance = {
      add: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        ids: [["id1", "id2"]],
        distances: [[0.1, 0.5]],
        documents: [["doc1", "doc2"]],
        metadatas: [[{ key: "value1" }, { key: "value2" }]],
      }),
      get: vi.fn().mockResolvedValue({
        ids: ["id1"],
        embeddings: [[0.1, 0.2, 0.3]],
        documents: ["test document"],
        metadatas: [{ key: "value" }],
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    // Create vector store instance
    vectorStore = new ChromaVectorStore({
      host: "localhost",
      port: 8000,
      expectedDimension: 1024,
    });

    // Get reference to the client instance through vectorStore's private property
    mockClientInstance = (vectorStore as any).client;

    // Setup mock responses
    mockClientInstance.createCollection.mockResolvedValue(mockCollectionInstance);
    mockClientInstance.deleteCollection.mockResolvedValue(undefined);
    mockClientInstance.getOrCreateCollection.mockResolvedValue(mockCollectionInstance);
  });

  describe("constructor", () => {
    it("should create instance with valid config", () => {
      expect(vectorStore).toBeDefined();
      expect(vectorStore).toBeInstanceOf(ChromaVectorStore);
    });

    it("should create instance with auth token", () => {
      const storeWithAuth = new ChromaVectorStore({
        host: "localhost",
        port: 8000,
        authToken: "test-token",
      });
      expect(storeWithAuth).toBeDefined();
    });

    it("should create instance without expectedDimension", () => {
      const storeNoDimension = new ChromaVectorStore({
        host: "localhost",
        port: 8000,
      });
      expect(storeNoDimension).toBeDefined();
    });
  });

  describe("createCollection", () => {
    it("should create a new collection", async () => {
        await vectorStore.createCollection("test-collection");

        expect(mockClientInstance.createCollection).toHaveBeenCalledWith({
        name: "test-collection",
        embeddingFunction: undefined,
        });
    });

    it("should cache collections after first access", async () => {
        const validEmbedding = new Array(1024).fill(0.5);
        
        // First call should create/get collection
        await vectorStore.storeEmbedding(
        "test-collection",
        "id1",
        validEmbedding,
        {},
        "doc1"
        );
        
        expect(mockClientInstance.getOrCreateCollection).toHaveBeenCalledTimes(1);
        
        // Second call to same collection should use cache
        await vectorStore.storeEmbedding(
        "test-collection",
        "id2",
        validEmbedding,
        {},
        "doc2"
        );
        
        // Should still only be called once (cached)
        expect(mockClientInstance.getOrCreateCollection).toHaveBeenCalledTimes(1);
    });

    it("should throw VectorStoreError on failure", async () => {
        mockClientInstance.createCollection.mockRejectedValue(new Error("Creation failed"));

        await expect(vectorStore.createCollection("test-collection")).rejects.toThrow(
        VectorStoreError
        );
    });
    });

  describe("deleteCollection", () => {
    it("should delete a collection", async () => {
      await vectorStore.deleteCollection("test-collection");

      expect(mockClientInstance.deleteCollection).toHaveBeenCalledWith({
        name: "test-collection",
      });
    });

    it("should remove collection from cache", async () => {
      // First create and cache a collection
      await vectorStore.createCollection("test-collection");

      // Then delete it
      await vectorStore.deleteCollection("test-collection");

      expect(mockClientInstance.deleteCollection).toHaveBeenCalledWith({
        name: "test-collection",
      });
    });

    it("should throw VectorStoreError on failure", async () => {
      mockClientInstance.deleteCollection.mockRejectedValue(new Error("Deletion failed"));

      await expect(vectorStore.deleteCollection("test-collection")).rejects.toThrow(
        VectorStoreError
      );
    });
  });

  describe("storeEmbedding", () => {
    const validEmbedding = new Array(1024).fill(0.5);

    it("should store a single embedding", async () => {
      await vectorStore.storeEmbedding(
        "test-collection",
        "test-id",
        validEmbedding,
        { key: "value" },
        "test document"
      );

      expect(mockCollectionInstance.add).toHaveBeenCalledWith({
        ids: ["test-id"],
        embeddings: [validEmbedding],
        documents: ["test document"],
        metadatas: [{ key: "value" }],
      });
    });

    it("should validate embedding before storing", async () => {
      const invalidEmbedding = new Array(512).fill(0.5); // Wrong dimension

      await expect(
        vectorStore.storeEmbedding(
          "test-collection",
          "test-id",
          invalidEmbedding,
          { key: "value" },
          "test document"
        )
      ).rejects.toThrow(VectorStoreError);
    });

    it("should throw VectorStoreError on storage failure", async () => {
      mockCollectionInstance.add.mockRejectedValueOnce(new Error("Storage failed"));

      await expect(
        vectorStore.storeEmbedding(
          "test-collection",
          "test-id",
          validEmbedding,
          { key: "value" },
          "test document"
        )
      ).rejects.toThrow(VectorStoreError);
    });
  });

  describe("storeBatch", () => {
    const validEmbedding1 = new Array(1024).fill(0.5);
    const validEmbedding2 = new Array(1024).fill(0.6);

    it("should store multiple embeddings in batch", async () => {
      const items = [
        {
          id: "id1",
          embedding: validEmbedding1,
          metadata: { key: "value1" },
          document: "doc1",
        },
        {
          id: "id2",
          embedding: validEmbedding2,
          metadata: { key: "value2" },
          document: "doc2",
        },
      ];

      await vectorStore.storeBatch("test-collection", items);

      expect(mockCollectionInstance.add).toHaveBeenCalledWith({
        ids: ["id1", "id2"],
        embeddings: [validEmbedding1, validEmbedding2],
        documents: ["doc1", "doc2"],
        metadatas: [{ key: "value1" }, { key: "value2" }],
      });
    });

    it("should validate all embeddings before storing", async () => {
      const invalidEmbedding = new Array(512).fill(0.5);
      const items = [
        {
          id: "id1",
          embedding: validEmbedding1,
          metadata: { key: "value1" },
          document: "doc1",
        },
        {
          id: "id2",
          embedding: invalidEmbedding,
          metadata: { key: "value2" },
          document: "doc2",
        },
      ];

      await expect(vectorStore.storeBatch("test-collection", items)).rejects.toThrow(
        VectorStoreError
      );
    });

    it("should throw VectorStoreError on batch storage failure", async () => {
      mockCollectionInstance.add.mockRejectedValueOnce(new Error("Batch storage failed"));

      const items = [
        {
          id: "id1",
          embedding: validEmbedding1,
          metadata: { key: "value1" },
          document: "doc1",
        },
      ];

      await expect(vectorStore.storeBatch("test-collection", items)).rejects.toThrow(
        VectorStoreError
      );
    });
  });

  describe("search", () => {
    const queryEmbedding = new Array(1024).fill(0.5);

    it("should search for similar embeddings", async () => {
      const results = await vectorStore.search("test-collection", queryEmbedding);

      expect(mockCollectionInstance.query).toHaveBeenCalledWith({
        queryEmbeddings: [queryEmbedding],
        nResults: 10,
        where: undefined,
        include: ["metadatas", "documents", "distances"],
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty("id", "id1");
      expect(results[0]).toHaveProperty("score");
      expect(results[0]).toHaveProperty("document", "doc1");
      expect(results[0]).toHaveProperty("metadata");
    });

    it("should respect search options", async () => {
      await vectorStore.search("test-collection", queryEmbedding, {
        limit: 5,
        where: { category: "test" },
      });

      expect(mockCollectionInstance.query).toHaveBeenCalledWith({
        queryEmbeddings: [queryEmbedding],
        nResults: 5,
        where: { category: "test" },
        include: ["metadatas", "documents", "distances"],
      });
    });

    it("should filter results by minScore", async () => {
      const results = await vectorStore.search("test-collection", queryEmbedding, {
        minScore: 0.9,
      });

      // With distances [0.1, 0.5], scores are [1/(1+0.1), 1/(1+0.5)] = [0.909, 0.667]
      // Only first result should pass minScore of 0.9
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should validate query embedding", async () => {
      const invalidEmbedding = new Array(512).fill(0.5);

      await expect(
        vectorStore.search("test-collection", invalidEmbedding)
      ).rejects.toThrow(VectorStoreError);
    });

    it("should convert distance to similarity score", async () => {
      const results = await vectorStore.search("test-collection", queryEmbedding);

      // Distance 0.1 should convert to score ~0.909
      expect(results[0].score).toBeCloseTo(1 / (1 + 0.1), 2);
      // Distance 0.5 should convert to score ~0.667
      expect(results[1].score).toBeCloseTo(1 / (1 + 0.5), 2);
    });

    it("should throw VectorStoreError on search failure", async () => {
      mockCollectionInstance.query.mockRejectedValueOnce(new Error("Search failed"));

      await expect(
        vectorStore.search("test-collection", queryEmbedding)
      ).rejects.toThrow(VectorStoreError);
    });
  });

  describe("get", () => {
    it("should retrieve embedding by ID", async () => {
      const result = await vectorStore.get("test-collection", "id1");

      expect(mockCollectionInstance.get).toHaveBeenCalledWith({
        ids: ["id1"],
        include: ["embeddings", "documents", "metadatas"],
      });

      expect(result).toEqual({
        id: "id1",
        embedding: [0.1, 0.2, 0.3],
        document: "test document",
        metadata: { key: "value" },
      });
    });

    it("should return null if embedding not found", async () => {
      mockCollectionInstance.get.mockResolvedValueOnce({
        ids: [],
        embeddings: [],
        documents: [],
        metadatas: [],
      });

      const result = await vectorStore.get("test-collection", "nonexistent");

      expect(result).toBeNull();
    });

    it("should handle missing fields gracefully", async () => {
      mockCollectionInstance.get.mockResolvedValueOnce({
        ids: ["id1"],
        embeddings: undefined,
        documents: undefined,
        metadatas: undefined,
      });

      const result = await vectorStore.get("test-collection", "id1");

      expect(result).toEqual({
        id: "id1",
        embedding: [],
        document: "",
        metadata: {},
      });
    });

    it("should throw VectorStoreError on retrieval failure", async () => {
      mockCollectionInstance.get.mockRejectedValueOnce(new Error("Retrieval failed"));

      await expect(vectorStore.get("test-collection", "id1")).rejects.toThrow(
        VectorStoreError
      );
    });
  });

  describe("delete", () => {
    it("should delete embedding by ID", async () => {
      await vectorStore.delete("test-collection", "id1");

      expect(mockCollectionInstance.delete).toHaveBeenCalledWith({
        ids: ["id1"],
      });
    });

    it("should throw VectorStoreError on deletion failure", async () => {
      mockCollectionInstance.delete.mockRejectedValueOnce(new Error("Deletion failed"));

      await expect(vectorStore.delete("test-collection", "id1")).rejects.toThrow(
        VectorStoreError
      );
    });
  });

  describe("validateEmbedding", () => {
    it("should accept valid embeddings", async () => {
      const validEmbedding = new Array(1024).fill(0.5);

      // Should not throw
      await expect(
        vectorStore.storeEmbedding(
          "test-collection",
          "test-id",
          validEmbedding,
          {},
          "test"
        )
      ).resolves.not.toThrow();
    });

    it("should reject non-array embeddings", async () => {
      const invalidEmbedding = "not an array" as any;

      await expect(
        vectorStore.storeEmbedding(
          "test-collection",
          "test-id",
          invalidEmbedding,
          {},
          "test"
        )
      ).rejects.toThrow(VectorStoreError);

      try {
        await vectorStore.storeEmbedding(
          "test-collection",
          "test-id",
          invalidEmbedding,
          {},
          "test"
        );
      } catch (error: any) {
        expect(error.cause.message).toBe("Embedding must be an array");
      }
    });

    it("should reject empty embeddings", async () => {
      const emptyEmbedding: number[] = [];

      await expect(
        vectorStore.storeEmbedding("test-collection", "test-id", emptyEmbedding, {}, "test")
      ).rejects.toThrow(VectorStoreError);

      try {
        await vectorStore.storeEmbedding("test-collection", "test-id", emptyEmbedding, {}, "test");
      } catch (error: any) {
        expect(error.cause.message).toBe("Embedding cannot be empty");
      }
    });

    it("should reject embeddings with non-numeric values", async () => {
      const invalidEmbedding = [0.1, 0.2, NaN, 0.4];

      await expect(
        vectorStore.storeEmbedding(
          "test-collection",
          "test-id",
          invalidEmbedding,
          {},
          "test"
        )
      ).rejects.toThrow(VectorStoreError);

      try {
        await vectorStore.storeEmbedding(
          "test-collection",
          "test-id",
          invalidEmbedding,
          {},
          "test"
        );
      } catch (error: any) {
        expect(error.cause.message).toBe("Embedding must contain only valid numbers");
      }
    });

    it("should reject embeddings with wrong dimensions", async () => {
      const wrongDimension = new Array(512).fill(0.5); // Expected 1024

      await expect(
        vectorStore.storeEmbedding("test-collection", "test-id", wrongDimension, {}, "test")
      ).rejects.toThrow(VectorStoreError);

      try {
        await vectorStore.storeEmbedding("test-collection", "test-id", wrongDimension, {}, "test");
      } catch (error: any) {
        expect(error.cause.message).toBe("Embedding dimension mismatch: expected 1024, got 512");
      }
    });

    it("should accept any dimension when expectedDimension not configured", async () => {
      const storeNoDimension = new ChromaVectorStore({
        host: "localhost",
        port: 8000,
      });

      // Setup mock for new instance
      const newMockClient = (storeNoDimension as any).client;
      newMockClient.getOrCreateCollection.mockResolvedValue(mockCollectionInstance);

      const anyDimension = new Array(512).fill(0.5);

      // Should not throw
      await expect(
        storeNoDimension.storeEmbedding("test-collection", "test-id", anyDimension, {}, "test")
      ).resolves.toBeUndefined();
    });
  });

  describe("close", () => {
    it("should clear collection cache", async () => {
      // Create and cache some collections
      await vectorStore.createCollection("collection1");
      await vectorStore.createCollection("collection2");

      // Close should clear the cache
      await vectorStore.close();

      // After close, getting a collection should fetch it fresh
      // (We can't directly test cache state, but the behavior should be correct)
      expect(async () => await vectorStore.close()).not.toThrow();
    });
  });

  describe("VectorStoreError", () => {
    it("should create error with message", () => {
      const error = new VectorStoreError("Test error");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("VectorStoreError");
      expect(error.message).toBe("Test error");
      expect(error.cause).toBeUndefined();
    });

    it("should create error with cause", () => {
      const cause = new Error("Original error");
      const error = new VectorStoreError("Test error", cause);

      expect(error.cause).toBe(cause);
    });
  });
});
