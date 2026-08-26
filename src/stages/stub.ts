import type { StageBackend } from "./types.js";

export const stubBackend: StageBackend = {
  // eslint-disable-next-line @typescript-eslint/require-await -- must satisfy StageBackend.run's async contract, matching real backends
  async run() {
    return { status: "passed" };
  },
};
