import type { DriftSignal } from "../drift/signals.js";
import type { Intent } from "../intent/schema.js";
import type { PromptSpec } from "../schema/prompt-spec.js";

export type ProtocolStatus = "clean" | "high_risk" | "drift_detected" | "error";

export interface AgentProtocolEnvelope {
	version: 1;
	command: string;
	status: ProtocolStatus;
	exit_code: 0 | 1 | 2 | 3;
	signals?: DriftSignal[];
	spec?: PromptSpec;
	intent?: Intent;
}

export function buildEnvelope(
	command: string,
	spec: PromptSpec,
	opts: {
		signals?: DriftSignal[];
		intent?: Intent;
	} = {},
): AgentProtocolEnvelope {
	const hasHighRisk = spec.risk_flags.some((r) => r.severity === "high");
	const hasDrift = (opts.signals?.length ?? 0) > 0;

	let status: ProtocolStatus;
	let exit_code: 0 | 1 | 2 | 3;

	if (hasDrift) {
		status = "drift_detected";
		exit_code = 3;
	} else if (hasHighRisk) {
		status = "high_risk";
		exit_code = 2;
	} else {
		status = "clean";
		exit_code = 0;
	}

	return {
		version: 1,
		command,
		status,
		exit_code,
		signals: opts.signals,
		spec,
		intent: opts.intent,
	};
}
