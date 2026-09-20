import type { FlatRecord } from "./flattenLogRecords";
import type { OrderedEvent } from "../types";

export function sequenceEvents(records: FlatRecord[]): OrderedEvent[] {
  const sorted = [...records].sort((a, b) => a.sequence - b.sequence);
  return sorted.map((record) => ({
    sequence: record.sequence,
    timestamp: record.timestamp,
    type: record.name,
    queryType:
      typeof record.attributes["query_source"] === "string"
        ? (record.attributes["query_source"] as string)
        : null,
    attributes: record.attributes,
  }));
}
