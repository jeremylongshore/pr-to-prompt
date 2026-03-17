# pr-to-spec

The agent-to-agent translation layer for pull requests.

`pr-to-spec` converts any GitHub PR into a structured **prompt-spec** — a canonical format that your AI agent can consume, evaluate, and act on. No MCP server needed. The CLI *is* the API.

[![CI](https://github.com/jeremylongshore/pr-to-spec/actions/workflows/ci.yml/badge.svg)](https://github.com/jeremylongshore/pr-to-spec/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## How It Works

```
PR opened → pr-to-spec → structured spec → your agent decides
```

1. A contributor opens a PR
2. `pr-to-spec` fetches metadata, diffs, and reviews via GitHub API
3. **Deterministically** generates a structured spec (no LLM required)
4. Your agent consumes the spec and makes a review decision

```bash
# The complete agent pipeline — one line
pr-to-spec --repo owner/repo --pr 42 --json | your-agent review
```

## Quick Start

### Agent Piping (recommended)

```bash
# Get the full spec as JSON — pipe to jq, your agent, or any tool
pr-to-spec --repo owner/repo --pr 42 --json | jq .

# Extract just the risk flags
pr-to-spec --repo owner/repo --pr 42 --json | jq '.risk_flags'

# Extract a single field
pr-to-spec --repo owner/repo --pr 42 --field risk_flags --quiet

# Check exit code: 0=clean, 1=error, 2=high-risk PR
pr-to-spec --repo owner/repo --pr 42 --json > /dev/null
echo $?  # 2 if high-risk changes detected

# Feed to Claude for review
pr-to-spec --repo owner/repo --pr 42 --json \
  | claude --print "Review this PR spec and decide: approve, request changes, or needs info"
```

### File Output

```bash
# Generate all formats to a directory
pr-to-spec --repo owner/repo --pr 42 --out ./specs

# Output:
#   specs/pr-42.spec.yaml     — canonical YAML spec
#   specs/pr-42.summary.md    — human-readable Markdown
#   specs/pr-42.spec.json     — machine-readable JSON
```

### GitHub Action

```yaml
# .github/workflows/pr-to-spec.yml
name: PR to Spec
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: write
  pull-requests: write

jobs:
  generate-spec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate prompt-spec
        id: spec
        uses: jeremylongshore/pr-to-spec@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          INPUT_COMMENT: "true"
          INPUT_FORMAT: "both"

      - uses: actions/upload-artifact@v4
        with:
          name: prompt-spec-pr-${{ github.event.pull_request.number }}
          path: .pr-to-spec/specs/
```

### npm / npx

```bash
npm install -g pr-to-spec
# or
npx pr-to-spec --repo owner/repo --pr 42 --json
```

## CLI Reference

```
Options:
  --repo <owner/name>      GitHub repository (required)
  --pr <number>            Pull request number (required)
  --out <directory>        Output directory (default: ./output)
  --token <token>          GitHub token (or set GITHUB_TOKEN env var)
  --format <format>        Output: yaml, markdown, json, both (default: both)
  --stdout                 Print to stdout instead of files
  --quiet                  Suppress logging, only output the spec (for piping)
  --field <path>           Extract a single field (dot notation)
  --json                   Shorthand for --format json --stdout --quiet
  --comment                Post spec summary as a PR comment
  --ai-enhance             Enhance spec with AI-generated insights
  --ai-provider <provider> AI provider: anthropic, openai (default: anthropic)
  --ai-model <model>       AI model override
  -V, --version            Show version
  -h, --help               Show help
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — PR analyzed, no high-risk flags |
| `1` | Error — invalid input, API failure, etc. |
| `2` | Success — but high-risk changes detected |

## The Prompt-Spec Format

Every spec contains:

| Field | Description |
|-------|-------------|
| `source` | PR metadata (repo, number, author, branches) |
| `intent` | Inferred goal and change type (feature, bugfix, refactor, etc.) |
| `scope` | Affected directories and glob patterns |
| `affected_files` | File list with status and line counts |
| `risk_flags` | Categorized risks with severity (high/medium/low) |
| `constraints` | Rules the change must preserve |
| `acceptance_criteria` | Verification checklist |
| `generation_prompt` | Ready-to-use prompt for reimplementation |
| `decision_prompt` | Ready-to-use prompt for review decisions |
| `semantic_changes` | Extracted function/class/import changes |
| `review_summary` | Reviewer comments and approval status |
| `stats` | Files changed, additions, deletions, commits |

### Sample JSON Spec (truncated)

```json
{
  "version": 1,
  "source": {
    "repo": "owner/repo",
    "pr_number": 42,
    "author": "contributor"
  },
  "intent": {
    "likely_goal": "Add tenant-aware API rate limiting to public routes",
    "change_type": "feature"
  },
  "risk_flags": [
    {
      "category": "security-headers",
      "description": "Changes to middleware (src/middleware/rateLimit.ts)",
      "severity": "medium"
    }
  ],
  "stats": {
    "files_changed": 3,
    "additions": 150,
    "deletions": 10
  }
}
```

## Agent Integration Patterns

### Bash: Automated Risk Gate

```bash
#!/bin/bash
# Block merges on high-risk PRs
pr-to-spec --repo "$REPO" --pr "$PR_NUM" --json > /tmp/spec.json
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo "High-risk PR detected. Routing to senior reviewer."
  jq '.risk_flags[] | select(.severity == "high")' /tmp/spec.json
  exit 1
fi
```

### Claude Code: CLAUDE.md Integration

Add this to your project's `CLAUDE.md`:

```markdown
## PR Review Protocol

When asked to review a PR, use pr-to-spec to generate the spec first:

\`\`\`bash
pr-to-spec --repo owner/repo --pr <number> --json
\`\`\`

Evaluate the spec against these criteria:
1. Do the risk flags indicate areas needing careful review?
2. Does the intent align with the project roadmap?
3. Are the constraints satisfied?
4. Would you approve, request changes, or ask for more info?
```

### GitHub Action Chain: Spec to Another Action

```yaml
- name: Generate spec
  id: spec
  uses: jeremylongshore/pr-to-spec@main
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    INPUT_FORMAT: "json"

- name: Feed to review agent
  run: |
    cat .pr-to-spec/specs/pr-${{ github.event.pull_request.number }}.spec.json \
      | your-review-tool --decide
```

## Risk Classification

Built-in heuristic rules flag changes to:

| Category | Severity | Triggers |
|----------|----------|----------|
| `authentication` | **high** | Auth, login, session, OAuth, JWT files |
| `secrets` | **high** | .env, .key, .pem, credentials files |
| `database` | **high** | Migrations, .sql, schema files |
| `permissions` | **high** | RBAC, ACL, policy files |
| `payment` | **high** | Stripe, billing, subscription files |
| `dependencies` | medium | Lockfiles, package managers |
| `infrastructure` | medium | Docker, Terraform, k8s, deploy configs |
| `destructive-operations` | medium | DROP TABLE, DELETE FROM in patches |
| `security-config` | medium | CORS, CSP, security headers |
| `large-change` | low | 300+ line changes in a single file |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub token with PR read access |
| `ANTHROPIC_API_KEY` | No | For AI-enhanced summaries |
| `OPENAI_API_KEY` | No | Alternative AI provider |

**Classic PAT:** `repo` (private repos) or `public_repo` (public only)
**Fine-grained PAT:** `Pull requests: Read` + `Contents: Read`
**GitHub Action:** Default `GITHUB_TOKEN` works — no additional secrets needed.

## Architecture

```
src/
  cli/            CLI entrypoint (Commander)
  action/         GitHub Action entrypoint
  core/
    schema/       Zod schema for the canonical prompt-spec format
    github/       Octokit-based PR data fetching
    parsing/      Deterministic spec generation from PR metadata
    risk/         Rule-based risk classification heuristics
    rendering/    YAML, Markdown, JSON, and PR comment renderers
    ai/           Optional AI enhancement (Anthropic, OpenAI)
    diff/         Spec version diffing
```

### Design Principles

- **Deterministic first**: Core spec uses heuristics, not LLMs. Reproducible and auditable.
- **No execution**: Never runs code from PRs — metadata and diffs only.
- **Agent-native**: JSON output, clean exit codes, field extraction. Built for piping.
- **Minimal trust surface**: Read-only by default. Zod-validated output.

## Security

See [SECURITY.md](./SECURITY.md) for the full security policy and threat model.

- Never executes PR code
- Treats contributor input as untrusted
- Validates and sanitizes all output
- Minimal dependency tree (4 runtime deps)

## Development

```bash
pnpm install       # Install dependencies
pnpm build         # Compile TypeScript
pnpm test          # Run tests
pnpm lint          # Lint with Biome
pnpm typecheck     # TypeScript strict check
pnpm check         # All of the above
pnpm dev           # Watch mode
```

## License

MIT — see [LICENSE](./LICENSE).
