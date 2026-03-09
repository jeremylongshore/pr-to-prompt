import { describe, expect, it } from "vitest";
import { PromptSpecSchema } from "../src/core/schema/prompt-spec.js";

const VALID_SPEC = {
	version: 1 as const,
	generated_at: "2025-01-15T10:30:00.000Z",
	source: {
		repo: "owner/repo",
		pr_number: 42,
		pr_url: "https://github.com/owner/repo/pull/42",
		base_branch: "main",
		head_branch: "feature/add-rate-limiting",
		author: "contributor",
	},
	title: "Add rate limiting middleware",
	summary:
		'Feature PR by @contributor: "Add rate limiting middleware" — 3 files changed (+150/-10)',
	intent: {
		likely_goal: "Add tenant-aware API rate limiting to public routes",
		change_type: "feature" as const,
	},
	scope: {
		include: ["src/middleware/**", "src/routes/**"],
		exclude: ["auth provider changes"],
	},
	affected_files: [
		{
			filename: "src/middleware/rateLimit.ts",
			status: "added" as const,
			additions: 100,
			deletions: 0,
		},
		{ filename: "src/routes/api.ts", status: "modified" as const, additions: 30, deletions: 5 },
		{ filename: "tests/rateLimit.test.ts", status: "added" as const, additions: 20, deletions: 5 },
	],
	constraints: ["Preserve existing auth behavior", "Do not rate limit admin routes"],
	acceptance_criteria: [
		"Public routes enforce per-tenant rate limits",
		"Returns 429 on limit exceeded",
		"Existing tests pass",
	],
	verification: {
		tests_required: ["unit", "integration"],
		manual_checks: ["Verify API endpoint behavior manually"],
	},
	risk_flags: [
		{
			category: "security-headers",
			description: "Changes to middleware (src/middleware/rateLimit.ts)",
			severity: "medium" as const,
		},
	],
	open_questions: ["Should limits be configurable per plan?"],
	generation_prompt: "Re-implement this change...",
	stats: {
		files_changed: 3,
		additions: 150,
		deletions: 10,
		commits: 2,
	},
};

describe("PromptSpecSchema", () => {
	it("validates a correct spec", () => {
		const result = PromptSpecSchema.safeParse(VALID_SPEC);
		expect(result.success).toBe(true);
	});

	it("rejects invalid version", () => {
		const result = PromptSpecSchema.safeParse({ ...VALID_SPEC, version: 2 });
		expect(result.success).toBe(false);
	});

	it("rejects missing required fields", () => {
		const { title: _, ...noTitle } = VALID_SPEC;
		const result = PromptSpecSchema.safeParse(noTitle);
		expect(result.success).toBe(false);
	});

	it("rejects invalid change_type", () => {
		const result = PromptSpecSchema.safeParse({
			...VALID_SPEC,
			intent: { ...VALID_SPEC.intent, change_type: "invalid" },
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid severity", () => {
		const result = PromptSpecSchema.safeParse({
			...VALID_SPEC,
			risk_flags: [{ category: "test", description: "test", severity: "critical" }],
		});
		expect(result.success).toBe(false);
	});

	it("accepts spec with empty arrays", () => {
		const result = PromptSpecSchema.safeParse({
			...VALID_SPEC,
			risk_flags: [],
			open_questions: [],
			constraints: [],
		});
		expect(result.success).toBe(true);
	});

	it("validates file status enum", () => {
		const result = PromptSpecSchema.safeParse({
			...VALID_SPEC,
			affected_files: [{ filename: "test.ts", status: "deleted", additions: 0, deletions: 10 }],
		});
		expect(result.success).toBe(false);
	});
});
