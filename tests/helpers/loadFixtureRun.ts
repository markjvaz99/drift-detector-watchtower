import { readFileSync } from "node:fs";
import { buildRunFromText } from "../../src/parsing/buildRun";

export function loadFixtureRun(fixtureRelativePath: string, label: string) {
  const text = readFileSync(fixtureRelativePath, "utf8");
  const built = buildRunFromText(fixtureRelativePath, text);
  built.run.label = label;
  return built;
}
