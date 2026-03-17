# pr-to-spec

**The flight envelope for agentic coding.**

CodeRabbit reviews for humans. `pr-to-spec` converts for agents.

Turn any code change — a GitHub PR, a local branch, staged edits — into a structured, agent-consumable spec with intent drift detection. No MCP server needed. The CLI *is* the API.

[![CI](https://github.com/jeremylongshore/pr-to-spec/actions/workflows/ci.yml/badge.svg)](https://github.com/jeremylongshore/pr-to-spec/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## What It Does

```
declare intent → make changes → pr-to-spec check → agent sees clean/drift/high-risk
```

1. **Declare intent**: Tell `pr-to-spec` what you're building, what scope is allowed, and your risk ceiling
2. **Make changes**: Work normally in your branch
3. **Check drift**: `pr-to-spec check --json` produces a structured spec + drift signals
4. **Agent consumes**: Any agent reads the envelope and acts accordingly

---

## Quick Start

### Local Diff (no GitHub needed)

```bash
# Analyze your current branch vs main
pr-to-spec scan --branch main --json

# Analyze staged changes only
pr-to-spec scan --staged --json

# Analyze last 3 commits
pr-to-spec scan --diff 3 --json
```

### Intent + Drift Detection

```bash
# 1. Declare what this change is supposed to do
pr-to-spec intent set \
  --goal "Add rate limiting to API" \
  --scope "src/middleware/**" \
  --forbid "src/db/**" \
  --max-risk medium \
  --type feature

# 2. After making changes, check for drift
pr-to-spec check --json
# exit 0 = clean, exit 2 = high-risk, exit 3 = drift detected

# Show current intent
pr-to-spec intent show
```

### GitHub PR Analysis

```bash
# Analyze a GitHub PR
pr-to-spec --repo owner/repo --pr 42 --json | your-agent review

# Extract just the risk flags
pr-to-spec --repo owner/repo --pr 42 --json | jq '.spec.risk_flags'

# Feed to Claude for review
pr-to-spec --repo owner/repo --pr 42 --json \
  | claude --print "Review this spec and decide: approve, request changes, or needs info"
```

---

## Agent Protocol

All `--json` output is wrapped in the agent protocol envelope:

```json
{
  "version": 1,
  "command": "check",
  "status": "drift_detected",
  "exit_code": 3,
  "signals": [
    {
      "type": "forbidden_touch",
      "description": "1 forbidden file(s) modified",
      "severity": "high",
      "details": ["src/db/schema.ts"]
    }
  ],
  "spec": { ... },
  "intent": { ... }
}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Clean — no issues |
| `1` | Error |
| `2` | High-risk changes detected |
| `3` | Drift from declared intent |

### Drift Signals

| Signal | Trigger |
|--------|---------|
| `scope_creep` | Files changed outside `expected_scope` |
| `forbidden_touch` | Files matching `forbidden_scope` were modified |
| `risk_escalation` | Detected risk level exceeds `max_risk` |
| `size_overrun` | Total LOC changed exceeds `size_budget` |
| `type_mismatch` | Inferred change type doesn't match `expected_type` |

---

## CLI Reference

### `pr-to-spec` (analyze a GitHub PR)

```
Options:
  --repo <owner/name>      GitHub repository (required)
  --pr <number>            Pull request number (required)
  --out <directory>        Output directory (default: ./output)
  --token <token>          GitHub token (or set GITHUB_TOKEN env var)
  --format <format>        Output: yaml, markdown, json, both (default: both)
  --stdout                 Print to stdout instead of files
  --quiet                  Suppress logging
  --field <path>           Extract a single field (dot notation)
  --json                   Shorthand for --format json --stdout --quiet
  --comment                Post spec summary as a PR comment
  --ai-enhance             Enhance spec with AI-generated insights
  -V, --version            Show version
  -h, --help               Show help
```

### `pr-to-spec scan` (analyze local changes)

```
Options:
  --branch <ref>           Base branch to diff against (default: main)
  --diff <n>               Diff last N commits
  --staged                 Analyze staged changes only
  --out <directory>        Output directory (default: ./output)
  --format <format>        Output: yaml, markdown, json, both
  --stdout                 Print to stdout
  --quiet                  Suppress logging
  --json                   Shorthand for --format json --stdout --quiet
  --field <path>           Extract a single field
```

### `pr-to-spec intent set`

```
Options:
  --goal <text>            What this change is trying to achieve (required)
  --scope <glob...>        Expected file globs (repeatable)
  --forbid <glob...>       Forbidden file globs (repeatable)
  --max-risk <level>       Maximum acceptable risk: low, medium, high
  --type <type>            Expected change type: feature, bugfix, refactor, etc.
  --size-budget <n>        Max total lines changed
  --json                   Output as JSON
```

### `pr-to-spec check`

```
Options:
  --branch <ref>           Base branch to diff against
  --diff <n>               Diff last N commits
  --staged                 Analyze staged changes only
  --quiet                  Suppress logging
  --json                   Output as JSON agent protocol envelope
```

---

## GitHub Action

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

      - name: Generate spec
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

---

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

---

## Architecture

```
src/
  cli/            CLI entrypoints (analyze, scan, intent, check)
  action/         GitHub Action entrypoint
  core/
    schema/       Zod schema for the canonical prompt-spec format
    github/       Octokit-based PR data fetching
    sources/      DiffSource abstraction (GitHub PR, local branch, staged, commits)
    parsing/      Deterministic spec generation from diff metadata
    risk/         Rule-based risk classification heuristics
    intent/       Intent schema and YAML storage (.pr-to-spec/intent.yaml)
    drift/         Drift detection against declared intent
    protocol/     Agent protocol envelope (version, status, exit_code)
    rendering/    YAML, Markdown, JSON, and PR comment renderers
    ai/           Optional AI enhancement (Anthropic, OpenAI)
    diff/         Spec version diffing
```

### Design Principles

- **Deterministic first**: Core spec uses heuristics, not LLMs. Reproducible and auditable.
- **No execution**: Never runs code — metadata and diffs only.
- **Agent-native**: JSON envelope output, clean exit codes, field extraction. Built for piping.
- **Local-first**: Works on local branches and staged changes without GitHub.
- **Minimal trust surface**: Read-only by default. Zod-validated output.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | For GitHub PRs | GitHub token with PR read access |
| `ANTHROPIC_API_KEY` | No | For AI-enhanced summaries |
| `OPENAI_API_KEY` | No | Alternative AI provider |

---

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
