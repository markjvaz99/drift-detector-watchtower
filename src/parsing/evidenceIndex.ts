import type { EvidenceReference, LogFile, OrderedEvent } from "../types";

export class EvidenceIndex {
  private logFilesById = new Map<string, LogFile>();

  register(logFile: LogFile): void {
    this.logFilesById.set(logFile.id, logFile);
  }

  resolve(ref: EvidenceReference): OrderedEvent | null {
    const logFile = this.logFilesById.get(ref.logFileId);
    if (!logFile) return null;
    return logFile.events.find((event) => event.sequence === ref.sequence) ?? null;
  }
}
