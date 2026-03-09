import { Octokit } from "@octokit/rest";

export interface PRData {
	number: number;
	title: string;
	body: string | null;
	url: string;
	base_branch: string;
	head_branch: string;
	author: string;
	state: string;
	commits: number;
	additions: number;
	deletions: number;
	changed_files: number;
	files: PRFile[];
	labels: string[];
	linked_issues: string[];
}

export interface PRFile {
	filename: string;
	status: string;
	additions: number;
	deletions: number;
	patch?: string;
	previous_filename?: string;
}

export function createClient(token: string): Octokit {
	return new Octokit({ auth: token });
}

export async function fetchPR(
	octokit: Octokit,
	owner: string,
	repo: string,
	prNumber: number,
): Promise<PRData> {
	const [prResponse, filesResponse] = await Promise.all([
		octokit.pulls.get({ owner, repo, pull_number: prNumber }),
		octokit.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 300 }),
	]);

	const pr = prResponse.data;

	// Extract linked issues from PR body
	const linkedIssues = extractLinkedIssues(pr.body ?? "", owner, repo);

	return {
		number: pr.number,
		title: pr.title,
		body: pr.body,
		url: pr.html_url,
		base_branch: pr.base.ref,
		head_branch: pr.head.ref,
		author: pr.user?.login ?? "unknown",
		state: pr.state,
		commits: pr.commits,
		additions: pr.additions,
		deletions: pr.deletions,
		changed_files: pr.changed_files,
		labels: pr.labels.map((l) => l.name),
		linked_issues: linkedIssues,
		files: filesResponse.data.map((f) => ({
			filename: f.filename,
			status: f.status,
			additions: f.additions,
			deletions: f.deletions,
			patch: f.patch,
			previous_filename: f.previous_filename,
		})),
	};
}

function extractLinkedIssues(body: string, owner: string, repo: string): string[] {
	const issues: string[] = [];
	// Match "Fixes #123", "Closes #456", "Resolves #789"
	const patterns = [
		/(?:fix(?:es)?|close(?:s)?|resolve(?:s)?)\s+#(\d+)/gi,
		/(?:fix(?:es)?|close(?:s)?|resolve(?:s)?)\s+https:\/\/github\.com\/[\w-]+\/[\w-]+\/issues\/(\d+)/gi,
	];
	for (const pattern of patterns) {
		for (const match of body.matchAll(pattern)) {
			const num = match[1];
			issues.push(`https://github.com/${owner}/${repo}/issues/${num}`);
		}
	}
	return [...new Set(issues)];
}
