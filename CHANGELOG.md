# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
