/**
 * Quick diagnostic: What content does the agent actually pass to the analyzer?
 *
 * This simulates the agent's parameter extraction logic without running the full agent.
 */

// Simulate what working memory might look like after a web_search
const mockWorkingMemory = {
  recentOutcomes: [
    {
      success: true,
      result: {
        results: [
          {
            title: "Quantum Computing in 2025",
            url: "https://example.com/quantum1",
            content: "Quantum computers use qubits. They are very powerful.",
            snippet: "Brief overview of quantum computing"
          },
          {
            title: "IBM Quantum Systems",
            url: "https://example.com/ibm",
            content: "IBM has deployed 127-qubit systems.",
            snippet: "IBM's quantum computer specs"
          }
        ]
      }
    }
  ],
  keyFindings: []
};

// This is the EXACT logic from reasoning.ts extractParameters for content_analyzer
const fetchedContent = mockWorkingMemory.recentOutcomes
  .filter((o: any) => o.success && o.result?.content)
  .map((o: any) => o.result.content)
  .join('\n\n---\n\n');

const searchSnippets = mockWorkingMemory.recentOutcomes
  .filter((o: any) => o.success && o.result?.results && Array.isArray(o.result.results))
  .flatMap((o: any) => o.result.results)
  .map((r: any) => {
    const title = r.title || '';
    const snippet = r.content || r.snippet || r.description || '';
    return title && snippet ? `${title}\n${snippet}` : snippet;
  })
  .filter(Boolean)
  .join('\n\n---\n\n');

const combinedContent = [fetchedContent, searchSnippets]
  .filter(Boolean)
  .join('\n\n========\n\n');

const content = combinedContent || mockWorkingMemory.keyFindings.map((f: any) => f.content).join('\n\n');

console.log('=== CONTENT THAT WOULD BE PASSED TO ANALYZER ===\n');
console.log('fetchedContent length:', fetchedContent.length);
console.log('searchSnippets length:', searchSnippets.length);
console.log('combinedContent length:', combinedContent.length);
console.log('\nActual content:\n');
console.log(content);
console.log('\n=== END ===');
console.log('\nDIAGNOSIS:');

if (content.length < 100) {
  console.log('❌ PROBLEM: Content is too short (< 100 chars)');
  console.log('   The analyzer needs substantial content to extract facts.');
  console.log('   Solution: Agent must call web_fetch to get full page content, not just snippets.');
} else if (content.length < 500) {
  console.log('⚠️  WARNING: Content is short (< 500 chars)');
  console.log('   May not have enough substantive information for fact extraction.');
  console.log('   Consider adding web_fetch calls for fuller content.');
} else {
  console.log('✅ Content length looks reasonable');
  console.log('   Should be sufficient for fact extraction.');
}
