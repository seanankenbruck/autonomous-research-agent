/**
 * Test: Verify URL Extraction for web_fetch
 *
 * This verifies that web_fetch can extract valid URLs from search results.
 */

import { WorkingMemory } from '../../src/agent/types';

// Simulate working memory with search results
const mockWorkingMemory: any = {
  recentActions: [],
  recentOutcomes: [
    {
      actionId: 'search-1',
      success: true,
      result: {
        results: [
          {
            title: 'Quantum Computing - Wikipedia',
            url: 'https://en.wikipedia.org/wiki/Quantum_computing',
            snippet: 'Quantum computing is...'
          },
          {
            title: 'IBM Quantum',
            url: 'https://www.ibm.com/quantum',
            snippet: 'IBM Quantum systems...'
          },
          {
            title: 'Google Quantum AI',
            url: 'https://quantumai.google/',
            snippet: 'Google Quantum AI...'
          },
        ]
      },
      observations: ['Found 3 results'],
      duration: 1000,
      metadata: {},
      timestamp: new Date(),
    },
  ],
  keyFindings: [],
};

// This is the EXACT logic from reasoning.ts for web_fetch parameter extraction
const searchResults = mockWorkingMemory.recentOutcomes
  .filter((o: any) => o.success && o.result?.results && Array.isArray(o.result.results))
  .flatMap((o: any) => o.result.results);

const fetchedUrls = new Set(
  mockWorkingMemory.recentOutcomes
    .filter((o: any) => o.success && o.result?.url)
    .map((o: any) => o.result.url)
);

const urlToFetch = searchResults
  .map((r: any) => r.url)
  .filter((url: string) => url && !fetchedUrls.has(url))[0];

console.log('=== URL EXTRACTION TEST ===\n');
console.log('Search results found:', searchResults.length);
console.log('URLs available:', searchResults.map((r: any) => r.url));
console.log('Already fetched URLs:', Array.from(fetchedUrls));
console.log('Selected URL to fetch:', urlToFetch);
console.log('\n=== VALIDATION ===');

if (urlToFetch) {
  try {
    new URL(urlToFetch);
    console.log('✅ URL is valid and can be fetched');
    console.log('✅ web_fetch should succeed with this URL');
  } catch (error) {
    console.log('❌ URL is invalid:', error);
  }
} else {
  console.log('❌ No URL extracted!');
  console.log('   This means web_fetch will fail with validation error');
  console.log('   Possible causes:');
  console.log('   - No search results in working memory');
  console.log('   - Search results have no URLs');
  console.log('   - All URLs already fetched');
}
