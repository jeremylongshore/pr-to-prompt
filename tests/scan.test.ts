import { describe, expect, it } from "vitest";
import { generateSpec } from "../src/core/parsing/pr-parser.js";
import { PromptSpecSchema } from "../src/core/schema/prompt-spec.js";
import type { DiffSource } from "../src/core/sources/types.js";

function makeDiffSource(overrides: Partial<DiffSource> = {}): DiffSource {
	return {
		title: "Branch feat/add-feature vs main",
		body: "Adds a new feature to the middleware.",
		base_ref: "main",
		head_ref: "feat/add-feature",
		author: "developer",
		files: [
			{
				filename: "src/middleware/feature.ts",
				status: "added",
				additions: 50,
				deletions: 0,
				patch: "+export function feature() { return true; }",
			},
			{
				filename: "tests/feature.test.ts",
				status: "added",
				additions: 20,
				deletions: 0,
			},
		],
		commits: 2,
		source_type: "local_branch",
		...overrides,
	};
}

describe("generateSpec with DiffSource (scan mode)", () => {
	it("produces a valid spec from a local DiffSource", () => {
		const source = makeDiffSource();
		const spec = generateSpec(source);
		const result = PromptSpecSchema.safeParse(spec);
		expect(result.success).toBe(true);
	});

	it("sets source_type fields correctly for local branch", () => {
		const source = makeDiffSource();
		const spec = generateSpec(source);
		expect(spec.source.base_branch).toBe("main");
		expect(spec.source.head_branch).toBe("feat/add-feature");
		expect(spec.source.author).toBe("developer");
		expect(spec.source.pr_number).toBeUndefined();
		expect(spec.source.pr_url).toBeUndefined();
	});

	it("uses 'local' as default repo when none provided", () => {
		const source = makeDiffSource();
		const spec = generateSpec(source);
		expect(spec.source.repo).toBe("local");
	});

	it("uses provided repo when given", () => {
		const source = makeDiffSource({ repo: "owner/repo", source_type: "github_pr" });
		const spec = generateSpec(source, "owner/repo");
		expect(spec.source.repo).toBe("owner/repo");
	});

	it("computes stats from files", () => {
		const source = makeDiffSource();
		const spec = generateSpec(source);
		expect(spec.stats.files_changed).toBe(2);
		expect(spec.stats.additions).toBe(70);
		expect(spec.stats.deletions).toBe(0);
		expect(spec.stats.commits).toBe(2);
	});

	it("infers feature change type from branch name", () => {
		const source = makeDiffSource();
		const spec = generateSpec(source);
		expect(spec.intent.change_type).toBe("feature");
	});

	it("generates a non-empty generation prompt", () => {
		const source = makeDiffSource();
		const spec = generateSpec(source);
		expect(spec.generation_prompt.length).toBeGreaterThan(50);
	});

	it("correctly identifies affected files", () => {
		const source = makeDiffSource();
		const spec = generateSpec(source);
		expect(spec.affected_files).toHaveLength(2);
		expect(spec.affected_files[0].filename).toBe("src/middleware/feature.ts");
	});

	it("handles zero commits for staged diff source", () => {
		const source = makeDiffSource({ commits: undefined, source_type: "local_staged" });
		const spec = generateSpec(source);
		expect(spec.stats.commits).toBe(0);
	});

	it("returns high-risk flag for auth file changes", () => {
		const source = makeDiffSource({
			files: [
				{
					filename: "src/auth/login.ts",
					status: "modified",
					additions: 20,
					deletions: 5,
				},
			],
		});
		const spec = generateSpec(source);
		const hasHighRisk = spec.risk_flags.some((r) => r.severity === "high");
		expect(hasHighRisk).toBe(true);
	});

	it("returns no high-risk flag for doc changes", () => {
		const source = makeDiffSource({
			files: [
				{
					filename: "README.md",
					status: "modified",
					additions: 10,
					deletions: 2,
				},
			],
		});
		const spec = generateSpec(source);
		const hasHighRisk = spec.risk_flags.some((r) => r.severity === "high");
		expect(hasHighRisk).toBe(false);
	});
});
