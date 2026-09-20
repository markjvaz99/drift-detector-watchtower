import { buildRunFromText } from "../parsing/buildRun";

export interface ParseWorkerRequest {
  fileName: string;
  text: string;
}

self.onmessage = (event: MessageEvent<ParseWorkerRequest>) => {
  const { fileName, text } = event.data;
  try {
    const builtRun = buildRunFromText(fileName, text);
    (self as unknown as Worker).postMessage({ ok: true, builtRun });
  } catch (error) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
