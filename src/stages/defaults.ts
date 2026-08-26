import { ciBackend } from "./backends/ci.js";
import { lintBackend } from "./backends/lint.js";
import { prBackend } from "./backends/pr.js";
import { pushBackend } from "./backends/push.js";
import { reviewBackend } from "./backends/review.js";
import { testBackend } from "./backends/test.js";
import { stubBackend } from "./stub.js";
import type { StageBackend, StageName } from "./types.js";

const DEFAULT_BACKENDS: Partial<Record<StageName, StageBackend>> = {
  review: reviewBackend,
  test: testBackend,
  lint: lintBackend,
  push: pushBackend,
  PR: prBackend,
  CI: ciBackend,
};

export function getDefaultBackend(stage: StageName): StageBackend {
  return DEFAULT_BACKENDS[stage] ?? stubBackend;
}
