const STOPWORDS = new Set([
  "a", "an", "the", "this", "that", "and", "or", "to", "of", "in", "on", "for",
  "with", "is", "are", "it", "be", "as", "at", "by", "we", "our", "please",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const freqs = new Map<string, number>();
  for (const token of tokens) {
    freqs.set(token, (freqs.get(token) ?? 0) + 1);
  }
  return freqs;
}

export function computePromptSimilarity(promptA: string, promptB: string): number {
  const freqA = termFrequencies(tokenize(promptA));
  const freqB = termFrequencies(tokenize(promptB));
  if (freqA.size === 0 || freqB.size === 0) return 0;

  const allTerms = new Set([...freqA.keys(), ...freqB.keys()]);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const term of allTerms) {
    const a = freqA.get(term) ?? 0;
    const b = freqB.get(term) ?? 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
