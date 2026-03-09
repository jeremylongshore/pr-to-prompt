import { z } from "zod";

export const FileChangeSchema = z.object({
	filename: z.string(),
	status: z.enum(["added", "removed", "modified", "renamed", "copied"]),
	additions: z.number(),
	deletions: z.number(),
	patch: z.string().optional(),
});

export const PromptSpecSchema = z.object({
	version: z.literal(1),
	generated_at: z.string().datetime(),
	source: z.object({
		repo: z.string(),
		pr_number: z.number(),
		pr_url: z.string().url(),
		base_branch: z.string(),
		head_branch: z.string(),
		author: z.string(),
	}),
	title: z.string(),
	summary: z.string(),
	intent: z.object({
		likely_goal: z.string(),
		change_type: z.enum([
			"feature",
			"bugfix",
			"refactor",
			"docs",
			"test",
			"chore",
			"config",
			"mixed",
		]),
	}),
	scope: z.object({
		include: z.array(z.string()),
		exclude: z.array(z.string()),
	}),
	affected_files: z.array(FileChangeSchema),
	constraints: z.array(z.string()),
	acceptance_criteria: z.array(z.string()),
	verification: z.object({
		tests_required: z.array(z.string()),
		manual_checks: z.array(z.string()),
	}),
	risk_flags: z.array(
		z.object({
			category: z.string(),
			description: z.string(),
			severity: z.enum(["low", "medium", "high"]),
		}),
	),
	open_questions: z.array(z.string()),
	generation_prompt: z.string(),
	stats: z.object({
		files_changed: z.number(),
		additions: z.number(),
		deletions: z.number(),
		commits: z.number(),
	}),
	ai_enhanced: z
		.object({
			summary: z.string(),
			goal: z.string(),
			key_changes: z.array(z.string()),
			review_hints: z.array(z.string()),
			provider: z.string(),
		})
		.optional(),
});

export type PromptSpec = z.infer<typeof PromptSpecSchema>;
export type FileChange = z.infer<typeof FileChangeSchema>;
