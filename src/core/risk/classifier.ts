import type { PRFile } from "../github/client.js";

export interface RiskFlag {
	category: string;
	description: string;
	severity: "low" | "medium" | "high";
}

interface RiskRule {
	category: string;
	description: string;
	severity: "low" | "medium" | "high";
	match: (file: PRFile) => boolean;
}

const RISK_RULES: RiskRule[] = [
	{
		category: "authentication",
		description: "Changes to authentication or authorization logic",
		severity: "high",
		match: (f) => /\b(auth|login|session|oauth|jwt|token|passport)\b/i.test(f.filename),
	},
	{
		category: "secrets",
		description: "Changes to secrets, config, or environment handling",
		severity: "high",
		match: (f) =>
			/\.(env|secret|key|pem|cert)/.test(f.filename) ||
			/\b(config|secrets?|credentials?)\b/i.test(f.filename),
	},
	{
		category: "dependencies",
		description: "Dependency changes may introduce supply chain risk",
		severity: "medium",
		match: (f) =>
			/^(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|Gemfile(\.lock)?|requirements.*\.txt|Cargo\.(toml|lock)|go\.(mod|sum)|composer\.(json|lock))$/.test(
				f.filename,
			),
	},
	{
		category: "database",
		description: "Database migration or schema changes",
		severity: "high",
		match: (f) => /\b(migration|schema|migrate)\b/i.test(f.filename) || /\.sql$/.test(f.filename),
	},
	{
		category: "infrastructure",
		description: "Infrastructure or deployment configuration changes",
		severity: "medium",
		match: (f) =>
			/\b(docker|terraform|k8s|kubernetes|helm|deploy|infra|ci|cd)\b/i.test(f.filename) ||
			(/\.(ya?ml|toml)$/.test(f.filename) && /\b(deploy|infra|workflow)\b/i.test(f.filename)),
	},
	{
		category: "permissions",
		description: "Changes to permission, role, or access control logic",
		severity: "high",
		match: (f) => /\b(permission|role|rbac|acl|access|policy)\b/i.test(f.filename),
	},
	{
		category: "payment",
		description: "Changes to payment, billing, or financial logic",
		severity: "high",
		match: (f) =>
			/\b(payment|billing|stripe|invoice|subscription|checkout|pricing)\b/i.test(f.filename),
	},
	{
		category: "destructive-operations",
		description: "File may contain destructive operations (delete, drop, truncate)",
		severity: "medium",
		match: (f) =>
			f.patch !== undefined &&
			/\b(DELETE|DROP|TRUNCATE|destroy|remove_all|purge|wipe)\b/.test(f.patch),
	},
	{
		category: "security-headers",
		description: "Changes to security headers, CORS, or CSP configuration",
		severity: "medium",
		match: (f) => /\b(cors|csp|security|headers|middleware)\b/i.test(f.filename),
	},
	{
		category: "large-change",
		description: "File has a large number of changes, increasing review risk",
		severity: "low",
		match: (f) => f.additions + f.deletions > 300,
	},
];

export function classifyRisks(files: PRFile[]): RiskFlag[] {
	const flags: RiskFlag[] = [];
	const seen = new Set<string>();

	for (const file of files) {
		for (const rule of RISK_RULES) {
			if (rule.match(file) && !seen.has(`${rule.category}:${file.filename}`)) {
				seen.add(`${rule.category}:${file.filename}`);
				flags.push({
					category: rule.category,
					description: `${rule.description} (${file.filename})`,
					severity: rule.severity,
				});
			}
		}
	}

	// Sort by severity: high > medium > low
	const order = { high: 0, medium: 1, low: 2 };
	return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
