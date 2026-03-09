# pr-to-prompt

Convert GitHub pull requests into structured, reviewable **prompt-spec** artifacts.

Give any PR to `pr-to-prompt` and get back a canonical specification that a maintainer can use to understand, review, and regenerate the change with their own AI tools.

[![CI](https://github.com/jeremylongshore/pr-to-prompt/actions/workflows/ci.yml/badge.svg)](https://github.com/jeremylongshore/pr-to-prompt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Why

Pull requests are optimized for code review, not for understanding intent. When you want to:

- **Re-implement** a contributor's change in your own style
- **Understand** what a PR is really doing before merging
- **Feed** a structured spec into Claude Code, Copilot, or another AI agent
- **Audit** changes for risk without reading every diff line

...you need a **prompt-spec**, not a raw diff.

## How It Works

```
PR opened → pr-to-prompt analyzes metadata + diffs → generates structured YAML spec
```

1. Fetches PR metadata, files, and diffs via GitHub API
2. **Deterministically** classifies change type, risk flags, and scope (no LLM required)
3. Generates a canonical YAML spec + Markdown summary
4. Optionally posts a compact summary comment on the PR

No AI key needed for core functionality. The spec is built from heuristics and templates.

## Quick Start

### CLI Usage

```bash
# Clone and build
git clone https://github.com/jeremylongshore/pr-to-prompt.git
cd pr-to-prompt
pnpm install
pnpm build

# Generate a spec from any public PR
GITHUB_TOKEN=ghp_your_token node dist/cli/index.js \
  --repo octocat/hello-world \
  --pr 42 \
  --out ./output

# Output:
#   output/pr-42.spec.yaml
#   output/pr-42.summary.md
```

### CLI Options

```
Options:
  --repo <owner/name>   GitHub repository (required)
  --pr <number>         Pull request number (required)
  --out <directory>     Output directory (default: ./output)
  --token <token>       GitHub token (or set GITHUB_TOKEN env var)
  --comment             Post spec summary as a PR comment
  --format <format>     Output: yaml, markdown, both (default: both)
  --stdout              Print to stdout instead of files
  -V, --version         Show version
  -h, --help            Show help
```

### GitHub Action Usage

Add this workflow to any repository:

```yaml
# .github/workflows/pr-to-prompt.yml
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
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Generate spec
        run: node dist/cli/index.js --repo ${{ github.repository }} --pr ${{ github.event.pull_request.number }} --out .pr-to-prompt/specs --comment
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v4
        with:
          name: prompt-spec-pr-${{ github.event.pull_request.number }}
          path: .pr-to-prompt/specs/
```

## Sample Output

### Generated YAML Spec (truncated)

```yaml
version: 1
source:
  repo: octocat/hello-world
  pr_number: 42
  pr_url: https://github.com/octocat/hello-world/pull/42
  base_branch: main
  head_branch: feat/rate-limiting
  author: contributor
title: "feat: add rate limiting middleware"
intent:
  likely_goal: Add tenant-aware API rate limiting to public routes
  change_type: feature
scope:
  include:
    - src/middleware/**
    - src/routes/**
risk_flags:
  - category: security-headers
    description: Changes to middleware (src/middleware/rateLimit.ts)
    severity: medium
acceptance_criteria:
  - Changes apply cleanly to main
  - All existing tests pass
  - Public routes enforce per-tenant rate limits
generation_prompt: |
  Re-implement the following change for the octocat/hello-world repository...
```

See full examples in [`examples/`](./examples/).

### PR Comment Preview

The bot posts a compact, scannable comment:

```
## PR Spec Analysis

**feature** | 3 files | +150/-10

### Summary
Add tenant-aware API rate limiting to public routes

### Affected Files (3)
- `src/middleware/rateLimit.ts` (added, +100/-0)
- `src/routes/api.ts` (modified, +30/-5)
- `tests/rateLimit.test.ts` (added, +20/-5)

### Risk Flags
- 🟡 **medium**: Changes to middleware (src/middleware/rateLimit.ts)

### Acceptance Criteria
- [ ] Changes apply cleanly to main
- [ ] All existing tests pass

📋 Copy-ready prompt spec (expandable)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub token with PR read access |
| `ANTHROPIC_API_KEY` | No | For optional AI-enhanced summaries (v2) |
| `PR_TO_PROMPT_AI_ENHANCE` | No | Enable AI enhancement (`true`/`false`) |

### Token Scopes

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
    rendering/    YAML, Markdown, and PR comment renderers
```

### Design Principles

- **Deterministic first**: Core spec generation uses heuristics, not LLMs
- **No execution**: Never runs code from PRs — metadata and diffs only
- **Minimal trust surface**: Read-only by default, write only for optional PR comments
- **Structured output**: Zod-validated schema ensures consistent, parseable specs

### Risk Classification

Built-in heuristic rules flag changes to:
- Authentication/authorization logic
- Secrets, config, environment files
- Dependencies (package.json, lockfiles)
- Database migrations/schemas
- Infrastructure/deployment configs
- Permission/role/RBAC logic
- Payment/billing paths
- Destructive operations (DROP, DELETE, etc.)
- Large changesets (300+ line changes)

## Security

See [SECURITY.md](./SECURITY.md) for the full security policy and threat model.

Key points:
- Never executes PR code
- Treats contributor input as untrusted
- Validates and sanitizes all output
- Minimal dependency tree
- Token scopes documented and minimized

## Development

```bash
pnpm install       # Install dependencies
pnpm build         # Compile TypeScript
pnpm test          # Run tests (42 tests)
pnpm lint          # Lint with Biome
pnpm typecheck     # TypeScript strict check
pnpm check         # All of the above
pnpm dev           # Watch mode for development
```

## Roadmap

### v1.1
- [ ] Optional AI-enhanced summaries via Anthropic API (behind feature flag)
- [ ] Semantic diff analysis for better intent extraction
- [ ] Support for monorepo scope detection

### v1.2
- [ ] Published npm package (`npx pr-to-prompt`)
- [ ] GitHub Marketplace action
- [ ] Spec versioning and diff between spec versions

### v2
- [ ] GitHub App for zero-config installation
- [ ] Spec storage and browsing UI
- [ ] Team review workflows around specs
- [ ] Integration with Claude Code, Cursor, and other AI tools

## License

MIT — see [LICENSE](./LICENSE).
