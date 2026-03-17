import { Command } from "commander";
import { detectDriftWithSpec } from "../core/drift/detector.js";
import { readIntent } from "../core/intent/storage.js";
import { generateSpec } from "../core/parsing/pr-parser.js";
import { renderJson } from "../core/rendering/json.js";
import { buildLocalDiffSource } from "../core/sources/local.js";

export const checkCommand = new Command("check")
	.description("Scan local changes and check for drift against declared intent")
	.option("--branch <ref>", "Base branch to diff against (default: main)")
	.option("--diff <n>", "Diff last N commits", (v) => Number.parseInt(v))
	.option("--staged", "Analyze staged changes only", false)
	.option("--quiet", "Suppress all logging", false)
	.option("--json", "Output as JSON (default for agent use)", false)
	.action(async (opts) => {
		try {
			const exitCode = await runCheck(opts);
			process.exit(exitCode);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (!opts.quiet && !opts.json) console.error(`Error: ${message}`);
			process.exit(1);
		}
	});

function log(opts: { quiet: boolean; json: boolean }, ...args: unknown[]): void {
	if (!opts.quiet && !opts.json) console.log(...args);
}

async function runCheck(opts: {
	branch?: string;
	diff?: number;
	staged: boolean;
	quiet: boolean;
	json: boolean;
}): Promise<number> {
	const source = buildLocalDiffSource({
		base: opts.branch,
		commits: opts.diff,
		staged: opts.staged,
	});

	log(opts, `Scanning: "${source.title}" (${source.files.length} files)`);
	const spec = generateSpec(source);

	const intent = readIntent();

	if (!intent) {
		log(opts, 'No intent declared. Run: pr-to-spec intent set --goal "..."');
		// Fall back to scan behavior
		if (opts.json) process.stdout.write(`${renderJson(spec)}\n`);
		const hasHighRisk = spec.risk_flags.some((r) => r.severity === "high");
		return hasHighRisk ? 2 : 0;
	}

	log(opts, "Checking drift against intent...");
	const signals = detectDriftWithSpec(source, intent, spec.intent.change_type, spec.risk_flags);

	if (opts.json) {
		const output = JSON.stringify(
			{
				version: 1,
				command: "check",
				status:
					signals.length > 0
						? "drift_detected"
						: spec.risk_flags.some((r) => r.severity === "high")
							? "high_risk"
							: "clean",
				exit_code:
					signals.length > 0 ? 3 : spec.risk_flags.some((r) => r.severity === "high") ? 2 : 0,
				signals,
				spec,
				intent,
			},
			null,
			2,
		);
		process.stdout.write(`${output}\n`);
	} else {
		if (signals.length === 0) {
			console.log("No drift detected.");
		} else {
			console.log(`${signals.length} drift signal(s) detected:`);
			for (const s of signals) {
				console.log(`  [${s.severity.toUpperCase()}] ${s.type}: ${s.description}`);
				if (s.details?.length) {
					for (const d of s.details.slice(0, 5)) console.log(`    - ${d}`);
				}
			}
		}
	}

	if (signals.length > 0) return 3;
	const hasHighRisk = spec.risk_flags.some((r) => r.severity === "high");
	return hasHighRisk ? 2 : 0;
}
