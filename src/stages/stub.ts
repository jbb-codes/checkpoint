import type { StageBackend } from "./types.js";

export const stubBackend: StageBackend = {
  async run() {
    return { status: "passed" };
  },
};
