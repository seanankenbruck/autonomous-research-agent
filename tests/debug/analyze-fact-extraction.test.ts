/**
 * Debug Test: Analyze Tool Fact Extraction
 *
 * This test diagnoses why the analyze tool is returning 0 facts.
 * It uses real API calls to see what the LLM actually returns.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createAnalyzeTool } from '../../src/tools/analyze';
import { LLMClient } from '../../src/llm/client';
import { createLogger } from '../../src/utils/logger';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

describe('Analyze Tool Fact Extraction Debug', () => {
  let analyzeTool: ReturnType<typeof createAnalyzeTool>;
  let logger: ReturnType<typeof createLogger>;

  beforeAll(() => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY required for this debug test');
    }

    logger = createLogger({ level: 'debug' });
    const llmClient = new LLMClient({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      defaultModel: 'claude-sonnet-4-5-20250929',
    });

    analyzeTool = createAnalyzeTool(
      {
        enabled: true,
        llmModel: 'claude-sonnet-4-5-20250929',
        maxTokens: 4000,
        temperature: 0.3,
      },
      llmClient
    );
  });

  it('should extract facts from quantum computing content', async () => {
    // Sample content similar to what the agent would analyze
    const sampleContent = `
Quantum Computing in 2025

Quantum computers leverage quantum mechanical phenomena like superposition and entanglement
to process information. Unlike classical computers that use bits (0 or 1), quantum computers
use qubits that can exist in multiple states simultaneously.

IBM has deployed several quantum computers accessible via cloud, with their latest system
featuring 127 qubits. Google achieved quantum supremacy in 2019 with their Sycamore processor,
performing a calculation in 200 seconds that would take classical supercomputers 10,000 years.

Current applications include:
- Drug discovery and molecular simulation
- Cryptography and security
- Financial modeling and optimization
- Machine learning acceleration

Major challenges remain: qubits are extremely fragile and require near-absolute-zero temperatures
to operate. Error rates are still too high for practical applications, though error correction
techniques are improving.
    `.trim();

    const result = await analyzeTool.execute(
      {
        content: sampleContent,
        analysisType: 'extract',
        extractionTargets: {
          facts: true,
          entities: true,
          keyPhrases: true,
          concepts: true,
        },
      },
      {
        logger,
        sessionId: 'test-session',
      }
    );

    console.log('\n=== ANALYZE TOOL RESULT ===');
    console.log('Success:', result.success);
    console.log('Facts extracted:', result.data?.facts?.length || 0);

    if (result.data?.facts && result.data.facts.length > 0) {
      console.log('\nExtracted Facts:');
      result.data.facts.forEach((fact: any, i: number) => {
        console.log(`${i + 1}. "${fact.statement}" (confidence: ${fact.confidence})`);
      });
    } else {
      console.log('\n❌ NO FACTS EXTRACTED!');
      console.log('This is the bug - the LLM should extract facts from this content.');
    }

    if (result.data?.entities) {
      console.log('\nEntities found:', result.data.entities.length);
    }
    if (result.data?.concepts) {
      console.log('Concepts found:', result.data.concepts.length);
    }
    if (result.data?.keyPhrases) {
      console.log('Key phrases found:', result.data.keyPhrases.length);
    }

    // The test itself - we expect facts to be extracted
    expect(result.success).toBe(true);
    expect(result.data?.facts).toBeDefined();

    // This is what we're debugging - facts should be > 0
    if (result.data && result.data.facts && result.data.facts.length === 0) {
      console.log('\n⚠️  BUG CONFIRMED: Analyze tool returned 0 facts from valid content');
    }
  }, 30000); // 30 second timeout for API call
});
