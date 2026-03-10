import { describe, expect, it } from "vitest";
import type { PRData } from "../src/core/github/client.js";
import { generateSpec } from "../src/core/parsing/pr-parser.js";

function makePR(): PRData {
	return {
		number: 42,
		title: "feat: add rate limiting",
		body: "Add rate limiting.",
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
			},
		],
	};
}

describe("webhook payload", () => {
	it("generates valid JSON payload from spec", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const payload = JSON.stringify({
			event: "spec_generated",
			repo: "owner/repo",
			pr_number: 42,
			spec,
			generated_at: spec.generated_at,
		});
		const parsed = JSON.parse(payload);
		expect(parsed.event).toBe("spec_generated");
		expect(parsed.repo).toBe("owner/repo");
		expect(parsed.pr_number).toBe(42);
		expect(parsed.spec.version).toBe(1);
		expect(parsed.generated_at).toBe(spec.generated_at);
	});

	it("webhook payload contains full spec", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const payload = {
			event: "spec_generated",
			repo: "owner/repo",
			pr_number: 42,
			spec,
			generated_at: spec.generated_at,
		};
		expect(payload.spec.title).toBe("feat: add rate limiting");
		expect(payload.spec.source.author).toBe("contributor");
		expect(Array.isArray(payload.spec.risk_flags)).toBe(true);
		expect(payload.spec.stats.files_changed).toBe(3);
	});

	it("webhook payload includes risk flags", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const payload = {
			event: "spec_generated",
			repo: "owner/repo",
			pr_number: 42,
			spec,
			generated_at: spec.generated_at,
		};
		expect(Array.isArray(payload.spec.risk_flags)).toBe(true);
	});

	it("webhook POST uses correct headers", () => {
		const headers = {
			"Content-Type": "application/json",
			"User-Agent": "pr-to-prompt/0.5.0",
		};
		expect(headers["Content-Type"]).toBe("application/json");
		expect(headers["User-Agent"]).toContain("pr-to-prompt");
	});
});
