/**
 * GitHub Action entrypoint for pr-to-spec.
 * Reads PR context from environment and GitHub event payload.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, fetchPR } from "../core/github/client.js";
import { generateSpec } from "../core/parsing/pr-parser.js";
import { renderComment } from "../core/rendering/comment.js";
import { renderMarkdown } from "../core/rendering/markdown.js";
import { renderYaml } from "../core/rendering/yaml.js";

interface ActionInputs {
	token: string;
	comment: boolean;
	outputDir: string;
}

function getInputs(): ActionInputs {
	return {
		token: process.env.GITHUB_TOKEN ?? process.env.INPUT_GITHUB_TOKEN ?? "",
		comment: (process.env.INPUT_COMMENT ?? "true") === "true",
		outputDir: process.env.INPUT_OUTPUT_DIR ?? ".pr-to-spec/specs",
	};
}

function getEventPayload(): { owner: string; repo: string; prNumber: number } {
	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (!eventPath) {
		throw new Error("GITHUB_EVENT_PATH not set — are you running inside a GitHub Action?");
	}

	const event = JSON.parse(readFileSync(eventPath, "utf-8"));
	const prNumber = event.pull_request?.number ?? event.number;
	const repoFullName = process.env.GITHUB_REPOSITORY ?? "";
	const [owner, repo] = repoFullName.split("/");

	if (!owner || !repo || !prNumber) {
		throw new Error("Could not determine PR context from GitHub event payload");
	}

	return { owner, repo, prNumber };
}

async function main(): Promise<void> {
	const inputs = getInputs();
	const { owner, repo, prNumber } = getEventPayload();

	if (!inputs.token) {
		throw new Error("GitHub token is required. Set GITHUB_TOKEN or pass github_token input.");
	}

	const repoFull = `${owner}/${repo}`;
	console.log(`::group::Fetching PR #${prNumber} from ${repoFull}`);
	const octokit = createClient(inputs.token);
	const prData = await fetchPR(octokit, owner, repo, prNumber);
	console.log(`PR: "${prData.title}" by @${prData.author}`);
	console.log("::endgroup::");

	console.log("::group::Generating prompt-spec");
	const spec = generateSpec(prData, repoFull);
	const yamlOutput = renderYaml(spec);
	const mdOutput = renderMarkdown(spec);
	console.log("::endgroup::");

	// Write output files
	console.log("::group::Writing output files");
	const outDir = resolve(inputs.outputDir);
	mkdirSync(outDir, { recursive: true });

	const yamlPath = resolve(outDir, `pr-${prNumber}.spec.yaml`);
	const mdPath = resolve(outDir, `pr-${prNumber}.summary.md`);

	writeFileSync(yamlPath, yamlOutput, "utf-8");
	writeFileSync(mdPath, mdOutput, "utf-8");
	console.log(`Written: ${yamlPath}`);
	console.log(`Written: ${mdPath}`);
	console.log("::endgroup::");

	// Set action outputs
	setOutput("spec_yaml_path", yamlPath);
	setOutput("spec_md_path", mdPath);
	setOutput("pr_number", String(prNumber));
	setOutput("files_changed", String(spec.stats.files_changed));
	setOutput("risk_count", String(spec.risk_flags.length));

	// Post comment
	if (inputs.comment) {
		console.log("::group::Posting PR comment");
		const commentBody = renderComment(spec);
		await octokit.issues.createComment({
			owner,
			repo,
			issue_number: prNumber,
			body: commentBody,
		});
		console.log(`Comment posted on PR #${prNumber}`);
		console.log("::endgroup::");
	}
}

function setOutput(name: string, value: string): void {
	const outputFile = process.env.GITHUB_OUTPUT;
	if (outputFile) {
		const fs = require("node:fs");
		fs.appendFileSync(outputFile, `${name}=${value}\n`);
	}
}

main().catch((err) => {
	console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
