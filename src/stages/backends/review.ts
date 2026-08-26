import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { Finding, StageBackend } from "../types.js";
import { createFinding } from "./finding.js";

type FileReader = (path: string) => string;

const defaultReadFile: FileReader = (path) => readFileSync(path, "utf-8");

const REVIEW_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\bconsole\.(log|debug)\s*\(/,
    message: "console.log/debug statement found",
  },
  {
    pattern:
      /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i,
    message: "possible hardcoded secret",
  },
];

export function createReviewBackend(
  runner: CommandRunner = defaultCommandRunner,
  readFile: FileReader = defaultReadFile,
): StageBackend {
  return {
    async run(context) {
      const diff = await runner("git", ["diff", "--name-only", "HEAD"], {
        cwd: context.cwd,
      });
      const files = diff.stdout
        .split("\n")
        .map((file) => file.trim())
        .filter(Boolean);

      const findings: Finding[] = [];

      for (const file of files) {
        let content: string;
        try {
          content = readFile(join(context.cwd, file));
        } catch {
          continue;
        }

        content.split("\n").forEach((lineText, index) => {
          for (const rule of REVIEW_RULES) {
            if (rule.pattern.test(lineText)) {
              findings.push(
                createFinding({
                  file,
                  line: index + 1,
                  description: rule.message,
                  severity: "error",
                }),
              );
            }
          }
        });
      }

      return {
        status: findings.length > 0 ? "failed" : "passed",
        findings: findings.length > 0 ? findings : undefined,
      };
    },
  };
}

export const reviewBackend = createReviewBackend();
