let installed = false;

export class NetworkEgressAttemptedError extends Error {
  constructor(mechanism: string) {
    super(
      `Network egress attempted via ${mechanism} — ingestion/analysis must run entirely on-device (FR-30).`,
    );
    this.name = "NetworkEgressAttemptedError";
  }
}

export function installNetworkEgressGuard(): void {
  if (installed) return;
  installed = true;

  if (typeof globalThis.fetch === "function") {
    globalThis.fetch = (): never => {
      throw new NetworkEgressAttemptedError("fetch");
    };
  }

  if (typeof XMLHttpRequest !== "undefined") {
    XMLHttpRequest.prototype.open = function guardedOpen(): void {
      throw new NetworkEgressAttemptedError("XMLHttpRequest");
    } as typeof XMLHttpRequest.prototype.open;
  }
}

export function isNetworkEgressGuardInstalled(): boolean {
  return installed;
}
