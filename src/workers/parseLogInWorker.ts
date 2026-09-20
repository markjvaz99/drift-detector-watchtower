import type { BuiltRun } from "../parsing/buildRun";
import type { ParseWorkerRequest } from "./parseLogWorker";

export function parseLogInWorker(file: File): Promise<BuiltRun> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parseLogWorker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<{ ok: boolean; builtRun?: BuiltRun; error?: string }>) => {
      worker.terminate();
      if (event.data.ok && event.data.builtRun) {
        resolve(event.data.builtRun);
      } else {
        reject(new Error(event.data.error ?? "Unknown parsing error"));
      }
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };
    file.text().then((text) => {
      const request: ParseWorkerRequest = { fileName: file.name, text };
      worker.postMessage(request);
    });
  });
}
