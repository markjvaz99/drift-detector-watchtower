import { create } from "zustand";
import { EvidenceIndex } from "../parsing/evidenceIndex";
import type { BuiltRun } from "../parsing/buildRun";
import type { LogFile, Run } from "../types";

export interface SessionState {
  logFiles: LogFile[];
  runs: Run[];
  evidenceIndex: EvidenceIndex;
  pinnedMetricKeys: string[];
  addBuiltRuns: (builtRuns: BuiltRun[]) => void;
  pinMetric: (metricKey: string) => void;
  unpinMetric: (metricKey: string) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  logFiles: [],
  runs: [],
  evidenceIndex: new EvidenceIndex(),
  pinnedMetricKeys: [],

  addBuiltRuns: (builtRuns: BuiltRun[]) => {
    const { logFiles, runs, evidenceIndex } = get();
    const nextLogFiles = [...logFiles];
    const nextRuns = [...runs];
    const startIndex = nextRuns.length;

    builtRuns.forEach((built, offset) => {
      evidenceIndex.register(built.logFile);
      nextLogFiles.push(built.logFile);
      nextRuns.push({ ...built.run, label: `Run ${startIndex + offset + 1}` });
    });

    set({ logFiles: nextLogFiles, runs: nextRuns });
  },

  pinMetric: (metricKey: string) => {
    const { pinnedMetricKeys } = get();
    if (pinnedMetricKeys.includes(metricKey)) return;
    set({ pinnedMetricKeys: [...pinnedMetricKeys, metricKey] });
  },

  unpinMetric: (metricKey: string) => {
    set((state) => ({
      pinnedMetricKeys: state.pinnedMetricKeys.filter((key) => key !== metricKey),
    }));
  },

  reset: () => {
    set({ logFiles: [], runs: [], evidenceIndex: new EvidenceIndex(), pinnedMetricKeys: [] });
  },
}));
