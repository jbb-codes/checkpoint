import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { Finding, StageBackend } from "../types.js";
import { createFinding } from "./finding.js";

const CONFIG_MISSING_EXIT_CODE = 2;

interface EslintMessage {
  line: number;
  message: string;
  severity: number;
}

interface EslintFileReport {
  filePath: string;
  messages: EslintMessage[];
}

function parseEslintReport(stdout: string): Finding[] {
  let report: EslintFileReport[];
  try {
    report = JSON.parse(stdout) as EslintFileReport[];
  } catch {
    return [];
  }

  return report.flatMap((file) =>
    file.messages.map((message) =>
      createFinding({
        file: file.filePath,
        line: message.line,
        description: message.message,
        severity: message.severity === 2 ? "error" : "warning",
      }),
    ),
  );
}

export function createLintBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const result = await runner(
        "npx",
        ["--yes", "eslint", ".", "--format", "json"],
        { cwd: context.cwd },
      );

      if (result.code === CONFIG_MISSING_EXIT_CODE) {
        return { status: "passed" };
      }

      const findings = parseEslintReport(result.stdout);

      return {
        status: result.code === 0 ? "passed" : "failed",
        findings: findings.length > 0 ? findings : undefined,
      };
    },
  };
}

export const lintBackend = createLintBackend();
