import { describe, expect, it } from "vitest";
import { detectDrift, detectDriftWithSpec } from "../src/core/drift/detector.js";
import type { Intent } from "../src/core/intent/schema.js";
import type { DiffSource } from "../src/core/sources/types.js";

function makeIntent(overrides: Partial<Intent> = {}): Intent {
	return {
		goal: "Add rate limiting to API",
		expected_scope: ["src/middleware/**"],
		forbidden_scope: [],
		max_risk: "high",
		...overrides,
	};
}

function makeDiff(filenames: string[], additions = 10, deletions = 5): DiffSource {
	return {
		title: "Test diff",
		base_ref: "main",
		head_ref: "feat/test",
		author: "developer",
		files: filenames.map((filename) => ({
			filename,
			status: "modified" as const,
			additions,
			deletions,
		})),
		source_type: "local_branch",
	};
}

describe("detectDrift — scope_creep", () => {
	it("returns no signals when all files are in scope", () => {
		const diff = makeDiff(["src/middleware/rateLimit.ts"]);
		const intent = makeIntent({ expected_scope: ["src/middleware/**"] });
		const signals = detectDrift(diff, intent);
		expect(signals.filter((s) => s.type === "scope_creep")).toHaveLength(0);
	});

	it("fires scope_creep when files are outside expected scope", () => {
		const diff = makeDiff(["src/db/schema.ts", "src/middleware/rateLimit.ts"]);
		const intent = makeIntent({ expected_scope: ["src/middleware/**"] });
		const signals = detectDrift(diff, intent);
		const creep = signals.find((s) => s.type === "scope_creep");
		expect(creep).toBeDefined();
		expect(creep?.severity).toBe("medium");
		expect(creep?.details).toContain("src/db/schema.ts");
	});

	it("no scope_creep when expected_scope is empty", () => {
		const diff = makeDiff(["src/db/schema.ts", "src/anything/else.ts"]);
		const intent = makeIntent({ expected_scope: [] });
		const signals = detectDrift(diff, intent);
		expect(signals.filter((s) => s.type === "scope_creep")).toHaveLength(0);
	});
});

describe("detectDrift — forbidden_touch", () => {
	it("fires forbidden_touch when a forbidden file is changed", () => {
		const diff = makeDiff(["src/db/schema.ts"]);
		const intent = makeIntent({ forbidden_scope: ["src/db/**"] });
		const signals = detectDrift(diff, intent);
		const forbidden = signals.find((s) => s.type === "forbidden_touch");
		expect(forbidden).toBeDefined();
		expect(forbidden?.severity).toBe("high");
		expect(forbidden?.details).toContain("src/db/schema.ts");
	});

	it("no forbidden_touch when no forbidden files changed", () => {
		const diff = makeDiff(["src/middleware/rateLimit.ts"]);
		const intent = makeIntent({ forbidden_scope: ["src/db/**"] });
		const signals = detectDrift(diff, intent);
		expect(signals.filter((s) => s.type === "forbidden_touch")).toHaveLength(0);
	});
});

describe("detectDrift — size_overrun", () => {
	it("fires size_overrun when LOC exceeds budget", () => {
		const diff = makeDiff(["src/a.ts"], 100, 50); // 150 LOC
		const intent = makeIntent({ size_budget: 100 });
		const signals = detectDrift(diff, intent);
		const overrun = signals.find((s) => s.type === "size_overrun");
		expect(overrun).toBeDefined();
		expect(overrun?.severity).toBe("low");
	});

	it("no size_overrun when within budget", () => {
		const diff = makeDiff(["src/a.ts"], 40, 10); // 50 LOC
		const intent = makeIntent({ size_budget: 100 });
		const signals = detectDrift(diff, intent);
		expect(signals.filter((s) => s.type === "size_overrun")).toHaveLength(0);
	});

	it("no size_overrun when size_budget is undefined", () => {
		const diff = makeDiff(["src/a.ts"], 1000, 1000);
		const intent = makeIntent({ size_budget: undefined });
		const signals = detectDrift(diff, intent);
		expect(signals.filter((s) => s.type === "size_overrun")).toHaveLength(0);
	});
});

describe("detectDriftWithSpec — risk_escalation", () => {
	it("fires risk_escalation when high risk exceeds max_risk medium", () => {
		const diff = makeDiff(["src/auth/login.ts"]);
		const intent = makeIntent({ max_risk: "medium" });
		const riskFlags = [{ category: "auth", description: "Auth change", severity: "high" as const }];
		const signals = detectDriftWithSpec(diff, intent, "feature", riskFlags);
		const escalation = signals.find((s) => s.type === "risk_escalation");
		expect(escalation).toBeDefined();
		expect(escalation?.severity).toBe("high");
	});

	it("no risk_escalation when risk is within max_risk", () => {
		const diff = makeDiff(["src/a.ts"]);
		const intent = makeIntent({ max_risk: "high" });
		const riskFlags = [{ category: "dep", description: "Deps", severity: "medium" as const }];
		const signals = detectDriftWithSpec(diff, intent, "feature", riskFlags);
		expect(signals.filter((s) => s.type === "risk_escalation")).toHaveLength(0);
	});
});

describe("detectDriftWithSpec — type_mismatch", () => {
	it("fires type_mismatch when inferred type differs from expected", () => {
		const diff = makeDiff(["src/a.ts"]);
		const intent = makeIntent({ expected_type: "bugfix" });
		const signals = detectDriftWithSpec(diff, intent, "feature", []);
		const mismatch = signals.find((s) => s.type === "type_mismatch");
		expect(mismatch).toBeDefined();
		expect(mismatch?.severity).toBe("low");
		expect(mismatch?.details).toContain("inferred: feature");
		expect(mismatch?.details).toContain("expected: bugfix");
	});

	it("no type_mismatch when types match", () => {
		const diff = makeDiff(["src/a.ts"]);
		const intent = makeIntent({ expected_type: "feature" });
		const signals = detectDriftWithSpec(diff, intent, "feature", []);
		expect(signals.filter((s) => s.type === "type_mismatch")).toHaveLength(0);
	});

	it("no type_mismatch when expected_type is not set", () => {
		const diff = makeDiff(["src/a.ts"]);
		const intent = makeIntent({ expected_type: undefined });
		const signals = detectDriftWithSpec(diff, intent, "feature", []);
		expect(signals.filter((s) => s.type === "type_mismatch")).toHaveLength(0);
	});
});

describe("detectDrift — clean case", () => {
	it("returns empty array when all within intent", () => {
		const diff = makeDiff(["src/middleware/rateLimit.ts"], 50, 10);
		const intent = makeIntent({
			expected_scope: ["src/middleware/**"],
			forbidden_scope: [],
			size_budget: 200,
		});
		const signals = detectDrift(diff, intent);
		expect(signals).toHaveLength(0);
	});
});
