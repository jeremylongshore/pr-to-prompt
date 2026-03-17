import { z } from "zod";

export const IntentSchema = z.object({
	goal: z.string().min(1, "Goal is required"),
	expected_scope: z.array(z.string()).default([]),
	forbidden_scope: z.array(z.string()).default([]),
	max_risk: z.enum(["low", "medium", "high"]).default("high"),
	expected_type: z
		.enum(["feature", "bugfix", "refactor", "docs", "test", "chore", "config", "mixed"])
		.optional(),
	size_budget: z.number().int().positive().optional(),
	created_at: z.string().datetime().optional(),
	updated_at: z.string().datetime().optional(),
});

export type Intent = z.infer<typeof IntentSchema>;
