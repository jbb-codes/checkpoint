import { randomUUID } from "node:crypto";
import type { Finding } from "../types.js";

export function createFinding(input: Omit<Finding, "id" | "action">): Finding {
  return { id: randomUUID(), action: "no-op", ...input };
}
