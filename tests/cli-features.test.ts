import { describe, expect, it } from "vitest";
import type { PRData } from "../src/core/github/client.js";
import { generateSpecFromPR } from "../src/core/parsing/pr-parser.js";
import { renderJson } from "../src/core/rendering/json.js";

function makePR(overrides: Partial<PRData> = {}): PRData {
	return {
		number: 42,
		title: "feat: add rate limiting",
		body: "Add tenant-aware rate limiting to public API routes.\n\nThis prevents abuse.",
		url: "https://github.com/owner/repo/pull/42",
		base_branch: "main",
		head_branch: "feat/rate-limiting",
		author: "contributor",
		state: "open",
		commits: 3,
		additions: 150,
		deletions: 20,
		changed_files: 3,
		labels: [],
		linked_issues: [],
		review_comments: [],
		reviews: [],
		files: [
			{
				filename: "src/middleware/rateLimit.ts",
				status: "added",
				additions: 100,
				deletions: 0,
				patch: "+export function rateLimit() {}",
			},
			{
				filename: "src/routes/api.ts",
				status: "modified",
				additions: 30,
				deletions: 10,
			},
			{
				filename: "tests/rateLimit.test.ts",
				status: "added",
				additions: 20,
				deletions: 10,
			},
		],
		...overrides,
	};
}

describe("renderJson", () => {
	it("produces valid JSON string", () => {
		const spec = generateSpecFromPR(makePR(), "owner/repo");
		const json = renderJson(spec);
		const parsed = JSON.parse(json);
		expect(parsed.version).toBe(1);
	});

	it("contains key fields", () => {
		const spec = generateSpecFromPR(makePR(), "owner/repo");
		const json = renderJson(spec);
		const parsed = JSON.parse(json);
		expect(parsed.source.repo).toBe("owner/repo");
		expect(parsed.source.pr_number).toBe(42);
		expect(parsed.title).toBe("feat: add rate limiting");
	});

	it("does not contain patch data", () => {
		const spec = generateSpecFromPR(makePR(), "owner/repo");
		const json = renderJson(spec);
		expect(json).not.toContain("export function rateLimit");
	});

	it("round-trips through schema validation", () => {
		const spec = generateSpecFromPR(makePR(), "owner/repo");
		const json = renderJson(spec);
		const parsed = JSON.parse(json);
		expect(parsed.version).toBe(1);
		expect(parsed.stats.files_changed).toBe(3);
		expect(Array.isArray(parsed.risk_flags)).toBe(true);
		expect(Array.isArray(parsed.affected_files)).toBe(true);
	});
});

describe("extractField (via spec structure)", () => {
	it("can access top-level fields", () => {
		const spec = generateSpecFromPR(makePR(), "owner/repo");
		expect(spec.title).toBe("feat: add rate limiting");
		expect(spec.version).toBe(1);
	});

	it("can access nested fields", () => {
		const spec = generateSpecFromPR(makePR(), "owner/repo");
		expect(spec.source.author).toBe("contributor");
		expect(spec.intent.change_type).toBe("feature");
	});

	it("risk_flags is an array", () => {
		const spec = generateSpecFromPR(makePR(), "owner/repo");
		expect(Array.isArray(spec.risk_flags)).toBe(true);
	});

	it("stats contains expected values", () => {
		const spec = generateSpecFromPR(makePR(), "owner/repo");
		expect(spec.stats.files_changed).toBe(3);
		expect(spec.stats.additions).toBe(150);
	});
});

describe("exit code behavior", () => {
	it("no high-risk flags for safe PR", () => {
		const spec = generateSpecFromPR(
			makePR({
				files: [
					{
						filename: "README.md",
						status: "modified",
						additions: 5,
						deletions: 2,
					},
				],
			}),
			"owner/repo",
		);
		const hasHighRisk = spec.risk_flags.some((r) => r.severity === "high");
		expect(hasHighRisk).toBe(false);
	});

	it("high-risk flags for auth changes", () => {
		const spec = generateSpecFromPR(
			makePR({
				files: [
					{
						filename: "src/auth/login.ts",
						status: "modified",
						additions: 30,
						deletions: 10,
					},
				],
			}),
			"owner/repo",
		);
		const hasHighRisk = spec.risk_flags.some((r) => r.severity === "high");
		expect(hasHighRisk).toBe(true);
	});
});
