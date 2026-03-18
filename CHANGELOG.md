# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-03-17

### Added
- **Intent DAG**: Graph-based intent tracking with spec fragments, decision taxonomy, and propagation engine
- `graph` subcommand — query ancestors/descendants, compute impact, view graph stats
- `contract` subcommand — declarative contract verification (no_new_dependencies, no_file_outside_scope, max_files_changed, no_pattern_in_diff, require_pattern_in_diff, no_new_exports, custom_command)
- `intent approve` / `intent lock` — approval workflow (draft → approved → locked)
- `intent gate` — evaluate gate policy (min_confidence, require_no_stale, require_no_must_ask)
- Graph materialization — gate and contract results become audit trail nodes
- Feedback ingestion — learn from reviews to improve future classifications
- 364 tests (84 new tests for Intent DAG)

### Changed
- Contract evaluator: smarter `no_new_dependencies` detection (lock files vs manifest files)
- Protocol envelope: `gate_failed` status with exit code 4
- `check` subcommand: integrated contract evaluation and gate checks

## [0.6.0] - 2026-03-17

### Changed
- **Renamed**: `pr-to-prompt` → `pr-to-spec`
- **Positioning**: "The flight envelope for agentic coding"

### Added
- `DiffSource` abstraction — works on any diff (local branches, staged changes, GitHub PRs)
- `scan` subcommand — analyze local git changes without GitHub
- `intent` subcommand — declare expected scope, risk ceiling, change type
- `check` subcommand — scan + drift detection against declared intent
- Drift signals: `scope_creep`, `forbidden_touch`, `risk_escalation`, `size_overrun`, `type_mismatch`
- Agent protocol envelope wraps all `--json` output
- Claude Code skill manifest (`.claude/skills/pr-to-spec/SKILL.md`)

### Backwards Compatible
- `pr-to-spec --repo owner/repo --pr 42 --json` still works unchanged

## [0.5.0] - 2026-03-09

### Added
- JSON output format with `--format json` for agent-friendly piping (#7)
- Bash-friendly CLI flags: `--quiet`, `--field <path>`, `--json` shorthand (#8)
- Exit code semantics: 0=success, 1=error, 2=high-risk PR detected (#8)
- `decision_prompt` field in spec for agent-driven review decisions (#12)
- Webhook notifications via `webhook_url` input in GitHub Action (#11)
- Example integrations: `claude-code.md`, `bash-agent.sh`, `github-action-chain.yml` (#10)

### Changed
- README rewritten with agent-first positioning and piping examples (#9)

## [0.4.0] - 2026-03-09

### Added
- Review parsing with `parseReviews()` for aggregated review summaries
- Monorepo detection with `detectMonorepo()` for workspace-aware specs
- Semantic diff analysis with `analyzeSemanticDiff()` for change categorization
- Spec diffing with `diffSpecs()` for comparing spec versions
- Review comments integration in PR data and rendered outputs

## [0.3.0] - 2026-03-09

### Added
- GitHub Marketplace release as official Action
- Action bundle with `@vercel/ncc` for single-file distribution

## [0.2.0] - 2026-03-09

### Added
- AI enhancement with `--ai-enhance` flag (Anthropic/OpenAI support)
- Compact spec output via `compactSpec()` for smaller payloads
- GitHub Action for automated PR spec generation

## [0.1.0] - 2026-03-09

### Added
- Initial release
- Core PR parsing with `generateSpec()`
- Risk classification with severity levels
- YAML and Markdown rendering
- PR comment posting via `--comment` flag
- GitHub API client with Octokit
