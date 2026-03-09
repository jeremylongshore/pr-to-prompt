import { describe, expect, it } from "vitest";
import type { PRData } from "../src/core/github/client.js";
import { generateSpec } from "../src/core/parsing/pr-parser.js";
import { renderComment } from "../src/core/rendering/comment.js";
import { renderMarkdown } from "../src/core/rendering/markdown.js";
import { renderYaml } from "../src/core/rendering/yaml.js";

function makePR(): PRData {
	return {
		number: 17,
		title: "feat: add webhook handler",
		body: "Implement webhook handler for Stripe events.\n\nHandles payment_intent.succeeded and invoice.paid.",
		url: "https://github.com/owner/repo/pull/17",
		base_branch: "main",
		head_branch: "feat/webhooks",
		author: "dev",
		state: "open",
		commits: 2,
		additions: 80,
		deletions: 5,
		changed_files: 2,
		labels: [],
		linked_issues: [],
		files: [
			{
				filename: "src/webhooks/stripe.ts",
				status: "added",
				additions: 60,
				deletions: 0,
				patch: "+export function handleWebhook() {}",
			},
			{
				filename: "src/routes/webhooks.ts",
				status: "modified",
				additions: 20,
				deletions: 5,
			},
		],
	};
}

describe("renderYaml", () => {
	it("produces valid YAML string", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const yaml = renderYaml(spec);
		expect(typeof yaml).toBe("string");
		expect(yaml.length).toBeGreaterThan(100);
	});

	it("contains key fields", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const yaml = renderYaml(spec);
		expect(yaml).toContain("version: 1");
		expect(yaml).toContain("owner/repo");
		expect(yaml).toContain("pr_number: 17");
		expect(yaml).toContain("feat: add webhook handler");
	});

	it("does not contain patch data", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const yaml = renderYaml(spec);
		expect(yaml).not.toContain("handleWebhook");
	});
});

describe("renderMarkdown", () => {
	it("produces Markdown with headers", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const md = renderMarkdown(spec);
		expect(md).toContain("# Prompt Spec:");
		expect(md).toContain("## Summary");
		expect(md).toContain("## Affected Files");
	});

	it("includes file status badges", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const md = renderMarkdown(spec);
		expect(md).toContain("[A]");
		expect(md).toContain("[M]");
	});

	it("includes generation prompt in code block", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const md = renderMarkdown(spec);
		expect(md).toContain("## Generation Prompt");
		expect(md).toContain("```");
	});

	it("includes stats table", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const md = renderMarkdown(spec);
		expect(md).toContain("Files changed");
		expect(md).toContain("+80");
	});
});

describe("renderComment", () => {
	it("produces a compact PR comment", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const comment = renderComment(spec);
		expect(comment).toContain("## PR Spec Analysis");
		expect(comment).toContain("pr-to-prompt");
	});

	it("includes acceptance criteria as checkboxes", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const comment = renderComment(spec);
		expect(comment).toContain("- [ ]");
	});

	it("includes copy-ready prompt in details block", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const comment = renderComment(spec);
		expect(comment).toContain("<details>");
		expect(comment).toContain("Copy-ready prompt spec");
	});

	it("lists affected files", () => {
		const spec = generateSpec(makePR(), "owner/repo");
		const comment = renderComment(spec);
		expect(comment).toContain("stripe.ts");
		expect(comment).toContain("webhooks.ts");
	});
});
