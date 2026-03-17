export { enhanceSpec, type AIEnhanceOptions } from "./core/ai/enhancer.js";
export { diffSpecs, type SpecDiff, type SectionDiff } from "./core/diff/spec-diff.js";
export { PromptSpecSchema, type PromptSpec, type FileChange } from "./core/schema/prompt-spec.js";
export { createClient, fetchPR, type PRData, type PRFile } from "./core/github/client.js";
export { generateSpec, generateSpecFromPR, compactSpec } from "./core/parsing/pr-parser.js";
export { parseReviews, type ReviewSummary } from "./core/parsing/review-parser.js";
export { analyzeSemanticDiff, type SemanticChange } from "./core/parsing/semantic-diff.js";
export { detectMonorepo, type MonorepoInfo } from "./core/parsing/monorepo-detector.js";
export { classifyRisks, type RiskFlag } from "./core/risk/classifier.js";
export { renderYaml } from "./core/rendering/yaml.js";
export { renderMarkdown } from "./core/rendering/markdown.js";
export { renderComment } from "./core/rendering/comment.js";
export { renderJson } from "./core/rendering/json.js";
export { githubPRtoDiffSource } from "./core/sources/github.js";
export { buildLocalDiffSource, parseDiffStat, parseNameStatus } from "./core/sources/local.js";
export type { DiffSource, DiffFile } from "./core/sources/types.js";
export {
	IntentSchema,
	IntentLayerSchema,
	LayeredIntentSchema,
	type Intent,
	type IntentLayer,
	type LayeredIntent,
} from "./core/intent/schema.js";
export { readIntent, writeIntent } from "./core/intent/storage.js";
export { mergeIntents, flattenToIntent, singleLayerIntent } from "./core/intent/composition.js";
export { detectDrift, detectDriftWithSpec, detectAssumptionViolations } from "./core/drift/detector.js";
export type { DriftSignal, DriftSignalType } from "./core/drift/signals.js";
export {
	classifyDecision,
	analyzeAssumptions,
	type DecisionAction,
	type Decision,
} from "./core/decisions/classifier.js";
export { buildEnvelope } from "./core/protocol/envelope.js";
export type { AgentProtocolEnvelope, ProtocolStatus } from "./core/protocol/envelope.js";
// Graph engine
export {
	IntentNodeSchema,
	IntentNodeTypeSchema,
	IntentNodeSourceSchema,
	type IntentNode,
	type IntentNodeType,
	type IntentNodeSource,
} from "./core/graph/node.js";
export {
	IntentEdgeSchema,
	IntentGraphSchema,
	EdgeTypeSchema,
	type IntentEdge,
	type IntentGraph,
	type EdgeType,
} from "./core/graph/edge.js";
export {
	propagateInvalidation,
	getStaleNodes,
	clearInvalidation,
	upsertNode,
	addEdge,
	createEmptyGraph,
} from "./core/graph/propagation.js";
export { readGraph, writeGraph, getGraphPath } from "./core/graph/storage.js";
export {
	ingestFeedback,
	summarizeFeedback,
	type ReviewFeedback,
	type CIFeedback,
	type FeedbackInput,
	type FeedbackSummary,
} from "./core/feedback/ingester.js";
