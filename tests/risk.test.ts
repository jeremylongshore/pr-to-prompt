import { describe, expect, it } from "vitest";
import type { PRFile } from "../src/core/github/client.js";
import { classifyRisks } from "../src/core/risk/classifier.js";

function file(overrides: Partial<PRFile> & { filename: string }): PRFile {
	return {
		status: "modified",
		additions: 10,
		deletions: 5,
		...overrides,
	};
}

describe("classifyRisks", () => {
	it("flags authentication files", () => {
		const risks = classifyRisks([file({ filename: "src/auth/login.ts" })]);
		expect(risks.some((r) => r.category === "authentication")).toBe(true);
		expect(risks.find((r) => r.category === "authentication")?.severity).toBe("high");
	});

	it("flags secret/env files", () => {
		const risks = classifyRisks([file({ filename: ".env.production" })]);
		expect(risks.some((r) => r.category === "secrets")).toBe(true);
	});

	it("flags dependency changes", () => {
		const risks = classifyRisks([file({ filename: "package-lock.json" })]);
		expect(risks.some((r) => r.category === "dependencies")).toBe(true);
		expect(risks.find((r) => r.category === "dependencies")?.severity).toBe("medium");
	});

	it("flags database migrations", () => {
		const risks = classifyRisks([file({ filename: "db/migrations/001_add_users.sql" })]);
		expect(risks.some((r) => r.category === "database")).toBe(true);
	});

	it("flags payment files", () => {
		const risks = classifyRisks([file({ filename: "src/billing/stripe-checkout.ts" })]);
		expect(risks.some((r) => r.category === "payment")).toBe(true);
	});

	it("flags destructive operations in patches", () => {
		const risks = classifyRisks([
			file({ filename: "src/cleanup.ts", patch: "+ await db.query('DROP TABLE users')" }),
		]);
		expect(risks.some((r) => r.category === "destructive-operations")).toBe(true);
	});

	it("flags large changes", () => {
		const risks = classifyRisks([file({ filename: "src/big.ts", additions: 250, deletions: 100 })]);
		expect(risks.some((r) => r.category === "large-change")).toBe(true);
	});

	it("flags permission files", () => {
		const risks = classifyRisks([file({ filename: "src/rbac/permissions.ts" })]);
		expect(risks.some((r) => r.category === "permissions")).toBe(true);
	});

	it("returns empty for safe files", () => {
		const risks = classifyRisks([
			file({ filename: "src/utils/format.ts", additions: 5, deletions: 2 }),
		]);
		expect(risks).toHaveLength(0);
	});

	it("sorts by severity (high first)", () => {
		const risks = classifyRisks([
			file({ filename: "README.md", additions: 500, deletions: 0 }),
			file({ filename: "src/auth/jwt.ts" }),
		]);
		expect(risks[0].severity).toBe("high");
	});

	it("handles multiple risk categories on one file", () => {
		const risks = classifyRisks([file({ filename: "src/auth/config.ts" })]);
		expect(risks.length).toBeGreaterThanOrEqual(2);
	});
});
