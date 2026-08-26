import { pathToFileURL } from "node:url";
import type { StageBackend } from "./types.js";

function isStageBackend(value: unknown): value is StageBackend {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { run?: unknown }).run === "function"
  );
}

export async function loadStageBackend(
  scriptPath: string,
): Promise<StageBackend> {
  const module: unknown = await import(pathToFileURL(scriptPath).href);
  const candidate = (module as { default?: unknown }).default;

  if (!isStageBackend(candidate)) {
    throw new Error(
      `checkpoint: backend script "${scriptPath}" does not satisfy StageBackend (missing default export with a run() function)`,
    );
  }

  return candidate;
}
