export interface WorkingDirectoryComparisonResult {
  sameDirectory: boolean;
  description: string;
}

export function compareWorkingDirectory(a: string, b: string): WorkingDirectoryComparisonResult {
  const sameDirectory = a.length > 0 && a === b;
  return {
    sameDirectory,
    description: sameDirectory ? "same project path" : "different project path",
  };
}
