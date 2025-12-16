/**
 * Database Initialization Script
 * Sets up SQLite database and verifies Chroma connection
 */

import { config } from "dotenv";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { SQLiteDocumentStore } from "../src/memory/stores/document-store";
import { ChromaClient } from "chromadb";

// Load environment variables
config();

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || "./storage/sqlite/agent.db";
const CHROMA_HOST = process.env.CHROMA_HOST || "localhost";
const CHROMA_PORT = parseInt(process.env.CHROMA_PORT || "8000");
const CHROMA_AUTH_TOKEN = process.env.CHROMA_AUTH_TOKEN;

async function initializeDatabase() {
  console.log("🔧 Initializing Autonomous Research Agent Database...\n");

  // Step 1: Ensure storage directory exists
  console.log("📁 Creating storage directories...");
  try {
    const dbDir = resolve(SQLITE_DB_PATH, "..");
    mkdirSync(dbDir, { recursive: true });
    console.log(`   ✓ SQLite directory: ${dbDir}`);
  } catch (error) {
    console.error("   ✗ Failed to create storage directory:", error);
    process.exit(1);
  }

  // Step 2: Initialize SQLite database
  console.log("\n📊 Initializing SQLite database...");
  try {
    const documentStore = new SQLiteDocumentStore(SQLITE_DB_PATH);
    console.log(`   ✓ Database created at: ${SQLITE_DB_PATH}`);
    console.log("   ✓ Schema initialized:");
    console.log("     - sessions table");
    console.log("     - episodes table");
    console.log("     - semantic_facts table");
    console.log("     - strategies table");
    console.log("     - user_feedback table");
    
    // Test basic operations
    const sessions = await documentStore.listSessions();
    console.log(`   ✓ Database operational (${sessions.length} existing sessions)`);
    
    await documentStore.close();
  } catch (error) {
    console.error("   ✗ Failed to initialize SQLite:", error);
    process.exit(1);
  }

  // Step 3: Test Chroma connection
  console.log("\n🔍 Testing Chroma vector store connection...");
  try {
    const chromaClient = new ChromaClient({
      path: `http://${CHROMA_HOST}:${CHROMA_PORT}`,
      auth: CHROMA_AUTH_TOKEN ? {
        provider: "token",
        credentials: CHROMA_AUTH_TOKEN,
      } : undefined,
    });

    // Test connection
    const heartbeat = await chromaClient.heartbeat();
    console.log(`   ✓ Chroma is healthy (heartbeat: ${heartbeat}ms)`);

    // List existing collections
    const collections = await chromaClient.listCollections();
    console.log(`   ✓ Found ${collections.length} existing collections`);

    // Create default collections if they don't exist
    const defaultCollections = [
      "episodic_memory",
      "semantic_memory",
      "procedural_memory"
    ];

    for (const collectionName of defaultCollections) {
      try {
        await chromaClient.getCollection({ name: collectionName });
        console.log(`   ✓ Collection '${collectionName}' already exists`);
      } catch (error) {
        // Collection doesn't exist, create it
        await chromaClient.createCollection({
          name: collectionName,
          metadata: { 
            description: `${collectionName.replace('_', ' ')} storage`,
            created_at: new Date().toISOString()
          },
        });
        console.log(`   ✓ Created collection '${collectionName}'`);
      }
    }
  } catch (error: any) {
    console.error("   ✗ Failed to connect to Chroma:", error.message);
    console.error("\n⚠️  Make sure Chroma is running:");
    console.error("     docker-compose up chroma");
    console.error("     or: make start");
    process.exit(1);
  }

  // Step 4: Seed initial strategies (optional)
  console.log("\n🌱 Seeding initial research strategies...");
  try {
    const documentStore = new SQLiteDocumentStore(SQLITE_DB_PATH);
    
    const existingStrategies = await documentStore.listStrategies();
    
    if (existingStrategies.length === 0) {
      // Seed default strategies
      const defaultStrategies = [
        {
          id: "strategy-broad-then-deep",
          strategyName: "Broad Then Deep",
          description: "Start with broad overview search, then dive deep into specific subtopics",
          applicableContexts: ["general_research", "exploratory", "learning"],
          requiredTools: ["search", "fetch", "analyze"],
          successRate: 0.75,
          averageDuration: 300, // 5 minutes
          timesUsed: 0,
          refinements: [],
          createdAt: new Date(),
          lastRefined: new Date(),
        },
        {
          id: "strategy-verify-first",
          strategyName: "Verify First",
          description: "Prioritize finding authoritative sources and fact-checking before deep analysis",
          applicableContexts: ["fact_checking", "controversial_topics", "high_stakes"],
          requiredTools: ["search", "fetch", "verify"],
          successRate: 0.85,
          averageDuration: 400, // 6.7 minutes
          timesUsed: 0,
          refinements: [],
          createdAt: new Date(),
          lastRefined: new Date(),
        },
        {
          id: "strategy-comparative-analysis",
          strategyName: "Comparative Analysis",
          description: "Gather multiple perspectives and compare/contrast different viewpoints",
          applicableContexts: ["debate", "comparison", "decision_making"],
          requiredTools: ["search", "fetch", "analyze", "synthesize"],
          successRate: 0.70,
          averageDuration: 450, // 7.5 minutes
          timesUsed: 0,
          refinements: [],
          createdAt: new Date(),
          lastRefined: new Date(),
        },
        {
          id: "strategy-timeline-based",
          strategyName: "Timeline Based",
          description: "Research chronologically to understand evolution and development over time",
          applicableContexts: ["historical", "trends", "evolution"],
          requiredTools: ["search", "fetch", "analyze"],
          successRate: 0.68,
          averageDuration: 350, // 5.8 minutes
          timesUsed: 0,
          refinements: [],
          createdAt: new Date(),
          lastRefined: new Date(),
        },
      ];

      for (const strategy of defaultStrategies) {
        await documentStore.storeStrategy(strategy);
      }
      
      console.log(`   ✓ Seeded ${defaultStrategies.length} default strategies`);
    } else {
      console.log(`   ✓ Found ${existingStrategies.length} existing strategies (skipping seed)`);
    }
    
    await documentStore.close();
  } catch (error) {
    console.error("   ✗ Failed to seed strategies:", error);
    // Non-fatal - continue
  }

  // Success!
  console.log("\n✅ Database initialization complete!\n");
  console.log("Next steps:");
  console.log("  1. Update .env with your API keys");
  console.log("  2. Run: npm run dev");
  console.log("  3. Or run tests: npm test\n");
}

// Run initialization
initializeDatabase().catch((error) => {
  console.error("\n❌ Initialization failed:", error);
  process.exit(1);
});