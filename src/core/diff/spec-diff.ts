import type { PromptSpec } from "../schema/prompt-spec.js";

export interface SpecDiff {
	changed: boolean;
	sections: SectionDiff[];
}

export interface SectionDiff {
	section: string;
	type: "added" | "removed" | "changed" | "unchanged";
	details?: string;
}

/**
 * Compare two prompt specs and produce a structured diff.
 * Useful for tracking how a PR spec evolves across revisions.
 */
export function diffSpecs(previous: PromptSpec, current: PromptSpec): SpecDiff {
	const sections: SectionDiff[] = [];

	// Title
	if (previous.title !== current.title) {
		sections.push({
			section: "title",
			type: "changed",
			details: `"${previous.title}" → "${current.title}"`,
		});
	}

	// Intent
	if (previous.intent.change_type !== current.intent.change_type) {
		sections.push({
			section: "change_type",
			type: "changed",
			details: `${previous.intent.change_type} → ${current.intent.change_type}`,
		});
	}

	// Files
	const prevFiles = new Set(previous.affected_files.map((f) => f.filename));
	const currFiles = new Set(current.affected_files.map((f) => f.filename));
	const addedFiles = [...currFiles].filter((f) => !prevFiles.has(f));
	const removedFiles = [...prevFiles].filter((f) => !currFiles.has(f));

	if (addedFiles.length > 0) {
		sections.push({
			section: "affected_files",
			type: "added",
			details: `+${addedFiles.length} files: ${addedFiles.join(", ")}`,
		});
	}
	if (removedFiles.length > 0) {
		sections.push({
			section: "affected_files",
			type: "removed",
			details: `-${removedFiles.length} files: ${removedFiles.join(", ")}`,
		});
	}

	// Stats
	if (
		previous.stats.files_changed !== current.stats.files_changed ||
		previous.stats.additions !== current.stats.additions ||
		previous.stats.deletions !== current.stats.deletions
	) {
		sections.push({
			section: "stats",
			type: "changed",
			details: `${previous.stats.files_changed}→${current.stats.files_changed} files, +${previous.stats.additions}→+${current.stats.additions}, -${previous.stats.deletions}→-${current.stats.deletions}`,
		});
	}

	// Risk flags
	const prevRisks = new Set(previous.risk_flags.map((r) => `${r.category}:${r.severity}`));
	const currRisks = new Set(current.risk_flags.map((r) => `${r.category}:${r.severity}`));
	const newRisks = [...currRisks].filter((r) => !prevRisks.has(r));
	const resolvedRisks = [...prevRisks].filter((r) => !currRisks.has(r));

	if (newRisks.length > 0) {
		sections.push({
			section: "risk_flags",
			type: "added",
			details: `New risks: ${newRisks.join(", ")}`,
		});
	}
	if (resolvedRisks.length > 0) {
		sections.push({
			section: "risk_flags",
			type: "removed",
			details: `Resolved: ${resolvedRisks.join(", ")}`,
		});
	}

	// Constraints
	const prevConstraints = new Set(previous.constraints);
	const currConstraints = new Set(current.constraints);
	const newConstraints = [...currConstraints].filter((c) => !prevConstraints.has(c));
	if (newConstraints.length > 0) {
		sections.push({
			section: "constraints",
			type: "added",
			details: `+${newConstraints.length} constraints`,
		});
	}

	// Review status
	if (previous.review_summary?.approval_status !== current.review_summary?.approval_status) {
		const prev = previous.review_summary?.approval_status ?? "none";
		const curr = current.review_summary?.approval_status ?? "none";
		sections.push({ section: "review_status", type: "changed", details: `${prev} → ${curr}` });
	}

	return {
		changed: sections.length > 0,
		sections,
	};
}
