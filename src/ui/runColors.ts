const RUN_COLORS = [
  "var(--run-a)",
  "var(--run-b)",
  "var(--run-c)",
  "var(--run-d)",
  "var(--run-e)",
];

export function runColor(index: number): string {
  return RUN_COLORS[index % RUN_COLORS.length];
}
