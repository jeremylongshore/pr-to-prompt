import { Command } from "commander";
import { type Intent, IntentSchema } from "../core/intent/schema.js";
import { readIntent, writeIntent } from "../core/intent/storage.js";
import { analyzeAssumptions, type Decision } from "../core/decisions/classifier.js";
import { buildLocalDiffSource } from "../core/sources/local.js";

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

function logAnalyze(
	opts: { quiet: boolean; json: boolean },
	...args: unknown[]
): void {
	if (!opts.quiet && !opts.json) console.log(...args);
}

intentCommand
	.command("analyze")
	.description("Analyze assumptions and surface decisions before coding")
	.option("--branch <ref>", "Base branch to diff against (default: main)")
	.option("--diff <n>", "Diff last N commits", (v) => Number.parseInt(v))
	.option("--staged", "Analyze staged changes only", false)
	.option("--quiet", "Suppress all logging", false)
	.option("--json", "Output as JSON", false)
	.option(
		"--action <action>",
		"Filter by action: must_ask, confirm_upfront, ask_adhoc, assume_safe",
	)
	.action(async (opts) => {
		try {
			const exitCode = await runIntentAnalyze(opts);
			process.exit(exitCode);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (!opts.quiet && !opts.json) console.error(`Error: ${message}`);
			process.exit(1);
		}
	});

async function runIntentAnalyze(opts: {
	branch?: string;
	diff?: number;
	staged: boolean;
	quiet: boolean;
	json: boolean;
	action?: string;
}): Promise<number> {
	const source = buildLocalDiffSource({
		base: opts.branch,
		commits: opts.diff,
		staged: opts.staged,
	});

	const intent = readIntent();
	if (!intent) {
		logAnalyze(opts, 'No intent declared. Run: pr-to-spec intent set --goal "..."');
		if (opts.json) {
			process.stdout.write(
				JSON.stringify({ decisions: [], error: "no_intent" }, null, 2) + "\n",
			);
		}
		return 1;
	}

	logAnalyze(opts, `Analyzing assumptions for: "${source.title}"`);
	let decisions: Decision[] = analyzeAssumptions(source, intent);

	if (opts.action) {
		decisions = decisions.filter((d) => d.action === opts.action);
	}

	if (opts.json) {
		process.stdout.write(JSON.stringify({ decisions }, null, 2) + "\n");
	} else {
		if (decisions.length === 0) {
			console.log("No assumptions to validate. All clear.");
		} else {
			const grouped = new Map<string, Decision[]>();
			for (const d of decisions) {
				const list = grouped.get(d.action) ?? [];
				list.push(d);
				grouped.set(d.action, list);
			}

			const order: string[] = [
				"must_ask",
				"confirm_upfront",
				"ask_adhoc",
				"assume_safe",
			];
			const labels: Record<string, string> = {
				must_ask: "MUST ASK (low predictability, low reversibility)",
				confirm_upfront: "CONFIRM UPFRONT (high predictability, low reversibility)",
				ask_adhoc: "ASK AD-HOC (low predictability, high reversibility)",
				assume_safe: "ASSUME SAFE (high predictability, high reversibility)",
			};

			for (const action of order) {
				const group = grouped.get(action);
				if (!group) continue;
				console.log(`\n${labels[action]}:`);
				for (const d of group) {
					console.log(`  [${d.category}] ${d.question}`);
					if (d.context) console.log(`    Context: ${d.context}`);
				}
			}
			console.log(`\nTotal: ${decisions.length} decision(s)`);
		}
	}

	const hasMustAsk = decisions.some((d) => d.action === "must_ask");
	return hasMustAsk ? 3 : 0;
}
