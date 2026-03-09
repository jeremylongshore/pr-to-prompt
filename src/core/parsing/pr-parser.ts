import type { PRData } from "../github/client.js";
import { classifyRisks } from "../risk/classifier.js";
import type { FileChange, PromptSpec } from "../schema/prompt-spec.js";

/**
 * Deterministic spec generation from PR metadata.
 * No LLM required — uses heuristics and templates.
 */
export function generateSpec(pr: PRData, repo: string): PromptSpec {
	const changeType = inferChangeType(pr);
	const likelyGoal = inferGoal(pr);
	const scope = inferScope(pr);
	const constraints = inferConstraints(pr);
	const acceptanceCriteria = inferAcceptanceCriteria(pr);
	const verification = inferVerification(pr);
	const risks = classifyRisks(pr.files);
	const openQuestions = inferOpenQuestions(pr, risks);
	const prompt = buildGenerationPrompt(pr, repo, likelyGoal, scope, constraints);

	return {
		version: 1,
		generated_at: new Date().toISOString(),
		source: {
			repo,
			pr_number: pr.number,
			pr_url: pr.url,
			base_branch: pr.base_branch,
			head_branch: pr.head_branch,
			author: pr.author,
		},
		title: pr.title,
		summary: buildSummary(pr, changeType),
		intent: {
			likely_goal: likelyGoal,
			change_type: changeType,
		},
		scope,
		affected_files: pr.files.map(
			(f): FileChange => ({
				filename: f.filename,
				status: normalizeStatus(f.status),
				additions: f.additions,
				deletions: f.deletions,
				patch: f.patch,
			}),
		),
		constraints,
		acceptance_criteria: acceptanceCriteria,
		verification,
		risk_flags: risks,
		open_questions: openQuestions,
		generation_prompt: prompt,
		stats: {
			files_changed: pr.changed_files,
			additions: pr.additions,
			deletions: pr.deletions,
			commits: pr.commits,
		},
	};
}

function normalizeStatus(status: string): "added" | "removed" | "modified" | "renamed" | "copied" {
	const map: Record<string, "added" | "removed" | "modified" | "renamed" | "copied"> = {
		added: "added",
		removed: "removed",
		modified: "modified",
		renamed: "renamed",
		copied: "copied",
		changed: "modified",
	};
	return map[status] ?? "modified";
}

function inferChangeType(
	pr: PRData,
): "feature" | "bugfix" | "refactor" | "docs" | "test" | "chore" | "config" | "mixed" {
	const title = pr.title.toLowerCase();
	const branch = pr.head_branch.toLowerCase();

	if (/\b(fix|bug|patch|hotfix|issue)\b/.test(title) || branch.startsWith("fix/")) return "bugfix";
	if (/\b(feat|feature|add|implement)\b/.test(title) || branch.startsWith("feat/"))
		return "feature";
	if (/\b(refactor|cleanup|clean up|reorganize)\b/.test(title) || branch.startsWith("refactor/"))
		return "refactor";
	if (/\b(doc|docs|readme|documentation)\b/.test(title) || branch.startsWith("docs/"))
		return "docs";
	if (/\b(test|spec|coverage)\b/.test(title) || branch.startsWith("test/")) return "test";
	if (/\b(chore|ci|build|deps|bump)\b/.test(title) || branch.startsWith("chore/")) return "chore";
	if (/\b(config|setup|configure)\b/.test(title)) return "config";

	// Check file patterns
	const exts = pr.files.map((f) => f.filename.split(".").pop() ?? "");
	const allDocs = exts.every((e) => ["md", "txt", "rst", "adoc"].includes(e));
	if (allDocs) return "docs";

	const allTests = pr.files.every((f) => /\b(test|spec|__tests__)\b/i.test(f.filename));
	if (allTests) return "test";

	return "mixed";
}

function inferGoal(pr: PRData): string {
	// Use PR body first line or title as the goal basis
	if (pr.body) {
		const firstParagraph = pr.body.split("\n\n")[0].trim();
		if (firstParagraph.length > 10 && firstParagraph.length < 500) {
			return firstParagraph;
		}
	}
	return `${pr.title} (inferred from PR title)`;
}

function inferScope(pr: PRData): { include: string[]; exclude: string[] } {
	// Group files by top-level directory paths
	const dirs = new Set<string>();
	for (const f of pr.files) {
		const parts = f.filename.split("/");
		if (parts.length > 2) {
			// Deep path: use top two directory segments as glob
			dirs.add(`${parts[0]}/${parts[1]}/**`);
		} else if (parts.length === 2) {
			// Single directory + file: use the exact path
			dirs.add(f.filename);
		} else {
			// Root-level file
			dirs.add(f.filename);
		}
	}

	return {
		include: [...dirs].slice(0, 15),
		exclude: ["Unrelated modules not touched by this PR"],
	};
}

function inferConstraints(pr: PRData): string[] {
	const constraints: string[] = [];

	if (pr.files.some((f) => /test/i.test(f.filename))) {
		constraints.push("Existing tests must continue to pass");
	}

	if (
		pr.files.some(
			(f) =>
				/\b(migration|migrate)\b/i.test(f.filename) ||
				/\.sql$/.test(f.filename) ||
				(/\bschema\b/i.test(f.filename) &&
					/\b(db|database|prisma|drizzle|knex|sequelize|typeorm|sql|alembic)\b/i.test(f.filename)),
		)
	) {
		constraints.push("Database migrations must be backwards-compatible");
	}

	if (pr.files.some((f) => /api|route|endpoint/i.test(f.filename))) {
		constraints.push("API contracts must remain stable for existing clients");
	}

	if (pr.labels.includes("breaking-change")) {
		constraints.push("This is a breaking change — requires version bump and migration guide");
	}

	constraints.push("Preserve existing behavior for untouched code paths");
	return constraints;
}

function inferAcceptanceCriteria(pr: PRData): string[] {
	const criteria: string[] = [];

	criteria.push(`Changes apply cleanly to ${pr.base_branch}`);
	criteria.push("All existing tests pass");

	if (pr.files.some((f) => f.status === "added")) {
		criteria.push("New files are properly integrated with existing module structure");
	}

	if (pr.files.some((f) => /test/i.test(f.filename))) {
		criteria.push("New/modified tests cover the changed functionality");
	}

	criteria.push("No regressions in affected modules");
	return criteria;
}

function inferVerification(pr: PRData): { tests_required: string[]; manual_checks: string[] } {
	const tests: string[] = [];
	const manual: string[] = [];

	if (pr.files.some((f) => /test/i.test(f.filename))) {
		tests.push("unit");
	}

	if (pr.files.some((f) => /integration|e2e/i.test(f.filename))) {
		tests.push("integration");
	}

	if (tests.length === 0) {
		tests.push("unit");
		manual.push("Verify no test coverage gaps introduced");
	}

	if (pr.files.some((f) => /api|route/i.test(f.filename))) {
		manual.push("Verify API endpoint behavior manually");
	}

	if (pr.files.some((f) => /ui|component|page/i.test(f.filename))) {
		manual.push("Visual check of affected UI components");
	}

	return { tests_required: tests, manual_checks: manual };
}

function inferOpenQuestions(
	pr: PRData,
	risks: Array<{ category: string; severity: string }>,
): string[] {
	const questions: string[] = [];

	if (!pr.body || pr.body.trim().length < 20) {
		questions.push("PR description is sparse — author should clarify the motivation");
	}

	if (pr.files.length > 20) {
		questions.push("Large changeset — could this be split into smaller PRs?");
	}

	if (risks.some((r) => r.severity === "high")) {
		questions.push("High-risk changes detected — has this been reviewed by a domain expert?");
	}

	if (pr.files.some((f) => f.status === "removed")) {
		questions.push("Files were deleted — confirm no other modules depend on them");
	}

	return questions;
}

function buildSummary(pr: PRData, changeType: string): string {
	const fileWord = pr.changed_files === 1 ? "file" : "files";
	return `${capitalize(changeType)} PR by @${pr.author}: "${pr.title}" — ${pr.changed_files} ${fileWord} changed (+${pr.additions}/-${pr.deletions})`;
}

function buildGenerationPrompt(
	pr: PRData,
	repo: string,
	goal: string,
	scope: { include: string[] },
	constraints: string[],
): string {
	const files = pr.files.map((f) => `  - ${f.filename} (${f.status})`).join("\n");

	return `Re-implement the following change for the ${repo} repository.

## Goal
${goal}

## Branch
Apply changes to: ${pr.base_branch}
Original branch: ${pr.head_branch}

## Affected Files
${files}

## Scope
Focus on: ${scope.include.join(", ")}

## Constraints
${constraints.map((c) => `- ${c}`).join("\n")}

## Reference
Original PR: ${pr.url}
Author: @${pr.author}

Implement this change following the repository's existing patterns and conventions.
Ensure all tests pass after making the changes.`;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build a compact spec without patch data (for YAML output).
 */
export function compactSpec(spec: PromptSpec): PromptSpec {
	return {
		...spec,
		affected_files: spec.affected_files.map(({ patch: _patch, ...rest }) => rest as FileChange),
	};
}
