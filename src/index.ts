export { enhanceSpec, type AIEnhanceOptions } from "./core/ai/enhancer.js";
export { PromptSpecSchema, type PromptSpec, type FileChange } from "./core/schema/prompt-spec.js";
export { createClient, fetchPR, type PRData, type PRFile } from "./core/github/client.js";
export { generateSpec, compactSpec } from "./core/parsing/pr-parser.js";
export { classifyRisks, type RiskFlag } from "./core/risk/classifier.js";
export { renderYaml } from "./core/rendering/yaml.js";
export { renderMarkdown } from "./core/rendering/markdown.js";
export { renderComment } from "./core/rendering/comment.js";
