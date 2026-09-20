// Synthetic fixtures (and the schema originally assumed) use a marker that
// directly states the total original length.
const TOTAL_LENGTH_MARKER = /\.\.\.\[truncated: original length (\d+)\]$/;

// Real Claude Code telemetry instead appends "…[N chars]" (a Unicode
// ellipsis) stating how many MORE characters were cut beyond what's visible —
// the true length is the visible prefix (excluding the marker itself) plus N.
const REMAINING_CHARS_MARKER = /…\[(\d+) chars\]$/;

export function reconstructTrueLength(content: string): number {
  const totalMatch = TOTAL_LENGTH_MARKER.exec(content);
  if (totalMatch) {
    return Number(totalMatch[1]);
  }

  const remainingMatch = REMAINING_CHARS_MARKER.exec(content);
  if (remainingMatch) {
    const visiblePrefixLength = content.length - remainingMatch[0].length;
    return visiblePrefixLength + Number(remainingMatch[1]);
  }

  return content.length;
}

export function isTruncated(content: string): boolean {
  return TOTAL_LENGTH_MARKER.test(content) || REMAINING_CHARS_MARKER.test(content);
}
