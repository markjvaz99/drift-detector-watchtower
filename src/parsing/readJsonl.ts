export function parseJsonlText(text: string): unknown[] {
  const records: unknown[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    records.push(JSON.parse(trimmed));
  }
  return records;
}

export async function readJsonlFile(file: File | Blob): Promise<unknown[]> {
  const text = await file.text();
  return parseJsonlText(text);
}
