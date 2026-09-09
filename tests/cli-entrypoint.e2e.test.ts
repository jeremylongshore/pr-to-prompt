import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

beforeAll(() => {
	execFileSync("pnpm", ["build"], { cwd: repoRoot, stdio: "pipe" });
}, 30_000);

describe("CLI entrypoint", () => {
	it("runs local subcommands without GitHub PR options", () => {
		const fixture = mkdtempSync(join(tmpdir(), "pr-to-spec-local-"));
		execFileSync("git", ["init", "--quiet"], { cwd: fixture });
		execFileSync("git", ["config", "user.name", "Test Operator"], { cwd: fixture });

		const result = spawnSync(
			process.execPath,
			[resolve(repoRoot, "dist/cli/index.js"), "scan", "--staged", "--json"],
			{ cwd: fixture, encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		expect(result.stderr).not.toContain("required option '--repo");
		expect(result.stderr).not.toContain("required option '--pr");
	});
});
