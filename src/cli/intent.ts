import { Command } from "commander";
import { type Intent, IntentSchema } from "../core/intent/schema.js";
import { readIntent, writeIntent } from "../core/intent/storage.js";

export const intentCommand = new Command("intent").description(
	"Manage intent declaration for drift detection",
);

intentCommand
	.command("set")
	.description("Set the intent for this project")
	.requiredOption("--goal <text>", "What this change is trying to achieve")
	.option("--scope <glob...>", "Expected file globs (can repeat)")
	.option("--forbid <glob...>", "Forbidden file globs (can repeat)")
	.option("--max-risk <level>", "Maximum acceptable risk: low, medium, high", "high")
	.option("--type <type>", "Expected change type: feature, bugfix, refactor, etc.")
	.option("--size-budget <n>", "Max total lines changed", Number.parseInt)
	.option("--json", "Output as JSON", false)
	.action((opts) => {
		const now = new Date().toISOString();
		const existing = readIntent();
		const intent: Intent = IntentSchema.parse({
			goal: opts.goal,
			expected_scope: opts.scope ?? [],
			forbidden_scope: opts.forbid ?? [],
			max_risk: opts.maxRisk ?? "high",
			expected_type: opts.type,
			size_budget: opts.sizeBudget,
			created_at: existing?.created_at ?? now,
			updated_at: now,
		});
		writeIntent(intent);
		if (opts.json) {
			console.log(JSON.stringify(intent, null, 2));
		} else {
			console.log(`Intent saved: "${intent.goal}"`);
		}
	});

intentCommand
	.command("show")
	.description("Show the current intent")
	.option("--json", "Output as JSON", false)
	.action((opts) => {
		const intent = readIntent();
		if (!intent) {
			if (opts.json) {
				console.log(JSON.stringify(null));
			} else {
				console.log('No intent set. Use: pr-to-spec intent set --goal "..."');
			}
			return;
		}
		if (opts.json) {
			console.log(JSON.stringify(intent, null, 2));
		} else {
			console.log(`Goal: ${intent.goal}`);
			if (intent.expected_scope.length) console.log(`Scope: ${intent.expected_scope.join(", ")}`);
			if (intent.forbidden_scope.length)
				console.log(`Forbidden: ${intent.forbidden_scope.join(", ")}`);
			console.log(`Max risk: ${intent.max_risk}`);
			if (intent.expected_type) console.log(`Type: ${intent.expected_type}`);
			if (intent.size_budget) console.log(`Size budget: ${intent.size_budget} LOC`);
		}
	});
