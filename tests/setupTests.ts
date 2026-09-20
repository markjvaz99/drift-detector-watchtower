import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// jsdom has no ResizeObserver; recharts' <ResponsiveContainer> constructs one
// unconditionally, so without this stub every chart using it throws in tests.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver ??= ResizeObserverStub;
