#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { program } from "commander";
import { createClient, fetchPR } from "../core/github/client.js";
import { generateSpec } from "../core/parsing/pr-parser.js";
import { renderComment } from "../core/rendering/comment.js";
import { renderMarkdown } from "../core/rendering/markdown.js";
import { renderYaml } from "../core/rendering/yaml.js";

program
	.name("pr-to-prompt")
	.description("Convert GitHub PRs into structured prompt-spec artifacts")
	.version("0.1.0")
	.requiredOption("--repo <owner/name>", "GitHub repository (owner/name)")
	.requiredOption("--pr <number>", "Pull request number", Number.parseInt)
	.option("--out <directory>", "Output directory", "./output")
	.option("--token <token>", "GitHub token (or set GITHUB_TOKEN env var)")
	.option("--comment", "Post spec summary as a PR comment", false)
	.option("--format <format>", "Output format: yaml, markdown, both", "both")
	.option("--stdout", "Print to stdout instead of writing files", false)
	.action(async (opts) => {
		try {
			await run(opts);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`Error: ${message}`);
			process.exit(1);
		}
	});

interface CLIOptions {
	repo: string;
	pr: number;
	out: string;
	token?: string;
	comment: boolean;
	format: string;
	stdout: boolean;
}

async function run(opts: CLIOptions): Promise<void> {
	const token = opts.token ?? process.env.GITHUB_TOKEN;
	if (!token) {
		throw new Error(
			"GitHub token required. Set GITHUB_TOKEN env var or pass --token flag.\nToken needs `repo` scope (or fine-grained: pull requests read access).",
		);
	}

	const [owner, repo] = opts.repo.split("/");
	if (!owner || !repo) {
		throw new Error("Repository must be in owner/name format (e.g., octocat/hello-world)");
	}

	if (Number.isNaN(opts.pr) || opts.pr < 1) {
		throw new Error("PR number must be a positive integer");
	}

	console.log(`Fetching PR #${opts.pr} from ${opts.repo}...`);
	const octokit = createClient(token);
	const prData = await fetchPR(octokit, owner, repo, opts.pr);

	console.log(`Generating prompt-spec for: "${prData.title}"`);
	const spec = generateSpec(prData, opts.repo);

	const yamlOutput = renderYaml(spec);
	const mdOutput = renderMarkdown(spec);

	if (opts.stdout) {
		if (opts.format === "yaml" || opts.format === "both") {
			console.log("\n--- YAML ---\n");
			console.log(yamlOutput);
		}
		if (opts.format === "markdown" || opts.format === "both") {
			console.log("\n--- Markdown ---\n");
			console.log(mdOutput);
		}
	} else {
		const outDir = resolve(opts.out);
		mkdirSync(outDir, { recursive: true });

		const yamlPath = resolve(outDir, `pr-${opts.pr}.spec.yaml`);
		const mdPath = resolve(outDir, `pr-${opts.pr}.summary.md`);

		if (opts.format === "yaml" || opts.format === "both") {
			writeFileSync(yamlPath, yamlOutput, "utf-8");
			console.log(`  Written: ${yamlPath}`);
		}
		if (opts.format === "markdown" || opts.format === "both") {
			writeFileSync(mdPath, mdOutput, "utf-8");
			console.log(`  Written: ${mdPath}`);
		}
	}

	if (opts.comment) {
		console.log("Posting PR comment...");
		const commentBody = renderComment(spec);
		await octokit.issues.createComment({
			owner,
			repo,
			issue_number: opts.pr,
			body: commentBody,
		});
		console.log(`  Comment posted on PR #${opts.pr}`);
	}

	console.log("Done.");
}

program.parse();
