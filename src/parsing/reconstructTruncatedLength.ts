const TRUNCATION_MARKER = /\.\.\.\[truncated: original length (\d+)\]$/;

export function reconstructTrueLength(content: string): number {
  const match = TRUNCATION_MARKER.exec(content);
  if (match) {
    return Number(match[1]);
  }
  return content.length;
}

export function isTruncated(content: string): boolean {
  return TRUNCATION_MARKER.test(content);
}
